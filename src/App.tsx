import React, { useState, useEffect, useRef } from "react";
import {
  CefrLevel,
  GameMode,
  BotDifficulty,
  GameRoom,
  Player,
  PlayerStats,
  QuestionDefinition,
} from "./types/game";
import { Board } from "./components/Board";
import { QuestionPanel } from "./components/QuestionPanel";
import { HUD } from "./components/HUD";
import { ResolutionModal } from "./components/ResolutionModal";
import { MatchSummary } from "./components/MatchSummary";
import { HowToPlayModal } from "./components/HowToPlayModal";
import { LeaderboardModal } from "./components/LeaderboardModal";
import { StatsModal } from "./components/StatsModal";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { PWAInstallButton } from "./components/PWAInstallButton";
import { BotSimulator } from "./game/bot";
import {
  resolveStandardRound,
  resolveRescue,
  canActivateDuel,
  resolveDuel,
  evaluateMatchWinner,
  toPublicQuestion,
  isAnswerCorrect,
  STANDARD_QUESTION_DURATION_MS,
  RESCUE_QUESTION_DURATION_MS,
  DUEL_QUESTION_DURATION_MS,
  TIEBREAK_QUESTION_DURATION_MS,
  MAX_MATCH_ROUNDS,
  META_CELL,
} from "./game/rules";
import {
  Play,
  Bot,
  Users,
  Trophy,
  Zap,
  HelpCircle,
  BarChart2,
  Copy,
  Check,
  RotateCcw,
  BookOpen,
  Sparkles,
  Wifi,
  ChevronRight,
} from "lucide-react";
import { ArrowRight, Swords, Shield } from "lucide-react";
import questionsData from "./data/questions.json";

const allQuestions = questionsData as QuestionDefinition[];

