import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

/** The round arena. A car whose centre leaves it is knocked out. */
export const ARENA = { x: WIDTH / 2, y: 265, radius: 200 } as const;
export const CAR_RADIUS = 18;
export const ROUND_SECONDS = 60;
export const POINTS_PER_KNOCKOUT = 100;
export const VICTORY_BONUS = 300;
/** The longest step the animation loop takes, so a background tab can't teleport cars. */
export const MAX_STEP = 0.05;

export const PLAYER_ACCEL = 520;
export const PLAYER_MAX_SPEED = 260;
export const RIVAL_ACCEL = [240, 270, 300] as const;
export const RIVAL_MAX_SPEED = 190;
/** Share of speed lost each second when nobody is pressing the pedal. */
export const FRICTION = 1.4;
/** No car goes faster than this, even straight after a bump. */
export const BUMP_MAX_SPEED = 420;
/** The smallest push a bump gives each car, so even a gentle tap knocks them apart. */
export const MIN_BUMP = 90;
/** How bouncy a bump is: 0 is a dead stop, 1 a perfect bounce. */
export const RESTITUTION = 0.9;
/** Rivals steer back towards the middle once they are this far out. */
export const RIVAL_EDGE_CAUTION = 0.8;

export interface Car {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Radians, the way the car is facing. */
  heading: number;
  accel: number;
  maxSpeed: number;
  isPlayer: boolean;
  eliminated: boolean;
}

export interface Input {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export type Phase = 'playing' | 'won' | 'lost' | 'timeup';

export interface BumperCarsState {
  /** The player is always `cars[0]`; the rest are rivals. */
  cars: Car[];
  /** Active seconds played this round. */
  elapsed: number;
  knockouts: number;
  score: number;
  phase: Phase;
}

export function noInput(): Input {
  return { up: false, down: false, left: false, right: false };
}

function makeCar(angle: number, isPlayer: boolean, accel: number, maxSpeed: number): Car {
  const distance = ARENA.radius * 0.6;
  return {
    x: ARENA.x + Math.cos(angle) * distance,
    y: ARENA.y + Math.sin(angle) * distance,
    vx: 0,
    vy: 0,
    // Face the middle of the arena.
    heading: angle + Math.PI,
    accel,
    maxSpeed,
    isPlayer,
    eliminated: false,
  };
}

/** A fresh round: the player at the bottom, the three rivals left, top and right. */
export function createState(): BumperCarsState {
  const cars = [
    makeCar(Math.PI / 2, true, PLAYER_ACCEL, PLAYER_MAX_SPEED),
    makeCar(Math.PI, false, RIVAL_ACCEL[0], RIVAL_MAX_SPEED),
    makeCar(-Math.PI / 2, false, RIVAL_ACCEL[1], RIVAL_MAX_SPEED),
    makeCar(0, false, RIVAL_ACCEL[2], RIVAL_MAX_SPEED),
  ];
  return { cars, elapsed: 0, knockouts: 0, score: 0, phase: 'playing' };
}

export function player(state: BumperCarsState): Car {
  return state.cars[0];
}

export function rivalsLeft(state: BumperCarsState): number {
  return state.cars.filter((car) => !car.isPlayer && !car.eliminated).length;
}

/** 100 per rival knocked out, plus whole seconds survived, plus 300 for a win. */
export function scoreFor(knockouts: number, elapsed: number, won: boolean): number {
  return knockouts * POINTS_PER_KNOCKOUT + Math.floor(elapsed + 1e-9) + (won ? VICTORY_BONUS : 0);
}

/** Seconds since the last frame, capped at `MAX_STEP` and never negative. */
export function frameStep(lastMs: number, nowMs: number): number {
  return Math.min(Math.max((nowMs - lastMs) / 1000, 0), MAX_STEP);
}

function normalize(x: number, y: number): { x: number; y: number } {
  const length = Math.hypot(x, y);
  return length < 1e-9 ? { x: 0, y: 0 } : { x: x / length, y: y / length };
}

/** The unit direction the player's held keys ask for, or zero. */
export function inputDirection(input: Input): { x: number; y: number } {
  return normalize(
    (input.right ? 1 : 0) - (input.left ? 1 : 0),
    (input.down ? 1 : 0) - (input.up ? 1 : 0),
  );
}

/**
 * Where a rival steers: straight at the player, but once it is near the edge it
 * also pulls back towards the middle so it doesn't drive itself out.
 */
export function rivalDirection(rival: Car, target: Car): { x: number; y: number } {
  const chase = normalize(target.x - rival.x, target.y - rival.y);
  const fromCentre = Math.hypot(rival.x - ARENA.x, rival.y - ARENA.y);
  const edge = ARENA.radius * RIVAL_EDGE_CAUTION;
  if (fromCentre <= edge) return chase;
  const home = normalize(ARENA.x - rival.x, ARENA.y - rival.y);
  const pull = Math.min((fromCentre - edge) / (ARENA.radius - edge), 1) * 2;
  const direction = normalize(chase.x + home.x * pull, chase.y + home.y * pull);
  return direction.x === 0 && direction.y === 0 ? home : direction;
}

function capSpeed(car: Car, max: number): void {
  const speed = Math.hypot(car.vx, car.vy);
  if (speed > max) {
    car.vx = (car.vx / speed) * max;
    car.vy = (car.vy / speed) * max;
  }
}

/** Accelerates, slows and moves one car for `dt` seconds. */
export function drive(car: Car, direction: { x: number; y: number }, dt: number): void {
  if (car.eliminated) return;
  car.vx += direction.x * car.accel * dt;
  car.vy += direction.y * car.accel * dt;
  const drag = Math.max(0, 1 - FRICTION * dt);
  car.vx *= drag;
  car.vy *= drag;
  // Only the pedal is capped at the car's top speed; a bump can push it faster.
  if (direction.x !== 0 || direction.y !== 0) {
    const speed = Math.hypot(car.vx, car.vy);
    if (speed > car.maxSpeed) {
      const keep = Math.max(car.maxSpeed, speed - car.accel * dt);
      car.vx = (car.vx / speed) * keep;
      car.vy = (car.vy / speed) * keep;
    }
  }
  capSpeed(car, BUMP_MAX_SPEED);
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  if (Math.hypot(car.vx, car.vy) > 5) car.heading = Math.atan2(car.vy, car.vx);
}

/**
 * Bumps two cars apart if they overlap: separates them so they just touch, and
 * pushes each away from the other. Cars with the same centre are pushed apart
 * sideways. Returns whether they bumped.
 */
export function collide(a: Car, b: Car): boolean {
  if (a.eliminated || b.eliminated) return false;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy);
  const minDistance = CAR_RADIUS * 2;
  if (distance >= minDistance) return false;

