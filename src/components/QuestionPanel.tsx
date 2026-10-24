import React, { useState, useEffect, useRef } from 'react';
import { PublicQuestionDTO } from '../types/game';
import { Clock, Send, RotateCcw, Delete, CheckCircle2 } from 'lucide-react';
import { sound } from '../services/audio';

interface QuestionPanelProps {
  question: PublicQuestionDTO;
  deadlineAt: number;
  durationMs: number;
  onSubmitAnswer: (rawAnswer: string, optionId?: string) => void;
  isLocked: boolean;
  userAnswer?: string;
  isRanked?: boolean;
}

export const QuestionPanel: React.FC<QuestionPanelProps> = ({
  question,
  deadlineAt,
  durationMs,
  onSubmitAnswer,
  isLocked,
  userAnswer,
  isRanked = false
}) => {
  const [timeLeftMs, setTimeLeftMs] = useState<number>(durationMs);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [textValue, setTextValue] = useState<string>('');
  
  // Letter scramble states
  const [scrambleBank, setScrambleBank] = useState<Array<{ char: string; id: number; used: boolean }>>([]);
  const [scrambleAnswer, setScrambleAnswer] = useState<Array<{ char: string; id: number }>>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize timer
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const rem = Math.max(0, deadlineAt - now);
      setTimeLeftMs(rem);

      if (rem <= 3000 && rem > 0 && Math.floor(rem) % 1000 < 100) {
        sound.playTick();
      }

      if (rem <= 0) {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [deadlineAt]);

  // Initialize letter scramble if applicable
  useEffect(() => {
    if (question.type === 'letter_scramble') {
      // Create letter tiles from answer pattern or clue letters
      // Note: for letter_scramble, if options exist or from clue, prepare bank
      let letters: string[] = [];
      if (question.options && question.options.length > 0) {
        letters = question.options[0].text.split('');
      } else {
        // Fallback or scramble from topic
        letters = 'ABCDEFGH'.split('');
      }
      // Shuffle letters
      const shuffled = letters
        .map((c, i) => ({ char: c, id: i, used: false }))
        .sort(() => Math.random() - 0.5);
      setScrambleBank(shuffled);
      setScrambleAnswer([]);
    }
  }, [question]);

  // Focus input on text_input type
  useEffect(() => {
    if (question.type === 'text_input' && inputRef.current && !isLocked) {
      inputRef.current.focus();
    }
  }, [question, isLocked]);

  // Keyboard navigation (1-4 for multiple choice)
  useEffect(() => {
    if (isLocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (question.type === 'multiple_choice' || question.type === 'gap_fill') {
        const keyNum = parseInt(e.key, 10);
        if (keyNum >= 1 && keyNum <= 4 && question.options && question.options[keyNum - 1]) {
          handleSelectOption(question.options[keyNum - 1].id, question.options[keyNum - 1].text);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [question, isLocked]);

  const handleSelectOption = (optionId: string, optionText: string) => {
    if (isLocked) return;
    setSelectedOptionId(optionId);
    onSubmitAnswer(optionText, optionId);
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || !textValue.trim()) return;
    onSubmitAnswer(textValue.trim());
  };

  const handleScrambleAddLetter = (tile: { char: string; id: number }) => {
    if (isLocked) return;
    setScrambleBank(prev => prev.map(t => (t.id === tile.id ? { ...t, used: true } : t)));
    setScrambleAnswer(prev => [...prev, tile]);
  };

  const handleScrambleBackspace = () => {
    if (isLocked || scrambleAnswer.length === 0) return;
    const last = scrambleAnswer[scrambleAnswer.length - 1];
    setScrambleBank(prev => prev.map(t => (t.id === last.id ? { ...t, used: false } : t)));
    setScrambleAnswer(prev => prev.slice(0, -1));
  };

  const handleScrambleReset = () => {
    if (isLocked) return;
    setScrambleBank(prev => prev.map(t => ({ ...t, used: false })));
    setScrambleAnswer([]);
  };

  const handleScrambleSubmit = () => {
    if (isLocked || scrambleAnswer.length === 0) return;
    const word = scrambleAnswer.map(t => t.char).join('');
    onSubmitAnswer(word);
  };

  // Timer Progress Calculation
  const progressPercent = Math.min(100, Math.max(0, (timeLeftMs / durationMs) * 100));
  let timerBarColor = 'bg-emerald-500 shadow-emerald-500/50';
  if (progressPercent < 30) {
    timerBarColor = 'bg-rose-500 shadow-rose-500/50 animate-pulse';
  } else if (progressPercent < 55) {
    timerBarColor = 'bg-amber-500 shadow-amber-500/50';
  }

  const secondsDisplay = (timeLeftMs / 1000).toFixed(1);

  return (
    <div className="w-full max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md relative overflow-hidden">
      {/* Top Countdown Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs font-bold mb-1.5">
          <span className="flex items-center gap-1.5 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Tiempo de respuesta</span>
          </span>
          <span className={`font-mono text-sm ${timeLeftMs < 3000 ? 'text-rose-400 font-black' : 'text-slate-200'}`}>
            {secondsDisplay}s
          </span>
        </div>
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-75 shadow-sm ${timerBarColor}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Question Header & Clue */}
      <div className="mb-4 bg-slate-800/70 border border-slate-700/60 rounded-xl p-3">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
          <span className="text-indigo-400">{question.topic}</span>
          <span className="bg-slate-700/80 px-2 py-0.5 rounded text-slate-300">
            {question.type.replace('_', ' ')}
          </span>
        </div>

        <p className="text-sm font-medium text-slate-100 leading-snug">
          {question.clueEn}
        </p>

        {question.instructionEs && (
          <p className="text-xs text-slate-400 mt-1 italic">
            {question.instructionEs}
          </p>
        )}

        {/* Pattern Hint: [3, 3] letters */}
        {question.letterPattern && question.letterPattern.length > 0 && (
          <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-400 font-mono">
            <span className="text-slate-500">Patrón:</span>
            <span className="bg-slate-900/90 text-indigo-300 px-1.5 py-0.5 rounded font-semibold border border-slate-800">
              [{question.letterPattern.join(', ')}] letras
            </span>
          </div>
        )}
      </div>

      {/* Answer Area by Type */}
      {(question.type === 'multiple_choice' || question.type === 'gap_fill') && question.options && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {question.options.map((opt, index) => {
            const isSelected = selectedOptionId === opt.id || userAnswer === opt.text;
            return (
              <button
                key={opt.id}
                onClick={() => handleSelectOption(opt.id, opt.text)}
                disabled={isLocked}
                className={`relative flex items-center gap-2 p-3 rounded-xl border text-left text-xs font-semibold transition-all duration-150 ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/40 ring-2 ring-indigo-400'
                    : 'bg-slate-800/90 text-slate-200 border-slate-700 hover:bg-slate-750 hover:border-slate-600'
                } ${isLocked ? 'cursor-not-allowed opacity-80' : 'active:scale-95'}`}
              >
                <span className="flex items-center justify-center w-5 h-5 rounded-md bg-slate-900/60 text-slate-300 font-mono text-[10px] font-bold">
                  {index + 1}
                </span>
                <span className="flex-1 break-words leading-tight">{opt.text}</span>
              </button>
            );
          })}
        </div>
      )}

      {question.type === 'text_input' && (
        <form onSubmit={handleTextSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={textValue}
            onChange={e => setTextValue(e.target.value)}
            disabled={isLocked}
            autoComplete={isRanked ? 'off' : 'on'}
            autoCorrect={isRanked ? 'off' : 'on'}
            spellCheck={false}
            placeholder="Escribe tu respuesta..."
            className="flex-1 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={isLocked || !textValue.trim()}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 text-white rounded-xl font-semibold text-xs flex items-center gap-1.5 transition shadow-md shadow-indigo-600/30"
          >
            <Send className="w-4 h-4" />
            <span>Enviar</span>
          </button>
        </form>
      )}

      {question.type === 'letter_scramble' && (
        <div className="space-y-3">
          {/* Constructed word display */}
          <div className="min-h-11 p-2 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-center gap-1.5 flex-wrap">
            {scrambleAnswer.map((tile, i) => (
              <span
                key={i}
                className="w-7 h-8 flex items-center justify-center bg-indigo-600 text-white font-bold rounded-lg shadow text-xs uppercase"
              >
                {tile.char}
              </span>
            ))}
            {scrambleAnswer.length === 0 && (
              <span className="text-xs text-slate-500">Toca las letras para formar la palabra</span>
            )}
          </div>

          {/* Letter Bank */}
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {scrambleBank.map(tile => (
              <button
                key={tile.id}
                onClick={() => handleScrambleAddLetter(tile)}
                disabled={tile.used || isLocked}
                className={`w-8 h-9 rounded-lg font-bold text-xs uppercase transition shadow-sm ${
                  tile.used
                    ? 'bg-slate-800 text-slate-600 border border-slate-800/40 opacity-40 cursor-not-allowed'
                    : 'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 active:scale-95'
                }`}
              >
                {tile.char}
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={handleScrambleBackspace}
                disabled={isLocked || scrambleAnswer.length === 0}
                className="p-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 disabled:opacity-50 text-xs flex items-center gap-1"
                title="Borrar última"
              >
                <Delete className="w-3.5 h-3.5" />
                <span>Borrar</span>
              </button>
              <button
                type="button"
                onClick={handleScrambleReset}
                disabled={isLocked || scrambleAnswer.length === 0}
                className="p-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 disabled:opacity-50 text-xs flex items-center gap-1"
                title="Reiniciar"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reiniciar</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleScrambleSubmit}
              disabled={isLocked || scrambleAnswer.length === 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Enviar</span>
            </button>
          </div>
        </div>
      )}

      {/* Confirmation State */}
      {isLocked && (
        <div className="mt-3 py-2 px-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-emerald-300 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Respuesta enviada. Esperando fin de ronda...</span>
        </div>
      )}
    </div>
  );
};
