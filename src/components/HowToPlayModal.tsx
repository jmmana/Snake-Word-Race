import React from "react";
import {
  X,
  Zap,
  Skull,
  Swords,
  Trophy,
  Clock,
  CheckCircle2,
} from "lucide-react";

import { useDialogFocus } from "./useDialogFocus";
interface HowToPlayModalProps {
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ onClose }) => {
  const dialogRef = useDialogFocus(onClose);
  return (
    <div className="game-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Cómo jugar"
        className="game-modal w-full max-w-md game-surface border game-border rounded-2xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b game-border pb-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold game-text">
              Cómo Jugar: Snake Word Race
            </h3>
          </div>
          <button
            aria-label="Cerrar cómo jugar"
            onClick={onClose}
            className="p-1 rounded-lg game-muted game-hover-text game-hover transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Objetivo */}
        <div className="space-y-1.5 text-xs game-muted">
          <h4 className="font-bold game-text text-sm flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>1. Objetivo de la Carrera</span>
          </h4>
          <p className="leading-relaxed game-muted">
            Comienzas en la <strong>casilla 0</strong>. El primero en alcanzar o
            superar la <strong>casilla 30</strong> gana la partida. No hay
            dados: tu avance depende de la rapidez y precisión de tus respuestas
            en inglés.
          </p>
        </div>

        {/* 2. Reglas de Movimiento */}
        <div className="space-y-1.5 text-xs game-muted">
          <h4 className="font-bold game-text text-sm flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>2. Rondas y Puntuación por Velocidad</span>
          </h4>
          <div className="game-page border game-border rounded-xl p-3 space-y-1.5 text-[11px]">
            <div className="flex justify-between items-center text-emerald-300">
              <span>Respuesta correcta en menos de 3.5s:</span>
              <span className="font-bold">+2 casillas</span>
            </div>
            <div className="flex justify-between items-center text-indigo-300">
              <span>Respuesta correcta de 3.5s a 10s:</span>
              <span className="font-bold">+1 casilla</span>
            </div>
            <div className="flex justify-between items-center text-rose-400">
              <span>Respuesta incorrecta o tiempo agotado:</span>
              <span className="font-bold">0 casillas</span>
            </div>
          </div>
        </div>

        {/* 3. Casillas Especiales */}
        <div className="space-y-2 text-xs">
          <h4 className="font-bold game-text text-sm">
            3. Casillas Especiales
          </h4>
          <p className="text-[11px] game-muted">
            Solo se activan si tu movimiento termina exactamente en ellas (pasar
            por encima no las activa):
          </p>

          <div className="space-y-2 text-[11px]">
            {/* Boost */}
            <div className="flex items-start gap-2 bg-emerald-950/40 border border-emerald-500/30 p-2.5 rounded-xl text-emerald-200">
              <Zap className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-emerald-300 block">
                  Boost (Casillas 6, 14, 22)
                </strong>
                Si aterrizas aquí habiendo acertado en menos de 4.0s, recibes un
                impulso extra de <strong>+2 casillas</strong>.
              </div>
            </div>

            {/* Trap */}
            <div className="flex items-start gap-2 bg-rose-950/40 border border-rose-500/30 p-2.5 rounded-xl text-rose-200">
              <Skull className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-rose-300 block">
                  Trampa (Casillas 9, 18, 25)
                </strong>
                Aparece una pregunta de rescate (6s). Si aciertas te quedas en
                la casilla; si fallas retrocedes <strong>-3 casillas</strong>.
              </div>
            </div>

            {/* Duel */}
            <div className="flex items-start gap-2 bg-purple-950/40 border border-purple-500/30 p-2.5 rounded-xl text-purple-200">
              <Swords className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-purple-300 block">
                  Duelo (Casillas 12, 27)
                </strong>
                Si ambos rivales coinciden en esta casilla, se activa un
                enfrentamiento directo (6s). El primero en acertar avanza{" "}
                <strong>+2 casillas</strong>.
              </div>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 game-text rounded-xl text-xs font-bold transition shadow-md"
        >
          ¡Entendido, a jugar!
        </button>
      </div>
    </div>
  );
};
