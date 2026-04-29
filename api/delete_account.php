<?php
// delete_account.php
// Permanently deletes a player and all their scores (CASCADE handles scores).
// Expects a JSON POST body: { "player_id": int }
// Returns: { success: true }  on success
//          { success: false, message }  on failure

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Only POST allowed']);
    exit;
}

require_once __DIR__ . '/db.php';

$body     = json_decode(file_get_contents('php://input'), true);
$playerId = intval($body['player_id'] ?? 0);

if ($playerId <= 0) {
    echo json_encode(['success' => false, 'message' => 'Invalid player']);
    exit;
}

// Confirm the player exists before attempting delete
$check = mysqli_prepare($conn, 'SELECT id FROM players WHERE id = ?');
mysqli_stmt_bind_param($check, 'i', $playerId);
mysqli_stmt_execute($check);
$res = mysqli_stmt_get_result($check);
if (!mysqli_fetch_assoc($res)) {
    echo json_encode(['success' => false, 'message' => 'Player not found']);
    exit;
}
mysqli_stmt_close($check);

// Delete the player — ON DELETE CASCADE removes their scores automatically
$stmt = mysqli_prepare($conn, 'DELETE FROM players WHERE id = ?');
mysqli_stmt_bind_param($stmt, 'i', $playerId);

if (mysqli_stmt_execute($stmt)) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'message' => 'Delete failed']);
}

mysqli_stmt_close($stmt);
mysqli_close($conn);
