// asteroids.js
// Handles creation, rendering, movement, and destruction of asteroids.
// Depends on: constants.js, utils.js, game.js (for level, score, roids, canv, ctx)

// Builds and returns a single asteroid object at position (x, y) with radius r.
// Speed scales with the current level. Shape is randomised via vertex offsets.
function newAsteroid(x, y, r) {
  var lvlMult = 1 + 0.1 * level;
  var roid = {
    x: x,
    y: y,
    xv:
      ((Math.random() * ROID_SPEED * lvlMult) / FPS) *
      (Math.random() < 0.5 ? 1 : -1),
    yv:
      ((Math.random() * ROID_SPEED * lvlMult) / FPS) *
      (Math.random() < 0.5 ? 1 : -1),
    r: r,
    a: Math.random() * Math.PI * 2, // Initial rotation angle
    vert: Math.floor(Math.random() * (ROIDS_VERT + 1) + ROIDS_VERT / 2),
    offs: [], // Per-vertex radius offsets that give the jagged shape
  };

  // Generate random offsets for each vertex to produce irregular asteroid shapes
  for (var i = 0; i < roid.vert; i++) {
    roid.offs.push(Math.random() * ROIDS_JAG * 2 + 1 - ROIDS_JAG);
  }
  return roid;
}

// Populates the global roids array with a fresh set of large asteroids.
// Asteroids are placed randomly but always at a safe distance from the ship.
function createAsteroidBelt() {
  roids = [];
  var x, y;
  for (var i = 0; i < ROIDS_NUM + level; i++) {
    do {
      x = Math.floor(Math.random() * canv.width);
      y = Math.floor(Math.random() * canv.height);
    } while (distBetweenPoints(ship.x, ship.y, x, y) < ROIDS_SIZE * 2 + ship.r);
    roids.push(newAsteroid(x, y, Math.ceil(ROIDS_SIZE / 2)));
  }
}

// Destroys the asteroid at roids[index].
// Large and medium asteroids split into two smaller children.
// Points are awarded only when flag is true (laser hit); ship collisions pass flag=false.
// When the last asteroid is cleared the level-complete flow begins.
function destroyAsteroid(index, flag = true) {
  var x = roids[index].x;
  var y = roids[index].y;
  var r = roids[index].r;

  if (r == Math.ceil(ROIDS_SIZE / 2)) {
    // Large asteroid splits into two medium asteroids
    roids.push(newAsteroid(x, y, Math.ceil(ROIDS_SIZE / 4)));
    roids.push(newAsteroid(x, y, Math.ceil(ROIDS_SIZE / 4)));
    flag
      ? (score += Math.floor(Math.random() * ROIDS_PTS_LARGE + 5))
      : (score = score);
  } else if (r == Math.ceil(ROIDS_SIZE / 4)) {
    // Medium asteroid splits into two small asteroids
    roids.push(newAsteroid(x, y, Math.ceil(ROIDS_SIZE / 8)));
    roids.push(newAsteroid(x, y, Math.ceil(ROIDS_SIZE / 8)));
    flag
      ? (score += Math.floor(Math.random() * ROIDS_PTS_MED + 10))
      : (score = score);
  } else {
    // Small asteroid — no further splitting, highest point value
    flag
      ? (score += Math.floor(Math.random() * ROIDS_PTS_SML + 20))
      : (score = score);
  }

  roids.splice(index, 1);
  fxHit.play();

  // All asteroids cleared — transition to the between-level pause screen
  if (roids.length == 0) {
    levelsCompleted++; // Unlock logout while waiting between levels
    level++;
    gameIsLive = false; // Prevent mid-level logout block from firing
    waitingForNextLevel = true; // Signal the game loop to show the level-complete screen
  }
}

// Draws every asteroid in the roids array using their stored vertex/offset data.
// Optionally draws a bounding circle when SHOW_BOUNDING is enabled for debugging.
function drawAsteroid() {
  var x, y, r, a, vert, offs;
  for (var i = 0; i < roids.length; i++) {
    ctx.fillStyle = "cornsilk";
    ctx.lineWidth = SHIP_SIZE / 20;

    x = roids[i].x;
    y = roids[i].y;
    r = roids[i].r;
    a = roids[i].a;
    vert = roids[i].vert;
    offs = roids[i].offs;

    ctx.beginPath();
    ctx.moveTo(x + r * offs[0] * Math.cos(a), y + r * offs[0] * Math.sin(a));
    for (var j = 1; j < vert; j++) {
      ctx.lineTo(
        x + r * offs[j] * Math.cos(a + (j * Math.PI * 2) / vert),
        y + r * offs[j] * Math.sin(a + (j * Math.PI * 2) / vert),
      );
    }
    ctx.closePath();
    ctx.fill();

    if (SHOW_BOUNDING) {
      ctx.strokeStyle = "lime";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2, false);
      ctx.stroke();
    }
  }
}

// Advances every asteroid by its velocity vector and wraps it at canvas edges.
function moveAsteroids() {
  for (var i = 0; i < roids.length; i++) {
    roids[i].x += roids[i].xv;
    roids[i].y += roids[i].yv;
    handleEdge(roids[i], roids[i].r);
  }
}
