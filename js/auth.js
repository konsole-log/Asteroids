// auth.js
// Manages authentication flow, session, score saving, leaderboard,
// logout rules, and the new delete-account feature.

const API_BASE = "api";
let currentPlayer = JSON.parse(sessionStorage.getItem("asteroids_player")) || null;

// ─── DOM REFERENCES ───────────────────────────────────────────────────────────

const choiceStep    = document.getElementById("choice-step");
const authStep      = document.getElementById("auth-step");
const infoStep      = document.getElementById("info-step");

const goLoginBtn    = document.getElementById("go-login-btn");
const goRegisterBtn = document.getElementById("go-register-btn");
const guestBtn      = document.getElementById("guest-btn");

const authForm      = document.getElementById("auth-form");
const authTitle     = document.getElementById("auth-title");
const authUsername  = document.getElementById("auth-username");
const authPassword  = document.getElementById("auth-password");
const authSubmitBtn = document.getElementById("auth-submit");
const authMessage   = document.getElementById("auth-message");
const backBtn       = document.getElementById("back-btn");

const welcomeMsg         = document.getElementById("welcome-msg");
const startHighscoreInfo = document.getElementById("start-highscore-info");
const playerStatus       = document.getElementById("player-status");
const playerName         = document.getElementById("player-name");
const logoutBtn          = document.getElementById("logout-btn");
const deleteBtn          = document.getElementById("delete-btn");
const leaderboardBody    = document.getElementById("leaderboard-body");

let isLoginMode = true;

// ─── INIT ─────────────────────────────────────────────────────────────────────

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
  authStep.style.display   = "none";
  infoStep.style.display   = "none";
}

function showAuthStep() {
  choiceStep.style.display = "none";
  authStep.style.display   = "flex";
  infoStep.style.display   = "none";
}

function showInfoStep() {
  choiceStep.style.display = "none";
  authStep.style.display   = "none";
  infoStep.style.display   = "flex";

  if (currentPlayer) {
    welcomeMsg.textContent     = "WELCOME, " + currentPlayer.username.toUpperCase();
    playerName.textContent     = currentPlayer.username;
    // Show delete button only for logged-in users, never for guests
    if (deleteBtn) deleteBtn.style.display = "inline";
  } else {
    welcomeMsg.textContent     = "PLAYING AS GUEST";
    playerName.textContent     = "GUEST";
    if (deleteBtn) deleteBtn.style.display = "none";
    if (typeof setGameHighScore === "function") setGameHighScore(0);
  }
  playerStatus.style.display = "flex";
}

function openAuthForm(mode) {
  isLoginMode               = mode === "login";
  authTitle.textContent     = isLoginMode ? "[ LOGIN ]"  : "[ REGISTER ]";
  authSubmitBtn.textContent = isLoginMode ? "LOGIN"      : "REGISTER";
  authUsername.value        = "";
  authPassword.value        = "";
  authMessage.textContent   = "";
  authMessage.className     = "auth-msg";
  showAuthStep();
}

// ─── AUTHENTICATION ───────────────────────────────────────────────────────────

async function handleAuthSubmit(e) {
  e.preventDefault();

  const username = authUsername.value.trim();
  const password = authPassword.value.trim();

  if (!username || !password) {
    showMsg("Please fill in both fields", "error");
    return;
  }

  const endpoint = isLoginMode ? `${API_BASE}/login.php` : `${API_BASE}/register.php`;

  authSubmitBtn.disabled    = true;
  authSubmitBtn.textContent = "LOADING...";

  try {
    const res  = await fetch(endpoint, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ username, password }),
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

  authSubmitBtn.disabled    = false;
  authSubmitBtn.textContent = isLoginMode ? "LOGIN" : "REGISTER";
}

function playAsGuest() {
  currentPlayer = null;
  sessionStorage.removeItem("asteroids_player");
  if (typeof setGameHighScore === "function") setGameHighScore(0);
  showInfoStep();
}

// ─── LOGOUT ───────────────────────────────────────────────────────────────────

function logout() {
  var started   = typeof gameStarted     !== "undefined" && gameStarted;
  var isLive    = typeof gameIsLive      !== "undefined" && gameIsLive;
  var completed = typeof levelsCompleted !== "undefined" ? levelsCompleted : 0;
  var isGO      = typeof showingGameOver !== "undefined" && showingGameOver;

  var btn = document.getElementById("logout-btn");

  function flashWarning(msg) {
    var original = btn.textContent;
    btn.textContent = msg;
    btn.classList.add("logout-warning");
    setTimeout(function () {
      btn.textContent = original;
      btn.classList.remove("logout-warning");
    }, 2000);
  }

  if (started && isLive) {
    flashWarning("[FINISH LEVEL FIRST]");
    return;
  }

  if (!isGO && started && completed < 1) {
    flashWarning("[COMPLETE A LEVEL FIRST]");
    return;
  }

  // All checks passed
  doLogout();
}

// Shared cleanup used by both logout() and deleteAccount() success
function doLogout() {
  currentPlayer = null;
  sessionStorage.removeItem("asteroids_player");

  if (typeof gameInterval !== "undefined" && gameInterval) {
    clearInterval(gameInterval);
    gameInterval = null;
  }
  if (typeof gameStarted      !== "undefined") gameStarted      = false;
  if (typeof gameIsLive       !== "undefined") gameIsLive       = false;
  if (typeof gamePaused       !== "undefined") gamePaused       = false;
  if (typeof levelsCompleted  !== "undefined") levelsCompleted  = 0;
  if (typeof waitingForNextLevel !== "undefined") waitingForNextLevel = false;
  if (typeof showingGameOver  !== "undefined") showingGameOver  = false;

  if (typeof setGameHighScore === "function") setGameHighScore(0);

  // Hide pause button when not in game
  var pauseBtn = document.getElementById("pause-btn");
  if (pauseBtn) {
    pauseBtn.style.display   = "none";
    pauseBtn.textContent     = "⏸ PAUSE";
    pauseBtn.classList.remove("toggle-off");
  }

  if (deleteBtn) deleteBtn.style.display = "none";
  playerStatus.style.display = "none";

  var ss = document.getElementById("start-screen");
  if (ss) ss.style.display = "flex";
  showChoiceStep();
}
// ─── DELETE ACCOUNT ───────────────────────────────────────────────────────────

