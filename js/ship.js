// ship.js
// All logic relating to the player's ship and its lasers:
// creation, drawing, movement, thrust, explosion, shooting, and hit detection.
// Depends on: constants.js, utils.js, game.js (for canv, ctx, roids, fxThrust, etc.)

// ─── SHIP ─────────────────────────────────────────────────────────────────────

// Returns a fresh ship object positioned at the canvas centre.
// Invincibility blink counters are pre-calculated from the relevant constants.
function newShip() {
  return {
    x: canv.width / 2,
    y: canv.height / 2,
    r: SHIP_SIZE / 2, // Collision radius
    a: (90 / 180) * Math.PI, // Facing angle (radians) — starts pointing up
    rot: 0, // Current rotation rate (radians per frame)
    canShoot: true, // False while Space is held; resets on key-up
    explodeTime: 0, // Frames remaining in the explosion animation
    lasers: [],
    dead: false,
    blinkTime: Math.ceil(SHIP_BLINK_DUR * FPS), // Frames per blink half-cycle
    blinkNum: Math.ceil(SHIP_INV_DUR / SHIP_BLINK_DUR), // Total blink cycles before invincibility ends
    thrusting: false,
    thrust: { x: 0, y: 0 }, // Accumulated velocity vector
  };
}

// Draws the triangular ship outline at position (x, y) facing angle a.
// Used both for the live ship and for the life-counter icons in the HUD.
function drawShip(x, y, a, colour = "white") {
  ctx.strokeStyle = colour;
  ctx.lineWidth = SHIP_SIZE / 20;
  ctx.beginPath();
  ctx.moveTo(
    x + (4 / 3) * ship.r * Math.cos(a), // Nose vertex
    y - (4 / 3) * ship.r * Math.sin(a),
  );
  ctx.lineTo(
    x - ship.r * ((2 / 3) * Math.cos(a) + Math.sin(a)), // Left wing
    y + ship.r * ((2 / 3) * Math.sin(a) - Math.cos(a)),
  );
  ctx.lineTo(
    x - ship.r * ((2 / 3) * Math.cos(a) - Math.sin(a)), // Right wing
    y + ship.r * ((2 / 3) * Math.sin(a) + Math.cos(a)),
  );
  ctx.closePath();
  ctx.stroke();
}

