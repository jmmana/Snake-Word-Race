import React, { useEffect } from "react";
import { QuestionDefinition, Player } from "../types/game";
import {
  CheckCircle2,
  XCircle,
  Zap,
  Skull,
  Swords,
  ArrowRight,
} from "lucide-react";
import { sound } from "../services/audio";

interface ResolutionModalProps {
  question: QuestionDefinition;
  player: Player;
  opponent?: Player;
  onContinue?: () => void;
  isAutoDismiss?: boolean;
}

export const ResolutionModal: React.FC<ResolutionModalProps> = ({
  question,
  player,
  opponent,
  onContinue,
  isAutoDismiss = true,
}) => {
  const ans = player.currentAnswer;
  const isCorrect = Boolean(ans && ans.isCorrect);

  useEffect(() => {
    if (isCorrect) {
      sound.playCorrect();
    } else {
      sound.playWrong();
    }
  }, [isCorrect]);

  return (
    <div
      className="resolution-card animate-fadeIn"
      role="status"
      aria-live="polite"
    >
      <div className="resolution-content space-y-4">
        {/* Result Header */}
        <div className="flex items-center gap-3">
          {isCorrect ? (
            <div className="p-2.5 rounded-full bg-emerald-950 border border-emerald-500/50 text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          ) : (
            <div className="p-2.5 rounded-full bg-rose-950 border border-rose-500/50 text-rose-400">
              <XCircle className="w-6 h-6" />
            </div>
          )}
          <div>
            <h3 className="text-base font-bold game-text">
              {isCorrect ? "¡Respuesta Correcta!" : "Respuesta Incorrecta"}
            </h3>
            <p className="text-xs game-muted">
              {isCorrect
                ? ans && ans.responseTimeMs < 3500
                  ? `Rápido: +2 casillas (${(ans.responseTimeMs / 1000).toFixed(1)}s)`
                  : `+1 casilla (${((ans?.responseTimeMs || 0) / 1000).toFixed(1)}s)`
                : "Sin movimiento"}
            </p>
          </div>
        </div>

        {/* Answers comparison */}
        <div className="game-page border game-border rounded-xl p-3 space-y-2 text-xs">
          <div>
            <span className="game-muted block mb-0.5">Solución oficial:</span>
            <span className="font-bold text-emerald-400 text-sm">
              {question.answer}
            </span>
          </div>

          {!isCorrect && ans?.rawAnswer && (
            <div>
              <span className="game-muted block mb-0.5">Tu respuesta:</span>
              <span className="font-medium text-rose-400 line-through">
                {ans.rawAnswer}
              </span>
            </div>
          )}

          {/* Educational Explanations */}
          <div className="pt-2 border-t game-border game-muted space-y-1">
            <p className="font-medium leading-relaxed">
              {question.explanationEn}
            </p>
            {question.explanationEs && (
              <p className="text-[11px] game-muted italic">
                {question.explanationEs}
              </p>
            )}
          </div>
        </div>

        {/* Movement and Opponent snapshot */}
        <div className="flex items-center justify-between text-xs game-soft px-3 py-2 rounded-xl border game-border">
          <div className="flex items-center gap-1.5">
            <span className="game-muted">Posición actual:</span>
            <span className="font-bold text-indigo-400 text-sm">
              Casilla {player.position}
            </span>
          </div>

          {opponent && (
            <div className="game-muted text-[11px]">
              {opponent.name}:{" "}
              <strong className="game-text">Casilla {opponent.position}</strong>
            </div>
          )}
        </div>

        {!isAutoDismiss && onContinue && (
          <button
            onClick={onContinue}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 game-text rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md"
          >
            <span>Siguiente Ronda</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
