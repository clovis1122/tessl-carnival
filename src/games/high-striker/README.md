# High Striker

Swing the hammer at the right moment to send the puck up the tower and ring the bell.

## How to play

- A marker slides back and forth along the meter under the instructions.
- Press **Space**, or click or tap the game, to swing. The swing locks the marker where it is.
- The hammer comes down and the puck rises up the tower. Wait for it to come back down before the next swing.
- Holding Space, or pressing again while the puck is moving, does not spend another swing.
- You get five swings per round. After the fifth, the final score shows. Press **Enter**, or click or tap, to start a new round. Restarting never spends a swing.

## Scoring

Each swing scores a whole number from 0 to 100, from how far the marker is from the ideal point, the red line in the middle of the meter:

- On the ideal point: 100.
- At either end of the meter: 0.
- In between, the score falls smoothly: `round(100 × (1 − d^1.5))`, where `d` is the distance from the ideal as a fraction of half the meter.

The puck rises to a height proportional to the score. A swing of **95 or more** rings the bell: it lights up and rings with gold rings, and the score shows as `DING!`. The gold band on the meter is where a swing rings the bell, and the blue band around it is the good-hit zone, where a swing scores at least 65.

Your round's score is the total of the five swings, from 0 to 500. It is saved to the carnival's score board once, when the fifth swing finishes.

## Files

- `game.ts`: the game logic (`createState`, `stepMarker`, `accuracyScore`, `ringsBell`, `swing`, `swingKeyDown`, `swingKeyUp`, `step`, `puckHeight`) and the `highStriker` entry, the default export the midway finds.
- `game.test.ts`: tests for the game logic.