export default function App() {
  const [darkMenu, setDarkMenu] = useState(() => {
    try {
      return localStorage.getItem("aql-snake-menu") === "dark";
    } catch {
      return false;
    }
  });
  const toggleMenu = () =>
    setDarkMenu((previous) => {
      const next = !previous;
      try {
        localStorage.setItem("aql-snake-menu", next ? "dark" : "light");
      } catch {}
      return next;
    });
  // Navigation / View State
  const [view, setView] = useState<"home" | "lobby" | "match" | "summary">(
    "home",
  );
  const [selectedMode, setSelectedMode] = useState<GameMode>("bot");
  const [selectedLevel, setSelectedLevel] = useState<CefrLevel>("B1");
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("medium");
  const [adaptiveAssist, setAdaptiveAssist] = useState<boolean>(true);

  // Modals
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [showStats, setShowStats] = useState<boolean>(false);

  // Player Identity
  const [playerId] = useState<string>(() => {
    const saved = localStorage.getItem("snake_race_player_id");
    if (saved) return saved;
    const newId = `player_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem("snake_race_player_id", newId);
    return newId;
  });

  const [playerName, setPlayerName] = useState<string>(() => {
    return localStorage.getItem("snake_race_player_name") || "Runner";
  });

  // Career Statistics
  const [careerStats, setCareerStats] = useState<PlayerStats>(() => {
    const saved = localStorage.getItem("snake_race_stats");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      abandonments: 0,
      accuracyPercent: 0,
      avgResponseTimeMs: 4000,
      bestStreak: 0,
      currentStreak: 0,
      ratingByLevel: {
        A1: 1000,
        A2: 1000,
        B1: 1000,
        B2: 1000,
        C1: 1000,
        C2: 1000,
      },
      speedrunBestTimes: {
        A1: null,
        A2: null,
        B1: null,
        B2: null,
        C1: null,
        C2: null,
      },
    };
  });

  // Active Match Room
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isAnswerLocked, setIsAnswerLocked] = useState<boolean>(false);
  const [userSubmittedAnswer, setUserSubmittedAnswer] = useState<
    string | undefined
  >(undefined);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [roomCodeInput, setRoomCodeInput] = useState<string>("");
  const [isSearchingMatch, setIsSearchingMatch] = useState<boolean>(false);

  // Bot Simulator instance
  const botSimRef = useRef<BotSimulator>(new BotSimulator());

  // WebSocket reference
  const wsRef = useRef<WebSocket | null>(null);
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);

  // Initialize or connect WebSocket when multiplayer is chosen
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    function connectWs() {
      try {
        const socket = new WebSocket(wsUrl);
        socket.onopen = () => setIsWsConnected(true);
        socket.onclose = () => setIsWsConnected(false);
        socket.onerror = () => setIsWsConnected(false);

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleWsMessage(data);
          } catch (e) {
            console.error("WS parse error", e);
          }
        };

        wsRef.current = socket;
      } catch (err) {
        console.warn("Could not establish WebSocket; offline mode ready.", err);
      }
    }

    connectWs();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Handle incoming server events for PvP
  const handleWsMessage = (data: {
    event: string;
    room?: GameRoom;
    [key: string]: any;
  }) => {
    const { event, room: serverRoom } = data;

    if (serverRoom) {
      setRoom(serverRoom);
    }

    switch (event) {
      case "room:snapshot":
        if (serverRoom?.state === "LOBBY") {
          setView("lobby");
        } else if (serverRoom?.state === "FINISHED") {
          setView("summary");
        } else if (
          serverRoom?.state === "QUESTION_ACTIVE" ||
          serverRoom?.state === "COUNTDOWN"
        ) {
          setView("match");
        }
        break;

      case "question:opened":
        setIsAnswerLocked(false);
        setUserSubmittedAnswer(undefined);
        setView("match");
        break;

      case "match:finished":
        setView("summary");
        break;
    }
  };

  // Match Timer interval
  useEffect(() => {
    let timer: any = null;
    if (view === "match" && room && room.state !== "FINISHED") {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [view, room?.state]);

  // Save Player Name
  const handleNameChange = (name: string) => {
    setPlayerName(name);
    localStorage.setItem("snake_race_player_name", name);
  };

  // Helper: Get random question for local mode
  const getLocalRandomQuestion = (
    level: CefrLevel,
    excludeIds: string[] = [],
  ): QuestionDefinition => {
    const pool = allQuestions.filter(
      (q) => q.level === level && !excludeIds.includes(q.id),
    );
    if (pool.length === 0) {
      const fallback = allQuestions.filter((q) => q.level === level);
      return fallback[Math.floor(Math.random() * fallback.length)];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  };

  // ----------------------------------------------------
  // Local Game Engine (Bot Practice & Speedrun Solo)
  // ----------------------------------------------------
  const startLocalMatch = (
    mode: GameMode,
    level: CefrLevel,
    difficulty: BotDifficulty,
  ) => {
    const human: Player = {
      id: playerId,
      name: playerName || "Player",
      avatar: "snake",
      color: "#06b6d4",
      position: 0,
      previousPosition: 0,
      isReady: true,
      isConnected: true,
      rating: careerStats.ratingByLevel[level] || 1000,
      stats: {
        correctCount: 0,
        totalAnswers: 0,
        accumulatedCorrectTimeMs: 0,
        boostsTriggered: 0,
        trapsFallen: 0,
        rescuesSucceeded: 0,
        duelsWon: 0,
      },
    };

    const players: Player[] = [human];

    if (mode === "bot") {
      const botPlayer: Player = {
        id: "bot_opponent",
        name: `Bot (${difficulty.toUpperCase()})`,
        avatar: "robot",
        color: "#ec4899",
        position: 0,
        previousPosition: 0,
        isReady: true,
        isConnected: true,
        isBot: true,
        stats: {
          correctCount: 0,
          totalAnswers: 0,
          accumulatedCorrectTimeMs: 0,
          boostsTriggered: 0,
          trapsFallen: 0,
          rescuesSucceeded: 0,
          duelsWon: 0,
        },
      };
      players.push(botPlayer);
    }

    const firstQ = getLocalRandomQuestion(level);
    const now = Date.now();

    const localRoom: GameRoom = {
      id: `local_${Date.now()}`,
      code: "LOCAL",
      mode,
      level,
      botDifficulty: difficulty,
      adaptiveBotAssist: adaptiveAssist,
      state: "QUESTION_ACTIVE",
      roundNumber: 1,
      maxRounds: MAX_MATCH_ROUNDS,
      players,
      activeQuestion: firstQ,
      publicActiveQuestion: toPublicQuestion(firstQ),
      roundStartsAt: now,
      roundDeadlineAt: now + STANDARD_QUESTION_DURATION_MS,
      usedDuelCells: [],
      history: [],
      speedrunStartTime: now,
    };

    setRoom(localRoom);
    setElapsedSeconds(0);
    setIsAnswerLocked(false);
    setUserSubmittedAnswer(undefined);
    setView("match");

    // If bot mode, schedule bot decision
    if (mode === "bot") {
      scheduleLocalBotDecision(localRoom, firstQ);
    }

    // Schedule round closure
    scheduleLocalRoundTimeout(localRoom, 1);
  };

  const scheduleLocalBotDecision = (
    currentRoom: GameRoom,
    q: QuestionDefinition,
  ) => {
    const bot = currentRoom.players.find((p) => p.isBot);
    const human = currentRoom.players.find((p) => !p.isBot);
    if (!bot) return;

    const botDecision = botSimRef.current.planDecision(
      q,
      currentRoom.botDifficulty,
      STANDARD_QUESTION_DURATION_MS,
      human?.position,
      bot.position,
      currentRoom.adaptiveBotAssist,
    );

    setTimeout(() => {
      bot.currentAnswer = {
        rawAnswer: botDecision.answerText,
        optionId: botDecision.optionId,
        receivedAt: Date.now(),
        responseTimeMs: botDecision.responseTimeMs,
        isCorrect: botDecision.isCorrect,
      };
    }, botDecision.responseTimeMs);
  };

  const scheduleLocalRoundTimeout = (
    currentRoom: GameRoom,
    roundNum: number,
  ) => {
    setTimeout(() => {
      setRoom((prev) => {
        if (
          !prev ||
          prev.state !== "QUESTION_ACTIVE" ||
          prev.roundNumber !== roundNum
        )
          return prev;
        return resolveLocalRound(prev);
      });
    }, STANDARD_QUESTION_DURATION_MS);
  };

  const resolveLocalRound = (r: GameRoom): GameRoom => {
    const updated = { ...r, state: "ROUND_RESOLUTION" as const };
    const activeQ = updated.activeQuestion!;

    // 1. Process human & bot answers
    updated.players.forEach((p) => {
      if (p.currentAnswer) {
        p.currentAnswer.isCorrect = isAnswerCorrect(
          activeQ,
          p.currentAnswer.rawAnswer,
          p.currentAnswer.optionId,
        );
        if (p.currentAnswer.isCorrect) {
          p.stats.correctCount++;
          p.stats.accumulatedCorrectTimeMs += p.currentAnswer.responseTimeMs;
        }
      } else {
        // Timeout
        p.currentAnswer = {
          rawAnswer: "",
          receivedAt: updated.roundDeadlineAt,
          responseTimeMs: STANDARD_QUESTION_DURATION_MS,
          isCorrect: false,
          movement: 0,
        };
      }
      p.stats.totalAnswers++;
    });

    // 2. Resolve movements & boosts
    const resolutions = resolveStandardRound(
      updated.players,
      STANDARD_QUESTION_DURATION_MS,
    );
    resolutions.forEach((res) => {
      const p = updated.players.find((player) => player.id === res.playerId)!;
      p.position = res.positionAfterBoost;
      if (res.boostApplied) p.stats.boostsTriggered++;
      if (res.trapTriggered) p.stats.trapsFallen++;

      // Record to match history
      updated.history.push({
        roundNumber: updated.roundNumber,
        question: activeQ,
        playerAnswer: p.currentAnswer?.rawAnswer || "(Timeout)",
        isCorrect: Boolean(p.currentAnswer?.isCorrect),
        responseTimeMs:
          p.currentAnswer?.responseTimeMs || STANDARD_QUESTION_DURATION_MS,
        movementAwarded: res.baseMovement + res.boostMovement,
        specialEvent: res.boostApplied ? "boost" : undefined,
      });
    });

    // Check victory
    const winCheck = evaluateMatchWinner(
      updated.players[0],
      updated.players[1],
    );
    if (winCheck.isFinished) {
      return finishLocalMatch(
        updated,
        winCheck.reason || "meta_reached",
        winCheck.winnerId,
      );
    }

    // Check for trap rescues
    const trapped = resolutions.filter((res) => res.trapTriggered);
    if (trapped.length > 0) {
      return triggerLocalTraps(updated, trapped);
    }

    // Check for duel
    if (updated.players.length === 2) {
      const pA = updated.players[0];
      const pB = updated.players[1];
      const resA = resolutions.find((res) => res.playerId === pA.id)!;
      const resB = resolutions.find((res) => res.playerId === pB.id)!;
      const duelCell = pA.position;
      const landedA =
        resA.landedPosition === duelCell && pA.previousPosition !== duelCell;
      const landedB =
        resB.landedPosition === duelCell && pB.previousPosition !== duelCell;

      if (
        canActivateDuel(
          pA,
          pB,
          duelCell,
          updated.usedDuelCells,
          landedA,
          landedB,
          pA.previousPosition === duelCell,
          pB.previousPosition === duelCell,
        )
      ) {
        return triggerLocalDuel(updated, duelCell);
      }
    }

    // Show synchronized educational feedback
    return triggerLocalFeedback(updated);
  };

  const triggerLocalTraps = (
    r: GameRoom,
    trapped: ReturnType<typeof resolveStandardRound>,
  ): GameRoom => {
    const updated = { ...r, state: "RESCUE_ACTIVE" as const };
    const rescueQ = getLocalRandomQuestion(r.level);
    updated.rescueQuestion = rescueQ;
    updated.publicRescueQuestion = toPublicQuestion(rescueQ);

    const now = Date.now();
    updated.roundStartsAt = now;
    updated.roundDeadlineAt = now + RESCUE_QUESTION_DURATION_MS;

    setIsAnswerLocked(false);
    setUserSubmittedAnswer(undefined);

    // If bot was trapped, plan its rescue answer
    const bot = updated.players.find((p) => p.isBot);
    if (bot && trapped.some((t) => t.playerId === bot.id)) {
      const botDec = botSimRef.current.planDecision(
        rescueQ,
        updated.botDifficulty,
        RESCUE_QUESTION_DURATION_MS,
      );
      setTimeout(() => {
        bot.rescueAnswer = {
          rawAnswer: botDec.answerText,
          optionId: botDec.optionId,
          receivedAt: Date.now(),
          responseTimeMs: botDec.responseTimeMs,
          isCorrect: botDec.isCorrect,
        };
      }, botDec.responseTimeMs);
    }

    setTimeout(() => {
      setRoom((prev) => {
        if (!prev || prev.state !== "RESCUE_ACTIVE") return prev;
        trapped.forEach((t) => {
          const p = prev.players.find((player) => player.id === t.playerId)!;
          const ans = p.rescueAnswer;
          const isCorrect = Boolean(
            ans &&
            isAnswerCorrect(prev.rescueQuestion!, ans.rawAnswer, ans.optionId),
          );
          const rescueOutcome = resolveRescue(p.position, isCorrect);
          p.position = rescueOutcome.finalPosition;
          if (isCorrect) p.stats.rescuesSucceeded++;
        });

        const winCheck = evaluateMatchWinner(prev.players[0], prev.players[1]);
        if (winCheck.isFinished) {
          return finishLocalMatch(
            prev,
            winCheck.reason || "meta_reached",
            winCheck.winnerId,
          );
        }
        return triggerLocalFeedback(prev);
      });
    }, RESCUE_QUESTION_DURATION_MS);

    return updated;
  };

  const triggerLocalDuel = (r: GameRoom, duelCell: number): GameRoom => {
    const updated = { ...r, state: "DUEL_ACTIVE" as const };
    updated.usedDuelCells.push(duelCell);
    const duelQ = getLocalRandomQuestion(r.level);
    updated.duelQuestion = duelQ;
    updated.publicDuelQuestion = toPublicQuestion(duelQ);

    const now = Date.now();
    updated.roundStartsAt = now;
    updated.roundDeadlineAt = now + DUEL_QUESTION_DURATION_MS;

    setIsAnswerLocked(false);
    setUserSubmittedAnswer(undefined);

    const bot = updated.players.find((p) => p.isBot);
    if (bot) {
      const botDec = botSimRef.current.planDecision(
        duelQ,
        updated.botDifficulty,
        DUEL_QUESTION_DURATION_MS,
      );
      setTimeout(() => {
        bot.duelAnswer = {
          rawAnswer: botDec.answerText,
          optionId: botDec.optionId,
          receivedAt: Date.now(),
          responseTimeMs: botDec.responseTimeMs,
          isCorrect: botDec.isCorrect,
        };
      }, botDec.responseTimeMs);
    }

    setTimeout(() => {
      setRoom((prev) => {
        if (!prev || prev.state !== "DUEL_ACTIVE") return prev;
        const pA = prev.players[0];
        const pB = prev.players[1];
        [pA, pB].forEach((p) => {
          if (p.duelAnswer) {
            p.duelAnswer.isCorrect = isAnswerCorrect(
              prev.duelQuestion!,
              p.duelAnswer.rawAnswer,
              p.duelAnswer.optionId,
            );
          }
        });

        const outcome = resolveDuel(pA, pB);
        if (outcome.rewardMap[pA.id]) {
          pA.position = Math.min(
            META_CELL,
            pA.position + outcome.rewardMap[pA.id],
          );
          pA.stats.duelsWon++;
        }
        if (outcome.rewardMap[pB.id]) {
          pB.position = Math.min(
            META_CELL,
            pB.position + outcome.rewardMap[pB.id],
          );
          pB.stats.duelsWon++;
        }

        const winCheck = evaluateMatchWinner(pA, pB);
        if (winCheck.isFinished) {
          return finishLocalMatch(
            prev,
            winCheck.reason || "meta_reached",
            winCheck.winnerId,
          );
        }
        return triggerLocalFeedback(prev);
      });
    }, DUEL_QUESTION_DURATION_MS);

    return updated;
  };

  const triggerLocalFeedback = (r: GameRoom): GameRoom => {
    const updated = { ...r, state: "FEEDBACK" as const };

    setTimeout(() => {
      setRoom((prev) => {
        if (!prev || prev.state !== "FEEDBACK") return prev;
        return advanceLocalToNextRound(prev);
      });
    }, 2500);

    return updated;
  };

  const advanceLocalToNextRound = (r: GameRoom): GameRoom => {
    const nextRoundNum = r.roundNumber + 1;
    if (nextRoundNum > r.maxRounds) {
      return finishLocalMatch(r, "round_limit");
    }

    r.players.forEach((p) => {
      p.currentAnswer = undefined;
      p.rescueAnswer = undefined;
      p.duelAnswer = undefined;
      p.previousPosition = p.position;
    });

    const usedIds = r.history.map((h) => h.question.id);
    const nextQ = getLocalRandomQuestion(r.level, usedIds);
    const now = Date.now();

    const updated: GameRoom = {
      ...r,
      roundNumber: nextRoundNum,
      state: "QUESTION_ACTIVE",
      activeQuestion: nextQ,
      publicActiveQuestion: toPublicQuestion(nextQ),
      roundStartsAt: now,
      roundDeadlineAt: now + STANDARD_QUESTION_DURATION_MS,
    };

    setIsAnswerLocked(false);
    setUserSubmittedAnswer(undefined);

    if (updated.mode === "bot") {
      scheduleLocalBotDecision(updated, nextQ);
    }
    scheduleLocalRoundTimeout(updated, nextRoundNum);

    return updated;
  };

  const finishLocalMatch = (
    r: GameRoom,
    reason:
      "meta_reached" | "round_limit" | "abandonment" | "speedrun_complete",
    winnerId?: string | null,
  ): GameRoom => {
    const updated: GameRoom = {
      ...r,
      state: "FINISHED",
      finishReason: reason,
      winnerId:
        winnerId !== undefined
          ? winnerId
          : r.players[0].position >= META_CELL
            ? r.players[0].id
            : null,
      speedrunFinishTime: Date.now(),
    };

    // Update career stats
    const human =
      updated.players.find((p) => p.id === playerId) || updated.players[0];
    const won = updated.winnerId === human.id;
    const isTie = updated.winnerId === null;

    setCareerStats((prev) => {
      const totalAnswers =
        prev.accuracyPercent * prev.gamesPlayed + human.stats.correctCount;
      const games = prev.gamesPlayed + 1;
      const nextStreak = won ? prev.currentStreak + 1 : 0;
      const bestStreak = Math.max(prev.bestStreak, nextStreak);

      const updatedStats: PlayerStats = {
        ...prev,
        gamesPlayed: games,
        wins: won ? prev.wins + 1 : prev.wins,
        losses: !won && !isTie ? prev.losses + 1 : prev.losses,
        ties: isTie ? prev.ties + 1 : prev.ties,
        accuracyPercent:
          human.stats.totalAnswers > 0
            ? Math.round(
                (human.stats.correctCount / human.stats.totalAnswers) * 100,
              )
            : prev.accuracyPercent,
        avgResponseTimeMs:
          human.stats.correctCount > 0
            ? Math.round(
                human.stats.accumulatedCorrectTimeMs / human.stats.correctCount,
              )
            : prev.avgResponseTimeMs,
        currentStreak: nextStreak,
        bestStreak,
      };

      localStorage.setItem("snake_race_stats", JSON.stringify(updatedStats));
      return updatedStats;
    });

    setView("summary");
    return updated;
  };

  // ----------------------------------------------------
  // Submit Answer Handlers (Local and Online)
  // ----------------------------------------------------
  const handleAnswerSubmit = (rawAnswer: string, optionId?: string) => {
    if (!room || isAnswerLocked) return;

    setIsAnswerLocked(true);
    setUserSubmittedAnswer(rawAnswer);

    const serverNow = Date.now();
    const responseTime = Math.max(0, serverNow - room.roundStartsAt);

    // If online WebSocket match:
    if (
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN &&
      room.code !== "LOCAL"
    ) {
      wsRef.current.send(
        JSON.stringify({
          event: "answer:submit",
          payload: { rawAnswer, optionId },
        }),
      );
      return;
    }

    // Local mode answer record
    setRoom((prev) => {
      if (!prev) return prev;
      const human =
        prev.players.find((p) => p.id === playerId) || prev.players[0];

      if (prev.state === "QUESTION_ACTIVE") {
        human.currentAnswer = {
          rawAnswer,
          optionId,
          receivedAt: serverNow,
          responseTimeMs: responseTime,
        };
      } else if (prev.state === "RESCUE_ACTIVE") {
        human.rescueAnswer = {
          rawAnswer,
          optionId,
          receivedAt: serverNow,
          responseTimeMs: responseTime,
        };
      } else if (prev.state === "DUEL_ACTIVE") {
        human.duelAnswer = {
          rawAnswer,
          optionId,
          receivedAt: serverNow,
          responseTimeMs: responseTime,
        };
      }

      return { ...prev };
    });
  };

  // ----------------------------------------------------
  // Multiplayer Room Creation & Matchmaking
  // ----------------------------------------------------
  const handleCreateOnlineRoom = (mode: GameMode, level: CefrLevel) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert("Servidor multijugador no conectado. Iniciando práctica local.");
      startLocalMatch("bot", level, botDifficulty);
      return;
    }

    wsRef.current.send(
      JSON.stringify({
        event: "room:create",
        payload: {
          mode,
          level,
          player: {
            id: playerId,
            name: playerName || "Runner",
            avatar: "snake",
            color: "#06b6d4",
          },
        },
      }),
    );
  };

  const handleJoinOnlineRoom = (code: string) => {
    if (!code.trim()) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert("Sin conexión con el servidor.");
      return;
    }

    wsRef.current.send(
      JSON.stringify({
        event: "room:join",
        payload: {
          code: code.trim().toUpperCase(),
          player: {
            id: playerId,
            name: playerName || "Runner",
            avatar: "snake",
            color: "#ec4899",
          },
        },
      }),
    );
  };

  const handleToggleReady = () => {
    if (!wsRef.current || !room) return;
    const currentReady = room.players.find((p) => p.id === playerId)?.isReady;
    wsRef.current.send(
      JSON.stringify({
        event: "player:ready",
        payload: { isReady: !currentReady },
      }),
    );
  };

  const handleCopyRoomCode = () => {
    if (!room?.code) return;
    navigator.clipboard.writeText(room.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const levels: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

  return (
    <div className="snake-app">
      <header className={"adventure-topbar " + (darkMenu ? "dark" : "")}>
        <a
          className="adventure-logo"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (view === "home" || window.confirm("¿Volver al inicio?"))
              setView("home");
          }}
        >
          <img src="/art/warlock.webp" alt="" />
          <span>
            aque<b>lingua</b>
            <small>APRENDE JUGANDO</small>
          </span>
        </a>
        <nav aria-label="Navegación del juego">
          <button onClick={() => setShowHowToPlay(true)}>Cómo jugar</button>
          <button onClick={() => setShowLeaderboard(true)}>Récords</button>
          <button onClick={() => setShowStats(true)}>Estadísticas</button>
          <button
            onClick={toggleMenu}
            aria-label={darkMenu ? "Activar menú claro" : "Activar menú oscuro"}
          >
            {darkMenu ? "☀" : "☾"}
          </button>
        </nav>
      </header>
      {/* Offline Indicator floating toast */}
      <OfflineIndicator />

      {/* Main Container */}
      <main className={"adventure-main view-" + view}>
        {/* ========================================================= */}
        {/* VIEW: HOME (Lobby selection & setup) */}
        {/* ========================================================= */}
        {view === "home" && (
          <div className="race-home">
            <section className="race-hero">
              <span className="hero-label">TU AVENTURA · A1–C2</span>
              <h1>
                Tu inglés avanza.
                <br />
                <em>La aventura empieza.</em>
              </h1>
              <p>
                Recorre el valle, supera los retos y llega a la meta con cada
                palabra que aprendes.
              </p>
              <div className="hero-scene">
                <img
                  className="hero-mentor"
                  src="/art/warlock.webp"
                  alt="Warlock, tu mentor de inglés"
                />
                <div className="hero-callout">
                  <strong>Snake Word Race</strong>
                  <span>30 casillas · Sin dados · Tu inglés te mueve</span>
                </div>
              </div>
              <div className="home-features">
                <span>
                  <Zap />
                  Impulsos
                </span>
                <span>
                  <Shield />
                  Rescates
                </span>
                <span>
                  <Swords />
                  Duelos
                </span>
              </div>
            </section>
            <section className="race-setup">
              <header>
                <span className="eyebrow">PREPARA TU CARRERA</span>
                <h2>¿Listo para jugar?</h2>
                <p>Elige tu nivel y tu forma de aprender.</p>
              </header>
              <label className="field-label" htmlFor="player-name">
                Tu nombre
              </label>
              <input
                id="player-name"
                maxLength={20}
                value={playerName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="¿Cómo te llamas?"
              />
              <fieldset className="level-picker">
                <legend>Tu nivel de inglés</legend>
                {levels.map((l) => (
                  <button
                    key={l}
                    aria-pressed={selectedLevel === l}
                    className={selectedLevel === l ? "selected" : ""}
                    onClick={() => setSelectedLevel(l)}
                  >
                    {l}
                  </button>
                ))}
              </fieldset>
              <fieldset className="mode-picker">
                <legend>Elige la experiencia</legend>
                {(
                  [
                    {
                      id: "bot",
                      title: "Contra el bot",
                      desc: "Practica solo, también sin conexión.",
                      Icon: Bot,
                    },
                    {
                      id: "casual",
                      title: "Con un amigo",
                      desc: "Crea una sala o entra con su código.",
                      Icon: Users,
                    },
                    {
                      id: "ranked",
                      title: "Competitivo",
                      desc: "Pon a prueba tu nivel en partidas Elo.",
                      Icon: Trophy,
                    },
                    {
                      id: "speedrun",
                      title: "Contrarreloj",
                      desc: "Llega a la meta con precisión.",
                      Icon: Zap,
                    },
                  ] as const
                ).map(({ id, title, desc, Icon }) => (
                  <button
                    key={id}
                    className={
                      "mode-option " + (selectedMode === id ? "selected" : "")
                    }
                    aria-pressed={selectedMode === id}
                    onClick={() => setSelectedMode(id)}
                  >
                    <Icon />
                    <span>
                      <strong>{title}</strong>
                      <small>{desc}</small>
                    </span>
                    <span className="radio-dot" />
                  </button>
                ))}
              </fieldset>
              {selectedMode === "bot" && (
                <div className="bot-options">
                  <label>
                    Dificultad
                    <select
                      value={botDifficulty}
                      onChange={(e) =>
                        setBotDifficulty(e.target.value as BotDifficulty)
                      }
                    >
                      <option value="easy">Tranquilo</option>
                      <option value="medium">Equilibrado</option>
                      <option value="hard">Experto</option>
                    </select>
                  </label>
                  <label className="assist">
                    <input
                      type="checkbox"
                      checked={adaptiveAssist}
                      onChange={(e) => setAdaptiveAssist(e.target.checked)}
                    />
                    Ayuda adaptativa
                  </label>
                </div>
              )}
              {selectedMode === "casual" && (
                <div className="join-options">
                  <input
                    aria-label="Código de sala"
                    placeholder="Código de tu amigo"
                    maxLength={6}
                    value={roomCodeInput}
                    onChange={(e) =>
                      setRoomCodeInput(e.target.value.toUpperCase())
                    }
                  />
                  <button
                    onClick={() => handleJoinOnlineRoom(roomCodeInput)}
                    disabled={roomCodeInput.trim().length !== 6}
                  >
                    Unirme
                  </button>
                </div>
              )}
              <button
                className="launch-button"
                onClick={() => {
                  if (selectedMode === "bot" || selectedMode === "speedrun")
                    startLocalMatch(selectedMode, selectedLevel, botDifficulty);
                  else handleCreateOnlineRoom(selectedMode, selectedLevel);
                }}
              >
                <Play size={18} />
                {selectedMode === "bot"
                  ? "Empezar aventura"
                  : selectedMode === "speedrun"
                    ? "Iniciar contrarreloj"
                    : "Crear sala multijugador"}
                <ArrowRight size={18} />
              </button>
              <p className="setup-note">
                Cada respuesta cuenta. Aprende, compite y vuelve a intentarlo.
              </p>
            </section>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW: LOBBY (Waiting room for multiplayer matches) */}
        {/* ========================================================= */}
        {view === "lobby" && room && (
          <div className="w-full max-w-md mx-auto select-none game-surface border game-border rounded-2xl p-5 shadow-2xl space-y-4 animate-fadeIn">
            <div className="text-center space-y-1">
              <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest">
                Sala de Espera
              </span>
              <h2 className="text-xl font-black game-text">
                Código de la Sala
              </h2>
              {/* Copyable code */}
              <div className="flex items-center justify-center gap-2 pt-1">
                <span className="font-mono text-2xl font-black text-amber-400 tracking-widest game-page px-4 py-1.5 rounded-xl border game-border">
                  {room.code}
                </span>
                <button
                  onClick={handleCopyRoomCode}
                  className="p-2 game-soft game-hover game-text rounded-xl transition"
                  title="Copiar código"
                >
                  {copiedCode ? (
                    <Check className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Players list */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold game-muted uppercase tracking-wider block">
                Jugadores en la sala ({room.players.length}/2)
              </span>

              {room.players.map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between game-page p-3 rounded-xl border game-border"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs game-text"
                      style={{ backgroundColor: p.color || "#6366f1" }}
                    >
                      {p.name.slice(0, 1)}
                    </div>
                    <div>
                      <span className="font-bold text-sm game-text block">
                        {p.name}
                      </span>
                      <span className="text-[10px] game-muted">
                        {p.id === playerId ? "(Tú)" : "Oponente"}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      p.isReady
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                        : "game-soft game-muted"
                    }`}
                  >
                    {p.isReady ? "Listo" : "Esperando"}
                  </span>
                </div>
              ))}

              {room.players.length < 2 && (
                <div className="p-4 rounded-xl border border-dashed game-border text-center text-xs game-muted">
                  Esperando a que el segundo participante ingrese el código...
                </div>
              )}
            </div>

            {/* Ready & Start Button */}
            <div className="pt-2 flex gap-2">
              <button
                onClick={handleToggleReady}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 game-text font-bold text-xs rounded-xl shadow-lg transition"
              >
                {room.players.find((p) => p.id === playerId)?.isReady
                  ? "Cancelar Listo"
                  : "Marcar como Listo"}
              </button>

              <button
                onClick={() => setView("home")}
                className="py-3 px-4 game-soft game-hover game-muted game-hover-text text-xs font-bold rounded-xl transition"
              >
                Salir
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW: MATCH (Active Race) */}
        {/* ========================================================= */}
        {view === "match" && room && (
          <div className="race-match">
            {/* Top HUD */}
            <HUD
              mode={room.mode}
              level={room.level}
              roundNumber={room.roundNumber}
              maxRounds={room.maxRounds}
              elapsedSeconds={elapsedSeconds}
              onLeaveMatch={() => setView("home")}
              isConnected={room.code === "LOCAL" || isWsConnected}
            />

            {/* Serpentine Board */}
            <Board players={room.players} activePlayerId={playerId} />

            <aside className="race-challenge" aria-label="Reto de inglés">
              <section
                className="race-scoreboard"
                aria-label="Marcador de la carrera"
              >
                <header>
                  <span className="eyebrow">EN ESTA CARRERA</span>
                  <strong>Así va la partida</strong>
                </header>
                <div className="player-strip">
                  {room.players.map((p, i) => (
                    <div key={p.id} className={p.id === playerId ? "self" : ""}>
                      <span className={"player-dot p" + i} />
                      <strong>
                        {p.name}
                        {p.id === playerId ? " · Tú" : ""}
                      </strong>
                      <span>
                        <b>{p.position}</b>/30
                      </span>
                      <progress
                        value={p.position}
                        max={30}
                        aria-label={`Avance de ${p.name}`}
                      />
                      <small>
                        {p.stats.correctCount} aciertos · {p.stats.totalAnswers}{" "}
                        respuestas
                      </small>
                    </div>
                  ))}
                </div>
              </section>
              <div className="race-question-area">
                {/* Question Panel */}
                {room.publicActiveQuestion &&
                  ["QUESTION_ACTIVE", "TIEBREAK_ACTIVE"].includes(
                    room.state,
                  ) && (
                    <QuestionPanel
                      key={room.publicActiveQuestion?.id + room.state}
                      question={room.publicActiveQuestion}
                      deadlineAt={room.roundDeadlineAt}
                      durationMs={STANDARD_QUESTION_DURATION_MS}
                      onSubmitAnswer={handleAnswerSubmit}
                      isLocked={isAnswerLocked}
                      userAnswer={userSubmittedAnswer}
                      isRanked={room.mode === "ranked"}
                    />
                  )}

                {/* Trap Rescue Question Panel */}
                {room.publicRescueQuestion &&
                  room.state === "RESCUE_ACTIVE" && (
                    <div className="border border-rose-500/50 rounded-2xl overflow-hidden shadow-2xl">
                      <div className="bg-rose-950/80 px-4 py-2 text-rose-300 text-xs font-bold flex items-center justify-between">
                        <span>¡PREGUNTA DE RESCATE (TRAMPA)!</span>
                        <span>6 Segundos</span>
                      </div>
                      <QuestionPanel
                        key={room.publicRescueQuestion.id}
                        question={room.publicRescueQuestion}
                        deadlineAt={room.roundDeadlineAt}
                        durationMs={RESCUE_QUESTION_DURATION_MS}
                        onSubmitAnswer={handleAnswerSubmit}
                        isLocked={isAnswerLocked}
                        userAnswer={userSubmittedAnswer}
                        isRanked={room.mode === "ranked"}
                      />
                    </div>
                  )}

                {/* Duel Question Panel */}
                {room.publicDuelQuestion && room.state === "DUEL_ACTIVE" && (
                  <div className="border border-purple-500/50 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="bg-purple-950/80 px-4 py-2 text-purple-300 text-xs font-bold flex items-center justify-between">
                      <span>¡DUELO DIRECTO! (EL MÁS RÁPIDO GANA +2)</span>
                      <span>6 Segundos</span>
                    </div>
                    <QuestionPanel
                      key={room.publicDuelQuestion.id}
                      question={room.publicDuelQuestion}
                      deadlineAt={room.roundDeadlineAt}
                      durationMs={DUEL_QUESTION_DURATION_MS}
                      onSubmitAnswer={handleAnswerSubmit}
                      isLocked={isAnswerLocked}
                      userAnswer={userSubmittedAnswer}
                      isRanked={room.mode === "ranked"}
                    />
                  </div>
                )}

                {/* Synchronized Feedback Resolution Card */}
                {room.state === "FEEDBACK" && room.activeQuestion && (
                  <ResolutionModal
                    question={room.activeQuestion}
                    player={
                      room.players.find((p) => p.id === playerId) ||
                      room.players[0]
                    }
                    opponent={room.players.find((p) => p.id !== playerId)}
                    isAutoDismiss={true}
                  />
                )}
                {["COUNTDOWN", "ROUND_RESOLUTION", "TIEBREAK_ACTIVE"].includes(
                  room.state,
                ) &&
                  !room.publicActiveQuestion && (
                    <section className="challenge-wait">
                      <Sparkles />
                      <h2>Prepara tu siguiente respuesta</h2>
                      <p>La aventura continúa en un momento.</p>
                    </section>
                  )}
              </div>
            </aside>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW: SUMMARY (End of Race & Educational Mistake Review) */}
        {/* ========================================================= */}
        {view === "summary" && room && (
          <MatchSummary
            room={room}
            activePlayerId={playerId}
            onPlayAgain={() => {
              if (room.mode === "bot" || room.mode === "speedrun") {
                startLocalMatch(
                  room.mode,
                  room.level,
                  room.botDifficulty || "medium",
                );
              } else {
                handleCreateOnlineRoom(room.mode, room.level);
              }
            }}
            onReturnToLobby={() => setView("home")}
          />
        )}
      </main>

      {/* Global Modals */}
      {showHowToPlay && (
        <HowToPlayModal onClose={() => setShowHowToPlay(false)} />
      )}
      {showLeaderboard && (
        <LeaderboardModal onClose={() => setShowLeaderboard(false)} />
      )}
      {showStats && (
        <StatsModal stats={careerStats} onClose={() => setShowStats(false)} />
      )}
    </div>
  );
}
