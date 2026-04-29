<?php
// leaderboard.php
// Returns the top-20 players ranked by their personal best score.
// Each player appears only once — the sub-query selects the single highest-scoring
// row per player before the outer query orders and limits the results.
// Accepts GET (or OPTIONS for CORS preflight). No request body is required.
// Returns: JSON array of { rank, username, score, level, played_at }

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Respond to CORS preflight requests immediately
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/db.php';

// Correlated sub-query: for each score row, keep only the row whose id matches
// the highest-scored row for that player, ensuring one entry per player.
$query = "
    SELECT p.username, s.score, s.level, s.played_at
    FROM scores s
    JOIN players p ON s.player_id = p.id
    WHERE s.id = (
        SELECT id FROM scores s2
        WHERE s2.player_id = s.player_id
        ORDER BY s2.score DESC
        LIMIT 1
    )
    ORDER BY s.score DESC
    LIMIT 20
";

$result = mysqli_query($conn, $query);

if (!$result) {
    echo json_encode(['success' => false, 'message' => 'Query failed']);
    exit;
}

// Build the ranked response array; rank is assigned sequentially here
$leaderboard = [];
$rank = 1;
while ($row = mysqli_fetch_assoc($result)) {
    $leaderboard[] = [
        'rank' => $rank++,
        'username' => $row['username'],
        'score' => (int) $row['score'],
        'level' => (int) $row['level'],
        'played_at' => $row['played_at'],
    ];
}

echo json_encode($leaderboard);
mysqli_free_result($result);
mysqli_close($conn);