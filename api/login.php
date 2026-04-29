<?php
// login.php
// Authenticates a player by username and password.
// Expects a JSON POST body: { "username": "...", "password": "..." }
// Returns: { success, player_id, username }  on success
//          { success: false, message }        on failure

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Respond to CORS preflight requests immediately
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Only POST allowed']);
    exit;
}

require_once __DIR__ . '/db.php';

$body = json_decode(file_get_contents('php://input'), true);
$username = trim($body['username'] ?? '');
$password = trim($body['password'] ?? '');

if (empty($username) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'Username and password required']);
    exit;
}

// Fetch the stored password hash for the given username using a prepared statement
// to prevent SQL injection
$stmt = mysqli_prepare($conn, 'SELECT id, username, password FROM players WHERE username = ?');
mysqli_stmt_bind_param($stmt, 's', $username);
mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);
$player = mysqli_fetch_assoc($result);
mysqli_stmt_close($stmt);

// Verify the supplied password against the stored bcrypt hash
if ($player && password_verify($password, $player['password'])) {
    echo json_encode([
        'success' => true,
        'player_id' => $player['id'],
        'username' => $player['username'],
    ]);
} else {
    // Deliberately vague message to avoid revealing whether the username exists
    echo json_encode(['success' => false, 'message' => 'Invalid username or password']);
}

mysqli_close($conn);