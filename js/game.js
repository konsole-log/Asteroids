// game.js
// Core game loop, lifecycle management, HUD rendering, sound system,
// keyboard input, and the between-level / game-over / pause screens.
// Depends on: constants.js, utils.js, asteroids.js, ship.js, auth.js

// ─── DOM REFERENCES ───────────────────────────────────────────────────────────

var canv             = document.getElementById("gameCanvas");
var ctx              = canv.getContext("2d");
var displayScore     = document.getElementById("score");
var highScoreDisplay = document.getElementById("highscore");
var startScreen      = document.getElementById("start-screen");
var startHighscore   = document.getElementById("start-highscore");

// ─── GAME STATE ───────────────────────────────────────────────────────────────

var level, lives, roids, score, ship, text, textAlpha;

var highScore           = 0;
var gameStarted         = false;  // True after player presses Enter on start screen
var gameIsLive          = false;  // True only while ship is alive mid-level
var gamePaused          = false;  // True while game is paused with P key
var levelsCompleted     = 0;      // Levels cleared this session — gates logout
var waitingForNextLevel = false;  // True while level-complete screen is showing
var showingGameOver     = false;  // True while game-over screen is showing
var gameInterval        = null;   // setInterval handle
var scoreSaved          = false;  // Prevents saveScore firing more than once per screen

// ─── HIGH SCORE SETTER ────────────────────────────────────────────────────────

function setGameHighScore(val) {
  highScore = val || 0;
  var padded = "Best: " + highScore.toString().padStart(3, "0");
  if (highScoreDisplay) highScoreDisplay.textContent = padded;
  var infoHi   = document.getElementById("start-highscore-info");
  var choiceHi = document.getElementById("start-highscore");
  if (infoHi)   infoHi.textContent   = padded;
  if (choiceHi) choiceHi.textContent = padded;
}

// ─── SOUND TOGGLE HANDLERS ────────────────────────────────────────────────────

function toggleMusic() {
  var btn = document.getElementById("music-btn");
  var currentlyOn = btn.textContent.trim() === "MUS: ON";
  MUSIC_ON = !currentlyOn;
  btn.textContent = MUSIC_ON ? "MUS: ON" : "MUS: OFF";
  btn.classList.toggle("toggle-off", !MUSIC_ON);
}

function toggleSound() {
  var btn = document.getElementById("sfx-btn");
  var currentlyOn = btn.textContent.trim() === "SFX: ON";
  SOUND_ON = !currentlyOn;
  btn.textContent = SOUND_ON ? "SFX: ON" : "SFX: OFF";
  btn.classList.toggle("toggle-off", !SOUND_ON);
  if (!SOUND_ON && typeof fxThrust !== "undefined") fxThrust.stop();
}

// ─── PAUSE ────────────────────────────────────────────────────────────────────

// Toggles pause. Only works when the ship is alive mid-level (gameIsLive).
// The game loop keeps running — we just skip updates and draw the overlay.
function togglePause() {
  // Only pause during live mid-level play
  if (!gameStarted || !gameIsLive) return;
  gamePaused = !gamePaused;

  var pauseBtn = document.getElementById("pause-btn");
  if (pauseBtn) {
    pauseBtn.textContent = gamePaused ? "▶ RESUME" : "⏸ PAUSE";
    pauseBtn.classList.toggle("toggle-off", gamePaused);
  }

  if (gamePaused && typeof fxThrust !== "undefined") fxThrust.stop();
}

// Draws a semi-transparent retro pause overlay directly on the canvas.
// Called every frame while gamePaused is true instead of the normal update logic.
function drawPauseScreen() {
  // Semi-transparent overlay on top of frozen last frame
  ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
  ctx.fillRect(0, 0, canv.width, canv.height);

  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "rgb(47, 255, 0)";
  ctx.font      = "small-caps 60px VT323";
  ctx.fillText("[ PAUSED ]", canv.width / 2, canv.height / 2 - 44);

  if (Math.floor(Date.now() / 500) % 2 === 0) {
    ctx.fillStyle = "white";
    ctx.font      = "small-caps 28px VT323";
    ctx.fillText("PRESS P TO RESUME", canv.width / 2, canv.height / 2 + 14);
  }

  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font      = "small-caps 20px VT323";
  ctx.fillText(
    "SCORE: " + score.toString().padStart(6, "0") +
    "   |   PHASE " + (level + 1),
    canv.width / 2, canv.height / 2 + 58
  );
}

// ─── BETWEEN-LEVEL AND GAME-OVER SCREENS ─────────────────────────────────────

function proceedToNextLevel() {
  waitingForNextLevel = false;
  scoreSaved          = false;
  gameIsLive          = true;
  newLevel();
}

