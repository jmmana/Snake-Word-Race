import React from 'react';
import { Player } from '../types/game';
import { BOOST_CELLS, TRAP_CELLS, DUEL_CELLS, META_CELL, getCellType } from '../game/rules';
import { Zap, Skull, Swords, Trophy, Flag } from 'lucide-react';

interface BoardProps {
  players: Player[];
  activePlayerId?: string;
}

export const Board: React.FC<BoardProps> = ({ players, activePlayerId }) => {
  // 5 columns x 6 rows = 30 cells
  // Bottom row (row 5 in 0-index): 1 to 5 (left to right)
  // Row 4: 10 to 6 (right to left)
  // Row 3: 11 to 15 (left to right)
  // Row 2: 20 to 16 (right to left)
  // Row 1: 21 to 25 (left to right)
  // Top row (row 0): 30 to 26 (right to left)

  const rows = [
    [30, 29, 28, 27, 26], // row 0: Finish at top left
    [21, 22, 23, 24, 25], // row 1
    [20, 19, 18, 17, 16], // row 2
    [11, 12, 13, 14, 15], // row 3
    [10, 9, 8, 7, 6],     // row 4
    [1, 2, 3, 4, 5]       // row 5: Start at bottom left
  ];

  const getCellPlayers = (cellNumber: number) => {
    return players.filter(p => p.position === cellNumber);
  };

  return (
    <div className="w-full max-w-md mx-auto select-none bg-slate-900/90 border border-slate-800 rounded-2xl p-3 shadow-2xl backdrop-blur-sm">
      {/* Legend Header */}
      <div className="flex items-center justify-between text-xs font-semibold px-2 pb-2 mb-2 border-b border-slate-800 text-slate-400">
        <div className="flex items-center gap-1 text-emerald-400">
          <Zap className="w-3.5 h-3.5" />
          <span>Boost (6, 14, 22)</span>
        </div>
        <div className="flex items-center gap-1 text-rose-400">
          <Skull className="w-3.5 h-3.5" />
          <span>Trap (9, 18, 25)</span>
        </div>
        <div className="flex items-center gap-1 text-purple-400">
          <Swords className="w-3.5 h-3.5" />
          <span>Duel (12, 27)</span>
        </div>
        <div className="flex items-center gap-1 text-amber-400">
          <Trophy className="w-3.5 h-3.5" />
          <span>Meta (30)</span>
        </div>
      </div>

      {/* Grid Container */}
      <div className="grid grid-rows-6 gap-2 relative">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-5 gap-2">
            {row.map((cellNum) => {
              const cellType = getCellType(cellNum);
              const cellPlayers = getCellPlayers(cellNum);
              const isBoost = cellType === 'boost';
              const isTrap = cellType === 'trap';
              const isDuel = cellType === 'duel';
              const isMeta = cellType === 'meta';

              let bgStyle = 'bg-slate-800/80 border-slate-700/80 text-slate-300';
              if (isBoost) {
                bgStyle = 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300 shadow-emerald-950/50';
              } else if (isTrap) {
                bgStyle = 'bg-rose-950/60 border-rose-500/60 text-rose-300 shadow-rose-950/50';
              } else if (isDuel) {
                bgStyle = 'bg-purple-950/60 border-purple-500/60 text-purple-300 shadow-purple-950/50';
              } else if (isMeta) {
                bgStyle = 'bg-amber-950/70 border-amber-400 text-amber-300 shadow-amber-900/50 ring-1 ring-amber-400/50';
              }

              return (
                <div
                  key={cellNum}
                  className={`relative flex flex-col items-center justify-between aspect-square rounded-xl border p-1 transition-all duration-300 ${bgStyle}`}
                >
                  {/* Cell Number Header */}
                  <div className="w-full flex items-center justify-between text-[11px] font-bold px-0.5">
                    <span className="opacity-70">{cellNum}</span>
                    {isBoost && <Zap className="w-3 h-3 text-emerald-400 animate-pulse" />}
                    {isTrap && <Skull className="w-3 h-3 text-rose-400" />}
                    {isDuel && <Swords className="w-3 h-3 text-purple-400" />}
                    {isMeta && <Trophy className="w-3.5 h-3.5 text-amber-400 animate-bounce" />}
                  </div>

                  {/* Player Avatars Container */}
                  <div className="flex-1 w-full flex items-center justify-center relative">
                    {cellPlayers.length > 0 && (
                      <div className="flex items-center justify-center -space-x-2">
                        {cellPlayers.map((player, idx) => {
                          const isSelf = player.id === activePlayerId;
                          return (
                            <div
                              key={player.id}
                              className={`relative z-${idx + 10} flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 shadow-lg transition-transform hover:scale-110 ${
                                isSelf
                                  ? 'border-cyan-300 bg-cyan-600 text-white shadow-cyan-500/50 ring-2 ring-cyan-400/50'
                                  : 'border-fuchsia-300 bg-fuchsia-600 text-white shadow-fuchsia-500/50 ring-2 ring-fuchsia-400/50'
                              }`}
                              title={`${player.name} (Casilla ${cellNum})`}
                            >
                              <span className="text-[11px] font-black uppercase">
                                {player.name.slice(0, 1)}
                              </span>
                              {/* Pulse ring for active player */}
                              {isSelf && (
                                <span className="absolute -inset-0.5 rounded-full bg-cyan-400 animate-ping opacity-30 pointer-events-none" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Foot label */}
                  <div className="text-[8px] font-medium uppercase tracking-tight text-center opacity-60 leading-none">
                    {isBoost ? '+2' : isTrap ? 'Trampa' : isDuel ? 'Duelo' : isMeta ? 'Meta' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Start Area (Position 0) */}
      <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 font-bold text-slate-300 bg-slate-800 px-2 py-1 rounded-lg">
            <Flag className="w-3.5 h-3.5 text-indigo-400" />
            <span>Inicio (0)</span>
          </div>
          {/* Players at start */}
          <div className="flex items-center gap-1.5">
            {getCellPlayers(0).map((player) => (
              <span
                key={player.id}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  player.id === activePlayerId
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                    : 'bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-800'
                }`}
              >
                {player.name}
              </span>
            ))}
            {getCellPlayers(0).length === 0 && (
              <span className="text-slate-500 text-[11px]">En carrera</span>
            )}
          </div>
        </div>

        <div className="text-[11px] text-slate-400">
          Meta: <strong className="text-amber-400">Casilla 30</strong>
        </div>
      </div>
    </div>
  );
};
