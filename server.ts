import express, { Request, Response } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  CefrLevel,
  GameMode,
  GameRoom,
  MatchState,
  Player,
  QuestionDefinition,
  LeaderboardEntry,
  PlayerHistoryEntry
} from './src/types/game.js';
import {
  resolveStandardRound,
  resolveRescue,
  canActivateDuel,
  resolveDuel,
  evaluateMatchWinner,
  toPublicQuestion,
  calculateElo,
  STANDARD_QUESTION_DURATION_MS,
  RESCUE_QUESTION_DURATION_MS,
  DUEL_QUESTION_DURATION_MS,
  TIEBREAK_QUESTION_DURATION_MS,
  MAX_MATCH_ROUNDS,
  META_CELL,
  isAnswerCorrect
} from './src/game/rules.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());

// Load 1600+ questions database
const questionsPath = path.resolve(__dirname, 'src/data/questions.json');
let allQuestions: QuestionDefinition[] = [];
try {
  const data = fs.readFileSync(questionsPath, 'utf8');
  allQuestions = JSON.parse(data);
  console.log(`[Server] Loaded ${allQuestions.length} verified educational questions.`);
} catch (err) {
  console.error('[Server] Failed to load questions.json', err);
}

// In-memory persistent state (rooms, matchmaking, leaderboards)
const rooms = new Map<string, GameRoom>();
const playerSockets = new Map<string, WebSocket>();
const socketToPlayer = new Map<WebSocket, { roomId: string; playerId: string }>();
const matchmakingQueues: Record<GameMode, Record<CefrLevel, string[]>> = {
  bot: { A1: [], A2: [], B1: [], B2: [], C1: [], C2: [] },
  casual: { A1: [], A2: [], B1: [], B2: [], C1: [], C2: [] },
  ranked: { A1: [], A2: [], B1: [], B2: [], C1: [], C2: [] },
  speedrun: { A1: [], A2: [], B1: [], B2: [], C1: [], C2: [] }
};

const leaderboards: LeaderboardEntry[] = [
  { playerId: 'bot_champ', playerName: 'Alex Turner', level: 'B2', rating: 1280, date: '2026-10-23' },
  { playerId: 'speed_queen', playerName: 'Elena Rostova', level: 'B1', speedrunTimeMs: 42150, date: '2026-10-24' },
  { playerId: 'lex_master', playerName: 'David Kim', level: 'C1', rating: 1350, date: '2026-10-22' },
  { playerId: 'swift_runner', playerName: 'Sarah Connor', level: 'A2', speedrunTimeMs: 38900, date: '2026-10-24' },
  { playerId: 'polyglot_99', playerName: 'Lucas Silva', level: 'C2', rating: 1420, date: '2026-10-21' }
];

