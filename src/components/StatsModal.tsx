import React from 'react';
import { X, Award, Target, Flame, Clock, Trophy } from 'lucide-react';
import { PlayerStats, CefrLevel } from '../types/game';

interface StatsModalProps {
  stats: PlayerStats;
  onClose: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({ stats, onClose }) => {
  const levels: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-slate-100">Estadísticas de Carrera</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overview cards */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Partidas / Victorias</span>
            </div>
            <div className="text-lg font-bold text-slate-100">
              {stats.wins} <span className="text-xs text-slate-500">/ {stats.gamesPlayed}</span>
            </div>
            <span className="text-[10px] text-slate-500">
              {stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0}% de victorias
            </span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Target className="w-4 h-4 text-emerald-400" />
              <span>Precisión Global</span>
            </div>
            <div className="text-lg font-bold text-emerald-400">
              {stats.accuracyPercent}%
            </div>
            <span className="text-[10px] text-slate-500">Acierto acumulado</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Flame className="w-4 h-4 text-rose-400" />
              <span>Mejor Racha</span>
            </div>
            <div className="text-lg font-bold text-rose-400">
              {stats.bestStreak}
            </div>
            <span className="text-[10px] text-slate-500">Respuestas seguidas</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>Velocidad Promedio</span>
            </div>
            <div className="text-lg font-bold text-indigo-300">
              {(stats.avgResponseTimeMs / 1000).toFixed(2)}s
            </div>
            <span className="text-[10px] text-slate-500">Por acierto</span>
          </div>
        </div>

        {/* Rating by CEFR level */}
        <div className="space-y-2">
          <h4 className="font-bold text-xs text-slate-300 uppercase tracking-wider">
            Rating Competitivo por Nivel CEFR
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {levels.map(lvl => (
              <div
                key={lvl}
                className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-xl text-center"
              >
                <span className="text-[10px] font-bold text-slate-400 block">{lvl}</span>
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
