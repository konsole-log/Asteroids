<?php
// save_score.php
// Inserts a score entry for an authenticated player.
// Every run (level complete or game over) is recorded as a separate row;
// the leaderboard query picks each player's personal best separately.
// Expects a JSON POST body: { "player_id": int, "score": int, "level": int }
// Returns: { success: true }  on success
//          { success: false, message }  on validation or DB error

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
$playerId = intval($body['player_id'] ?? 0);
$score = intval($body['score'] ?? 0);
$level = intval($body['level'] ?? 1);

// Validate inputs before any DB work
if ($playerId <= 0) {
    echo json_encode(['success' => false, 'message' => 'Invalid player']);
    exit;
}
if ($score < 0 || $level < 1) {
    echo json_encode(['success' => false, 'message' => 'Invalid score or level']);
    exit;
}

// Confirm the player_id exists to prevent orphaned score rows
$check = mysqli_prepare($conn, 'SELECT id FROM players WHERE id = ?');
mysqli_stmt_bind_param($check, 'i', $playerId);
mysqli_stmt_execute($check);
$res = mysqli_stmt_get_result($check);
if (!mysqli_fetch_assoc($res)) {
    echo json_encode(['success' => false, 'message' => 'Player not found']);
    exit;
}
mysqli_stmt_close($check);

// Insert the score row; played_at defaults to the current timestamp in the schema
$stmt = mysqli_prepare($conn, 'INSERT INTO scores (player_id, score, level) VALUES (?, ?, ?)');
mysqli_stmt_bind_param($stmt, 'iii', $playerId, $score, $level);

if (mysqli_stmt_execute($stmt)) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to save score']);
}

mysqli_stmt_close($stmt);
mysqli_close($conn);