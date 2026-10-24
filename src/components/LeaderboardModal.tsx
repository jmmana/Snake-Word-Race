import React, { useState, useEffect } from "react";
import { X, Trophy, Medal, Flame, Timer } from "lucide-react";
import { LeaderboardEntry, CefrLevel } from "../types/game";

import { useDialogFocus } from "./useDialogFocus";
interface LeaderboardModalProps {
  onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  onClose,
}) => {
  const [tab, setTab] = useState<"ranked" | "speedrun">("ranked");
  const [selectedLevel, setSelectedLevel] = useState<CefrLevel>("B1");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((res) => res.json())
      .then((data) => setEntries(data))
      .catch(() => {
        // Fallback demo entries
        setEntries([
          {
            playerId: "1",
            playerName: "Lucas Walker",
            level: "B1",
            rating: 1250,
            date: "2026-10-24",
          },
          {
            playerId: "2",
            playerName: "Sofia Martinez",
            level: "B1",
            rating: 1180,
            date: "2026-10-24",
          },
          {
            playerId: "3",
            playerName: "Kenji Sato",
            level: "B1",
            speedrunTimeMs: 44200,
            date: "2026-10-23",
          },
        ]);
      });
  }, []);

  const filteredEntries = entries
    .filter((e) => {
      if (tab === "ranked") {
        return (
          e.rating !== undefined &&
          (selectedLevel ? e.level === selectedLevel : true)
        );
      } else {
        return (
          e.speedrunTimeMs !== undefined &&
          (selectedLevel ? e.level === selectedLevel : true)
        );
      }
    })
    .sort((a, b) => {
      if (tab === "ranked") {
        return (b.rating || 0) - (a.rating || 0);
      } else {
        return (a.speedrunTimeMs || 999999) - (b.speedrunTimeMs || 999999);
      }
    });

  const levels: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

  const dialogRef = useDialogFocus(onClose);
  return (
    <div className="game-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Récords"
        className="game-modal w-full max-w-md game-surface border game-border rounded-2xl p-5 shadow-2xl max-h-[85vh] flex flex-col space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b game-border pb-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold game-text">
              Clasificación y Récords
            </h3>
          </div>
          <button
            aria-label="Cerrar récords"
            onClick={onClose}
            className="p-1 rounded-lg game-muted game-hover-text game-hover transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-xl game-page p-1 border game-border text-xs font-bold">
          <button
            onClick={() => setTab("ranked")}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              tab === "ranked"
                ? "bg-indigo-600 game-text shadow"
                : "game-muted game-hover-text"
            }`}
          >
            <Medal className="w-4 h-4" />
            <span>Ranked Elo</span>
          </button>
          <button
            onClick={() => setTab("speedrun")}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              tab === "speedrun"
                ? "bg-indigo-600 game-text shadow"
                : "game-muted game-hover-text"
            }`}
          >
            <Timer className="w-4 h-4" />
            <span>Speedrun</span>
          </button>
        </div>

        {/* CEFR Level filter */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
          {levels.map((lvl) => (
            <button
              key={lvl}
              onClick={() => setSelectedLevel(lvl)}
              className={`px-3 py-1 rounded-lg font-bold transition text-xs shrink-0 ${
                selectedLevel === lvl
                  ? "game-soft game-text border game-border"
                  : "game-soft game-muted game-hover-text border border-transparent"
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        {/* Rankings List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
          {filteredEntries.length === 0 ? (
            <div className="p-6 text-center game-muted">
              No hay récords registrados todavía para el nivel {selectedLevel}.
              ¡Sé el primero!
            </div>
          ) : (
            filteredEntries.map((entry, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-xl game-page border game-border"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex items-center justify-center w-6 h-6 rounded-full font-black text-xs ${
                      idx === 0
                        ? "bg-amber-500 game-contrast shadow-md shadow-amber-500/40"
                        : idx === 1
                          ? "game-soft game-contrast"
                          : idx === 2
                            ? "bg-amber-700 game-text"
                            : "game-soft game-muted"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div>
                    <span className="font-bold game-text block">
                      {entry.playerName}
                    </span>
                    <span className="text-[10px] game-muted">{entry.date}</span>
                  </div>
                </div>

                <div className="text-right">
                  {tab === "ranked" ? (
                    <span className="font-mono font-bold text-amber-400 text-sm">
                      {entry.rating} Elo
                    </span>
                  ) : (
                    <span className="font-mono font-bold text-indigo-400 text-sm">
                      {((entry.speedrunTimeMs || 0) / 1000).toFixed(2)}s
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
