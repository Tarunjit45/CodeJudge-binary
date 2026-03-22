import { Router } from 'express';
import { fetchGitHubRepo } from '../services/github.js';
import { runChaosSimulation } from '../services/chaos.js';
import { generateReview } from '../services/ai-review.js';
import { calculateScore } from '../services/scoring.js';
import { getLeaderboard, addToLeaderboard, getProjectById } from '../services/leaderboard.js';
import { analyzeAuthenticity } from '../services/authenticity.js';

export const apiRouter = Router();

/**
 * Auth Routes
 */
apiRouter.get('/auth/github', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'GitHub Client ID not configured' });
  const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/github/callback`;
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo,user`;
  res.redirect(url);
});

apiRouter.get('/auth/github/callback', async (req, res) => {
  const { code } = req.query;
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code
      })
    });
    const tokenData = await tokenRes.json();

    if (tokenData.access_token) {
      // Redirect back to frontend with a script to communicate the token
      res.send(`<script>window.opener.postMessage({ type: 'github-token', token: '${tokenData.access_token}' }, '*'); window.close();</script>`);
    } else {
      res.status(400).json(tokenData);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/submit
 * Accepts a GitHub URL, fetches repo info + README
 */
apiRouter.post('/submit', async (req, res) => {
  try {
    const { url, customConfig, githubToken } = req.body;
    console.log(`[API] Submit request for URL: ${url}`);

    if (!url || typeof url !== 'string' || url.trim() === '') {
      return res.status(400).json({ error: 'URL is required' });
    }

    const isGitHub = /github\.com\/[^/]+\/[^/]+/.test(url);
    if (!isGitHub) {
      console.log(`[API] Not a GitHub URL, evaluating as manual/live: ${url}`);
      let name = 'Manual Project';
      try {
        name = new URL(url).hostname;
      } catch (err) {
        // Not a URL? Treat the string itself as the project name/desc
        name = url.substring(0, 30);
      }

      return res.json({
        name: name,
        fullName: url,
        description: 'Manual Analysis Data',
        language: 'System',
        languages: [],
        stars: 0,
        forks: 0,
        openIssues: 0,
        license: 'Unknown',
        readme: url, // Treat the input string as the content to judge
        url: url,
        customConfig: customConfig || 'Judge requested manual deep-dive analysis.'
      });
    }

    const projectInfo = await fetchGitHubRepo(url, githubToken);

    // Add Authenticity Analysis (Timeline Truth)
    // Default window: last 72 hours for "hackathon" simulation
    const window = {
      start: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date().toISOString()
    };
    projectInfo.authenticity = analyzeAuthenticity(projectInfo, window);

    if (customConfig) {
      projectInfo.customConfig = customConfig;
    }

    res.json(projectInfo);
  } catch (error) {
    console.error(`[API] Submit error:`, error);
    res.status(400).json({ error: error.message || 'Analysis failed' });
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
apiRouter.get('/leaderboard', async (req, res) => {
  try {
    res.json(await getLeaderboard());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/project/:id
 * Fetches full details for a project dashboard
 */
apiRouter.get('/project/:id', async (req, res) => {
  try {
    const project = await getProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/leaderboard
 * Adds entry and returns the new entry with rank
 */
apiRouter.post('/leaderboard', async (req, res) => {
  try {
    const entry = await addToLeaderboard(req.body);
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
