import React, { useState, useEffect } from "react";
import { GameRoom, PlayerHistoryEntry } from "../types/game";
import {
  Trophy,
  Award,
  RotateCcw,
  Home,
  BookOpen,
  Clock,
  Target,
  Zap,
  Skull,
  Swords,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import confetti from "canvas-confetti";
import { sound } from "../services/audio";

interface MatchSummaryProps {
  room: GameRoom;
  activePlayerId: string;
  onPlayAgain: () => void;
  onReturnToLobby: () => void;
}

export const MatchSummary: React.FC<MatchSummaryProps> = ({
  room,
  activePlayerId,
  onPlayAgain,
  onReturnToLobby,
}) => {
  const [showErrorReview, setShowErrorReview] = useState(false);

  const activePlayer =
    room.players.find((p) => p.id === activePlayerId) || room.players[0];
  const opponent = room.players.find((p) => p.id !== activePlayerId);

  const isWinner = room.winnerId === activePlayer.id;
  const isTie = room.winnerId === null;

  useEffect(() => {
    if (isWinner) {
      sound.playVictory();
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
      return () => {
        confetti.reset();
      };
    }
  }, [isWinner]);

  // Extract mistakes from match history
  const mistakeEntries = room.history.filter((h) => !h.isCorrect);

  const accuracy =
    activePlayer.stats.totalAnswers > 0
      ? Math.round(
          (activePlayer.stats.correctCount / activePlayer.stats.totalAnswers) *
            100,
        )
      : 0;

  const avgSpeed =
    activePlayer.stats.correctCount > 0
      ? (
          activePlayer.stats.accumulatedCorrectTimeMs /
          activePlayer.stats.correctCount /
          1000
        ).toFixed(2)
      : "0.00";

  return (
    <div className="summary-card w-full max-w-md mx-auto select-none game-surface border game-border rounded-2xl p-5 shadow-2xl backdrop-blur-md space-y-5 animate-fadeIn">
      {/* Banner */}
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center mb-2">
          {isWinner ? (
            <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Trophy className="w-8 h-8 animate-bounce" />
            </div>
          ) : isTie ? (
            <div className="w-16 h-16 rounded-full bg-indigo-500/20 border-2 border-indigo-400 text-indigo-400 flex items-center justify-center">
              <Award className="w-8 h-8" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full game-soft border-2 game-border game-muted flex items-center justify-center">
              <Award className="w-8 h-8" />
            </div>
          )}
        </div>

        <h2 className="text-xl font-black game-text">
          {isWinner ? "¡Victoria!" : isTie ? "¡Empate!" : "Fin de la Carrera"}
        </h2>
        <p className="text-xs game-muted">
          {room.finishReason === "meta_reached" &&
            "Llegada a la meta (Casilla 30)"}
          {room.finishReason === "round_limit" && "Límite de rondas alcanzado"}
          {room.finishReason === "speedrun_complete" && "¡Speedrun completado!"}
          {room.finishReason === "abandonment" &&
            "Victoria por abandono del oponente"}
        </p>

        {room.mode === "ranked" && activePlayer.rating && (
          <div className="inline-block mt-2 px-3 py-1 bg-amber-950/70 border border-amber-500/50 rounded-full text-xs font-bold text-amber-300">
            Rating Oficial Elo: {activePlayer.rating} pts
          </div>
        )}
      </div>

      {/* Grid of Key Match Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
        <div className="game-soft border game-border p-2.5 rounded-xl">
          <div className="flex items-center justify-center text-emerald-400 mb-1">
            <Target className="w-4 h-4" />
          </div>
          <span className="text-[10px] game-muted block">Aciertos</span>
          <span className="font-bold game-text text-sm">
            {activePlayer.stats.correctCount} /{" "}
            {activePlayer.stats.totalAnswers}
          </span>
        </div>

        <div className="game-soft border game-border p-2.5 rounded-xl">
          <div className="flex items-center justify-center text-indigo-400 mb-1">
            <Award className="w-4 h-4" />
          </div>
          <span className="text-[10px] game-muted block">Precisión</span>
          <span className="font-bold game-text text-sm">{accuracy}%</span>
        </div>

        <div className="game-soft border game-border p-2.5 rounded-xl">
          <div className="flex items-center justify-center text-amber-400 mb-1">
            <Clock className="w-4 h-4" />
          </div>
          <span className="text-[10px] game-muted block">Vel. Media</span>
          <span className="font-bold game-text text-sm">{avgSpeed}s</span>
        </div>

        <div className="game-soft border game-border p-2.5 rounded-xl">
          <div className="flex items-center justify-center text-purple-400 mb-1">
            <Zap className="w-4 h-4" />
          </div>
          <span className="text-[10px] game-muted block">Impulsos</span>
          <span className="font-bold game-text text-sm">
            {activePlayer.stats.boostsTriggered}
          </span>
        </div>
      </div>

      {/* Educational Mistakes Drawer Toggle */}
      {mistakeEntries.length > 0 ? (
        <div className="game-page border game-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowErrorReview(!showErrorReview)}
            className="w-full flex items-center justify-between p-3 text-xs font-bold text-indigo-300 game-hover transition"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span>Revisar Errores ({mistakeEntries.length})</span>
            </div>
            {showErrorReview ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showErrorReview && (
            <div className="p-3 border-t game-border space-y-3 max-h-60 overflow-y-auto">
              {mistakeEntries.map((entry, idx) => (
                <div
                  key={idx}
                  className="game-surface border game-border rounded-lg p-2.5 text-xs space-y-1"
                >
                  <div className="font-medium game-text">
                    <span className="game-muted mr-1.5">
                      Ronda {entry.roundNumber}:
                    </span>
                    {entry.question.clueEn}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] pt-1">
                    <span className="text-rose-400 line-through">
                      Tuya: {entry.playerAnswer}
                    </span>
                    <span className="text-emerald-400 font-bold">
                      Correcta: {entry.question.answer}
                    </span>
                  </div>
                  <p className="text-[11px] game-muted italic pt-0.5">
                    {entry.question.explanationEn}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-center text-xs font-medium text-emerald-300">
          ¡Impecable! 100% de aciertos sin ningún error en esta carrera.
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={onPlayAgain}
          className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:scale-95 game-text font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Jugar Otra Vez</span>
        </button>

        <button
          onClick={onReturnToLobby}
          className="py-3 px-4 game-soft game-hover game-muted font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 border game-border transition"
        >
          <Home className="w-4 h-4" />
          <span>Lobby</span>
        </button>
      </div>
    </div>
  );
};
