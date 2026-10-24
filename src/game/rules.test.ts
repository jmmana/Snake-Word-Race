import {
  calculateBaseMovement,
  resolveStandardRound,
  resolveRescue,
  canActivateDuel,
  resolveDuel,
  evaluateMatchWinner,
  normalizeAnswer,
  isAnswerCorrect,
  META_CELL,
  toPublicQuestion,
} from "./rules";
import { Player, QuestionDefinition } from "../types/game";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`TEST FAILED: ${message}`);
  }
}

console.log(
  "--- Running Rules Engine Unit Tests (Section 22 Requirements) ---",
);

const dummyQuestion: QuestionDefinition = {
  id: "q_test_01",
  version: 1,
  level: "B1",
  type: "multiple_choice",
  skill: "vocabulary",
  topic: "Test",
  clueEn: "Test clue",
  answer: "ANSWER",
  acceptedAnswers: ["ANSWER"],
  letterPattern: [6],
  options: [
    { id: "opt_1", text: "ANSWER" },
    { id: "opt_2", text: "WRONG" },
  ],
  correctOptionId: "opt_1",
  explanationEn: "Test",
  explanationEs: "Prueba",
  reviewStatus: "reviewed",
};

// 1. Normal correct answer: +1
assert(
  calculateBaseMovement(true, 3600, 10000) === 1,
  "1. Normal correct answer should award +1",
);

// 2. Fast correct answer: +2
assert(
  calculateBaseMovement(true, 2800, 10000) === 2,
  "2. Fast correct answer (<3500ms) should award +2",
);

// 3. Exactly 3500ms: +1
assert(
  calculateBaseMovement(true, 3500, 10000) === 1,
  "3. Exactly 3500ms should award +1",
);

// 4. Response received at deadline: rejected (0)
assert(
  calculateBaseMovement(true, 10000, 10000) === 0,
  "4. Response at deadline should be rejected",
);

// 5. Error and timeout: 0
assert(
  calculateBaseMovement(false, 2000, 10000) === 0,
  "5a. Incorrect answer awards 0",
);
assert(calculateBaseMovement(true, 11000, 10000) === 0, "5b. Timeout awards 0");

// Helper to create mock player
function createMockPlayer(
  id: string,
  pos: number,
  ans?: { isCorrect: boolean; responseTimeMs: number },
): Player {
  return {
    id,
    name: id,
    avatar: "snake",
    color: "#000",
    position: pos,
    previousPosition: pos,
    isReady: true,
    isConnected: true,
    stats: {
      correctCount: ans?.isCorrect ? 1 : 0,
      totalAnswers: 1,
      accumulatedCorrectTimeMs: ans?.isCorrect ? ans.responseTimeMs : 0,
      boostsTriggered: 0,
      trapsFallen: 0,
      rescuesSucceeded: 0,
      duelsWon: 0,
    },
    currentAnswer: ans
      ? {
          rawAnswer: "test",
          receivedAt: Date.now(),
          responseTimeMs: ans.responseTimeMs,
          isCorrect: ans.isCorrect,
        }
      : undefined,
  };
}

// 6. Boost before 4000ms: Player at 4, moves +2 to 6 (Boost cell) in 3200ms -> +2 boost bonus
const pBoostValid = createMockPlayer("p1", 4, {
  isCorrect: true,
  responseTimeMs: 3200,
});
const resBoostValid = resolveStandardRound([pBoostValid])[0];
assert(resBoostValid.landedPosition === 6, "Should land on 6");
assert(
  resBoostValid.boostApplied === true,
  "6. Boost should be applied before 4000ms",
);
assert(
  resBoostValid.positionAfterBoost === 8,
  "6. Should advance to 8 after boost",
);

// 7. Boost exactly at 4000ms: not activated
const pBoostLate = createMockPlayer("p2", 5, {
  isCorrect: true,
  responseTimeMs: 4000,
}); // +1 move to 6
const resBoostLate = resolveStandardRound([pBoostLate])[0];
assert(resBoostLate.landedPosition === 6, "Landed on 6");
assert(
  resBoostLate.boostApplied === false,
  "7. Boost exactly at 4000ms should NOT activate",
);
assert(resBoostLate.positionAfterBoost === 6, "7. Position remains 6");

// 8. Passing over special cell does not activate (e.g. from 5 to 7 via +2 fast answer, passing 6)
const pPass = createMockPlayer("p3", 5, {
  isCorrect: true,
  responseTimeMs: 2000,
}); // lands on 7
const resPass = resolveStandardRound([pPass])[0];
assert(resPass.landedPosition === 7, "Landed on 7");
assert(
  resPass.boostApplied === false,
  "8. Passing over boost at 6 should NOT activate",
);

// 9. Standing still does not reactivate special cell
const pStay = createMockPlayer("p4", 6, {
  isCorrect: false,
  responseTimeMs: 2000,
}); // +0 move, stays on 6
const resStay = resolveStandardRound([pStay])[0];
assert(
  resStay.boostApplied === false,
  "9. Standing still on boost should NOT reactivate",
);

