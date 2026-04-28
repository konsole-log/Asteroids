// utils.js
// General-purpose helper functions shared across all game modules.
// No game state is stored or modified here.

// Returns the straight-line (Euclidean) distance between two points.
// Used for collision detection between the ship, lasers, and asteroids.
function distBetweenPoints(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

// Wraps an object around the canvas edges so it re-enters from the opposite side.
// Works for the ship, lasers, and asteroids alike.
// objSize is the object's radius — objects begin to wrap only once fully off-screen.
function handleEdge(obj, objSize) {
  if (obj.x < 0 - objSize) {
    obj.x = canv.width + objSize;
  } else if (obj.x > canv.width + objSize) {
    obj.x = 0 - objSize;
  }
  if (obj.y < 0 - objSize) {
    obj.y = canv.height + objSize;
  } else if (obj.y > canv.height + objSize) {
    obj.y = 0 - objSize;
  }
}