function drawLevelComplete() {
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "rgb(47, 255, 0)";
  ctx.font      = "small-caps 42px VT323";
  ctx.fillText("PHASE " + level + " COMPLETE", canv.width / 2, canv.height / 2 - 50);

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font      = "small-caps 20px VT323";
  ctx.fillText("SCORE: " + score.toString().padStart(6, "0"), canv.width / 2, canv.height / 2);

  if (Math.floor(Date.now() / 500) % 2 === 0) {
    ctx.fillStyle = "white";
    ctx.font      = "small-caps 28px VT323";
    ctx.fillText("— PRESS ENTER TO CONTINUE —", canv.width / 2, canv.height / 2 + 50);
  }

  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.font      = "small-caps 16px VT323";
  ctx.fillText("you may also logout now", canv.width / 2, canv.height / 2 + 95);
}

function drawGameOver() {
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "tomato";
  ctx.font      = "small-caps 52px VT323";
  ctx.fillText("GAME OVER", canv.width / 2, canv.height / 2 - 60);

  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font      = "small-caps 22px VT323";
  ctx.fillText(
    "FINAL SCORE: " + score.toString().padStart(6, "0") +
    "   |   LEVEL " + (level + 1),
    canv.width / 2, canv.height / 2 - 10
  );

  if (Math.floor(Date.now() / 500) % 2 === 0) {
    ctx.fillStyle = "white";
    ctx.font      = "small-caps 28px VT323";
    ctx.fillText("— PRESS ENTER TO PLAY AGAIN —", canv.width / 2, canv.height / 2 + 45);
  }

  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.font      = "small-caps 16px VT323";
  ctx.fillText("you may also logout now", canv.width / 2, canv.height / 2 + 95);
}

// ─── SOUND SYSTEM ─────────────────────────────────────────────────────────────

var fxLaser   = new Sound("sounds/laser.m4a",   5, 0.1);
var fxExplode = new Sound("sounds/explode.m4a");
var fxHit     = new Sound("sounds/hit.m4a",     5, 0.3);
var fxThrust  = new Sound("sounds/thrust.m4a");
var music     = new Music("sounds/music-low.m4a", "sounds/music-high.m4a");

// ─── KEYBOARD INPUT ───────────────────────────────────────────────────────────

function keyDown(event) {
  // Enter on start screen — only from info-step
  if (event.key === "Enter" && !gameStarted) {
    var infoStep = document.getElementById("info-step");
    if (!infoStep || infoStep.style.display === "none") return;
    startGame();
    return;
  }

  // Enter on level-complete screen
  if (event.key === "Enter" && waitingForNextLevel) {
    proceedToNextLevel();
    return;
  }

  // Enter on game-over screen
  if (event.key === "Enter" && showingGameOver) {
    newGame();
    return;
  }

  // P — toggle pause (only during live play, not on pause screens or start screen)
  if ((event.key === "p" || event.key === "P") && gameStarted) {
    togglePause();
    return;
  }

  // All other keys ignored while not playing or ship is dead
  if (!gameStarted || ship.dead || gamePaused) return;

  switch (event.key) {
    case " ":
      event.preventDefault();
      shootLaser();
      break;
    case "w": case "W": case "ArrowUp":
      ship.thrusting = true;
      break;
    case "d": case "D": case "ArrowRight":
      ship.rot = -((TURN_SPEED / 180) * Math.PI) / FPS;
      break;
    case "a": case "A": case "ArrowLeft":
      ship.rot = ((TURN_SPEED / 180) * Math.PI) / FPS;
      break;
  }
}

function keyUp(event) {
  if (!gameStarted || ship.dead || gamePaused) return;

  switch (event.key) {
    case " ":      ship.canShoot  = true;  break;
    case "w": case "W": case "ArrowUp":    ship.thrusting = false; break;
    case "d": case "D": case "ArrowRight": ship.rot = 0;           break;
    case "a": case "A": case "ArrowLeft":  ship.rot = 0;           break;
  }
}

// ─── GAME LIFECYCLE ───────────────────────────────────────────────────────────

function startGame() {
  startScreen.style.display = "none";
  gameStarted  = true;
  gameIsLive   = true;
  gamePaused   = false;
  // Show the pause button now that the game is running
  var pauseBtn = document.getElementById("pause-btn");
  if (pauseBtn) pauseBtn.style.display = "inline-block";
  newGame();
  gameInterval = setInterval(update, 1000 / FPS);
}

function newGame() {
  level               = 0;
  score               = 0;
  lives               = GAME_LIVES;
  levelsCompleted     = 0;
  gameIsLive          = true;
  gamePaused          = false;
  waitingForNextLevel = false;
  showingGameOver     = false;
  scoreSaved          = false;
  ship                = newShip();
  newLevel();
}

function newLevel() {
  text      = "Phase " + (level + 1);
  textAlpha = 1.0;
  createAsteroidBelt();
}

function gameOver() {
  ship.dead       = true;
  gameIsLive      = false;
  gamePaused      = false;   // Can't be paused on game over
  text            = "GAME OVER";
  textAlpha       = 1.0;
}