  // From a to b. Coincident centres get a fixed sideways normal, never NaN.
  const nx = distance < 1e-6 ? 1 : dx / distance;
  const ny = distance < 1e-6 ? 0 : dy / distance;

  const overlap = minDistance - distance;
  a.x -= (nx * overlap) / 2;
  a.y -= (ny * overlap) / 2;
  b.x += (nx * overlap) / 2;
  b.y += (ny * overlap) / 2;

  // Closing speed along the normal: positive when they drive into each other.
  const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  const push = Math.max(((1 + RESTITUTION) * Math.max(closing, 0)) / 2, MIN_BUMP);
  a.vx -= nx * push;
  a.vy -= ny * push;
  b.vx += nx * push;
  b.vy += ny * push;
  capSpeed(a, BUMP_MAX_SPEED);
  capSpeed(b, BUMP_MAX_SPEED);
  return true;
}

export function isOutside(car: Car): boolean {
  return Math.hypot(car.x - ARENA.x, car.y - ARENA.y) > ARENA.radius;
}

/** Advances the round by `dt` seconds with the player's held keys. */
export function step(state: BumperCarsState, input: Input, dt: number): void {
  if (state.phase !== 'playing') return;
  const dtClamped = Math.min(Math.max(dt, 0), MAX_STEP);
  const you = player(state);

  for (const car of state.cars) {
    const direction = car.isPlayer ? inputDirection(input) : rivalDirection(car, you);
    drive(car, direction, dtClamped);
  }

  for (let i = 0; i < state.cars.length; i++) {
    for (let j = i + 1; j < state.cars.length; j++) {
      collide(state.cars[i], state.cars[j]);
    }
  }

  for (const car of state.cars) {
    if (!car.eliminated && isOutside(car)) {
      car.eliminated = true;
      car.vx = 0;
      car.vy = 0;
      if (!car.isPlayer) state.knockouts += 1;
    }
  }

  state.elapsed = Math.min(state.elapsed + dtClamped, ROUND_SECONDS);

  // Losing your car counts first, even if the last rival went out in the same step.
  if (you.eliminated) state.phase = 'lost';
  else if (rivalsLeft(state) === 0) state.phase = 'won';
  else if (state.elapsed >= ROUND_SECONDS) state.phase = 'timeup';

  state.score = scoreFor(state.knockouts, state.elapsed, state.phase === 'won');
}

