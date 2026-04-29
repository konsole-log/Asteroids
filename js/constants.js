// constants.js
// Centralised configuration for all tunable game parameters.
// Every other module reads from here — change a value here and it
// propagates to physics, scoring, audio, and rendering automatically.

// Rendering
const FPS = 30; // Target frames per second for the game loop
const SHIP_SIZE = 30; // Diameter of the ship in pixels (used for drawing and collision radius)
const TEXT_SIZE = 30; // Font size (px) for mid-canvas status messages
const TEXT_FADE_TIME = 2.5; // Seconds before a status message fully fades out

// Ship movement
const TURN_SPEED = 360; // Degrees per second the ship can rotate
const SHIP_THRUST = 5; // Acceleration applied per frame while thrusting
const FRICTION = 0.7; // Velocity damping applied per frame when not thrusting (higher = more drag)

// Invincibility / explosion timing
const SHIP_EXPLODE_DUR = 0.5; // Duration (seconds) of the ship explosion animation
const SHIP_INV_DUR = 3; // Seconds of post-respawn invincibility
const SHIP_BLINK_DUR = 0.1; // Seconds per blink cycle during invincibility

// Lasers
const LASER_MAX = 10; // Maximum simultaneous lasers on screen
const LASER_SPEED = 500; // Laser travel speed in pixels per second
const LASER_DIST = 0.6; // Maximum laser range as a fraction of canvas width
const LASER_EXPLODE_DUR = 0.1; // Duration (seconds) of the laser hit explosion

// Asteroids — quantity and sizing
const ROIDS_NUM = Math.floor(Math.random() * 3) + 1; // Base number of asteroids per level (randomised at load)
const ROIDS_SIZE = 100; // Radius (px) of a large asteroid; smaller sizes are halved from this
const ROID_SPEED = 50; // Maximum asteroid speed in pixels per second (scales with level)
const ROIDS_VERT = 10; // Average number of vertices per asteroid polygon
const ROIDS_JAG = 0.3; // Jaggedness of asteroid edges (0 = perfect circle, 1 = very rough)

// Scoring — points awarded per asteroid size on a laser hit
const ROIDS_PTS_LARGE = 20;
const ROIDS_PTS_MED = 50;
const ROIDS_PTS_SML = 100;

// Lives
const GAME_LIVES = 3; // Number of lives the player starts with

// Debug overlays (set to true to visualise collision bounds / ship centre)
const SHOW_BOUNDING = false;
const SHOW_CENTRE_DOT = false;

// Runtime audio toggles (mutable — changed by the sound/music buttons in the UI)
var SOUND_ON = true;
var MUSIC_ON = true;
