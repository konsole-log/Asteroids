-- ============================================================
--  schema.sql
--  Run this ONCE to set up your database.
--  In your terminal: mysql -u root -p < db/schema.sql
-- ============================================================

-- Create the database if it doesn't already exist
CREATE DATABASE IF NOT EXISTS asteroids_database;

-- Tell MySQL to use this database for all following commands
USE asteroids_database;

-- ─── PLAYERS TABLE ────────────────────────────────────────────────────────────
-- Stores one row per registered player.
-- `id`       → auto-incrementing number, uniquely identifies each player
-- `username` → must be unique (no two players can share a name)
-- `password` → we store a HASH, never the plain password (security!)
-- `created_at` → automatically records when the account was made
CREATE TABLE IF NOT EXISTS players (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    username   VARCHAR(50)  NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,         -- bcrypt hash, always 60 chars
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ─── SCORES TABLE ─────────────────────────────────────────────────────────────
-- Stores one row per game session a player completes.
-- A player can have many scores (one-to-many relationship).
-- `player_id` links back to the players table via a FOREIGN KEY.
-- If a player is deleted, their scores are deleted too (ON DELETE CASCADE).
CREATE TABLE IF NOT EXISTS scores (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    player_id  INT       NOT NULL,
    score      INT       NOT NULL DEFAULT 0,
    level      INT       NOT NULL DEFAULT 1,
    played_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (player_id)
        REFERENCES players(id)
        ON DELETE CASCADE          -- delete scores if player is deleted
);