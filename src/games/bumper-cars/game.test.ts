import { describe, expect, it } from 'vitest';
import {
  ARENA,
  BUMP_MAX_SPEED,
  CAR_RADIUS,
  MAX_STEP,
  PLAYER_MAX_SPEED,
  ROUND_SECONDS,
  VICTORY_BONUS,
  collide,
  createState,
  drive,
  frameStep,
  inputDirection,
  noInput,
  player,
  rivalDirection,
  rivalsLeft,
  scoreFor,
  step,
  type BumperCarsState,
  type Car,
} from './game';

function car(overrides: Partial<Car> = {}): Car {
  return {
    x: ARENA.x,
    y: ARENA.y,
    vx: 0,
    vy: 0,
    heading: 0,
    accel: 500,
    maxSpeed: 250,
    isPlayer: false,
    eliminated: false,
    ...overrides,
  };
}

/** A round with the rivals parked far apart and still, so only what a test sets up happens. */
function quietState(): BumperCarsState {
  const state = createState();
  for (const rival of state.cars.slice(1)) rival.accel = 0;
  return state;
}

/** Puts a car just outside the arena, straight out from the middle past where it is now. */
function pushOut(c: Car) {
  const angle = Math.atan2(c.y - ARENA.y, c.x - ARENA.x);
  c.x = ARENA.x + Math.cos(angle) * (ARENA.radius + 10);
  c.y = ARENA.y + Math.sin(angle) * (ARENA.radius + 10);
}

function runFor(state: BumperCarsState, seconds: number, input = noInput()) {
  for (let t = 0; t < seconds; t += MAX_STEP) step(state, input, MAX_STEP);
}

