import React, { useState, useEffect } from "react";
import { CefrLevel, GameMode } from "../types/game";
import { Volume2, VolumeX, LogOut, Shield, Zap, Sparkles } from "lucide-react";
import { sound } from "../services/audio";
import { PWAInstallButton } from "./PWAInstallButton";

interface HUDProps {
  mode: GameMode;
  level: CefrLevel;
  roundNumber: number;
  maxRounds: number;
  elapsedSeconds: number;
  onLeaveMatch: () => void;
  isConnected?: boolean;
}

export const HUD: React.FC<HUDProps> = ({
  mode,
  level,
  roundNumber,
  maxRounds,
  elapsedSeconds,
  onLeaveMatch,
  isConnected = true,
}) => {
  const [isMuted, setIsMuted] = useState<boolean>(sound.getMuted());

  const toggleSound = () => {
    const next = sound.toggleMute();
    setIsMuted(next);
  };

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const modeLabels: Record<GameMode, { label: string; color: string }> = {
    bot: {
      label: "Práctica Bot",
      color: "bg-emerald-950 text-emerald-300 border-emerald-800",
    },
    casual: {
      label: "Casual PvP",
      color: "bg-indigo-950 text-indigo-300 border-indigo-800",
    },
    ranked: {
      label: "Ranked Elo",
      color: "bg-amber-950 text-amber-300 border-amber-800",
    },
    speedrun: {
      label: "Speedrun Solo",
      color: "bg-purple-950 text-purple-300 border-purple-800",
    },
  };

  return (
    <header className="race-hud w-full max-w-md mx-auto mb-2 flex flex-col gap-1.5 select-none">
      {/* Top action row */}
      <div className="flex items-center justify-between game-surface border game-border rounded-xl px-3 py-2 backdrop-blur-md shadow-md">
        <div className="flex items-center gap-2">
          {/* Mode Pill */}
          <span
            className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${modeLabels[mode].color}`}
          >
            {modeLabels[mode].label}
          </span>
          {/* CEFR Level Pill */}
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold game-soft game-text border game-border">
            Nivel {level}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <PWAInstallButton />

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="p-1.5 game-muted game-hover-text game-soft game-hover border game-border rounded-lg transition"
            title={isMuted ? "Activar sonido" : "Silenciar sonido"}
            aria-label={isMuted ? "Activar sonido" : "Silenciar sonido"}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 game-text" />
            )}
          </button>

          {/* Leave Match */}
          <button
            onClick={() => {
              if (window.confirm("¿Deseas salir de la partida actual?")) {
                onLeaveMatch();
              }
            }}
            className="p-1.5 game-muted hover:text-rose-400 game-soft game-hover border game-border rounded-lg transition"
            title="Salir al menú"
            aria-label="Salir de la partida"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between text-xs px-2 game-muted font-semibold">
        <div className="flex items-center gap-1.5">
          <span className="game-muted">Ronda:</span>
          <span className="game-text font-bold">
            {roundNumber} / {maxRounds}
          </span>
        </div>

        <div className="flex items-center gap-1.5 font-mono">
          <span className="game-muted">Tiempo:</span>
          <span className="text-indigo-300 font-bold">
            {formatTime(elapsedSeconds)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <span
            className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}
          />
          <span className="text-[11px]">
            {isConnected ? "Conectado" : "Reconectando"}
          </span>
        </div>
      </div>
    </header>
  );
};
