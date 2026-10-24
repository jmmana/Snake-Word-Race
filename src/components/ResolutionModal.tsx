import React, { useEffect } from 'react';
import { QuestionDefinition, Player } from '../types/game';
import { CheckCircle2, XCircle, Zap, Skull, Swords, ArrowRight } from 'lucide-react';
import { sound } from '../services/audio';

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
  isAutoDismiss = true
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-2xl p-5 shadow-2xl space-y-4">
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
            <h3 className="text-base font-bold text-slate-100">
              {isCorrect ? '¡Respuesta Correcta!' : 'Respuesta Incorrecta'}
            </h3>
            <p className="text-xs text-slate-400">
              {isCorrect
                ? ans && ans.responseTimeMs < 3500
                  ? `Rápido: +2 casillas (${(ans.responseTimeMs / 1000).toFixed(1)}s)`
                  : `+1 casilla (${((ans?.responseTimeMs || 0) / 1000).toFixed(1)}s)`
                : 'Sin movimiento'}
            </p>
          </div>
        </div>

        {/* Answers comparison */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
          <div>
            <span className="text-slate-500 block mb-0.5">Solución oficial:</span>
            <span className="font-bold text-emerald-400 text-sm">{question.answer}</span>
          </div>

          {!isCorrect && ans?.rawAnswer && (
            <div>
              <span className="text-slate-500 block mb-0.5">Tu respuesta:</span>
              <span className="font-medium text-rose-400 line-through">{ans.rawAnswer}</span>
            </div>
          )}

          {/* Educational Explanations */}
          <div className="pt-2 border-t border-slate-800 text-slate-300 space-y-1">
            <p className="font-medium leading-relaxed">{question.explanationEn}</p>
            {question.explanationEs && (
              <p className="text-[11px] text-slate-400 italic">{question.explanationEs}</p>
            )}
          </div>
        </div>

        {/* Movement and Opponent snapshot */}
        <div className="flex items-center justify-between text-xs bg-slate-800/60 px-3 py-2 rounded-xl border border-slate-700/50">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Posición actual:</span>
            <span className="font-bold text-indigo-400 text-sm">
              Casilla {player.position}
            </span>
          </div>

          {opponent && (
            <div className="text-slate-400 text-[11px]">
              {opponent.name}: <strong className="text-slate-200">Casilla {opponent.position}</strong>
            </div>
          )}
        </div>

        {!isAutoDismiss && onContinue && (
          <button
            onClick={onContinue}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md"
          >
            <span>Siguiente Ronda</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