// Shows the confirmation modal populated with the current player's username.
function showDeleteConfirm() {
  if (!currentPlayer) return;

  var modal     = document.getElementById("delete-confirm-modal");
  var nameSpan  = document.getElementById("delete-confirm-username");
  var errorEl   = document.getElementById("delete-confirm-error");

  if (nameSpan) nameSpan.textContent = currentPlayer.username.toUpperCase();
  if (errorEl)  errorEl.textContent  = "";
  if (modal)    modal.style.display  = "flex";
}

// Hides the confirmation modal.
function hideDeleteConfirm() {
  var modal = document.getElementById("delete-confirm-modal");
  if (modal) modal.style.display = "none";
}

// Called when the player clicks YES in the confirmation modal.
// Sends the delete request, refreshes the leaderboard, then logs out.
async function confirmDelete() {
  if (!currentPlayer) return;

  var yesBtn  = document.getElementById("delete-yes-btn");
  var errorEl = document.getElementById("delete-confirm-error");

  yesBtn.disabled    = true;
  yesBtn.textContent = "DELETING...";
  if (errorEl) errorEl.textContent = "";

  try {
    const res  = await fetch(`${API_BASE}/delete_account.php`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ player_id: currentPlayer.player_id }),
    });
    const data = await res.json();

    if (data.success) {
      hideDeleteConfirm();
      fetchLeaderboard();   // Refresh leaderboard — their row is now gone
      doLogout();           // Clear session and return to choice screen
    } else {
      if (errorEl) errorEl.textContent = data.message || "Delete failed";
      yesBtn.disabled    = false;
      yesBtn.textContent = "YES, DELETE";
    }
  } catch (err) {
    if (errorEl) errorEl.textContent = "Cannot reach server";
    yesBtn.disabled    = false;
    yesBtn.textContent = "YES, DELETE";
    console.error("Delete error:", err);
  }
}

// ─── PERSONAL BEST ────────────────────────────────────────────────────────────

async function fetchPersonalBest(playerId) {
  if (typeof setGameHighScore === "function") setGameHighScore(0);

  try {
    const res  = await fetch(`${API_BASE}/my_best.php`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ player_id: playerId }),
    });
    const data = await res.json();
    const best = (data && data.best) ? data.best : 0;
    if (typeof setGameHighScore === "function") setGameHighScore(best);
  } catch (err) {
    console.error("Personal best error:", err);
    if (typeof setGameHighScore === "function") setGameHighScore(0);
  }
}

// ─── SCORE ────────────────────────────────────────────────────────────────────

async function saveScore(score, level) {
  if (!currentPlayer) return;
  try {
    const res  = await fetch(`${API_BASE}/save_score.php`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ player_id: currentPlayer.player_id, score, level }),
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

async function fetchLeaderboard() {
  try {
    const res  = await fetch(`${API_BASE}/leaderboard.php`);
    const data = await res.json();
    renderLeaderboard(data);
  } catch (err) {
    console.error("Leaderboard error:", err);
    leaderboardBody.innerHTML =
      '<tr><td colspan="4" class="lb-empty">Failed to load</td></tr>';
  }
}

function renderLeaderboard(rows) {
  if (!rows || rows.length === 0) {
    leaderboardBody.innerHTML =
      '<tr><td colspan="4" class="lb-empty">No scores yet — be first!</td></tr>';
    return;
  }

  leaderboardBody.innerHTML = rows.map(function (row) {
    const isMe  = currentPlayer && row.username === currentPlayer.username;
    const cls   = isMe ? "lb-me" : "";
    const score = row.score.toString().padStart(6, "0");
    return `<tr class="${cls}">
      <td>${row.rank}</td>
      <td>${escapeHTML(row.username)}</td>
      <td>${score}</td>
      <td>${row.level}</td>
    </tr>`;
  }).join("");
}

function escapeHTML(str) {
  return str
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;");
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function showMsg(msg, type) {
  authMessage.textContent = msg;
  authMessage.className   = "auth-msg " + type;
}

// ─── EVENT LISTENERS ──────────────────────────────────────────────────────────

goLoginBtn.addEventListener("click",    function () { openAuthForm("login");    });
goRegisterBtn.addEventListener("click", function () { openAuthForm("register"); });
guestBtn.addEventListener("click",      playAsGuest);
authForm.addEventListener("submit",     handleAuthSubmit);
backBtn.addEventListener("click",       showChoiceStep);
logoutBtn.addEventListener("click",     logout);

// Delete button opens the confirmation modal
if (deleteBtn) {
  deleteBtn.addEventListener("click", showDeleteConfirm);
}

// Confirmation modal buttons
var deleteYesBtn = document.getElementById("delete-yes-btn");
var deleteNoBtn  = document.getElementById("delete-no-btn");
if (deleteYesBtn) deleteYesBtn.addEventListener("click", confirmDelete);
if (deleteNoBtn)  deleteNoBtn.addEventListener("click",  hideDeleteConfirm);

// ─── BOOT ─────────────────────────────────────────────────────────────────────

initAuth();
