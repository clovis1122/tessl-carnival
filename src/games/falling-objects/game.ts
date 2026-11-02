import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const PLAYER_WIDTH = 48;
export const PLAYER_HEIGHT = 24;
export const PLAYER_Y = HEIGHT - 60;
export const PLAYER_SPEED = 360;
/** The longest step the simulation takes, so a background tab can't skip time. */
export const MAX_STEP = 0.05;
/** Seconds before the first obstacle drops, so the player can read the controls. */
export const FIRST_SPAWN_DELAY = 2;
/** Seconds of survival it takes to reach the hardest difficulty. */
export const RAMP_SECONDS = 60;
export const MIN_FALL_SPEED = 140;
export const MAX_FALL_SPEED = 360;
export const MAX_SPAWN_INTERVAL = 1.1;
export const MIN_SPAWN_INTERVAL = 0.4;
export const MIN_OBSTACLE_SIZE = 28;
export const MAX_OBSTACLE_SIZE = 52;
const HINT_SECONDS = 4;

export interface Obstacle {
  /** Left edge. */
  x: number;
  /** Top edge. */
  y: number;
  size: number;
  /** Pixels per second, downwards. */
  speed: number;
}

export interface Player {
  /** Left edge. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HeldKeys {
  left: boolean;
  right: boolean;
}

export interface FallingObjectsState {
  player: Player;
  obstacles: Obstacle[];
  held: HeldKeys;
  /** Seconds survived this round. */
  elapsed: number;
  /** Seconds until the next obstacle spawns. */
  spawnTimer: number;
  phase: 'playing' | 'over';
}

/** A number in [0, 1), like Math.random. Tests pass their own. */
export type Random = () => number;

export function createState(): FallingObjectsState {
  return {
    player: {
      x: (WIDTH - PLAYER_WIDTH) / 2,
      y: PLAYER_Y,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
    },
    obstacles: [],
    held: { left: false, right: false },
    elapsed: 0,
    spawnTimer: FIRST_SPAWN_DELAY,
    phase: 'playing',
  };
}

/** Whole seconds survived. */
export function scoreFor(elapsed: number): number {
  return Math.floor(elapsed);
}

/** How far the round is through the difficulty ramp, from 0 to 1. */
export function difficulty(elapsed: number): number {
  return Math.min(Math.max(elapsed / RAMP_SECONDS, 0), 1);
}

export function fallSpeed(elapsed: number): number {
  return MIN_FALL_SPEED + (MAX_FALL_SPEED - MIN_FALL_SPEED) * difficulty(elapsed);
}

export function spawnInterval(elapsed: number): number {
  return MAX_SPAWN_INTERVAL - (MAX_SPAWN_INTERVAL - MIN_SPAWN_INTERVAL) * difficulty(elapsed);
}

/** A new obstacle just above the play area, at a random column. */
export function spawnObstacle(elapsed: number, random: Random): Obstacle {
  const size = MIN_OBSTACLE_SIZE + (MAX_OBSTACLE_SIZE - MIN_OBSTACLE_SIZE) * random();
  return { x: (WIDTH - size) * random(), y: -size, size, speed: fallSpeed(elapsed) };
}

/** True when the obstacle overlaps the player. Edges that only touch don't count. */
export function collides(player: Player, obstacle: Obstacle): boolean {
  return (
    obstacle.x < player.x + player.width &&
    obstacle.x + obstacle.size > player.x &&
    obstacle.y < player.y + player.height &&
    obstacle.y + obstacle.size > player.y
  );
}

/** Moves the player by the held keys over `dt` seconds, kept inside the play area. */
export function movePlayer(state: FallingObjectsState, dt: number): void {
  const direction = (state.held.right ? 1 : 0) - (state.held.left ? 1 : 0);
  const x = state.player.x + direction * PLAYER_SPEED * dt;
  state.player.x = Math.min(Math.max(x, 0), WIDTH - state.player.width);
}

