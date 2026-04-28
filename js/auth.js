// auth.js
// Manages the pre-game authentication flow (login / register / guest),
// session persistence via sessionStorage, score saving, personal best fetching,
// leaderboard rendering, and the logout rules that interlock with game state.
// Depends on: game.js (reads/writes gameStarted, gameIsLive, levelsCompleted, etc.)

const API_BASE = "api"; // Base path prepended to every PHP endpoint URL

// Restore a previously authenticated player from the current browser session.
// Null means the player is either a guest or not yet authenticated.
let currentPlayer =
  JSON.parse(sessionStorage.getItem("asteroids_player")) || null;

// ─── DOM REFERENCES ───────────────────────────────────────────────────────────

const choiceStep = document.getElementById("choice-step");
const authStep = document.getElementById("auth-step");
const infoStep = document.getElementById("info-step");

const goLoginBtn = document.getElementById("go-login-btn");
const goRegisterBtn = document.getElementById("go-register-btn");
const guestBtn = document.getElementById("guest-btn");

const authForm = document.getElementById("auth-form");
const authTitle = document.getElementById("auth-title");
const authUsername = document.getElementById("auth-username");
const authPassword = document.getElementById("auth-password");
const authSubmitBtn = document.getElementById("auth-submit");
const authMessage = document.getElementById("auth-message");
const backBtn = document.getElementById("back-btn");

const welcomeMsg = document.getElementById("welcome-msg");
const startHighscoreInfo = document.getElementById("start-highscore-info");

const playerStatus = document.getElementById("player-status");
const playerName = document.getElementById("player-name");
const logoutBtn = document.getElementById("logout-btn");
const leaderboardBody = document.getElementById("leaderboard-body");

let isLoginMode = true; // Differentiates the shared auth form between Login and Register

// ─── INITIALISATION ───────────────────────────────────────────────────────────

// Entry point called on page load. Fetches the leaderboard, then routes
// to the correct start-screen step based on session state.
function initAuth() {
  fetchLeaderboard();
  if (currentPlayer) {
    fetchPersonalBest(currentPlayer.player_id);
    showInfoStep();
  } else {
    showChoiceStep();
  }
}

// ─── STEP TRANSITIONS ─────────────────────────────────────────────────────────

function showChoiceStep() {
  choiceStep.style.display = "flex";
  authStep.style.display = "none";
  infoStep.style.display = "none";
}

function showAuthStep() {
  choiceStep.style.display = "none";
  authStep.style.display = "flex";
  infoStep.style.display = "none";
}

// Shows the controls/info step and populates the welcome message and player-status bar.
// Resets the high score display to 0 for guest players (no server data to fetch).
function showInfoStep() {
  choiceStep.style.display = "none";
  authStep.style.display = "none";
  infoStep.style.display = "flex";

  if (currentPlayer) {
    welcomeMsg.textContent = "WELCOME, " + currentPlayer.username.toUpperCase();
    playerName.textContent = currentPlayer.username;
  } else {
    welcomeMsg.textContent = "PLAYING AS GUEST";
    playerName.textContent = "GUEST";
    if (typeof setGameHighScore === "function") setGameHighScore(0);
  }
  playerStatus.style.display = "flex";
}

// Configures the shared auth form for either Login or Register mode,
// clears previous input, and navigates to the auth step.
function openAuthForm(mode) {
  isLoginMode = mode === "login";
  authTitle.textContent = isLoginMode ? "[ LOGIN ]" : "[ REGISTER ]";
  authSubmitBtn.textContent = isLoginMode ? "LOGIN" : "REGISTER";
  authUsername.value = "";
  authPassword.value = "";
  authMessage.textContent = "";
  authMessage.className = "auth-msg";
  showAuthStep();
}

// ─── AUTHENTICATION ───────────────────────────────────────────────────────────

// Submits login or registration credentials to the appropriate PHP endpoint.
// On success, stores the player object in sessionStorage and advances the UI.
async function handleAuthSubmit(e) {
  e.preventDefault();

  const username = authUsername.value.trim();
  const password = authPassword.value.trim();

  if (!username || !password) {
    showMsg("Please fill in both fields", "error");
    return;
  }

  const endpoint = isLoginMode
    ? `${API_BASE}/login.php`
    : `${API_BASE}/register.php`;

  authSubmitBtn.disabled = true;
  authSubmitBtn.textContent = "LOADING...";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (data.success) {
      currentPlayer = { player_id: data.player_id, username: data.username };
      sessionStorage.setItem("asteroids_player", JSON.stringify(currentPlayer));
      showInfoStep();
      fetchLeaderboard();
      fetchPersonalBest(currentPlayer.player_id);
    } else {
      showMsg(data.message || "Something went wrong", "error");
    }
  } catch (err) {
    showMsg("Cannot reach server. Is XAMPP running?", "error");
    console.error("Auth error:", err);
  }

  authSubmitBtn.disabled = false;
  authSubmitBtn.textContent = isLoginMode ? "LOGIN" : "REGISTER";
}

// Sets the session to guest (no currentPlayer), clears any stored session,
// resets the high-score display, and advances to the info step.
function playAsGuest() {
  currentPlayer = null;
  sessionStorage.removeItem("asteroids_player");
  if (typeof setGameHighScore === "function") setGameHighScore(0);
  showInfoStep();
}