// ─── COLLISION DETECTION ──────────────────────────────────────────────────────

function collisionCheck() {
  if (ship.blinkNum == 0 && !ship.dead) {
    for (var i = 0; i < roids.length; i++) {
      if (distBetweenPoints(ship.x, ship.y, roids[i].x, roids[i].y) < ship.r + roids[i].r) {
        explodeShip();
        destroyAsteroid(i, false);
        break;
      }
    }
  }
}

// ─── HUD ──────────────────────────────────────────────────────────────────────

function drawContent(exploding) {
  if (textAlpha >= 0) {
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle    = "rgba(255,255,255," + textAlpha + ")";
    ctx.font         = "small-caps " + TEXT_SIZE + "px VT323";
    ctx.fillText(text, canv.width / 2, canv.height * 0.75);
    textAlpha -= 1.0 / TEXT_FADE_TIME / FPS;
  } else if (ship.dead) {
    showingGameOver = true;
  }

  var lifeColour;
  for (var i = 0; i < lives; i++) {
    lifeColour = exploding && i == lives - 1 ? "red" : "white";
    drawShip(SHIP_SIZE + i * SHIP_SIZE * 1.2, SHIP_SIZE, 0.5 * Math.PI, lifeColour);
  }
}

// ─── SOUND CLASSES ────────────────────────────────────────────────────────────

function Sound(src, maxStreams, vol) {
  if (maxStreams === undefined) maxStreams = 1;
  if (vol       === undefined) vol = 1.0;
  this.streamNum = 0;
  this.streams   = [];
  for (var i = 0; i < maxStreams; i++) {
    this.streams.push(new Audio(src));
    this.streams[i].volume = vol;
  }
  this.play = function () {
    if (SOUND_ON) {
      this.streamNum = (this.streamNum + 1) % maxStreams;
      this.streams[this.streamNum].play();
    }
  };
  this.stop = function () {
    this.streams[this.streamNum].pause();
    this.streams[this.streamNum].currentTime = 0;
  };
}

function Music(srcLow, srcHigh) {
  this.soundLow  = new Audio(srcLow);
  this.soundHigh = new Audio(srcHigh);
  this.low       = true;
  this.tempo     = 1.0;
  this.beatTime  = 0;
  this.play = function () {
    if (MUSIC_ON) {
      (this.low ? this.soundLow : this.soundHigh).play();
      this.low = !this.low;
    }
  };
  this.setAsteroidRatio = function (ratio) {
    this.tempo = 1.0 - 0.75 * (1.0 - ratio);
  };
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

function update() {
  var blinkOn   = ship.blinkNum % 2 == 0;
  var exploding = ship.explodeTime > 0;

  // ── PAUSE SCREEN ─────────────────────────────────────────────────────────────
  // When paused: don't clear canvas, don't update anything —
  // just draw the overlay on top of the frozen last frame and return.
  if (gamePaused) {
    drawPauseScreen();
    return;
  }

  // Clear canvas every non-paused frame
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canv.width, canv.height);

  // ── LEVEL-COMPLETE SCREEN ─────────────────────────────────────────────────────
  if (waitingForNextLevel) {
    if (currentPlayer && !scoreSaved) {
      saveScore(score, level);
      scoreSaved = true;
    }
    drawLevelComplete();
    displayScore.textContent = "Score: " + score.toString().padStart(3, "0");
    if (score > highScore) {
      highScore = score;
      highScoreDisplay.textContent = "Best: " + highScore.toString().padStart(3, "0");
    }
    return;
  }

  // ── GAME-OVER SCREEN ──────────────────────────────────────────────────────────
  if (showingGameOver) {
    if (currentPlayer && !scoreSaved) {
      saveScore(score, level);
      scoreSaved = true;
    }
    drawGameOver();
    displayScore.textContent = "Score: " + score.toString().padStart(3, "0");
    if (score > highScore) {
      highScore = score;
      highScoreDisplay.textContent = "Best: " + highScore.toString().padStart(3, "0");
    }
    return;
  }

  // ── NORMAL PLAY ───────────────────────────────────────────────────────────────
  music.tick();

  if (!exploding) {
    thrustShip(blinkOn);
    if (blinkOn && !ship.dead) drawShip(ship.x, ship.y, ship.a);

    if (ship.blinkNum > 0) {
      ship.blinkTime--;
      if (ship.blinkTime == 0) {
        ship.blinkTime = Math.ceil(SHIP_BLINK_DUR * FPS);
        ship.blinkNum--;
      }
    }

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

  displayScore.textContent = "Score: " + score.toString().padStart(3, "0");
  if (score > highScore) highScore = score;
  highScoreDisplay.textContent = "Best: " + highScore.toString().padStart(3, "0");
}

// ─── BOOTSTRAP ────────────────────────────────────────────────────────────────

document.addEventListener("keydown", keyDown);
document.addEventListener("keyup",   keyUp);
