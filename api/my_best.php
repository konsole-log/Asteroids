<?php
// my_best.php
// Returns a single player's personal best (highest) score.
// Called after login and after every score save to keep the in-game
// high-score display up to date.
// Expects a JSON POST body: { "player_id": int }
// Returns: { success: true, best: int }   — best defaults to 0 if no scores exist
//          { success: false, best: 0 }    — if player_id is invalid

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Respond to CORS preflight requests immediately
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/db.php';

$body = json_decode(file_get_contents('php://input'), true);
$playerId = intval($body['player_id'] ?? 0);

if ($playerId <= 0) {
    echo json_encode(['success' => false, 'best' => 0]);
    exit;
}

// MAX(score) returns NULL if no rows exist; the null-coalescing cast below normalises that to 0
$stmt = mysqli_prepare($conn, 'SELECT MAX(score) AS best FROM scores WHERE player_id = ?');
mysqli_stmt_bind_param($stmt, 'i', $playerId);
mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);
$row = mysqli_fetch_assoc($result);

mysqli_stmt_close($stmt);
mysqli_close($conn);

echo json_encode([
    'success' => true,
    'best' => (int) ($row['best'] ?? 0)
]);