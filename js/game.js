// game.js
// Core game loop, lifecycle management, HUD rendering, sound system,
// keyboard input, and the between-level / game-over pause screens.
// Depends on: constants.js, utils.js, asteroids.js, ship.js, auth.js

// ─── DOM REFERENCES ───────────────────────────────────────────────────────────

var canv = document.getElementById("gameCanvas");
var ctx = canv.getContext("2d");
var displayScore = document.getElementById("score");
var highScoreDisplay = document.getElementById("highscore");
var startScreen = document.getElementById("start-screen");
var startHighscore = document.getElementById("start-highscore");

// ─── GAME STATE ───────────────────────────────────────────────────────────────

var level, lives, roids, score, ship, text, textAlpha;

var highScore = 0;
var gameStarted = false; // True after the player presses Enter on the start screen
var gameIsLive = false; // True only while the ship is alive mid-level
var levelsCompleted = 0; // Number of levels cleared in the current session
var waitingForNextLevel = false; // True while the level-complete pause screen is shown
var showingGameOver = false; // True while the game-over pause screen is shown
var gameInterval = null; // Reference to the setInterval handle for the game loop
var scoreSaved = false; // Guards saveScore so it fires once per pause screen, not every frame

// ─── HIGH SCORE SETTER ────────────────────────────────────────────────────────

// Called by auth.js after fetching the player's personal best from the server,
// and locally whenever the in-game score surpasses the current highScore.
function setGameHighScore(val) {
  highScore = val || 0;
  var padded = "Best: " + highScore.toString().padStart(3, "0");
  if (highScoreDisplay) highScoreDisplay.textContent = padded;

  // Keep the start-screen copies in sync as well
  var infoHi = document.getElementById("start-highscore-info");
  var choiceHi = document.getElementById("start-highscore");
  if (infoHi) infoHi.textContent = padded;
  if (choiceHi) choiceHi.textContent = padded;
}

// ─── SOUND TOGGLE HANDLERS ────────────────────────────────────────────────────

// Flips the MUSIC_ON flag and updates the button label / style.
// Truth is derived from the button text to stay in sync across calls.
function toggleMusic() {
  var btn = document.getElementById("music-btn");
  var currentlyOn = btn.textContent.trim() === "MUS: ON";
  MUSIC_ON = !currentlyOn;
  btn.textContent = MUSIC_ON ? "MUS: ON" : "MUS: OFF";
  btn.classList.toggle("toggle-off", !MUSIC_ON);
}

// Flips the SOUND_ON flag, updates the button, and immediately stops
// the thrust sound if SFX is being turned off mid-flight.
function toggleSound() {
  var btn = document.getElementById("sfx-btn");
  var currentlyOn = btn.textContent.trim() === "SFX: ON";
  SOUND_ON = !currentlyOn;
  btn.textContent = SOUND_ON ? "SFX: ON" : "SFX: OFF";
  btn.classList.toggle("toggle-off", !SOUND_ON);
  if (!SOUND_ON && typeof fxThrust !== "undefined") fxThrust.stop();
}

// ─── BETWEEN-LEVEL AND GAME-OVER SCREENS ─────────────────────────────────────

// Called when the player presses Enter on the level-complete screen.
// Clears the pause flags and starts the next level.
function proceedToNextLevel() {
  waitingForNextLevel = false;
  scoreSaved = false; // Allow saveScore to fire once for the next pause screen
  gameIsLive = true;
  newLevel();
}

// Renders the level-complete overlay with score and a blinking prompt.
// Also shows a subtle hint that logout is available at this point.
function drawLevelComplete() {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "rgb(47, 255, 0)";
  ctx.font = "small-caps 42px VT323";
  ctx.fillText(
    "PHASE " + level + " COMPLETE",
    canv.width / 2,
    canv.height / 2 - 50,
  );

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "small-caps 20px VT323";
  ctx.fillText(
    "SCORE: " + score.toString().padStart(6, "0"),
    canv.width / 2,
    canv.height / 2,
  );

  // Blink the prompt at ~2 Hz using the system clock
  if (Math.floor(Date.now() / 500) % 2 === 0) {
    ctx.fillStyle = "white";
    ctx.font = "small-caps 28px VT323";
    ctx.fillText(
      "— PRESS ENTER TO CONTINUE —",
      canv.width / 2,
      canv.height / 2 + 50,
    );
  }

  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.font = "small-caps 16px VT323";
  ctx.fillText("you may also logout now", canv.width / 2, canv.height / 2 + 95);
}