// Enforces logout rules that prevent players from quitting mid-level:
//
//   Allowed  — game has not started yet
//   Allowed  — game over screen is showing
//   Allowed  — at least one level has been completed AND ship is not alive mid-level
//   Blocked  — game started, no level cleared yet
//   Blocked  — ship is alive mid-level (gameIsLive = true)
//
// On pass: clears all game state, stops the loop, and returns to the choice step.
function logout() {
  var started = typeof gameStarted !== "undefined" && gameStarted;
  var isLive = typeof gameIsLive !== "undefined" && gameIsLive;
  var completed = typeof levelsCompleted !== "undefined" ? levelsCompleted : 0;
  var isGameOver = typeof showingGameOver !== "undefined" && showingGameOver;

  var btn = document.getElementById("logout-btn");

  // Temporarily replaces the button label with a warning message, then restores it.
  function flashWarning(msg) {
    var original = btn.textContent;
    btn.textContent = msg;
    btn.classList.add("logout-warning");
    setTimeout(function () {
      btn.textContent = original;
      btn.classList.remove("logout-warning");
    }, 2000);
  }

  // Block logout while the ship is alive mid-level
  if (started && isLive) {
    flashWarning("[FINISH LEVEL FIRST]");
    return;
  }

  // Always allow logout from the game-over screen; otherwise require a cleared level
  if (isGameOver) {
    // fall through — all checks passed
  } else if (started && completed < 1) {
    flashWarning("[COMPLETE A LEVEL FIRST]");
    return;
  }

  // All checks passed — clear session and game state, stop the loop
  currentPlayer = null;
  sessionStorage.removeItem("asteroids_player");

  if (typeof gameInterval !== "undefined" && gameInterval) {
    clearInterval(gameInterval);
    gameInterval = null;
  }
  if (typeof gameStarted !== "undefined") gameStarted = false;
  if (typeof gameIsLive !== "undefined") gameIsLive = false;
  if (typeof levelsCompleted !== "undefined") levelsCompleted = 0;
  if (typeof waitingForNextLevel !== "undefined") waitingForNextLevel = false;
  if (typeof showingGameOver !== "undefined") showingGameOver = false;

  if (typeof setGameHighScore === "function") setGameHighScore(0);

  playerStatus.style.display = "none";
  var ss = document.getElementById("start-screen");
  if (ss) ss.style.display = "flex";
  showChoiceStep();
}

// ─── PERSONAL BEST ────────────────────────────────────────────────────────────

// Fetches the authenticated player's all-time highest score from the server
// and updates the in-game high-score display via setGameHighScore.
async function fetchPersonalBest(playerId) {
  if (typeof setGameHighScore === "function") setGameHighScore(0);

  try {
    const res = await fetch(`${API_BASE}/my_best.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_id: playerId }),
    });
    const data = await res.json();
    const best = data && data.best ? data.best : 0;
    if (typeof setGameHighScore === "function") setGameHighScore(best);
  } catch (err) {
    console.error("Personal best error:", err);
    if (typeof setGameHighScore === "function") setGameHighScore(0);
  }
}

// ─── SCORE PERSISTENCE ────────────────────────────────────────────────────────

// Posts the current score and level to the server. No-op for guest players.
// On success, refreshes both the leaderboard and the player's personal best.
async function saveScore(score, level) {
  if (!currentPlayer) return;
  try {
    const res = await fetch(`${API_BASE}/save_score.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        player_id: currentPlayer.player_id,
        score,
        level,
      }),
    });
    const data = await res.json();
    if (data.success) {
      fetchLeaderboard();
      fetchPersonalBest(currentPlayer.player_id);
    }
  } catch (err) {
    console.error("Save score error:", err);
  }
}

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────

// Fetches the top-20 scores from the server and hands the array to renderLeaderboard.
async function fetchLeaderboard() {
  try {
    const res = await fetch(`${API_BASE}/leaderboard.php`);
    const data = await res.json();
    renderLeaderboard(data);
  } catch (err) {
    console.error("Leaderboard error:", err);
    leaderboardBody.innerHTML =
      '<tr><td colspan="4" class="lb-empty">Failed to load</td></tr>';
  }
}

// Builds the leaderboard table rows from the server response array.
// Highlights the current player's row with the lb-me CSS class.
function renderLeaderboard(rows) {
  if (!rows || rows.length === 0) {
    leaderboardBody.innerHTML =
      '<tr><td colspan="4" class="lb-empty">No scores yet — be first!</td></tr>';
    return;
  }

  leaderboardBody.innerHTML = rows
    .map(function (row) {
      const isMe = currentPlayer && row.username === currentPlayer.username;
      const cls = isMe ? "lb-me" : "";
      const score = row.score.toString().padStart(6, "0");
      return `<tr class="${cls}">
      <td>${row.rank}</td>
      <td>${escapeHTML(row.username)}</td>
      <td>${score}</td>
      <td>${row.level}</td>
    </tr>`;
    })
    .join("");
}

// Escapes HTML special characters to prevent XSS in user-supplied usernames.
function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── UI HELPERS ───────────────────────────────────────────────────────────────

// Displays a status message below the auth form with an 'error' or 'success' style.
function showMsg(msg, type) {
  authMessage.textContent = msg;
  authMessage.className = "auth-msg " + type;
}

// ─── EVENT LISTENERS ──────────────────────────────────────────────────────────

goLoginBtn.addEventListener("click", function () {
  openAuthForm("login");
});
goRegisterBtn.addEventListener("click", function () {
  openAuthForm("register");
});
guestBtn.addEventListener("click", playAsGuest);
authForm.addEventListener("submit", handleAuthSubmit);
backBtn.addEventListener("click", showChoiceStep);
logoutBtn.addEventListener("click", logout);

// ─── BOOT ─────────────────────────────────────────────────────────────────────

initAuth();