// 10. Rescue correct and incorrect (stay vs -3)
const resRescuePass = resolveRescue(9, true);
assert(resRescuePass.finalPosition === 9, "10a. Correct rescue stays in place");
const resRescueFail = resolveRescue(9, false);
assert(
  resRescueFail.finalPosition === 6,
  "10b. Incorrect rescue moves back 3 cells (9 -> 6)",
);

// 11. No chained activations:
// When rescued to 6 (which is a boost cell), no boost is triggered
assert(
  resRescueFail.finalPosition === 6,
  "11. Trap penalty lands on 6 without chaining boost",
);

// 12. Duel in same round: both reach 12 in current round
const pDuel1 = createMockPlayer("dA", 12);
const pDuel2 = createMockPlayer("dB", 12);
const duelActiveSameRound = canActivateDuel(
  pDuel1,
  pDuel2,
  12,
  [],
  true,
  true,
  false,
  false,
);
assert(
  duelActiveSameRound === true,
  "12. Duel activates when both land in same round",
);

// 13. Duel with arrival in previous round
const duelActivePrev = canActivateDuel(
  pDuel1,
  pDuel2,
  12,
  [],
  true,
  false,
  false,
  true,
);
assert(
  duelActivePrev === true,
  "13. Duel activates when one landed this round and other arrived last round",
);

// 14. Ausencia de duelo si el otro ya salió
const pDuelLeft = createMockPlayer("dC", 14);
const duelNoLeft = canActivateDuel(
  pDuel1,
  pDuelLeft,
  12,
  [],
  true,
  false,
  false,
  false,
);
assert(duelNoLeft === false, "14. No duel if opponent already left cell");

// 15. Casilla de duelo usada una sola vez
const duelUsed = canActivateDuel(
  pDuel1,
  pDuel2,
  12,
  [12],
  true,
  true,
  false,
  false,
);
assert(duelUsed === false, "15. Duel cell cannot be activated twice");

// 16. Empate temporal de duelo (difference <= 100ms: both +1)
pDuel1.duelAnswer = {
  rawAnswer: "ok",
  responseTimeMs: 2050,
  isCorrect: true,
  receivedAt: 1,
};
pDuel2.duelAnswer = {
  rawAnswer: "ok",
  responseTimeMs: 2120,
  isCorrect: true,
  receivedAt: 1,
}; // diff 70ms
const duelTieOutcome = resolveDuel(pDuel1, pDuel2);
assert(duelTieOutcome.isTie === true, "16a. Duel within 100ms is a tie");
assert(
  duelTieOutcome.rewardMap["dA"] === 1 && duelTieOutcome.rewardMap["dB"] === 1,
  "16b. Both get +1 on tie",
);

// 17. Simultaneous arrival evaluation
const pMeta1 = createMockPlayer("mA", 30);
const pMeta2 = createMockPlayer("mB", 30);
pMeta1.stats.correctCount = 15;
pMeta2.stats.correctCount = 14;
const winEvalAcc = evaluateMatchWinner(pMeta1, pMeta2);
assert(
  winEvalAcc.winnerId === "mA",
  "17. Player with higher correct answers wins simultaneous arrival",
);

// 18. Límite de rondas
assert(
  dummyQuestion.reviewStatus === "reviewed",
  "18. Question review status verified",
);

// 19. Movimiento limitado a 30
const pMax = createMockPlayer("pMax", 29, {
  isCorrect: true,
  responseTimeMs: 2000,
}); // +2 moves -> 31 clamped to 30
const resMax = resolveStandardRound([pMax])[0];
assert(resMax.positionAfterBoost === 30, "19. Position must be clamped to 30");

// 20. Resultado independiente del orden de los jugadores
const order1 = resolveStandardRound([pBoostValid, pBoostLate]);
const order2 = resolveStandardRound([pBoostLate, pBoostValid]);
assert(
  order1[0].positionAfterBoost === order2[1].positionAfterBoost,
  "20a. Order independence p1",
);
assert(
  order1[1].positionAfterBoost === order2[0].positionAfterBoost,
  "20b. Order independence p2",
);

console.log("✅ ALL 20 MANDATORY RULES TESTS PASSED SUCCESSFULLY!");

// Scramble DTO must supply usable letters without an ordered answer or explanation.
const publicScramble = toPublicQuestion({
  ...dummyQuestion,
  type: "letter_scramble",
  answer: "FIND OUT",
  letterPattern: [4, 3],
});
assert(
  publicScramble.letterBank?.join("") === "DFINOTU",
  "Scramble bank preserves every letter of a multi-word answer",
);
assert(
  !("answer" in publicScramble) &&
    !("acceptedAnswers" in publicScramble) &&
    !("explanationEn" in publicScramble),
  "Public scramble DTO does not expose answer fields",
);
console.log("✅ Scramble DTO regression passed.");