// Renders the game-over overlay with final score, level reached, and a prompt.
function drawGameOver() {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "tomato";
  ctx.font = "small-caps 52px VT323";
  ctx.fillText("GAME OVER", canv.width / 2, canv.height / 2 - 60);

  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "small-caps 22px VT323";
  ctx.fillText(
    "FINAL SCORE: " +
      score.toString().padStart(6, "0") +
      "   |   LEVEL " +
      (level + 1),
    canv.width / 2,
    canv.height / 2 - 10,
  );

  if (Math.floor(Date.now() / 500) % 2 === 0) {
    ctx.fillStyle = "white";
    ctx.font = "small-caps 28px VT323";
    ctx.fillText(
      "— PRESS ENTER TO PLAY AGAIN —",
      canv.width / 2,
      canv.height / 2 + 45,
    );
  }

  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.font = "small-caps 16px VT323";
  ctx.fillText("you may also logout now", canv.width / 2, canv.height / 2 + 95);
}

// ─── SOUND SYSTEM ─────────────────────────────────────────────────────────────

// Pooled audio player — maintains up to maxStreams simultaneous instances of a
// sound so rapid fire doesn't cut a sound short.
var fxLaser = new Sound("sounds/laser.m4a", 5, 0.1);
var fxExplode = new Sound("sounds/explode.m4a");
var fxHit = new Sound("sounds/hit.m4a", 5, 0.3);
var fxThrust = new Sound("sounds/thrust.m4a");

// Alternating-beat music player that speeds up as fewer asteroids remain.
var music = new Music("sounds/music-low.m4a", "sounds/music-high.m4a");

// ─── KEYBOARD INPUT ───────────────────────────────────────────────────────────

function keyDown(event) {
  // Enter on the start screen begins the game (info-step must be visible)
  if (event.key === "Enter" && !gameStarted) {
    var infoStep = document.getElementById("info-step");
    if (!infoStep || infoStep.style.display === "none") return;
    startGame();
    return;
  }

  // Enter on the level-complete screen advances to the next level
  if (event.key === "Enter" && waitingForNextLevel) {
    proceedToNextLevel();
    return;
  }

  // Enter on the game-over screen restarts from level 1
  if (event.key === "Enter" && showingGameOver) {
    newGame();
    return;
  }

  // All other keys are ignored while the game hasn't started or the ship is dead
  if (!gameStarted || ship.dead) return;

  switch (event.key) {
    case " ":
      event.preventDefault(); // Prevent page scroll on Space
      shootLaser();
      break;
    case "w":
    case "W":
    case "ArrowUp":
      ship.thrusting = true;
      break;
    case "d":
    case "D":
    case "ArrowRight":
      ship.rot = -((TURN_SPEED / 180) * Math.PI) / FPS; // Clockwise
      break;
    case "a":
    case "A":
    case "ArrowLeft":
      ship.rot = ((TURN_SPEED / 180) * Math.PI) / FPS; // Counter-clockwise
      break;
  }
}

function keyUp(event) {
  if (!gameStarted || ship.dead) return;

  switch (event.key) {
    case " ":
      ship.canShoot = true; // Re-arm after Space is released
      break;
    case "w":
    case "W":
    case "ArrowUp":
      ship.thrusting = false;
      break;
    case "d":
    case "D":
    case "ArrowRight":
      ship.rot = 0;
      break;
    case "a":
    case "A":
    case "ArrowLeft":
      ship.rot = 0;
      break;
  }
}

