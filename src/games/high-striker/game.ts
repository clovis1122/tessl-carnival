import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const SWINGS_PER_ROUND = 5;
/** The marker crosses the whole meter this many times per second. */
export const MARKER_SPEED = 0.8;
/** Where on the meter (0 to 1) a perfect hit lands. */
export const IDEAL = 0.5;
export const BELL_SCORE = 95;
/** Seconds a swing takes: the hammer falls, the puck rises and comes back down. */
export const SWING_DURATION = 1.6;
/** The longest step the game takes, so a returning background tab skips no feedback. */
export const MAX_STEP = 0.05;
/** How far either side of the ideal still rings the bell. */
export const BELL_ZONE = 0.5 * Math.pow(1 - (BELL_SCORE - 0.5) / 100, 2 / 3);

const HAMMER_TIME = 0.2;
const RISE_TIME = 0.6;
const HOLD_TIME = 0.4;

export interface HighStrikerState {
  phase: 'aiming' | 'swinging' | 'over';
  /** The timing marker's position on the meter, from 0 to 1. */
  marker: number;
  /** 1 moves right, -1 moves left. */
  direction: 1 | -1;
  swingsLeft: number;
  /** Every completed or animating swing's score, in order. */
  swings: number[];
  total: number;
  /** Seconds since the current swing started. */
  swingTime: number;
  /** True while the swing key is down, so holding it spends one swing. */
  keyHeld: boolean;
}

export function createState(): HighStrikerState {
  return {
    phase: 'aiming',
    marker: 0,
    direction: 1,
    swingsLeft: SWINGS_PER_ROUND,
    swings: [],
    total: 0,
    swingTime: 0,
    keyHeld: false,
  };
}

/** Score for a hit at `position`: 100 at the ideal, falling smoothly to 0 at either end. */
export function accuracyScore(position: number): number {
  const distance = Math.min(Math.abs(position - IDEAL) / 0.5, 1);
  const score = Math.round(100 * (1 - Math.pow(distance, 1.5)));
  return Math.max(0, Math.min(100, score));
}

export function ringsBell(score: number): boolean {
  return score >= BELL_SCORE;
}

/** Moves the marker back and forth along the meter for `dt` seconds. */
export function stepMarker(
  marker: number,
  direction: 1 | -1,
  dt: number,
): { marker: number; direction: 1 | -1 } {
  let next = marker + direction * MARKER_SPEED * dt;
  let dir = direction;
  while (next < 0 || next > 1) {
    if (next > 1) {
      next = 2 - next;
      dir = -1;
    } else {
      next = -next;
      dir = 1;
    }
  }
  return { marker: next, direction: dir };
}

/** Locks the marker and spends a swing. Returns false when a swing can't start now. */
export function swing(state: HighStrikerState): boolean {
  if (state.phase !== 'aiming' || state.swingsLeft === 0) return false;
  const score = accuracyScore(state.marker);
  state.swings.push(score);
  state.total += score;
  state.swingsLeft -= 1;
  state.swingTime = 0;
  state.phase = 'swinging';
  return true;
}

/** The swing key went down. Held-key repeats and a key that's already down do nothing. */
export function swingKeyDown(state: HighStrikerState, repeat: boolean): boolean {
  if (repeat || state.keyHeld) return false;
  state.keyHeld = true;
  return swing(state);
}

export function swingKeyUp(state: HighStrikerState): void {
  state.keyHeld = false;
}

/**
 * Advances the game by `dt` seconds, capped at MAX_STEP. Returns true on the
 * step the fifth swing finishes, and only then.
 */
export function step(state: HighStrikerState, dt: number): boolean {
  const capped = Math.min(Math.max(dt, 0), MAX_STEP);
  if (state.phase === 'aiming') {
    Object.assign(state, stepMarker(state.marker, state.direction, capped));
  } else if (state.phase === 'swinging') {
    state.swingTime += capped;
    if (state.swingTime >= SWING_DURATION) {
      state.swingTime = 0;
      state.phase = state.swingsLeft === 0 ? 'over' : 'aiming';
      return state.phase === 'over';
    }
  }
  return false;
}

