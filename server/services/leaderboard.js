import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const DATA_FILE = join(DATA_DIR, 'leaderboard.json');

let leaderboard = [];

// Load existing data on startup
function load() {
  try {
    if (existsSync(DATA_FILE)) {
      leaderboard = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
    }
  } catch {
    leaderboard = [];
  }
}

function save() {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    writeFileSync(DATA_FILE, JSON.stringify(leaderboard, null, 2));
  } catch (err) {
    console.error('Failed to save leaderboard:', err.message);
  }
}

load();

/**
 * Get the full leaderboard, sorted by score descending.
 */
export function getLeaderboard() {
  return leaderboard
    .sort((a, b) => b.score - a.score)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

/**
 * Add a new entry to the leaderboard.
 */
export function addToLeaderboard(entry) {
  const newEntry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: entry.name,
    score: entry.score,
    roast: entry.roast,
    topFix: entry.topFix,
    url: entry.url,
    timestamp: new Date().toISOString(),
  };

  leaderboard.push(newEntry);
  save();

  const sorted = getLeaderboard();
  const rank = sorted.findIndex(e => e.id === newEntry.id) + 1;

  return { ...newEntry, rank, total: sorted.length };
}