// ─── GAME LIFECYCLE ───────────────────────────────────────────────────────────

// Hides the start screen, creates the first game state, and starts the loop.
function startGame() {
  startScreen.style.display = "none";
  gameStarted = true;
  gameIsLive = true;
  newGame();
  gameInterval = setInterval(update, 1000 / FPS);
}

// Resets all per-game state and spawns the first level.
function newGame() {
  level = 0;
  score = 0;
  lives = GAME_LIVES;
  levelsCompleted = 0;
  gameIsLive = true;
  waitingForNextLevel = false;
  showingGameOver = false;
  scoreSaved = false;
  ship = newShip();
  newLevel();
}

// Sets up the phase announcement text and spawns a fresh asteroid belt.
function newLevel() {
  text = "Phase " + (level + 1);
  textAlpha = 1.0;
  createAsteroidBelt();
}

// Marks the ship as dead and signals the game-over flow.
// gameIsLive is cleared so logout is no longer blocked.
function gameOver() {
  ship.dead = true;
  gameIsLive = false;
  text = "GAME OVER";
  textAlpha = 1.0;
}

// ─── COLLISION DETECTION ──────────────────────────────────────────────────────

// Tests the ship against every asteroid each frame.
// Skipped during the invincibility blink period and after death.
// A collision destroys the asteroid (no score) and triggers the ship explosion.
function collisionCheck() {
  if (ship.blinkNum == 0 && !ship.dead) {
    for (var i = 0; i < roids.length; i++) {
      if (
        distBetweenPoints(ship.x, ship.y, roids[i].x, roids[i].y) <
        ship.r + roids[i].r
      ) {
        explodeShip();
        destroyAsteroid(i, false); // false = no points for ship-asteroid collision
        break;
      }
    }
  }
}

// ─── HUD ──────────────────────────────────────────────────────────────────────

// Draws the fading phase/game-over text and the life-counter ship icons.
// Once the fade-out text expires after death, it raises the game-over flag.
function drawContent(exploding) {
  if (textAlpha >= 0) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255," + textAlpha + ")";
    ctx.font = "small-caps " + TEXT_SIZE + "px VT323";
    ctx.fillText(text, canv.width / 2, canv.height * 0.75);
    textAlpha -= 1.0 / TEXT_FADE_TIME / FPS;
  } else if (ship.dead) {
    // Text has fully faded — switch to the static game-over pause screen
    showingGameOver = true;
  }

  // Draw one small ship icon per remaining life; the last icon turns red while exploding
  var lifeColour;
  for (var i = 0; i < lives; i++) {
    lifeColour = exploding && i == lives - 1 ? "red" : "white";
    drawShip(
      SHIP_SIZE + i * SHIP_SIZE * 1.2,
      SHIP_SIZE,
      0.5 * Math.PI,
      lifeColour,
    );
  }
}

// ─── SOUND CLASSES ────────────────────────────────────────────────────────────

// Pooled audio object: pre-allocates maxStreams Audio instances so overlapping
// playback of the same clip is possible without restarting.
function Sound(src, maxStreams, vol) {
  if (maxStreams === undefined) maxStreams = 1;
  if (vol === undefined) vol = 1.0;
  this.streamNum = 0;
  this.streams = [];
  for (var i = 0; i < maxStreams; i++) {
    this.streams.push(new Audio(src));
    this.streams[i].volume = vol;
  }
  // Advances the round-robin stream index before playing
  this.play = function () {
    if (SOUND_ON) {
      this.streamNum = (this.streamNum + 1) % maxStreams;
      this.streams[this.streamNum].play();
    }
  };
  // Pauses and rewinds the currently active stream
  this.stop = function () {
    this.streams[this.streamNum].pause();
    this.streams[this.streamNum].currentTime = 0;
  };
}

