import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://tarunjitbiswas123:mypeojectforbinary@cluster0.jglf7om.mongodb.net/codejudge?retryWrites=true&w=majority&appName=Cluster0';

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Backend Database'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Define Schema
const leaderboardSchema = new mongoose.Schema({
  name: String,
  score: Number,
  roast: String,
  topFix: String,
  url: String,
  level: String,
  levelEmoji: String,
  badge: String,
  fullReview: Object,
  attackResults: Array,
  timestamp: { type: Date, default: Date.now }
});

const Leaderboard = mongoose.model('Leaderboard', leaderboardSchema);

/**
 * Get the full leaderboard, sorted by score descending.
 */
export async function getLeaderboard() {
  try {
    const data = await Leaderboard.find({}, '-fullReview -attackResults').sort({ score: -1 }).lean();
    return data.map((entry, index) => ({
      ...entry,
      id: entry._id.toString(),
      rank: index + 1
    }));
  } catch (err) {
    console.error('getLeaderboard Error:', err);
    return [];
  }
}

/**
 * Get a single project by ID.
 */
export async function getProjectById(id) {
  try {
    const project = await Leaderboard.findById(id).lean();
    if (!project) return null;
    return {
      ...project,
      id: project._id.toString()
    };
  } catch (err) {
    console.error('getProjectById Error:', err);
    return null;
  }
}

/**
 * Add a new entry to the leaderboard.
 */
export async function addToLeaderboard(entry) {
  try {
    const newEntry = new Leaderboard({
      name: entry.name,
      score: entry.score,
      roast: entry.roast,
      topFix: entry.topFix,
      url: entry.url,
      level: entry.level || '',
      levelEmoji: entry.levelEmoji || '',
      badge: entry.badge || '',
      fullReview: entry.fullReview || {},
      attackResults: entry.attackResults || []
    });

    await newEntry.save();

    // Calculate rank
    const sorted = await getLeaderboard();
    const rank = sorted.findIndex(e => e.id === newEntry._id.toString()) + 1;

    return {
      id: newEntry._id.toString(),
      name: newEntry.name,
      score: newEntry.score,
      roast: newEntry.roast,
      topFix: newEntry.topFix,
      url: newEntry.url,
      level: newEntry.level,
      levelEmoji: newEntry.levelEmoji,
      badge: newEntry.badge,
      timestamp: newEntry.timestamp,
      rank,
      total: sorted.length
    };
  } catch (err) {
    console.error('addToLeaderboard Error:', err);
    throw err;
  }
}
