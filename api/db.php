<?php
// db.php
// Creates and exposes a single MySQLi connection ($conn) used by all other
// PHP endpoints. Include this file with require_once at the top of each endpoint.
// On connection failure the script responds with a JSON error and exits
// so callers always receive a valid JSON response even when the DB is down.

define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'asteroids_database');

$conn = mysqli_connect(DB_HOST, DB_USER, DB_PASS, DB_NAME);

if (!$conn) {
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed: ' . mysqli_connect_error()
    ]);
    exit;
}

// Use utf8mb4 so usernames with extended characters are stored correctly
mysqli_set_charset($conn, 'utf8mb4');
?>