// Two-note alternating background music that accelerates as the asteroid count drops.
// tempo ranges from 1.0 (many asteroids) down toward 0.25 (last asteroid).
function Music(srcLow, srcHigh) {
  this.soundLow = new Audio(srcLow);
  this.soundHigh = new Audio(srcHigh);
  this.low = true; // Which note plays next
  this.tempo = 1.0; // Beat interval multiplier (lower = faster)
  this.beatTime = 0; // Frames until the next beat

  this.play = function () {
    if (MUSIC_ON) {
      (this.low ? this.soundLow : this.soundHigh).play();
      this.low = !this.low;
    }
  };

  // ratio = asteroids remaining / asteroids at level start; drives tempo
  this.setAsteroidRatio = function (ratio) {
    this.tempo = 1.0 - 0.75 * (1.0 - ratio);
  };

  // Called every frame; fires a beat when the countdown hits zero
  this.tick = function () {
    if (this.beatTime == 0) {
      this.play();
      this.beatTime = Math.ceil(this.tempo * FPS);
    } else {
      this.beatTime--;
    }
  };
}

// ─── MAIN GAME LOOP ───────────────────────────────────────────────────────────

// Called at FPS intervals by setInterval. Clears the canvas then dispatches
// to the appropriate state: pause screens, explosion animation, or normal play.
function update() {
  var blinkOn = ship.blinkNum % 2 == 0;
  var exploding = ship.explodeTime > 0;

  // Clear canvas to black each frame
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canv.width, canv.height);

  // ── Level-complete pause ─────────────────────────────────────────────────────
  if (waitingForNextLevel) {
    // saveScore is guarded by scoreSaved so it only fires once when the screen
    // first appears, not on every frame (which would spam the API and cause flickering)
    if (currentPlayer && !scoreSaved) {
      saveScore(score, level);
      scoreSaved = true;
    }
    drawLevelComplete();
    displayScore.textContent = "Score: " + score.toString().padStart(3, "0");
    if (score > highScore) {
      highScore = score;
      highScoreDisplay.textContent =
        "Best: " + highScore.toString().padStart(3, "0");
    }
    return;
  }

  // ── Game-over pause ──────────────────────────────────────────────────────────
  if (showingGameOver) {
    if (currentPlayer && !scoreSaved) {
      saveScore(score, level);
      scoreSaved = true;
    }
    drawGameOver();
    displayScore.textContent = "Score: " + score.toString().padStart(3, "0");
    if (score > highScore) {
      highScore = score;
      highScoreDisplay.textContent =
        "Best: " + highScore.toString().padStart(3, "0");
    }
    return;
  }

  // ── Normal play ──────────────────────────────────────────────────────────────
  music.tick();

  if (!exploding) {
    thrustShip(blinkOn);

    // Only draw the ship during "blink on" frames and while alive
    if (blinkOn && !ship.dead) drawShip(ship.x, ship.y, ship.a);

    // Count down invincibility blink frames
    if (ship.blinkNum > 0) {
      ship.blinkTime--;
      if (ship.blinkTime == 0) {
        ship.blinkTime = Math.ceil(SHIP_BLINK_DUR * FPS);
        ship.blinkNum--;
      }
    }

    // Optional debug overlays
    if (SHOW_BOUNDING) {
      ctx.strokeStyle = "lime";
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, ship.r, 0, Math.PI * 2, false);
      ctx.stroke();
    }
    if (SHOW_CENTRE_DOT) {
      ctx.fillStyle = "red";
      ctx.fillRect(ship.x - 1, ship.y - 1, 2, 2);
    }

    drawLaser();
    detectAttack();
    collisionCheck();
    rotateShip();
    moveShip();
    moveLasers();
  } else {
    explodingShip();
  }

  drawContent(exploding);
  drawAsteroid();
  moveAsteroids();

  // Update score display and track high score in real time
  displayScore.textContent = "Score: " + score.toString().padStart(3, "0");
  if (score > highScore) highScore = score;
  highScoreDisplay.textContent =
    "Best: " + highScore.toString().padStart(3, "0");
}

// ─── BOOTSTRAP ────────────────────────────────────────────────────────────────

document.addEventListener("keydown", keyDown);
document.addEventListener("keyup", keyUp);