// Applies thrust or friction to the ship's velocity each frame.
// When thrusting, also renders the animated engine flame behind the ship.
function thrustShip(blinkOn) {
  if (ship.thrusting && !ship.dead) {
    ship.thrust.x += (SHIP_THRUST * Math.cos(ship.a)) / FPS;
    ship.thrust.y -= (SHIP_THRUST * Math.sin(ship.a)) / FPS;
    fxThrust.play();

    // Draw the thruster flame only on "blink on" frames (matches the ship's invincibility blink)
    if (blinkOn) {
      ctx.fillStyle = "red";
      ctx.strokeStyle = "yellow";
      ctx.lineWidth = SHIP_SIZE / 10;
      ctx.beginPath();
      ctx.moveTo(
        ship.x - ship.r * ((2 / 3) * Math.cos(ship.a) + 0.5 * Math.sin(ship.a)),
        ship.y + ship.r * ((2 / 3) * Math.sin(ship.a) - 0.5 * Math.cos(ship.a)),
      );
      ctx.lineTo(
        ship.x - ((ship.r * 5) / 3) * Math.cos(ship.a), // Flame tip
        ship.y + ((ship.r * 5) / 3) * Math.sin(ship.a),
      );
      ctx.lineTo(
        ship.x - ship.r * ((2 / 3) * Math.cos(ship.a) - 0.5 * Math.sin(ship.a)),
        ship.y + ship.r * ((2 / 3) * Math.sin(ship.a) + 0.5 * Math.cos(ship.a)),
      );
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else {
    // No thrust — apply friction to gradually bleed off speed
    ship.thrust.x -= (FRICTION * ship.thrust.x) / FPS;
    ship.thrust.y -= (FRICTION * ship.thrust.y) / FPS;
    fxThrust.stop();
  }
}

// Increments the ship's facing angle by its current rotation rate.
function rotateShip() {
  ship.a += ship.rot;
}

// Translates the ship by its current velocity and wraps it at canvas edges.
function moveShip() {
  ship.x += ship.thrust.x;
  ship.y += ship.thrust.y;
  handleEdge(ship, ship.r);
}

// Starts the ship explosion: sets the countdown timer and plays the sound.
function explodeShip() {
  ship.explodeTime = Math.ceil(SHIP_EXPLODE_DUR * FPS);
  fxExplode.play();
}

// Renders concentric coloured circles to animate the explosion, then
// decrements the timer. When it reaches zero, a life is deducted:
// spawn a new ship or trigger game over if no lives remain.
function explodingShip() {
  ctx.fillStyle = "darkred";
  ctx.beginPath();
  ctx.arc(ship.x, ship.y, ship.r * 1.8, 0, Math.PI * 2, false);
  ctx.fill();

  ctx.fillStyle = "red";
  ctx.beginPath();
  ctx.arc(ship.x, ship.y, ship.r * 1.5, 0, Math.PI * 2, false);
  ctx.fill();

  ctx.fillStyle = "orange";
  ctx.beginPath();
  ctx.arc(ship.x, ship.y, ship.r * 1.2, 0, Math.PI * 2, false);
  ctx.fill();

  ctx.fillStyle = "yellow";
  ctx.beginPath();
  ctx.arc(ship.x, ship.y, ship.r * 0.9, 0, Math.PI * 2, false);
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(ship.x, ship.y, ship.r * 0.6, 0, Math.PI * 2, false);
  ctx.fill();

  ship.explodeTime--;
  if (ship.explodeTime == 0) {
    lives--;
    if (lives == 0) {
      gameOver();
    } else {
      ship = newShip();
    }
  }
}

// ─── LASERS ───────────────────────────────────────────────────────────────────

// Fires a laser from the ship's nose tip, subject to LASER_MAX cap.
// Sets canShoot to false until the Space key is released.
function shootLaser() {
  if (ship.canShoot && ship.lasers.length < LASER_MAX) {
    ship.lasers.push({
      x: ship.x + (4 / 3) * ship.r * Math.cos(ship.a),
      y: ship.y - (4 / 3) * ship.r * Math.sin(ship.a),
      xv: (LASER_SPEED * Math.cos(ship.a)) / FPS,
      yv: -(LASER_SPEED * Math.sin(ship.a)) / FPS,
      dist: 0, // Cumulative distance travelled — removed when exceeding LASER_DIST
      explodeTime: 0, // Frames remaining in the hit explosion; 0 = travelling
    });
    fxLaser.play();
  }
  ship.canShoot = false;
}

// Draws every active laser as a small dot, or as a three-ring explosion
// animation while its explodeTime counter is running down.
function drawLaser() {
  for (var i = 0; i < ship.lasers.length; i++) {
    if (ship.lasers[i].explodeTime == 0) {
      // Active laser — small salmon circle
      ctx.fillStyle = "salmon";
      ctx.beginPath();
      ctx.arc(
        ship.lasers[i].x,
        ship.lasers[i].y,
        SHIP_SIZE / 15,
        0,
        Math.PI * 2,
        false,
      );
      ctx.fill();
    } else {
      // Hit explosion — three concentric circles fading outward
      ctx.fillStyle = "orangered";
      ctx.beginPath();
      ctx.arc(
        ship.lasers[i].x,
        ship.lasers[i].y,
        ship.r * 0.75,
        0,
        Math.PI * 2,
        false,
      );
      ctx.fill();

      ctx.fillStyle = "salmon";
      ctx.beginPath();
      ctx.arc(
        ship.lasers[i].x,
        ship.lasers[i].y,
        ship.r * 0.5,
        0,
        Math.PI * 2,
        false,
      );
      ctx.fill();

      ctx.fillStyle = "pink";
      ctx.beginPath();
      ctx.arc(
        ship.lasers[i].x,
        ship.lasers[i].y,
        ship.r * 0.25,
        0,
        Math.PI * 2,
        false,
      );
      ctx.fill();
    }
  }
}

// Moves each laser forward and removes it when it exceeds its maximum range
// or finishes its hit-explosion animation. Wraps at canvas edges while travelling.
function moveLasers() {
  for (var i = ship.lasers.length - 1; i >= 0; i--) {
    // Remove laser that has exceeded its maximum range
    if (ship.lasers[i].dist > LASER_DIST * canv.width) {
      ship.lasers.splice(i, 1);
      continue;
    }

    if (ship.lasers[i].explodeTime > 0) {
      // Count down the hit-explosion timer; remove when done
      ship.lasers[i].explodeTime--;
      if (ship.lasers[i].explodeTime == 0) {
        ship.lasers.splice(i, 1);
        continue;
      }
    } else {
      // Advance laser position and accumulate distance travelled
      ship.lasers[i].x += ship.lasers[i].xv;
      ship.lasers[i].y += ship.lasers[i].yv;
      ship.lasers[i].dist += Math.sqrt(
        Math.pow(ship.lasers[i].xv, 2) + Math.pow(ship.lasers[i].yv, 2),
      );
      handleEdge(ship.lasers[i], 0);
    }
  }
}

// Tests every travelling laser against every asteroid for a collision.
// On a hit: splits/destroys the asteroid and starts the laser explosion animation.
function detectAttack() {
  var ax, ay, ar, lx, ly;
  for (var i = roids.length - 1; i >= 0; i--) {
    ax = roids[i].x;
    ay = roids[i].y;
    ar = roids[i].r;

    for (var j = ship.lasers.length - 1; j >= 0; j--) {
      lx = ship.lasers[j].x;
      ly = ship.lasers[j].y;

      if (
        ship.lasers[j].explodeTime == 0 &&
        distBetweenPoints(ax, ay, lx, ly) < ar
      ) {
        destroyAsteroid(i);
        ship.lasers[j].explodeTime = Math.ceil(LASER_EXPLODE_DUR * FPS);
        break;
      }
    }
  }
}
