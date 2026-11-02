import { describe, expect, it } from 'vitest';
import {
  BELL_SCORE,
  BELL_ZONE,
  IDEAL,
  MARKER_SPEED,
  MAX_STEP,
  SWING_DURATION,
  SWINGS_PER_ROUND,
  accuracyScore,
  createState,
  currentSwing,
  puckHeight,
  ringsBell,
  step,
  stepMarker,
  swing,
  swingKeyDown,
  swingKeyUp,
  type HighStrikerState,
} from './game';

/** Steps until the current swing's animation has finished. Returns true if the round ended. */
function finishSwing(state: HighStrikerState): boolean {
  let ended = false;
  for (let t = 0; t < SWING_DURATION + MAX_STEP * 2; t += MAX_STEP) {
    if (step(state, MAX_STEP)) ended = true;
  }
  return ended;
}

describe('high striker', () => {
  it('starts a round with five swings and no score', () => {
    const state = createState();
    expect(state.phase).toBe('aiming');
    expect(state.swingsLeft).toBe(SWINGS_PER_ROUND);
    expect(state.total).toBe(0);
    expect(state.swings).toEqual([]);
    expect(state.marker).toBe(0);
  });

  describe('timing meter', () => {
    it('moves the marker at a steady speed', () => {
      expect(stepMarker(0, 1, 0.5)).toEqual({ marker: 0.5 * MARKER_SPEED, direction: 1 });
    });

    it('bounces off the right end and comes back', () => {
      const { marker, direction } = stepMarker(0.9, 1, 0.25);
      expect(direction).toBe(-1);
      expect(marker).toBeCloseTo(0.9);
    });

    it('bounces off the left end and comes back', () => {
      const { marker, direction } = stepMarker(0.1, -1, 0.25);
      expect(direction).toBe(1);
      expect(marker).toBeCloseTo(0.1);
    });

    it('stays on the meter for any step', () => {
      const state = createState();
      for (let i = 0; i < 1000; i++) {
        step(state, 0.037);
        expect(state.marker).toBeGreaterThanOrEqual(0);
        expect(state.marker).toBeLessThanOrEqual(1);
      }
    });

    it('caps long steps so a returning tab barely moves the marker', () => {
      const state = createState();
      step(state, 10);
      expect(state.marker).toBeCloseTo(MAX_STEP * MARKER_SPEED);
    });
  });

  describe('accuracy', () => {
    it('scores 100 at the ideal point', () => {
      expect(accuracyScore(IDEAL)).toBe(100);
    });

    it('scores 0 at either end of the meter', () => {
      expect(accuracyScore(0)).toBe(0);
      expect(accuracyScore(1)).toBe(0);
    });

    it('stays a whole number from 0 to 100, even off the meter', () => {
      for (let p = -0.5; p <= 1.5; p += 0.01) {
        const score = accuracyScore(p);
        expect(Number.isInteger(score)).toBe(true);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    });

    it('falls the further the hit is from the ideal, the same on both sides', () => {
      let previous = 100;
      for (let d = 0; d <= 0.5; d += 0.05) {
        const score = accuracyScore(IDEAL + d);
        expect(score).toBeLessThanOrEqual(previous);
        expect(accuracyScore(IDEAL - d)).toBe(score);
        previous = score;
      }
    });
  });

  describe('bell', () => {
    it(`rings at ${BELL_SCORE} or more`, () => {
      expect(ringsBell(BELL_SCORE - 1)).toBe(false);
      expect(ringsBell(BELL_SCORE)).toBe(true);
      expect(ringsBell(100)).toBe(true);
    });

    it('rings for a hit anywhere in the gold zone, and not outside it', () => {
      expect(ringsBell(accuracyScore(IDEAL + BELL_ZONE - 0.0001))).toBe(true);
      expect(ringsBell(accuracyScore(IDEAL - BELL_ZONE + 0.0001))).toBe(true);
      expect(ringsBell(accuracyScore(IDEAL + BELL_ZONE + 0.001))).toBe(false);
    });
  });

  describe('puck', () => {
    it('rises to a height proportional to the score, then comes back down', () => {
      expect(puckHeight(80, 0)).toBe(0);
      expect(puckHeight(80, 0.9)).toBeCloseTo(0.8);
      expect(puckHeight(40, 0.9)).toBeCloseTo(0.4);
      expect(puckHeight(80, SWING_DURATION)).toBeCloseTo(0);
    });
  });

  describe('swings', () => {
    it('locks the marker and scores the swing', () => {
      const state = createState();
      state.marker = IDEAL;
      expect(swing(state)).toBe(true);
      expect(state.swings).toEqual([100]);
      expect(state.total).toBe(100);
      expect(state.swingsLeft).toBe(SWINGS_PER_ROUND - 1);
      expect(state.phase).toBe('swinging');
      expect(currentSwing(state)).toBe(100);
    });

    it('ignores input until the animation finishes', () => {
      const state = createState();
      swing(state);
      step(state, MAX_STEP);
      expect(swing(state)).toBe(false);
      expect(state.swingsLeft).toBe(SWINGS_PER_ROUND - 1);
      finishSwing(state);
      expect(state.phase).toBe('aiming');
      expect(swing(state)).toBe(true);
    });

    it('spends one swing per key press, however long the key is held', () => {
      const state = createState();
      expect(swingKeyDown(state, false)).toBe(true);
      finishSwing(state);
      expect(swingKeyDown(state, true)).toBe(false);
      expect(swingKeyDown(state, false)).toBe(false);
      expect(state.swingsLeft).toBe(SWINGS_PER_ROUND - 1);
      swingKeyUp(state);
      expect(swingKeyDown(state, false)).toBe(true);
      expect(state.swingsLeft).toBe(SWINGS_PER_ROUND - 2);
    });

    it('ends the round when the fifth swing finishes, and reports it once', () => {
      const state = createState();
      const ends: number[] = [];
      for (let i = 0; i < SWINGS_PER_ROUND; i++) {
        expect(state.phase).toBe('aiming');
        swing(state);
        if (finishSwing(state)) ends.push(i);
      }
      expect(ends).toEqual([SWINGS_PER_ROUND - 1]);
      expect(state.phase).toBe('over');
      expect(swing(state)).toBe(false);
      expect(step(state, MAX_STEP)).toBe(false);
      expect(state.swings).toHaveLength(SWINGS_PER_ROUND);
    });

    it('totals the five swing scores', () => {
      const state = createState();
      const positions = [IDEAL, 0, 1, 0.25, 0.6];
      for (const position of positions) {
        state.marker = position;
        swing(state);
        finishSwing(state);
      }
      const expected = positions.map(accuracyScore);
      expect(state.swings).toEqual(expected);
      expect(state.total).toBe(expected.reduce((a, b) => a + b, 0));
      expect(state.total).toBeGreaterThanOrEqual(0);
      expect(state.total).toBeLessThanOrEqual(SWINGS_PER_ROUND * 100);
    });

    it('scores 500 for five perfect swings', () => {
      const state = createState();
      for (let i = 0; i < SWINGS_PER_ROUND; i++) {
        state.marker = IDEAL;
        swing(state);
        finishSwing(state);
      }
      expect(state.total).toBe(500);
    });
  });

  it('restarts with a clean round', () => {
    const state = createState();
    for (let i = 0; i < SWINGS_PER_ROUND; i++) {
      swingKeyDown(state, false);
      finishSwing(state);
      swingKeyUp(state);
    }
    expect(state.phase).toBe('over');
    const fresh = createState();
    expect(fresh).toEqual({
      phase: 'aiming',
      marker: 0,
      direction: 1,
      swingsLeft: SWINGS_PER_ROUND,
      swings: [],
      total: 0,
      swingTime: 0,
      keyHeld: false,
    });
  });
});