/** Advances the game by `dt` seconds, capped at MAX_STEP. Does nothing once the round is over. */
export function step(state: FallingObjectsState, dt: number, random: Random = Math.random): void {
  if (state.phase !== 'playing') return;
  const t = Math.min(Math.max(dt, 0), MAX_STEP);

  movePlayer(state, t);
  state.elapsed += t;

  state.spawnTimer -= t;
  while (state.spawnTimer <= 0) {
    state.obstacles.push(spawnObstacle(state.elapsed, random));
    state.spawnTimer += spawnInterval(state.elapsed);
  }

  for (const obstacle of state.obstacles) obstacle.y += obstacle.speed * t;
  state.obstacles = state.obstacles.filter((o) => o.y < HEIGHT);

  if (state.obstacles.some((o) => collides(state.player, o))) state.phase = 'over';
}

function draw(ctx: CanvasRenderingContext2D, state: FallingObjectsState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Ground under the player.
  ctx.fillStyle = colors.wood;
  ctx.fillRect(0, PLAYER_Y + PLAYER_HEIGHT + 6, WIDTH, 6);

  for (const obstacle of state.obstacles) {
    ctx.fillStyle = colors.danger;
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.size, obstacle.size);
    ctx.fillStyle = colors.stripeB;
    const inset = obstacle.size * 0.3;
    ctx.fillRect(obstacle.x + inset, obstacle.y + inset, obstacle.size - inset * 2, 4);
  }

  const { player } = state;
  ctx.fillStyle = colors.accent;
  ctx.fillRect(player.x, player.y, player.width, player.height);
  ctx.fillStyle = colors.surface;
  ctx.fillRect(player.x + 8, player.y + 6, player.width - 16, 6);

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Time ${state.elapsed.toFixed(1)}s`, 16, 30);
  ctx.textAlign = 'right';
  ctx.fillText(`Score ${scoreFor(state.elapsed)}`, WIDTH - 16, 30);

  if (state.phase === 'playing' && state.elapsed < HINT_SECONDS) {
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.muted;
    ctx.font = canvasFont('body');
    ctx.fillText('Left/Right or A/D to move. Dodge everything that falls!', WIDTH / 2, HEIGHT / 2);
  }

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Hit! You survived ${state.elapsed.toFixed(1)}s`, WIDTH / 2, HEIGHT / 2 - 20);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body', 'bold');
    ctx.fillText(`Score ${scoreFor(state.elapsed)}`, WIDTH / 2, HEIGHT / 2 + 20);
    ctx.font = canvasFont('body');
    ctx.fillText('Press Enter or click to play again', WIDTH / 2, HEIGHT / 2 + 56);
  }
}

const LEFT_KEYS = new Set(['ArrowLeft', 'a', 'A']);
const RIGHT_KEYS = new Set(['ArrowRight', 'd', 'D']);

export const fallingObjects: CarnivalGame = {
  id: 'falling-objects',
  name: 'Falling Objects',
  description: 'Dodge everything that falls for as long as you can. Every second counts.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;

    const restart = () => {
      state = createState();
      scoreRecorded = false;
    };
    const releaseKeys = () => {
      state.held.left = false;
      state.held.right = false;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (LEFT_KEYS.has(event.key)) {
        state.held.left = true;
        event.preventDefault();
      } else if (RIGHT_KEYS.has(event.key)) {
        state.held.right = true;
        event.preventDefault();
      } else if (event.key === 'Enter' && state.phase === 'over') {
        restart();
        event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (LEFT_KEYS.has(event.key)) state.held.left = false;
      if (RIGHT_KEYS.has(event.key)) state.held.right = false;
    };
    const onPointerDown = () => {
      if (state.phase === 'over') restart();
    };
    const onVisibility = () => {
      if (document.hidden) releaseKeys();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', releaseKeys);
    document.addEventListener('visibilitychange', onVisibility);
    canvas.addEventListener('pointerdown', onPointerDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // step caps dt at MAX_STEP, so a background tab doesn't teleport obstacles.
      const dt = (time - last) / 1000;
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(fallingObjects.id, scoreFor(state.elapsed));
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
      window.removeEventListener('blur', releaseKeys);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('pointerdown', onPointerDown);
    };
  },
};

export default fallingObjects;
