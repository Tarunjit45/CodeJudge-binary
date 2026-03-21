import { Router } from 'express';
import { fetchGitHubRepo } from '../services/github.js';
import { runChaosSimulation } from '../services/chaos.js';
import { generateReview } from '../services/ai-review.js';
import { calculateScore } from '../services/scoring.js';
import { getLeaderboard, addToLeaderboard } from '../services/leaderboard.js';

export const apiRouter = Router();

/**
 * POST /api/submit
 * Accepts a GitHub URL, fetches repo info + README
 */
apiRouter.post('/submit', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    const isGitHub = /github\.com\/[^/]+\/[^/]+/.test(url);
    if (!isGitHub) {
      // For non-GitHub URLs, create a basic project info
      return res.json({
        name: new URL(url).hostname,
        fullName: url,
        description: 'Live application URL — limited metadata available',
        language: 'Unknown',
        languages: [],
        stars: 0,
        forks: 0,
        openIssues: 0,
        license: 'Unknown',
        readme: '',
        url,
      });
    }

    const projectInfo = await fetchGitHubRepo(url);
    res.json(projectInfo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/analyze
 * Runs chaos simulation and returns attack results via SSE stream
 */
apiRouter.post('/analyze', async (req, res) => {
  const { projectInfo } = req.body;
  if (!projectInfo) {
    return res.status(400).json({ error: 'projectInfo is required' });
  }

  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const attackResults = await runChaosSimulation(projectInfo);

  // Stream each attack result with a delay for the real-time effect
  let index = 0;

  function sendNext() {
    if (index < attackResults.length) {
      res.write(`data: ${JSON.stringify({ type: 'attack', result: attackResults[index] })}\n\n`);
      index++;
      setTimeout(sendNext, 600 + Math.random() * 800);
    } else {
      // Send completion event with all results
      res.write(`data: ${JSON.stringify({ type: 'complete', results: attackResults })}\n\n`);
      res.end();
    }
  }

  sendNext();
});

/**
 * POST /api/review
 * Generates AI-powered brutal review
 */
apiRouter.post('/review', async (req, res) => {
  try {
    const { projectInfo, attackResults } = req.body;
    if (!projectInfo || !attackResults) {
      return res.status(400).json({ error: 'projectInfo and attackResults are required' });
    }

    const review = await generateReview(projectInfo, attackResults);
    const score = calculateScore(projectInfo, attackResults, review);

    res.json({ review, score });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/leaderboard
 */
apiRouter.get('/leaderboard', (req, res) => {
  res.json(getLeaderboard());
});

/**
 * POST /api/leaderboard
 * Adds entry and returns the new entry with rank
 */
apiRouter.post('/leaderboard', (req, res) => {
  try {
    const entry = addToLeaderboard(req.body);
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
