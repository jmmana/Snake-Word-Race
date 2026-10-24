export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type QuestionType =
  | "multiple_choice"
  | "letter_scramble"
  | "text_input"
  | "gap_fill";

export type QuestionSkill = "vocabulary" | "grammar" | "collocation" | "idiom";

export interface QuestionDefinition {
  id: string;
  version: number;
  level: CefrLevel;
  type: QuestionType;
  skill: QuestionSkill;
  topic: string;
  clueEn: string;
  instructionEs?: string;
  answer: string;
  acceptedAnswers: string[];
  letterPattern: number[];
  options?: Array<{
    id: string;
    text: string;
  }>;
  correctOptionId?: string;
  explanationEn: string;
  explanationEs: string;
  assetId?: string;
  reviewStatus: "draft" | "reviewed";
}

/**
 * Public DTO sent to the client during active question phase.
 * Excludes answers, acceptedAnswers, correctOptionId, and explanations.
 */
export interface PublicQuestionDTO {
  id: string;
  version: number;
  level: CefrLevel;
  type: QuestionType;
  skill: QuestionSkill;
  topic: string;
  clueEn: string;
  instructionEs?: string;
  letterPattern: number[];
  options?: Array<{
    id: string;
    text: string;
  }>;
  assetId?: string;
}

export type CellType = "normal" | "boost" | "trap" | "duel" | "meta";

export type GameMode = "bot" | "casual" | "ranked" | "speedrun";
export type BotDifficulty = "easy" | "medium" | "hard";

export type MatchState =
  | "LOBBY"
  | "COUNTDOWN"
  | "QUESTION_ACTIVE"
  | "ROUND_RESOLUTION"
  | "RESCUE_ACTIVE"
  | "DUEL_ACTIVE"
  | "FEEDBACK"
  | "TIEBREAK_ACTIVE"
  | "FINISHED"
  | "ABORTED";

export interface Player {
  id: string;
  name: string;
  avatar: string;
  color: string;
  position: number;
  previousPosition: number;
  isReady: boolean;
  isConnected: boolean;
  isBot?: boolean;
  rating?: number;
  stats: {
    correctCount: number;
    totalAnswers: number;
    accumulatedCorrectTimeMs: number;
    boostsTriggered: number;
    trapsFallen: number;
    rescuesSucceeded: number;
    duelsWon: number;
  };
  currentAnswer?: {
    rawAnswer: string;
    optionId?: string;
    receivedAt: number;
    responseTimeMs: number;
    isCorrect?: boolean;
    movement?: number;
  };
  rescueAnswer?: {
    rawAnswer: string;
    optionId?: string;
    receivedAt: number;
    responseTimeMs: number;
    isCorrect?: boolean;
  };
  duelAnswer?: {
    rawAnswer: string;
    optionId?: string;
    receivedAt: number;
    responseTimeMs: number;
    isCorrect?: boolean;
  };
}

export interface PlayerHistoryEntry {
  roundNumber: number;
  question: QuestionDefinition;
  playerAnswer: string;
  isCorrect: boolean;
  responseTimeMs: number;
  movementAwarded: number;
  specialEvent?: "boost" | "trap_rescue_success" | "trap_rescue_fail" | "duel_win" | "duel_loss" | "duel_tie";
}

export interface GameRoom {
  id: string;
  code: string;
  mode: GameMode;
  level: CefrLevel;
  botDifficulty?: BotDifficulty;
  adaptiveBotAssist?: boolean;
  state: MatchState;
  roundNumber: number;
  maxRounds: number;
  players: Player[];
  activeQuestion?: QuestionDefinition;
  publicActiveQuestion?: PublicQuestionDTO;
  rescueQuestion?: QuestionDefinition;
  publicRescueQuestion?: PublicQuestionDTO;
  duelQuestion?: QuestionDefinition;
  publicDuelQuestion?: PublicQuestionDTO;
  tiebreakQuestion?: QuestionDefinition;
  publicTiebreakQuestion?: PublicQuestionDTO;
  roundStartsAt: number;
  roundDeadlineAt: number;
  usedDuelCells: number[];
  winnerId?: string | null;
  finishReason?: "meta_reached" | "round_limit" | "abandonment" | "speedrun_complete";
  history: PlayerHistoryEntry[];
  speedrunStartTime?: number;
  speedrunFinishTime?: number;
  tiebreakRound?: number;
}

export interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  abandonments: number;
  accuracyPercent: number;
  avgResponseTimeMs: number;
  bestStreak: number;
  currentStreak: number;
  ratingByLevel: Record<CefrLevel, number>;
  speedrunBestTimes: Record<CefrLevel, number | null>;
}

export interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  level: CefrLevel;
  rating?: number;
  speedrunTimeMs?: number;
  date: string;
}
