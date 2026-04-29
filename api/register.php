<?php
// register.php
// Creates a new player account after validating username format and password length.
// Expects a JSON POST body: { "username": "...", "password": "..." }
// Returns: { success, player_id, username }  on success
//          { success: false, message }        on validation error or duplicate username

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
    echo json_encode(['success' => false, 'message' => 'Username and password are required']);
    exit;
}

// Usernames: 3–20 characters, letters / digits / underscores only
if (!preg_match('/^[a-zA-Z0-9_]{3,20}$/', $username)) {
    echo json_encode(['success' => false, 'message' => 'Username must be 3-20 chars (letters, numbers, _ only)']);
    exit;
}

if (strlen($password) < 6) {
    echo json_encode(['success' => false, 'message' => 'Password must be at least 6 characters']);
    exit;
}

// Hash the password with bcrypt before storage
$hashedPassword = password_hash($password, PASSWORD_DEFAULT);

// Insert the new player; the UNIQUE constraint on username raises errno 1062 on duplicates
$stmt = mysqli_prepare($conn, 'INSERT INTO players (username, password) VALUES (?, ?)');
mysqli_stmt_bind_param($stmt, 'ss', $username, $hashedPassword);
$ok = mysqli_stmt_execute($stmt);

if ($ok) {
    $playerId = mysqli_insert_id($conn);
    echo json_encode(['success' => true, 'player_id' => $playerId, 'username' => $username]);
} else {
    if (mysqli_errno($conn) === 1062) {
        echo json_encode(['success' => false, 'message' => 'Username already taken']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Registration failed, try again']);
    }
}

mysqli_stmt_close($stmt);
mysqli_close($conn);