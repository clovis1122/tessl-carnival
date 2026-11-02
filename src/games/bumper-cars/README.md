# Bumper Cars

Bump the three rival cars out of the ring before they bump you out.

## How to play

- Drive your yellow car with **WASD** or the **arrow keys**. Keys push the car in
  that direction; cars keep their momentum, slow down with friction and have a
  top speed.
- The three rivals chase you and try to bump you. They ease back towards the
  middle when they get near the edge, but a good bump still sends them out.
- When two cars touch they are pushed apart, harder the faster they hit.
- The dashed line is the edge of the ring. There are no walls: a car whose centre
  crosses the line is knocked out, stops, and no longer bumps anything.

## How a round ends

- **You win** when every rival is knocked out.
- **You lose** when your car is knocked out. If you go out in the same moment as
  the last rival, it still counts as a loss.
- **Time's up** after 60 seconds if any rivals are left.

Press **Enter** or click (or tap) the game to start a new round. Holding Enter
does not restart over and over, and a new round starts with no keys held.

## Scoring

| What                         | Points |
| ---------------------------- | ------ |
| Each rival knocked out       | 100    |
| Each whole second you last   | 1      |
| Winning (every rival is out) | 300    |

So knocking out all three rivals in 20.4 seconds scores 300 + 20 + 300 = 620.
The score freezes when the round ends, and is saved once to the carnival's score
board.

Time only counts while the game is running: each frame moves the game on by at
most 0.05 seconds, so coming back to a background tab doesn't teleport the cars
or add survival time.

## Files

- `game.ts`: the game logic (`createState`, `step`, `drive`, `collide`,
  `rivalDirection`, `scoreFor`, `frameStep`) and the `bumperCars` entry, the
  default export the midway finds.
- `game.test.ts`: tests for the game logic.
