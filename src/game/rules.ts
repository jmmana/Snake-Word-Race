import {
  CefrLevel,
  CellType,
  QuestionDefinition,
  Player,
  PublicQuestionDTO
} from '../types/game';

export const BOOST_CELLS = [6, 14, 22] as const;
export const TRAP_CELLS = [9, 18, 25] as const;
export const DUEL_CELLS = [12, 27] as const;
export const META_CELL = 30;
export const STANDARD_QUESTION_DURATION_MS = 10000;
export const RESCUE_QUESTION_DURATION_MS = 6000;
export const DUEL_QUESTION_DURATION_MS = 6000;
export const TIEBREAK_QUESTION_DURATION_MS = 6000;
export const MAX_MATCH_ROUNDS = 60;

export function getCellType(cell: number): CellType {
  if (cell === META_CELL) return 'meta';
  if ((BOOST_CELLS as readonly number[]).includes(cell)) return 'boost';
  if ((TRAP_CELLS as readonly number[]).includes(cell)) return 'trap';
  if ((DUEL_CELLS as readonly number[]).includes(cell)) return 'duel';
  return 'normal';
}

/**
 * Normalizes text per spec:
 * 1. Unicode normalization
 * 2. Trim whitespace
 * 3. Reduce repeated whitespace
 * 4. Case-insensitive
 * 5. Normalize typographic apostrophes
 */
