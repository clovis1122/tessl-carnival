import { describe, expect, it } from 'vitest';
import { theme } from '../../carnival';
import {
  FIRST_SPAWN_DELAY,
  MAX_FALL_SPEED,
  MAX_OBSTACLE_SIZE,
  MAX_SPAWN_INTERVAL,
  MAX_STEP,
  MIN_FALL_SPEED,
  MIN_SPAWN_INTERVAL,
  PLAYER_SPEED,
  PLAYER_WIDTH,
  RAMP_SECONDS,
  collides,
  createState,
  difficulty,
  fallSpeed,
  fallingObjects,
  scoreFor,
  spawnInterval,
  spawnObstacle,
  step,
  type FallingObjectsState,
  type Obstacle,
} from './game';

const { width: WIDTH, height: HEIGHT } = theme.canvas;
const fixed = (value: number) => () => value;

/** Steps `seconds` of game time in MAX_STEP slices. */
function run(state: FallingObjectsState, seconds: number, random = fixed(0)) {
  for (let t = 0; t < seconds - 1e-9; t += MAX_STEP) step(state, MAX_STEP, random);
}

describe('falling objects', () => {
  it('is registered under its folder name', () => {
    expect(fallingObjects.id).toBe('falling-objects');
  });

  it('starts at the bottom centre with nothing falling', () => {
    const state = createState();
    expect(state.player.x + state.player.width / 2).toBe(WIDTH / 2);
    expect(state.player.y).toBeGreaterThan(HEIGHT / 2);
    expect(state.obstacles).toHaveLength(0);
    expect(state.elapsed).toBe(0);
    expect(state.phase).toBe('playing');
  });

  describe('movement', () => {
    it('moves left and right with the held keys', () => {
      const state = createState();
      const startX = state.player.x;
      state.held.right = true;
      step(state, 0.05);
      expect(state.player.x).toBeCloseTo(startX + PLAYER_SPEED * 0.05);
      state.held.right = false;
      state.held.left = true;
      step(state, 0.05);
      expect(state.player.x).toBeCloseTo(startX);
    });

    it('stays put when both or neither key is held', () => {
      const state = createState();
      const startX = state.player.x;
      step(state, 0.05);
      state.held.left = true;
      state.held.right = true;
      step(state, 0.05);
      expect(state.player.x).toBe(startX);
    });

    it('stays inside the left and right edges', () => {
      const state = createState();
      state.spawnTimer = Infinity;
      state.held.left = true;
      run(state, 3);
      expect(state.player.x).toBe(0);
      state.held.left = false;
      state.held.right = true;
      run(state, 3);
      expect(state.player.x).toBe(WIDTH - PLAYER_WIDTH);
    });
  });

  describe('falling and spawning', () => {
    it('gives the player time before the first obstacle', () => {
      const state = createState();
      run(state, FIRST_SPAWN_DELAY - MAX_STEP);
      expect(state.obstacles).toHaveLength(0);
      run(state, MAX_STEP * 2);
      expect(state.obstacles.length).toBeGreaterThan(0);
    });

    it('spawns above the play area at a position set by the random source', () => {
      const left = spawnObstacle(0, fixed(0));
      const right = spawnObstacle(0, fixed(0.999));
      expect(left.x).toBe(0);
      expect(left.y).toBeLessThanOrEqual(-left.size);
      expect(right.x + right.size).toBeLessThanOrEqual(WIDTH);
      expect(right.x).toBeGreaterThan(WIDTH / 2);
    });

    it('moves obstacles downward', () => {
      const state = createState();
      state.obstacles = [{ x: 0, y: 0, size: 30, speed: 200 }];
      step(state, 0.05);
      expect(state.obstacles[0].y).toBeCloseTo(10);
    });

    it('removes obstacles that leave the bottom', () => {
      const state = createState();
      state.obstacles = [
        { x: 0, y: HEIGHT - 1, size: 30, speed: 200 },
        { x: 0, y: 100, size: 30, speed: 200 },
      ];
      step(state, 0.05);
      expect(state.obstacles).toHaveLength(1);
      expect(state.obstacles[0].y).toBeCloseTo(110);
    });
  });

  describe('collisions', () => {
    const state = createState();
    const { player } = state;
    const at = (x: number, y: number, size = 30): Obstacle => ({ x, y, size, speed: 0 });

    it('detects an overlap', () => {
      expect(collides(player, at(player.x + 5, player.y - 10))).toBe(true);
    });

    it('ignores obstacles that only touch an edge', () => {
      expect(collides(player, at(player.x - 30, player.y))).toBe(false);
      expect(collides(player, at(player.x + player.width, player.y))).toBe(false);
      expect(collides(player, at(player.x, player.y - 30))).toBe(false);
      expect(collides(player, at(player.x, player.y + player.height))).toBe(false);
    });

    it('counts a one pixel overlap on any edge', () => {
      expect(collides(player, at(player.x - 29, player.y))).toBe(true);
      expect(collides(player, at(player.x + player.width - 1, player.y))).toBe(true);
      expect(collides(player, at(player.x, player.y - 29))).toBe(true);
      expect(collides(player, at(player.x, player.y + player.height - 1))).toBe(true);
    });

    it('cannot skip past the player at top speed, even with a huge time step', () => {
      const s = createState();
      s.spawnTimer = Infinity;
      s.obstacles = [
        { x: s.player.x, y: s.player.y - MAX_OBSTACLE_SIZE - 1, size: 28, speed: MAX_FALL_SPEED },
      ];
      for (let i = 0; i < 20 && s.phase === 'playing'; i++) step(s, 10);
      expect(s.phase).toBe('over');
    });
  });

  describe('score and game over', () => {
    it('scores whole seconds survived', () => {
      expect(scoreFor(0)).toBe(0);
      expect(scoreFor(0.99)).toBe(0);
      expect(scoreFor(12.7)).toBe(12);
    });

    it('counts survival time while playing', () => {
      const state = createState();
      run(state, 1);
      expect(state.elapsed).toBeCloseTo(1);
    });

    it('caps a long time step so time away is not awarded', () => {
      const state = createState();
      step(state, 30);
      expect(state.elapsed).toBe(MAX_STEP);
    });

    it('ends the round on one collision and freezes everything', () => {
      const state = createState();
      state.elapsed = 7.4;
      state.obstacles = [{ x: state.player.x, y: state.player.y - 5, size: 30, speed: 100 }];
      step(state, 0.01);
      expect(state.phase).toBe('over');

      const frozen = JSON.stringify(state);
      state.held.right = true;
      step(state, 0.05);
      step(state, 0.05);
      expect(JSON.stringify({ ...state, held: { left: false, right: false } })).toBe(frozen);
      expect(scoreFor(state.elapsed)).toBe(7);
    });
  });

  describe('difficulty', () => {
    it('starts gentle and ramps up', () => {
      expect(fallSpeed(0)).toBe(MIN_FALL_SPEED);
      expect(spawnInterval(0)).toBe(MAX_SPAWN_INTERVAL);
      expect(fallSpeed(RAMP_SECONDS / 2)).toBeGreaterThan(MIN_FALL_SPEED);
      expect(fallSpeed(RAMP_SECONDS / 2)).toBeLessThan(MAX_FALL_SPEED);
      expect(spawnInterval(RAMP_SECONDS / 2)).toBeLessThan(MAX_SPAWN_INTERVAL);
      expect(spawnInterval(RAMP_SECONDS / 2)).toBeGreaterThan(MIN_SPAWN_INTERVAL);
    });

    it('caps speed and spawn rate', () => {
      expect(difficulty(RAMP_SECONDS * 10)).toBe(1);
      expect(fallSpeed(RAMP_SECONDS * 10)).toBe(MAX_FALL_SPEED);
      expect(spawnInterval(RAMP_SECONDS * 10)).toBe(MIN_SPAWN_INTERVAL);
    });

    it('gives later obstacles the faster speed', () => {
      expect(spawnObstacle(RAMP_SECONDS, fixed(0.5)).speed).toBe(MAX_FALL_SPEED);
      expect(spawnObstacle(0, fixed(0.5)).speed).toBe(MIN_FALL_SPEED);
    });

    it('spawns deterministically for a given random source', () => {
      const a = createState();
      const b = createState();
      // Keep the player out of the way so the round keeps going.
      run(a, 5, fixed(0.9));
      run(b, 5, fixed(0.9));
      expect(a.obstacles).toEqual(b.obstacles);
    });
  });

  describe('restart', () => {
    it('begins a clean round after one that ended', () => {
      const state = createState();
      state.held.left = true;
      run(state, FIRST_SPAWN_DELAY + 1);
      state.phase = 'over';
      // start() restarts by replacing the state with a new one.
      const fresh = createState();
      expect(fresh.obstacles).toHaveLength(0);
      expect(fresh.elapsed).toBe(0);
      expect(fresh.spawnTimer).toBe(FIRST_SPAWN_DELAY);
      expect(fresh.held).toEqual({ left: false, right: false });
      expect(fresh.player.x).toBe((WIDTH - PLAYER_WIDTH) / 2);
      expect(fresh.phase).toBe('playing');
      expect(state.obstacles.length).toBeGreaterThan(0);
      expect(fresh.player).not.toBe(state.player);
    });
  });
});
