# Falling Objects

Dodge everything that falls from the top of the booth for as long as you can.

## How to play

- Move left with the Left arrow or A, and right with the Right arrow or D. You
  can't leave the play area.
- The first obstacle drops after 2 seconds, while the controls are still on
  screen. Obstacles drop from random spots along the top and fall straight down.
  Once one passes the bottom of the play area it is gone.
- One hit ends the round. Everything freezes: you stop moving, nothing new
  falls and the clock stops. An obstacle only hits you when it overlaps you;
  just touching an edge doesn't count.
- On the game over screen, press Enter or click (or tap) the game to play again.
  A new round starts from scratch: you back in the middle, no obstacles, the
  clock and difficulty back at zero, and no keys held.
- If the window loses focus, or you switch tabs, the game lets go of the keys you
  were holding. The game moves at most 0.05 seconds per frame, so time spent in
  another tab doesn't count and obstacles can't jump past you.

## Difficulty

The game gets harder over the first 60 seconds you survive, then stays there:

| Survived | Fall speed | New obstacle every |
| -------- | ---------- | ------------------ |
| 0 s      | 140 px/s   | 1.1 s              |
| 30 s     | 250 px/s   | 0.75 s             |
| 60 s+    | 360 px/s   | 0.4 s              |

Obstacles are 28 to 52 px squares, and each one keeps the speed it had when it
appeared.

## Scoring

Your score is the whole seconds you survived, so 12.7 seconds scores 12. Higher
is better. The time and score show at the top while you play, and the game over
screen shows your final time and score. The score is saved to the carnival's
score board once, when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `step`, `movePlayer`, `spawnObstacle`,
  `collides`, `difficulty`, `fallSpeed`, `spawnInterval`, `scoreFor`) and the
  `fallingObjects` entry, the default export the midway finds. `step` and
  `spawnObstacle` take a random source, so tests can make rounds repeatable.
- `game.test.ts`: tests for the game logic.