export function normalizeAnswer(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFKC')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Checks if a player's answer is correct against the QuestionDefinition.
 */
export function isAnswerCorrect(
  question: QuestionDefinition,
  rawAnswer: string,
  optionId?: string
): boolean {
  if (question.type === 'multiple_choice' || question.type === 'gap_fill') {
    if (optionId && question.correctOptionId) {
      return optionId === question.correctOptionId;
    }
  }

  const normalizedInput = normalizeAnswer(rawAnswer);
  const normalizedTarget = normalizeAnswer(question.answer);

  if (normalizedInput === normalizedTarget) {
    return true;
  }

  if (question.acceptedAnswers && question.acceptedAnswers.length > 0) {
    return question.acceptedAnswers.some(
      ans => normalizeAnswer(ans) === normalizedInput
    );
  }

  return false;
}

/**
 * Calculates base movement from response time and correctness:
 * - Incorrect / timeout: 0
 * - Correct in < 3500ms: +2
 * - Correct from 3500ms to before deadline: +1
 * - Received >= deadline: 0 (rejected)
 */
export function calculateBaseMovement(
  isCorrect: boolean,
  responseTimeMs: number,
  deadlineMs: number = STANDARD_QUESTION_DURATION_MS
): number {
  if (!isCorrect) return 0;
  if (responseTimeMs >= deadlineMs) return 0;
  if (responseTimeMs < 3500) {
    return 2;
  }
  return 1;
}

export interface PlayerRoundResolution {
  playerId: string;
  initialPosition: number;
  baseMovement: number;
  landedPosition: number;
  isCorrect: boolean;
  responseTimeMs: number;
  boostApplied: boolean;
  boostMovement: number;
  trapTriggered: boolean;
  rescueNeeded: boolean;
  positionAfterBoost: number;
  finalPosition: number;
}

/**
 * Resolves standard round base movement and boost activations.
 */
export function resolveStandardRound(
  players: Player[],
  roundDurationMs: number = STANDARD_QUESTION_DURATION_MS
): PlayerRoundResolution[] {
  return players.map((player) => {
    const ans = player.currentAnswer;
    const isCorrect = Boolean(ans && ans.isCorrect);
    const responseTime = ans ? ans.responseTimeMs : roundDurationMs;

    const baseMovement = calculateBaseMovement(isCorrect, responseTime, roundDurationMs);
    const landedPosition = Math.min(META_CELL, player.position + baseMovement);

    // Boost rule:
    // Landed on 6, 14, 22 this round
    // Answer was correct AND responseTimeMs < 4000
    // passing over doesn't activate; staying still doesn't reactivate
    let boostApplied = false;
    let boostMovement = 0;

    const justLandedOnCell = landedPosition !== player.position;
    if (
      justLandedOnCell &&
      (BOOST_CELLS as readonly number[]).includes(landedPosition) &&
      isCorrect &&
      responseTime < 4000
    ) {
      boostApplied = true;
      boostMovement = 2;
    }

    const positionAfterBoost = Math.min(META_CELL, landedPosition + boostMovement);

    // Trap rule:
    // Landed on 9, 18, 25 this round
    const trapTriggered =
      justLandedOnCell &&
      (TRAP_CELLS as readonly number[]).includes(landedPosition);

    return {
      playerId: player.id,
      initialPosition: player.position,
      baseMovement,
      landedPosition,
      isCorrect,
      responseTimeMs: responseTime,
      boostApplied,
      boostMovement,
      trapTriggered,
      rescueNeeded: trapTriggered,
      positionAfterBoost,
      finalPosition: positionAfterBoost
    };
  });
}

/**
 * Resolves rescue outcomes:
 * Correct: stays in place.
 * Incorrect / Timeout: moves back 3 cells (minimum 0).
 * No chained activations!
 */
export function resolveRescue(
  currentPosition: number,
  isCorrect: boolean
): { finalPosition: number; penaltyApplied: boolean } {
  if (isCorrect) {
    return {
      finalPosition: currentPosition,
      penaltyApplied: false
    };
  }
  return {
    finalPosition: Math.max(0, currentPosition - 3),
    penaltyApplied: true
  };
}

/**
 * Checks duel activation condition per spec:
 * - Both end in the same duel cell (12 or 27)
 * - At least one landed in it this round
 * - The other arrived this round or in immediately previous round
 * - Cell hasn't been used for a duel in this match
 */
export function canActivateDuel(
  playerA: Player,
  playerB: Player,
  cell: number,
  usedDuelCells: number[],
  playerALandedThisRound: boolean,
  playerBLandedThisRound: boolean,
  playerAArrivedLastRound: boolean,
  playerBArrivedLastRound: boolean
): boolean {
  if (!(DUEL_CELLS as readonly number[]).includes(cell)) return false;
  if (usedDuelCells.includes(cell)) return false;
  if (playerA.position !== cell || playerB.position !== cell) return false;

  const validArrivalA = playerALandedThisRound || playerAArrivedLastRound;
  const validArrivalB = playerBLandedThisRound || playerBArrivedLastRound;

  const atLeastOneCurrent = playerALandedThisRound || playerBLandedThisRound;

  return atLeastOneCurrent && validArrivalA && validArrivalB;
}

export interface DuelOutcome {
  winnerId: string | null;
  isTie: boolean;
  rewardMap: Record<string, number>;
}

/**
 * Resolves duel rewards:
 * Winner: +2 cells
 * Loser: remains
 * Both wrong: nobody moves
 * Tie (both correct with <= 100ms difference): both +1
 */
export function resolveDuel(
  playerA: Player,
  playerB: Player
): DuelOutcome {
  const ansA = playerA.duelAnswer;
  const ansB = playerB.duelAnswer;

  const aCorrect = Boolean(ansA && ansA.isCorrect);
  const bCorrect = Boolean(ansB && ansB.isCorrect);

  if (aCorrect && !bCorrect) {
    return {
      winnerId: playerA.id,
      isTie: false,
      rewardMap: { [playerA.id]: 2, [playerB.id]: 0 }
    };
  }

  if (bCorrect && !aCorrect) {
    return {
      winnerId: playerB.id,
      isTie: false,
      rewardMap: { [playerA.id]: 0, [playerB.id]: 2 }
    };
  }

  if (aCorrect && bCorrect) {
    const timeA = ansA!.responseTimeMs;
    const timeB = ansB!.responseTimeMs;
    const diff = Math.abs(timeA - timeB);

    if (diff <= 100) {
      // Tie
      return {
        winnerId: null,
        isTie: true,
        rewardMap: { [playerA.id]: 1, [playerB.id]: 1 }
      };
    }

    if (timeA < timeB) {
      return {
        winnerId: playerA.id,
        isTie: false,
        rewardMap: { [playerA.id]: 2, [playerB.id]: 0 }
      };
    } else {
      return {
        winnerId: playerB.id,
        isTie: false,
        rewardMap: { [playerA.id]: 0, [playerB.id]: 2 }
      };
    }
  }

  // Neither correct
  return {
    winnerId: null,
    isTie: false,
    rewardMap: { [playerA.id]: 0, [playerB.id]: 0 }
  };
}

/**
 * Evaluates match winner:
 * Normal win: reaches 30
 * Simultaneous arrival tiebreak criteria:
 * 1. Total correct main answers
 * 2. Total accumulated correct response times
 * 3. Tiebreak question round needed if within 100ms
 */
export function evaluateMatchWinner(
  playerA: Player,
  playerB?: Player
): {
  isFinished: boolean;
  winnerId: string | null;
  needsTiebreak: boolean;
  reason?: "meta_reached" | "round_limit";
} {
  // Solo mode
  if (!playerB) {
    if (playerA.position >= META_CELL) {
      return { isFinished: true, winnerId: playerA.id, needsTiebreak: false, reason: "meta_reached" };
    }
    return { isFinished: false, winnerId: null, needsTiebreak: false };
  }

  const aReached = playerA.position >= META_CELL;
  const bReached = playerB.position >= META_CELL;

  if (aReached && !bReached) {
    return { isFinished: true, winnerId: playerA.id, needsTiebreak: false, reason: "meta_reached" };
  }
  if (bReached && !aReached) {
    return { isFinished: true, winnerId: playerB.id, needsTiebreak: false, reason: "meta_reached" };
  }

  if (aReached && bReached) {
    // Both reached simultaneously
    // 1. Compare total correct main answers
    if (playerA.stats.correctCount > playerB.stats.correctCount) {
      return { isFinished: true, winnerId: playerA.id, needsTiebreak: false, reason: "meta_reached" };
    }
    if (playerB.stats.correctCount > playerA.stats.correctCount) {
      return { isFinished: true, winnerId: playerB.id, needsTiebreak: false, reason: "meta_reached" };
    }

    // 2. Compare accumulated time of correct answers
    const diff = Math.abs(playerA.stats.accumulatedCorrectTimeMs - playerB.stats.accumulatedCorrectTimeMs);
    if (diff > 100) {
      const winnerId =
        playerA.stats.accumulatedCorrectTimeMs < playerB.stats.accumulatedCorrectTimeMs
          ? playerA.id
          : playerB.id;
      return { isFinished: true, winnerId, needsTiebreak: false, reason: "meta_reached" };
    }

    // 3. Difference <= 100ms requires tiebreak
    return { isFinished: false, winnerId: null, needsTiebreak: true, reason: "meta_reached" };
  }

  return { isFinished: false, winnerId: null, needsTiebreak: false };
}

/**
 * Strips secret answers and explanations to create safe PublicQuestionDTO.
 */
export function toPublicQuestion(q: QuestionDefinition): PublicQuestionDTO {
  return {
    id: q.id,
    version: q.version,
    level: q.level,
    type: q.type,
    skill: q.skill,
    topic: q.topic,
    clueEn: q.clueEn,
    instructionEs: q.instructionEs,
    letterPattern: q.letterPattern,
    options: q.options?.map(opt => ({
      id: opt.id,
      text: opt.text
    })),
    assetId: q.assetId
  };
}

/**
 * Calculates updated Elo ratings.
 * Initial rating: 1000, K-factor: 32.
 * score: 1 for win, 0 for loss, 0.5 for tie.
 */
export function calculateElo(
  ratingA: number,
  ratingB: number,
  scoreA: number,
  kFactor: number = 32
): { newRatingA: number; newRatingB: number } {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 - expectedA;
  const scoreB = 1 - scoreA;

  const newRatingA = Math.round(ratingA + kFactor * (scoreA - expectedA));
  const newRatingB = Math.round(ratingB + kFactor * (scoreB - expectedB));

  return { newRatingA, newRatingB };
}
