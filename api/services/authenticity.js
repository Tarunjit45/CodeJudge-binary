/**
 * Authenticity & Timeline Analysis Service
 * Detects backdating, bulk uploads, and non-hackathon activity.
 */

export function analyzeAuthenticity(repoData, hackathonWindow = null) {
    const {
        createdAt,
        pushedAt,
        totalCommits,
        firstCommitDate,
        lastCommitDate,
        commits = [],
        owner,
        repo
    } = repoData;

    const results = {
        score: 100,
        verdict: 'Authentic',
        flags: [],
        timeline: [],
        stats: {
            totalCommits,
            hackathonCommitCount: 0,
            preHackathonCommitCount: 0,
            postHackathonCommitCount: 0,
            bulkCommitsDetected: false,
        }
    };

    const now = new Date();
    const repoCreated = new Date(createdAt);
    const firstCommit = firstCommitDate ? new Date(firstCommitDate) : null;
    const lastCommit = lastCommitDate ? new Date(lastCommitDate) : null;

    // 1. Repo Origin Check
    if (hackathonWindow && repoCreated < new Date(hackathonWindow.start)) {
        const diffDays = Math.floor((new Date(hackathonWindow.start) - repoCreated) / (1000 * 60 * 60 * 24));
        if (diffDays > 2) {
            results.score -= 15;
            results.flags.push({
                type: 'ORIGIN',
                severity: 'warning',
                message: `Repository created ${diffDays} days BEFORE hackathon started.`,
                details: 'Possible imported code or pre-existing project.'
            });
        }
    }

    // 2. Commit Pattern Analysis
    if (commits.length > 0) {
        let bulkSprints = 0;
        let windowCommits = 0;

        // Sort commits by date
        const sortedCommits = [...commits].sort((a, b) => new Date(a.date) - new Date(b.date));

        for (let i = 0; i < sortedCommits.length; i++) {
            const c = sortedCommits[i];
            const cDate = new Date(c.date);

            // Hackathon Window Validation
            if (hackathonWindow) {
                if (cDate < new Date(hackathonWindow.start)) {
                    results.stats.preHackathonCommitCount++;
                } else if (cDate > new Date(hackathonWindow.end)) {
                    results.stats.postHackathonCommitCount++;
                } else {
                    results.stats.hackathonCommitCount++;
                    windowCommits++;
                }
            }

            // Bulk Detection: Check for commits very close to each other
            if (i > 0) {
                const prevDate = new Date(sortedCommits[i - 1].date);
                const diffSeconds = (cDate - prevDate) / 1000;
                if (diffSeconds > 0 && diffSeconds < 60) { // Commits within 60 seconds
                    bulkSprints++;
                }
            }

            // Backdated Detection: Compare author vs committer (if available)
            if (c.authorDate && c.committerDate) {
                const author = new Date(c.authorDate);
                const committer = new Date(c.committerDate);
                const diffHours = (committer - author) / (1000 * 60 * 60);
                if (diffHours > 2) {
                    results.score -= 5;
                    results.flags.push({
                        type: 'BACKDATED',
                        severity: 'danger',
                        message: `Backdated commit detected: "${c.message.substring(0, 30)}..."`,
                        details: `Author date (${author.toLocaleDateString()}) is ${Math.round(diffHours)} hours older than committer date.`
                    });
                }
            }
        }

        if (bulkSprints > commits.length * 0.4 && commits.length > 5) {
            results.score -= 25;
            results.stats.bulkCommitsDetected = true;
            results.flags.push({
                type: 'BULK',
                severity: 'danger',
                message: 'Bulk upload / suspicious burst detected',
                details: `${bulkSprints} commits were pushed in rapid succession. Likely a "final dump" rather than gradual development.`
            });
        }

        if (hackathonWindow && windowCommits < commits.length * 0.5) {
            results.score -= 20;
            const pct = Math.round((windowCommits / commits.length) * 100);
            results.flags.push({
                type: 'WINDOW',
                severity: 'warning',
                message: `Only ${pct}% of work happened during hackathon.`,
                details: `${results.stats.preHackathonCommitCount} commits were made before the event started.`
            });
        }
    }

    // 3. AI Pattern Detection (Experimental)
    if (repoData.sourceCode) {
        const aiAnalysis = detectAIPatterns(repoData.sourceCode);
        results.aiDetection = aiAnalysis;
        
        if (aiAnalysis.confidence > 60) {
            results.score -= Math.max(0, (aiAnalysis.confidence - 40) / 2); // Penalize based on AI confidence
            results.flags.push({
                type: 'AI_PATTERN',
                severity: aiAnalysis.confidence > 80 ? 'danger' : 'warning',
                message: `${aiAnalysis.confidence}% AI-generated signature detected`,
                details: aiAnalysis.reason
            });
        }
    }

    // Final Verdict
    if (results.score > 90) results.verdict = 'High Confidence (Authentic)';
    else if (results.score > 70) results.verdict = 'Likely Authentic';
    else if (results.score > 50) results.verdict = 'Suspicious Patterns';
    else results.verdict = 'High Risk (Potential Cheating)';

    results.score = Math.max(0, results.score);

    return results;
}

/**
 * Detects common AI/LLM patterns in source code.
 */
function detectAIPatterns(code) {
    let confidence = 0;
    const flags = [];
    const lines = code.split('\n');
    const lowerCode = code.toLowerCase();

    // 1. Check for over-verbose, perfect LLM-style comments
    const verboseComments = [
        "this function implements", "here is the", "below is the code",
        "i will now", "let's start by", "you can replace this",
        "implementation of the", "now we need to", "make sure to"
    ];
    
    let commentCount = 0;
    verboseComments.forEach(search => {
        if (lowerCode.includes(search)) {
            commentCount++;
            confidence += 10;
        }
    });
    if (commentCount > 1) flags.push("Over-verbose instruction-style comments");

    // 2. Look for LLM placeholders or boilerplate
    const placeholders = [
        "// add your", "your_api_key", "your-project-id", 
        "// implementation here", "// handle the error",
        "console.log('done')", "return response", "await fetch(url)"
    ];
    placeholders.forEach(search => {
        if (lowerCode.includes(search)) {
            confidence += 5;
        }
    });

    // 3. Perfect formatting check (no trailing spaces, uniform indent)
    // AI usually outputs perfect 2 or 4 space indents
    const indents = lines.filter(l => l.trim().length > 0)
                         .map(l => l.match(/^\s*/)[0].length);
    const uniformIndents = indents.every(i => i % 2 === 0);
    if (uniformIndents && lines.length > 20) confidence += 10;

    // 4. JSDoc overkill
    const jsDocCount = (code.match(/\/\*\*[\s\S]*?\*\//g) || []).length;
    if (jsDocCount > 5 && code.length < 5000) {
        confidence += 15;
        flags.push("Over-documented codebase (JSDoc overkill)");
    }

    // 5. Architecture "Too Standard"
    if (lowerCode.includes("const express = require('express')") && lowerCode.includes("app.use(express.json())")) {
        // Standard boilerplate is common but AI loves it
        confidence += 5;
    }

    // Cap confidence
    confidence = Math.min(100, Math.round(confidence));

    let reason = "The code follows natural manual development patterns.";
    if (confidence > 80) reason = `High AI signature: ${flags.join(", ") || "Artificial consistency detected."}`;
    else if (confidence > 40) reason = `Moderate AI signature: ${flags.join(", ") || "Too many standard boilerplates."}`;

    return { confidence, flags, reason };
}
