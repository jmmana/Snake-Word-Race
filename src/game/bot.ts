import {
  BotDifficulty,
  QuestionDefinition,
  Player
} from '../types/game';

export interface BotDecision {
  isCorrect: boolean;
  responseTimeMs: number;
  answerText: string;
  optionId?: string;
}

export class BotSimulator {
  private seed: number;

  constructor(initialSeed: number = Date.now()) {
    this.seed = initialSeed;
  }

  public setSeed(seed: number) {
    this.seed = seed;
  }

  // Simple deterministic Linear Congruential Generator for reproducible tests
  private nextRandom(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  /**
   * Plans the bot's decision at the beginning of a question window.
   */
  public planDecision(
    question: QuestionDefinition,
    difficulty: BotDifficulty = 'medium',
    windowDurationMs: number = 10000,
    humanPosition?: number,
    botPosition?: number,
    adaptiveAssistEnabled?: boolean
  ): BotDecision {
    // 1. Base accuracy & mean target time
    let baseAccuracy = 0.85;
    let meanTimeMs = 4500;

    if (difficulty === 'easy') {
      baseAccuracy = 0.70;
      meanTimeMs = 6500;
    } else if (difficulty === 'hard') {
      baseAccuracy = 0.95;
      meanTimeMs = 2500;
    }

    // Adaptive assistance in practice mode:
    // If human is > 5 squares behind bot, reduce accuracy by 20 percentage points
    if (
      adaptiveAssistEnabled &&
      humanPosition !== undefined &&
      botPosition !== undefined &&
      botPosition - humanPosition > 5
    ) {
      baseAccuracy = Math.max(0.20, baseAccuracy - 0.20);
    }

    const rollAcc = this.nextRandom();
    const isCorrect = rollAcc < baseAccuracy;

    // Timeout chance: 3% on easy, 1% on medium, 0% on hard
    const timeoutThreshold = difficulty === 'easy' ? 0.03 : difficulty === 'medium' ? 0.01 : 0.00;
    const isTimeout = this.nextRandom() < timeoutThreshold;

    let responseTimeMs = 0;
    if (isTimeout) {
      responseTimeMs = windowDurationMs + 200; // past deadline
    } else {
      // Gaussian-like variance around meanTimeMs
      const variance = (this.nextRandom() - 0.5) * 1600;
      responseTimeMs = Math.round(meanTimeMs + variance);
      // Clamp between min 1800ms and windowDurationMs - 400ms
      responseTimeMs = Math.max(1800, Math.min(windowDurationMs - 400, responseTimeMs));
    }

    // Prepare answer content
    let answerText = '';
    let optionId: string | undefined = undefined;

    if (question.type === 'multiple_choice' || question.type === 'gap_fill') {
      if (isCorrect) {
        answerText = question.answer;
        optionId = question.correctOptionId;
      } else {
        // Pick an incorrect option
        const wrongOpts = question.options?.filter(o => o.id !== question.correctOptionId) || [];
        if (wrongOpts.length > 0) {
          const chosen = wrongOpts[Math.floor(this.nextRandom() * wrongOpts.length)];
          answerText = chosen.text;
          optionId = chosen.id;
        } else {
          answerText = 'WRONG_ANSWER';
        }
      }
    } else {
      // Free text / letter scramble
      if (isCorrect) {
        answerText = question.answer;
      } else {
        answerText = question.answer.slice(0, Math.max(1, question.answer.length - 2)) + 'X';
      }
    }

    return {
      isCorrect: !isTimeout && isCorrect,
      responseTimeMs,
      answerText,
      optionId
    };
  }
}