/** The last swing's score, while its animation plays. */
export function currentSwing(state: HighStrikerState): number | undefined {
  return state.phase === 'swinging' ? state.swings[state.swings.length - 1] : undefined;
}

/** How far up the tower (0 to 1) the puck is, `time` seconds into a swing scoring `score`. */
export function puckHeight(score: number, time: number): number {
  const peak = score / 100;
  if (time <= HAMMER_TIME) return 0;
  if (time <= HAMMER_TIME + RISE_TIME) {
    const t = (time - HAMMER_TIME) / RISE_TIME;
    return peak * (1 - (1 - t) * (1 - t));
  }
  if (time <= HAMMER_TIME + RISE_TIME + HOLD_TIME) return peak;
  const fall = SWING_DURATION - HAMMER_TIME - RISE_TIME - HOLD_TIME;
  const t = Math.min((time - HAMMER_TIME - RISE_TIME - HOLD_TIME) / fall, 1);
  return peak * (1 - t * t);
}

const METER = { x: 60, y: 330, width: 380, height: 28 } as const;
const TOWER = { x: 600, top: 110, bottom: 430, width: 24 } as const;
const BELL = { x: TOWER.x, y: TOWER.top - 30, radius: 26 } as const;

function draw(ctx: CanvasRenderingContext2D, state: HighStrikerState) {
  const { colors } = theme;
  const score = currentSwing(state);
  const height = score === undefined ? 0 : puckHeight(score, state.swingTime);
  const peaked = state.swingTime >= HAMMER_TIME + RISE_TIME;
  const ringing = score !== undefined && ringsBell(score) && peaked;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.fillText('Ring the bell!', METER.x, 80);
  ctx.font = canvasFont('small');
  ctx.fillStyle = colors.muted;
  ctx.fillText('Press Space or click when the marker is on the gold line.', METER.x, 106);
  ctx.fillText(
    `A hit in the gold zone scores ${BELL_SCORE} or more and rings the bell.`,
    METER.x,
    128,
  );

  ctx.font = canvasFont('body', 'bold');
  ctx.fillStyle = colors.text;
  ctx.fillText(`Swings left ${state.swingsLeft}/${SWINGS_PER_ROUND}`, METER.x, 190);
  ctx.fillText(`Total ${state.total}`, METER.x, 220);
  ctx.fillStyle = colors.muted;
  ctx.font = canvasFont('small');
  ctx.fillText(`Swings: ${state.swings.join('  ') || 'none yet'}`, METER.x, 248);

  // The timing meter: the good zone, the bell zone, the ideal line and the marker.
  ctx.fillStyle = colors.surface;
  ctx.fillRect(METER.x, METER.y, METER.width, METER.height);
  const good = 0.25;
  ctx.fillStyle = colors.water;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(
    METER.x + (IDEAL - good) * METER.width,
    METER.y,
    good * 2 * METER.width,
    METER.height,
  );
  ctx.globalAlpha = 1;
  ctx.fillStyle = colors.accent;
  ctx.fillRect(
    METER.x + (IDEAL - BELL_ZONE) * METER.width,
    METER.y,
    BELL_ZONE * 2 * METER.width,
    METER.height,
  );
  ctx.fillStyle = colors.stripeA;
  ctx.fillRect(METER.x + IDEAL * METER.width - 1, METER.y - 6, 2, METER.height + 12);
  const markerX = METER.x + state.marker * METER.width;
  ctx.fillStyle = colors.text;
  ctx.beginPath();
  ctx.moveTo(markerX, METER.y + METER.height + 2);
  ctx.lineTo(markerX - 9, METER.y + METER.height + 18);
  ctx.lineTo(markerX + 9, METER.y + METER.height + 18);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(markerX - 1, METER.y, 2, METER.height);
  ctx.font = canvasFont('small');
  ctx.fillStyle = colors.muted;
  ctx.textAlign = 'center';
  ctx.fillText('ideal', METER.x + IDEAL * METER.width, METER.y - 12);

  // The tower, with a scale from 0 to 100.
  ctx.fillStyle = colors.wood;
  ctx.fillRect(TOWER.x - TOWER.width / 2, TOWER.top, TOWER.width, TOWER.bottom - TOWER.top);
  ctx.font = canvasFont('small');
  ctx.textAlign = 'right';
  for (let mark = 0; mark <= 100; mark += 25) {
    const y = TOWER.bottom - (mark / 100) * (TOWER.bottom - TOWER.top);
    ctx.fillStyle = colors.muted;
    ctx.fillRect(TOWER.x - TOWER.width / 2 - 10, y - 1, 10, 2);
    ctx.fillText(String(mark), TOWER.x - TOWER.width / 2 - 14, y + 5);
  }

  // The bell, ringing after a hit of BELL_SCORE or more.
  if (ringing) {
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 3;
    const pulse = (state.swingTime * 6) % 1;
    for (const r of [BELL.radius + 10 + pulse * 20, BELL.radius + 30 + pulse * 20]) {
      ctx.globalAlpha = 1 - pulse;
      ctx.beginPath();
      ctx.arc(BELL.x, BELL.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = ringing ? colors.accent : colors.muted;
  ctx.beginPath();
  ctx.arc(BELL.x, BELL.y, BELL.radius, Math.PI, 0);
  ctx.lineTo(BELL.x + BELL.radius, BELL.y + 12);
  ctx.lineTo(BELL.x - BELL.radius, BELL.y + 12);
  ctx.closePath();
  ctx.fill();

  // The puck.
  const puckY = TOWER.bottom - height * (TOWER.bottom - TOWER.top);
  ctx.fillStyle = colors.danger;
  ctx.fillRect(TOWER.x - 18, puckY - 12, 36, 12);

  // The pad and the hammer, which comes down at the start of a swing.
  ctx.fillStyle = colors.surface;
  ctx.fillRect(TOWER.x - 50, TOWER.bottom, 100, 14);
  const fall = state.phase === 'swinging' ? Math.min(state.swingTime / HAMMER_TIME, 1) : 0;
  const angle = -Math.PI / 2.4 + fall * (Math.PI / 2.4);
  ctx.save();
  ctx.translate(TOWER.x + 150, TOWER.bottom + 4);
  ctx.rotate(angle);
  ctx.fillStyle = colors.wood;
  ctx.fillRect(-90, -4, 90, 8);
  ctx.fillStyle = colors.stripeA;
  ctx.fillRect(-110, -16, 28, 32);
  ctx.restore();

  if (score !== undefined && peaked) {
    ctx.textAlign = 'left';
    ctx.font = canvasFont('title', 'bold');
    ctx.fillStyle = ringing ? colors.accent : colors.text;
    ctx.fillText(ringing ? `DING! ${score}` : `${score}`, TOWER.x + 40, Math.max(puckY, 150));
  }

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Final score ${state.total} / ${SWINGS_PER_ROUND * 100}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Press Enter or click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const highStriker: CarnivalGame = {
  id: 'high-striker',
  name: 'High Striker',
  description: 'Time your hammer swing to send the puck up the tower and ring the bell.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault();
        swingKeyDown(state, event.repeat);
      } else if (event.key === 'Enter' && !event.repeat && state.phase === 'over') {
        event.preventDefault();
        state = createState();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.key === ' ') swingKeyUp(state);
    };
    const onDown = (event: PointerEvent) => {
      event.preventDefault();
      if (state.phase === 'over') state = createState();
      else swing(state);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('pointerdown', onDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      const dt = Math.min((time - last) / 1000, MAX_STEP);
      last = time;
      if (step(state, dt)) recordScore(highStriker.id, state.total);
      draw(ctx, state);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointerdown', onDown);
    };
  },
};

export default highStriker;