const KEYS: Record<string, keyof Input> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

function drawCar(ctx: CanvasRenderingContext2D, car: Car, body: string) {
  const { colors } = theme;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.globalAlpha = car.eliminated ? 0.3 : 1;
  // Rubber bumper ring.
  ctx.fillStyle = colors.background;
  ctx.beginPath();
  ctx.arc(0, 0, CAR_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, CAR_RADIUS - 4, 0, Math.PI * 2);
  ctx.fill();
  // The bonnet points where the car faces.
  ctx.rotate(car.heading);
  ctx.fillStyle = colors.text;
  ctx.fillRect(4, -3, CAR_RADIUS - 8, 6);
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, state: BumperCarsState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  ctx.fillStyle = colors.surface;
  ctx.beginPath();
  ctx.arc(ARENA.x, ARENA.y, ARENA.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 10]);
  ctx.stroke();
  ctx.setLineDash([]);

  const rivalColors = [colors.stripeA, colors.water, colors.muted];
  // Knocked-out cars first, so live cars draw over them.
  const order = [...state.cars.keys()].sort(
    (a, b) => Number(state.cars[b].eliminated) - Number(state.cars[a].eliminated),
  );
  for (const i of order) {
    drawCar(ctx, state.cars[i], i === 0 ? colors.accent : rivalColors[(i - 1) % 3]);
  }

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, 70);
  ctx.fillText(`Rivals ${rivalsLeft(state)}/3`, 16, 96);
  ctx.textAlign = 'right';
  ctx.fillText(`Time ${Math.floor(state.elapsed)}/${ROUND_SECONDS}s`, WIDTH - 16, 70);
  ctx.font = canvasFont('small');
  ctx.fillStyle = colors.muted;
  ctx.textAlign = 'left';
  ctx.fillText('WASD or arrows to drive. Bump rivals out of the ring.', 16, HEIGHT - 36);
  ctx.fillText('100 per knockout, 1 per second survived, 300 for a win.', 16, HEIGHT - 16);

  if (state.phase !== 'playing') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    const title = {
      won: 'You cleared the ring!',
      lost: 'Knocked out!',
      timeup: "Time's up!",
    }[state.phase];
    ctx.fillStyle = state.phase === 'lost' ? colors.danger : colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(title, WIDTH / 2, HEIGHT / 2 - 20);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText(
      `You scored ${state.score} (${state.knockouts} knockouts, ${Math.floor(state.elapsed)}s)`,
      WIDTH / 2,
      HEIGHT / 2 + 20,
    );
    ctx.fillText('Press Enter or click to play again', WIDTH / 2, HEIGHT / 2 + 52);
  }
}

export const bumperCars: CarnivalGame = {
  id: 'bumper-cars',
  name: 'Bumper Cars',
  description: 'Bump three rival cars out of the ring before they bump you.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let input = noInput();
    let scoreRecorded = false;

    const restart = () => {
      state = createState();
      input = noInput();
      scoreRecorded = false;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = KEYS[event.code];
      if (key) {
        event.preventDefault();
        input[key] = true;
      } else if (event.key === 'Enter' && !event.repeat && state.phase !== 'playing') {
        event.preventDefault();
        restart();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const key = KEYS[event.code];
      if (key) input[key] = false;
    };
    const onBlur = () => {
      input = noInput();
    };
    const onPointerDown = () => {
      if (state.phase !== 'playing') restart();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    canvas.addEventListener('pointerdown', onPointerDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      const dt = frameStep(last, time);
      last = time;
      step(state, input, dt);
      if (state.phase !== 'playing' && !scoreRecorded) {
        recordScore(bumperCars.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('pointerdown', onPointerDown);
    };
  },
};

export default bumperCars;