describe('bumper cars', () => {
  it('starts the player and three rivals at distinct spots inside the arena', () => {
    const state = createState();
    expect(state.cars).toHaveLength(4);
    expect(player(state).isPlayer).toBe(true);
    expect(rivalsLeft(state)).toBe(3);
    expect(state.phase).toBe('playing');
    expect(state.score).toBe(0);
    for (const a of state.cars) {
      expect(Math.hypot(a.x - ARENA.x, a.y - ARENA.y)).toBeLessThan(ARENA.radius - CAR_RADIUS);
      for (const b of state.cars) {
        if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(CAR_RADIUS * 4);
      }
    }
  });

  it('turns held keys into a unit direction', () => {
    expect(inputDirection(noInput())).toEqual({ x: 0, y: 0 });
    expect(inputDirection({ ...noInput(), right: true })).toEqual({ x: 1, y: 0 });
    const diagonal = inputDirection({ ...noInput(), up: true, left: true });
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1);
    expect(inputDirection({ ...noInput(), left: true, right: true })).toEqual({ x: 0, y: 0 });
  });

  it('accelerates, keeps momentum, caps speed and slows with friction', () => {
    const c = car();
    drive(c, { x: 1, y: 0 }, 0.05);
    expect(c.vx).toBeGreaterThan(0);
    expect(c.x).toBeGreaterThan(ARENA.x);

    for (let i = 0; i < 200; i++) drive(c, { x: 1, y: 0 }, 0.05);
    expect(Math.hypot(c.vx, c.vy)).toBeLessThanOrEqual(c.maxSpeed + 1e-6);

    const coasting = c.vx;
    drive(c, { x: 0, y: 0 }, 0.05);
    expect(c.vx).toBeGreaterThan(0);
    expect(c.vx).toBeLessThan(coasting);
  });

  it('moves the player with the keys during a round', () => {
    const state = quietState();
    const startX = player(state).x;
    runFor(state, 0.5, { ...noInput(), right: true });
    expect(player(state).x).toBeGreaterThan(startX);
    expect(Math.hypot(player(state).vx, player(state).vy)).toBeLessThanOrEqual(PLAYER_MAX_SPEED);
  });

  it('sends rivals after the player', () => {
    const state = createState();
    const rival = state.cars[1];
    const before = Math.hypot(rival.x - player(state).x, rival.y - player(state).y);
    runFor(state, 0.5);
    const after = Math.hypot(rival.x - player(state).x, rival.y - player(state).y);
    expect(after).toBeLessThan(before);
  });

  it('steers a rival near the edge back towards the middle', () => {
    const target = car({ x: ARENA.x + ARENA.radius, y: ARENA.y });
    const rival = car({ x: ARENA.x + ARENA.radius - 5, y: ARENA.y + 1 });
    const direction = rivalDirection(rival, target);
    expect(direction.x).toBeLessThan(0);
  });

  it('separates overlapping cars and pushes them apart', () => {
    const a = car({ x: 400, y: 250, vx: 200 });
    const b = car({ x: 420, y: 250 });
    expect(collide(a, b)).toBe(true);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(CAR_RADIUS * 2);
    expect(b.vx).toBeGreaterThan(0);
    expect(a.vx).toBeLessThan(200);
  });

  it('pushes apart cars with the same centre without NaN', () => {
    const a = car({ x: 400, y: 250 });
    const b = car({ x: 400, y: 250 });
    expect(collide(a, b)).toBe(true);
    for (const value of [a.x, a.y, a.vx, a.vy, b.x, b.y, b.vx, b.vy]) {
      expect(Number.isFinite(value)).toBe(true);
    }
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(CAR_RADIUS * 2);
    expect(collide(a, b)).toBe(false);
  });

  it('caps the speed a bump can give', () => {
    const a = car({ x: 400, y: 250, vx: 1000 });
    const b = car({ x: 410, y: 250, vx: -1000 });
    collide(a, b);
    expect(Math.hypot(a.vx, a.vy)).toBeLessThanOrEqual(BUMP_MAX_SPEED + 1e-6);
    expect(Math.hypot(b.vx, b.vy)).toBeLessThanOrEqual(BUMP_MAX_SPEED + 1e-6);
  });

  it('leaves cars alone when they do not touch or one is knocked out', () => {
    expect(collide(car({ x: 400 }), car({ x: 400 + CAR_RADIUS * 2 + 1 }))).toBe(false);
    expect(collide(car({ x: 400 }), car({ x: 400, eliminated: true }))).toBe(false);
  });

  it('knocks out a rival once its centre leaves the arena, and counts it once', () => {
    const state = quietState();
    const rival = state.cars[1];
    rival.x = ARENA.x - ARENA.radius - 1;
    step(state, noInput(), MAX_STEP);
    expect(rival.eliminated).toBe(true);
    expect(state.knockouts).toBe(1);
    expect(rivalsLeft(state)).toBe(2);

    const { x, y } = rival;
    runFor(state, 1);
    expect(state.knockouts).toBe(1);
    expect([rival.x, rival.y]).toEqual([x, y]);
  });

  it('has no wall: a car driven at the edge goes out', () => {
    const state = quietState();
    runFor(state, 5, { ...noInput(), down: true });
    expect(player(state).eliminated).toBe(true);
    expect(state.phase).toBe('lost');
  });

  it('wins once every rival is out, with the victory bonus', () => {
    const state = quietState();
    for (const rival of state.cars.slice(1)) pushOut(rival);
    step(state, noInput(), MAX_STEP);
    expect(state.phase).toBe('won');
    expect(state.score).toBe(scoreFor(3, MAX_STEP, true));
    expect(state.score).toBe(300 + VICTORY_BONUS);
  });

  it('counts the player going out with the last rival as a loss', () => {
    const state = quietState();
    for (const c of state.cars) pushOut(c);
    step(state, noInput(), MAX_STEP);
    expect(state.phase).toBe('lost');
    expect(state.score).toBe(300);
  });

  it('ends the round at 60 seconds when rivals remain', () => {
    const state = quietState();
    runFor(state, ROUND_SECONDS - 1);
    expect(state.phase).toBe('playing');
    runFor(state, 2);
    expect(state.phase).toBe('timeup');
    expect(state.elapsed).toBe(ROUND_SECONDS);
    expect(state.score).toBe(ROUND_SECONDS);
  });

  it('scores 100 per knockout plus whole seconds, plus 300 for a win', () => {
    expect(scoreFor(0, 0, false)).toBe(0);
    expect(scoreFor(2, 12.9, false)).toBe(212);
    expect(scoreFor(3, 20.4, true)).toBe(620);
  });

  it('freezes the round once it ends', () => {
    const state = quietState();
    runFor(state, ROUND_SECONDS + 1);
    const frozen = structuredClone(state);
    runFor(state, 3, { ...noInput(), right: true });
    expect(state).toEqual(frozen);
  });

  it('caps a long frame so a background tab adds no time or teleport', () => {
    expect(frameStep(0, 10_000)).toBe(MAX_STEP);
    expect(frameStep(1000, 900)).toBe(0);
    const state = quietState();
    const startY = player(state).y;
    step(state, { ...noInput(), down: true }, 10);
    expect(state.elapsed).toBe(MAX_STEP);
    expect(player(state).y - startY).toBeLessThan(5);
  });

  it('starts every new round clean', () => {
    const played = quietState();
    runFor(played, 5, { ...noInput(), down: true });
    expect(played.phase).not.toBe('playing');
    expect(createState()).toEqual(createState());
    const fresh = createState();
    expect(fresh.phase).toBe('playing');
    expect(fresh.elapsed).toBe(0);
    expect(fresh.knockouts).toBe(0);
    expect(fresh.cars.every((c) => !c.eliminated && c.vx === 0 && c.vy === 0)).toBe(true);
  });
});