function getRandomQuestion(level: CefrLevel, excludeIds: string[] = []): QuestionDefinition {
  const pool = allQuestions.filter(q => q.level === level && !excludeIds.includes(q.id));
  if (pool.length === 0) {
    const fallback = allQuestions.filter(q => q.level === level);
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function broadcastRoom(room: GameRoom, event: string, extraData: Record<string, unknown> = {}) {
  const safeRoom = {
    ...room,
    activeQuestion: undefined, // ensure secrets are not broadcast in generic snapshot
    rescueQuestion: undefined,
    duelQuestion: undefined,
    tiebreakQuestion: undefined
  };

  const payload = JSON.stringify({
    event,
    room: safeRoom,
    ...extraData
  });

  room.players.forEach(p => {
    const ws = playerSockets.get(p.id);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

function sendToPlayer(playerId: string, payload: Record<string, unknown>) {
  const ws = playerSockets.get(playerId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

// Room Management & Lifecycle
function createRoom(options: {
  code?: string;
  mode: GameMode;
  level: CefrLevel;
  hostPlayer: { id: string; name: string; avatar: string; color: string; rating?: number };
}): GameRoom {
  const code = options.code || Math.random().toString(36).substring(2, 8).toUpperCase();
  const roomId = `room_${code}`;

  const host: Player = {
    id: options.hostPlayer.id,
    name: options.hostPlayer.name,
    avatar: options.hostPlayer.avatar,
    color: options.hostPlayer.color,
    position: 0,
    previousPosition: 0,
    isReady: false,
    isConnected: true,
    rating: options.hostPlayer.rating || 1000,
    stats: {
      correctCount: 0,
      totalAnswers: 0,
      accumulatedCorrectTimeMs: 0,
      boostsTriggered: 0,
      trapsFallen: 0,
      rescuesSucceeded: 0,
      duelsWon: 0
    }
  };

  const room: GameRoom = {
    id: roomId,
    code,
    mode: options.mode,
    level: options.level,
    state: 'LOBBY',
    roundNumber: 0,
    maxRounds: MAX_MATCH_ROUNDS,
    players: [host],
    roundStartsAt: 0,
    roundDeadlineAt: 0,
    usedDuelCells: [],
    history: []
  };

  rooms.set(roomId, room);
  return room;
}

function startCountdown(room: GameRoom) {
  room.state = 'COUNTDOWN';
  broadcastRoom(room, 'match:countdown', { countdownSeconds: 3 });

  setTimeout(() => {
    if (room.state === 'COUNTDOWN') {
      startNextRound(room);
    }
  }, 3000);
}

function startNextRound(room: GameRoom) {
  room.roundNumber++;
  if (room.roundNumber > room.maxRounds) {
    finishMatch(room, 'round_limit');
    return;
  }

  // Clear round answers
  room.players.forEach(p => {
    p.currentAnswer = undefined;
    p.rescueAnswer = undefined;
    p.duelAnswer = undefined;
    p.previousPosition = p.position;
  });

  const usedQIds = room.history.map(h => h.question.id);
  const question = getRandomQuestion(room.level, usedQIds);
  room.activeQuestion = question;
  room.publicActiveQuestion = toPublicQuestion(question);

  const now = Date.now();
  room.roundStartsAt = now;
  room.roundDeadlineAt = now + STANDARD_QUESTION_DURATION_MS;
  room.state = 'QUESTION_ACTIVE';

  broadcastRoom(room, 'question:opened', {
    question: room.publicActiveQuestion,
    roundNumber: room.roundNumber,
    startsAt: room.roundStartsAt,
    deadlineAt: room.roundDeadlineAt
  });

  // Authoritative server timer for round closure
  const expectedRound = room.roundNumber;
  setTimeout(() => {
    if (room.state === 'QUESTION_ACTIVE' && room.roundNumber === expectedRound) {
      resolveRound(room);
    }
  }, STANDARD_QUESTION_DURATION_MS);
}

function resolveRound(room: GameRoom) {
  if (room.state !== 'QUESTION_ACTIVE') return;
  room.state = 'ROUND_RESOLUTION';

  const activeQ = room.activeQuestion!;

  // 1. Evaluate answers
  room.players.forEach(p => {
    if (p.currentAnswer) {
      p.currentAnswer.isCorrect = isAnswerCorrect(
        activeQ,
        p.currentAnswer.rawAnswer,
        p.currentAnswer.optionId
      );
      if (p.currentAnswer.isCorrect) {
        p.stats.correctCount++;
        p.stats.accumulatedCorrectTimeMs += p.currentAnswer.responseTimeMs;
      }
    } else {
      // Timeout
      p.currentAnswer = {
        rawAnswer: '',
        receivedAt: room.roundDeadlineAt,
        responseTimeMs: STANDARD_QUESTION_DURATION_MS,
        isCorrect: false,
        movement: 0
      };
    }
    p.stats.totalAnswers++;
  });

  // 2. Resolve base moves & boosts
  const resolutions = resolveStandardRound(room.players, STANDARD_QUESTION_DURATION_MS);

  resolutions.forEach(res => {
    const player = room.players.find(p => p.id === res.playerId)!;
    player.position = res.positionAfterBoost;
    if (res.boostApplied) {
      player.stats.boostsTriggered++;
    }
    if (res.trapTriggered) {
      player.stats.trapsFallen++;
    }

    // Record history
    room.history.push({
      roundNumber: room.roundNumber,
      question: activeQ,
      playerAnswer: player.currentAnswer?.rawAnswer || '(Timeout)',
      isCorrect: Boolean(player.currentAnswer?.isCorrect),
      responseTimeMs: player.currentAnswer?.responseTimeMs || STANDARD_QUESTION_DURATION_MS,
      movementAwarded: res.baseMovement + res.boostMovement,
      specialEvent: res.boostApplied ? 'boost' : undefined
    });
  });

  // Check victory before special events
  const winCheck = evaluateMatchWinner(room.players[0], room.players[1]);
  if (winCheck.isFinished) {
    finishMatch(room, winCheck.reason || 'meta_reached', winCheck.winnerId);
    return;
  }

  // 3. Check for trap rescues
  const trappedResolutions = resolutions.filter(r => r.trapTriggered);
  if (trappedResolutions.length > 0) {
    triggerTraps(room, trappedResolutions);
    return;
  }

  // 4. Check for duel
  checkAndTriggerDuel(room, resolutions);
}

function triggerTraps(room: GameRoom, trappedResolutions: ReturnType<typeof resolveStandardRound>) {
  room.state = 'RESCUE_ACTIVE';
  const rescueQ = getRandomQuestion(room.level);
  room.rescueQuestion = rescueQ;
  room.publicRescueQuestion = toPublicQuestion(rescueQ);

  const now = Date.now();
  room.roundStartsAt = now;
  room.roundDeadlineAt = now + RESCUE_QUESTION_DURATION_MS;

  broadcastRoom(room, 'rescue:opened', {
    question: room.publicRescueQuestion,
    trappedPlayerIds: trappedResolutions.map(r => r.playerId),
    startsAt: room.roundStartsAt,
    deadlineAt: room.roundDeadlineAt
  });

  setTimeout(() => {
    if (room.state === 'RESCUE_ACTIVE') {
      trappedResolutions.forEach(tr => {
        const p = room.players.find(player => player.id === tr.playerId)!;
        const ans = p.rescueAnswer;
        const isCorrect = Boolean(ans && isAnswerCorrect(room.rescueQuestion!, ans.rawAnswer, ans.optionId));

        const rescueOutcome = resolveRescue(p.position, isCorrect);
        p.position = rescueOutcome.finalPosition;
        if (isCorrect) {
          p.stats.rescuesSucceeded++;
        }
      });

      // Post-rescue win check
      const winCheck = evaluateMatchWinner(room.players[0], room.players[1]);
      if (winCheck.isFinished) {
        finishMatch(room, winCheck.reason || 'meta_reached', winCheck.winnerId);
        return;
      }

      showFeedback(room);
    }
  }, RESCUE_QUESTION_DURATION_MS);
}

function checkAndTriggerDuel(room: GameRoom, resolutions: ReturnType<typeof resolveStandardRound>) {
  if (room.players.length < 2) {
    showFeedback(room);
    return;
  }

  const pA = room.players[0];
  const pB = room.players[1];
  const resA = resolutions.find(r => r.playerId === pA.id)!;
  const resB = resolutions.find(r => r.playerId === pB.id)!;

  const duelCell = pA.position;
  const landedAThisRound = resA.landedPosition === duelCell && pA.previousPosition !== duelCell;
  const landedBThisRound = resB.landedPosition === duelCell && pB.previousPosition !== duelCell;

  const isDuelPossible = canActivateDuel(
    pA,
    pB,
    duelCell,
    room.usedDuelCells,
    landedAThisRound,
    landedBThisRound,
    pA.previousPosition === duelCell,
    pB.previousPosition === duelCell
  );

  if (isDuelPossible) {
    room.state = 'DUEL_ACTIVE';
    room.usedDuelCells.push(duelCell);

    const duelQ = getRandomQuestion(room.level);
    room.duelQuestion = duelQ;
    room.publicDuelQuestion = toPublicQuestion(duelQ);

    const now = Date.now();
    room.roundStartsAt = now;
    room.roundDeadlineAt = now + DUEL_QUESTION_DURATION_MS;

    broadcastRoom(room, 'duel:opened', {
      question: room.publicDuelQuestion,
      duelCell,
      startsAt: room.roundStartsAt,
      deadlineAt: room.roundDeadlineAt
    });

    setTimeout(() => {
      if (room.state === 'DUEL_ACTIVE') {
        // Validate duel answers
        [pA, pB].forEach(p => {
          if (p.duelAnswer) {
            p.duelAnswer.isCorrect = isAnswerCorrect(
              room.duelQuestion!,
              p.duelAnswer.rawAnswer,
              p.duelAnswer.optionId
            );
          }
        });

        const duelOutcome = resolveDuel(pA, pB);
        if (duelOutcome.rewardMap[pA.id]) {
          pA.position = Math.min(META_CELL, pA.position + duelOutcome.rewardMap[pA.id]);
          pA.stats.duelsWon++;
        }
        if (duelOutcome.rewardMap[pB.id]) {
          pB.position = Math.min(META_CELL, pB.position + duelOutcome.rewardMap[pB.id]);
          pB.stats.duelsWon++;
        }

        const winCheck = evaluateMatchWinner(pA, pB);
        if (winCheck.isFinished) {
          finishMatch(room, winCheck.reason || 'meta_reached', winCheck.winnerId);
          return;
        }

        showFeedback(room);
      }
    }, DUEL_QUESTION_DURATION_MS);
  } else {
    showFeedback(room);
  }
}

function showFeedback(room: GameRoom) {
  room.state = 'FEEDBACK';
  broadcastRoom(room, 'feedback:shown', {
    activeQuestion: room.activeQuestion,
    players: room.players.map(p => ({
      id: p.id,
      position: p.position,
      answer: p.currentAnswer
    }))
  });

  setTimeout(() => {
    if (room.state === 'FEEDBACK') {
      const winCheck = evaluateMatchWinner(room.players[0], room.players[1]);
      if (winCheck.isFinished) {
        finishMatch(room, winCheck.reason || 'meta_reached', winCheck.winnerId);
      } else if (winCheck.needsTiebreak) {
        triggerTiebreak(room);
      } else {
        startNextRound(room);
      }
    }
  }, 2500); // 2.5s synchronized feedback
}

function triggerTiebreak(room: GameRoom) {
  room.state = 'TIEBREAK_ACTIVE';
  room.tiebreakRound = (room.tiebreakRound || 0) + 1;

  if (room.tiebreakRound > 3) {
    // Max 3 tiebreak questions -> real tie
    finishMatch(room, 'meta_reached', null);
    return;
  }

  const tiebreakQ = getRandomQuestion(room.level);
  room.tiebreakQuestion = tiebreakQ;
  room.publicTiebreakQuestion = toPublicQuestion(tiebreakQ);

  const now = Date.now();
  room.roundStartsAt = now;
  room.roundDeadlineAt = now + TIEBREAK_QUESTION_DURATION_MS;

  broadcastRoom(room, 'tiebreak:opened', {
    question: room.publicTiebreakQuestion,
    tiebreakRound: room.tiebreakRound,
    startsAt: room.roundStartsAt,
    deadlineAt: room.roundDeadlineAt
  });

  setTimeout(() => {
    if (room.state === 'TIEBREAK_ACTIVE') {
      const pA = room.players[0];
      const pB = room.players[1];
      const aCorrect = Boolean(pA.currentAnswer && isAnswerCorrect(room.tiebreakQuestion!, pA.currentAnswer.rawAnswer, pA.currentAnswer.optionId));
      const bCorrect = Boolean(pB.currentAnswer && isAnswerCorrect(room.tiebreakQuestion!, pB.currentAnswer.rawAnswer, pB.currentAnswer.optionId));

      if (aCorrect && !bCorrect) {
        finishMatch(room, 'meta_reached', pA.id);
      } else if (bCorrect && !aCorrect) {
        finishMatch(room, 'meta_reached', pB.id);
      } else if (aCorrect && bCorrect) {
        const timeA = pA.currentAnswer!.responseTimeMs;
        const timeB = pB.currentAnswer!.responseTimeMs;
        if (Math.abs(timeA - timeB) > 100) {
          finishMatch(room, 'meta_reached', timeA < timeB ? pA.id : pB.id);
        } else {
          // Continue tiebreak
          triggerTiebreak(room);
        }
      } else {
        triggerTiebreak(room);
      }
    }
  }, TIEBREAK_QUESTION_DURATION_MS);
}

function finishMatch(
  room: GameRoom,
  reason: "meta_reached" | "round_limit" | "abandonment" | "speedrun_complete",
  winnerId?: string | null
) {
  room.state = 'FINISHED';
  room.winnerId = winnerId;
  room.finishReason = reason;

  // Rating calculations for Ranked mode
  if (room.mode === 'ranked' && room.players.length === 2) {
    const pA = room.players[0];
    const pB = room.players[1];
    let scoreA = 0.5;
    if (winnerId === pA.id) scoreA = 1;
    if (winnerId === pB.id) scoreA = 0;

    const { newRatingA, newRatingB } = calculateElo(pA.rating || 1000, pB.rating || 1000, scoreA);
    pA.rating = newRatingA;
    pB.rating = newRatingB;

    leaderboards.push({
      playerId: pA.id,
      playerName: pA.name,
      level: room.level,
      rating: newRatingA,
      date: new Date().toISOString().split('T')[0]
    });
  }

  broadcastRoom(room, 'match:finished', {
    winnerId,
    reason,
    players: room.players,
    history: room.history
  });
}

// WebSocket Connection Handler
wss.on('connection', (ws: WebSocket) => {
  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message);
      const { event, payload } = data;

      switch (event) {
        case 'room:create': {
          const room = createRoom({
            code: payload.code,
            mode: payload.mode || 'casual',
            level: payload.level || 'B1',
            hostPlayer: payload.player
          });
          playerSockets.set(payload.player.id, ws);
          socketToPlayer.set(ws, { roomId: room.id, playerId: payload.player.id });

          sendToPlayer(payload.player.id, {
            event: 'room:snapshot',
            room
          });
          break;
        }

        case 'room:join': {
          const room = Array.from(rooms.values()).find(
            r => r.code.toUpperCase() === payload.code?.toUpperCase()
          );

          if (!room) {
            ws.send(JSON.stringify({ event: 'operation:error', message: 'Room not found' }));
            return;
          }

          if (room.players.length >= 2) {
            ws.send(JSON.stringify({ event: 'operation:error', message: 'Room is full' }));
            return;
          }

          const existingPlayer = room.players.find(p => p.id === payload.player.id);
          if (!existingPlayer) {
            room.players.push({
              id: payload.player.id,
              name: payload.player.name,
              avatar: payload.player.avatar || 'snake',
              color: payload.player.color || '#ec4899',
              position: 0,
              previousPosition: 0,
              isReady: false,
              isConnected: true,
              rating: payload.player.rating || 1000,
              stats: {
                correctCount: 0,
                totalAnswers: 0,
                accumulatedCorrectTimeMs: 0,
                boostsTriggered: 0,
                trapsFallen: 0,
                rescuesSucceeded: 0,
                duelsWon: 0
              }
            });
          }

          playerSockets.set(payload.player.id, ws);
          socketToPlayer.set(ws, { roomId: room.id, playerId: payload.player.id });

          broadcastRoom(room, 'room:snapshot', { room });
          break;
        }

        case 'match:matchmaking': {
          const mode: GameMode = payload.mode;
          const level: CefrLevel = payload.level;
          const player = payload.player;

          playerSockets.set(player.id, ws);

          // Find opponent in queue
          const queue = matchmakingQueues[mode][level];
          const opponentId = queue.find(id => id !== player.id);

          if (opponentId) {
            // Remove opponent from queue and create match
            const idx = queue.indexOf(opponentId);
            queue.splice(idx, 1);

            const room = createRoom({
              mode,
              level,
              hostPlayer: player
            });

            const oppWs = playerSockets.get(opponentId);
            if (oppWs) {
              socketToPlayer.set(oppWs, { roomId: room.id, playerId: opponentId });
            }
            socketToPlayer.set(ws, { roomId: room.id, playerId: player.id });

            // Opponent player join
            room.players.push({
              id: opponentId,
              name: payload.opponentName || 'Opponent',
              avatar: 'snake',
              color: '#10b981',
              position: 0,
              previousPosition: 0,
              isReady: true,
              isConnected: true,
              rating: 1000,
              stats: {
                correctCount: 0,
                totalAnswers: 0,
                accumulatedCorrectTimeMs: 0,
                boostsTriggered: 0,
                trapsFallen: 0,
                rescuesSucceeded: 0,
                duelsWon: 0
              }
            });

            room.players[0].isReady = true;
            broadcastRoom(room, 'room:snapshot', { room });
            startCountdown(room);
          } else {
            // Add to queue
            if (!queue.includes(player.id)) {
              queue.push(player.id);
            }
            ws.send(JSON.stringify({ event: 'matchmaking:queued', level, mode }));
          }
          break;
        }

        case 'player:ready': {
          const mapping = socketToPlayer.get(ws);
          if (!mapping) return;
          const room = rooms.get(mapping.roomId);
          if (!room) return;

          const player = room.players.find(p => p.id === mapping.playerId);
          if (player) {
            player.isReady = payload.isReady !== undefined ? payload.isReady : true;
          }

          broadcastRoom(room, 'room:snapshot', { room });

          // Start if both players are ready
          if (room.players.length === 2 && room.players.every(p => p.isReady)) {
            startCountdown(room);
          }
          break;
        }

        case 'answer:submit': {
          const mapping = socketToPlayer.get(ws);
          if (!mapping) return;
          const room = rooms.get(mapping.roomId);
          if (!room) return;

          const player = room.players.find(p => p.id === mapping.playerId);
          if (!player) return;

          const serverNow = Date.now();
          const responseTime = Math.max(0, serverNow - room.roundStartsAt);

          if (room.state === 'QUESTION_ACTIVE') {
            if (!player.currentAnswer) {
              player.currentAnswer = {
                rawAnswer: payload.rawAnswer || '',
                optionId: payload.optionId,
                receivedAt: serverNow,
                responseTimeMs: responseTime
              };
              // Acknowledge submission without revealing correctness
              sendToPlayer(player.id, {
                event: 'answer:ack',
                questionId: room.publicActiveQuestion?.id,
                receivedAt: serverNow
              });
            }
          } else if (room.state === 'RESCUE_ACTIVE') {
            if (!player.rescueAnswer) {
              player.rescueAnswer = {
                rawAnswer: payload.rawAnswer || '',
                optionId: payload.optionId,
                receivedAt: serverNow,
                responseTimeMs: responseTime
              };
              sendToPlayer(player.id, {
                event: 'answer:ack',
                questionId: room.publicRescueQuestion?.id,
                receivedAt: serverNow
              });
            }
          } else if (room.state === 'DUEL_ACTIVE') {
            if (!player.duelAnswer) {
              player.duelAnswer = {
                rawAnswer: payload.rawAnswer || '',
                optionId: payload.optionId,
                receivedAt: serverNow,
                responseTimeMs: responseTime
              };
              sendToPlayer(player.id, {
                event: 'answer:ack',
                questionId: room.publicDuelQuestion?.id,
                receivedAt: serverNow
              });
            }
          }
          break;
        }

        case 'match:resume': {
          const mapping = socketToPlayer.get(ws);
          if (!mapping) return;
          const room = rooms.get(mapping.roomId);
          if (!room) return;

          const player = room.players.find(p => p.id === mapping.playerId);
          if (player) {
            player.isConnected = true;
          }

          sendToPlayer(mapping.playerId, {
            event: 'room:snapshot',
            room
          });
          break;
        }
      }
    } catch (err) {
      console.error('[WS Error]', err);
    }
  });

  ws.on('close', () => {
    const mapping = socketToPlayer.get(ws);
    if (!mapping) return;

    const room = rooms.get(mapping.roomId);
    if (room) {
      const player = room.players.find(p => p.id === mapping.playerId);
      if (player) {
        player.isConnected = false;
        broadcastRoom(room, 'connection:status', {
          playerId: player.id,
          isConnected: false
        });

        // 30-second disconnect timeout
        setTimeout(() => {
          if (!player.isConnected && room.state !== 'FINISHED' && room.state !== 'ABORTED') {
            finishMatch(room, 'abandonment', room.players.find(p => p.id !== player.id)?.id);
          }
        }, 30000);
      }
    }
    socketToPlayer.delete(ws);
  });
});

// REST API Endpoints
app.get('/api/questions/stats', (_req: Request, res: Response) => {
  const stats: Record<string, number> = {};
  ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].forEach(lvl => {
    stats[lvl] = allQuestions.filter(q => q.level === lvl).length;
  });
  res.json({
    total: allQuestions.length,
    byLevel: stats
  });
});

app.get('/api/leaderboard', (_req: Request, res: Response) => {
  res.json(leaderboards);
});

// Vite dev middleware or static serving
const PORT = 3000;
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true }
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Snake Word Race full-stack app running on port ${PORT}`);
  });
}

startServer();
