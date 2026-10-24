import React from "react";
import { X, Award, Target, Flame, Clock, Trophy } from "lucide-react";
import { PlayerStats, CefrLevel } from "../types/game";

import { useDialogFocus } from "./useDialogFocus";
interface StatsModalProps {
  stats: PlayerStats;
  onClose: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({ stats, onClose }) => {
  const levels: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

  const dialogRef = useDialogFocus(onClose);
  return (
    <div className="game-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Estadísticas"
        className="game-modal w-full max-w-md game-surface border game-border rounded-2xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b game-border pb-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold game-text">
              Estadísticas de Carrera
            </h3>
          </div>
          <button
            aria-label="Cerrar estadísticas"
            onClick={onClose}
            className="p-1 rounded-lg game-muted game-hover-text game-hover transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overview cards */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="game-page border game-border p-3 rounded-xl">
            <div className="flex items-center gap-1.5 game-muted mb-1">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Partidas / Victorias</span>
            </div>
            <div className="text-lg font-bold game-text">
              {stats.wins}{" "}
              <span className="text-xs game-muted">/ {stats.gamesPlayed}</span>
            </div>
            <span className="text-[10px] game-muted">
              {stats.gamesPlayed > 0
                ? Math.round((stats.wins / stats.gamesPlayed) * 100)
                : 0}
              % de victorias
            </span>
          </div>

          <div className="game-page border game-border p-3 rounded-xl">
            <div className="flex items-center gap-1.5 game-muted mb-1">
              <Target className="w-4 h-4 text-emerald-400" />
              <span>Precisión Global</span>
            </div>
            <div className="text-lg font-bold text-emerald-400">
              {stats.accuracyPercent}%
            </div>
            <span className="text-[10px] game-muted">Acierto acumulado</span>
          </div>

          <div className="game-page border game-border p-3 rounded-xl">
            <div className="flex items-center gap-1.5 game-muted mb-1">
              <Flame className="w-4 h-4 text-rose-400" />
              <span>Mejor Racha</span>
            </div>
            <div className="text-lg font-bold text-rose-400">
              {stats.bestStreak}
            </div>
            <span className="text-[10px] game-muted">Respuestas seguidas</span>
          </div>

          <div className="game-page border game-border p-3 rounded-xl">
            <div className="flex items-center gap-1.5 game-muted mb-1">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>Velocidad Promedio</span>
            </div>
            <div className="text-lg font-bold text-indigo-300">
              {(stats.avgResponseTimeMs / 1000).toFixed(2)}s
            </div>
            <span className="text-[10px] game-muted">Por acierto</span>
          </div>
        </div>

        {/* Rating by CEFR level */}
        <div className="space-y-2">
          <h4 className="font-bold text-xs game-muted uppercase tracking-wider">
            Rating Competitivo por Nivel CEFR
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {levels.map((lvl) => (
              <div
                key={lvl}
                className="game-page border game-border p-2.5 rounded-xl text-center"
              >
                <span className="text-[10px] font-bold game-muted block">
                  {lvl}
                </span>
                <span className="text-sm font-mono font-bold text-amber-400">
                  {stats.ratingByLevel[lvl] || 1000}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
