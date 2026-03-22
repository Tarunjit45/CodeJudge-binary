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

    // Final Verdict
    if (results.score > 90) results.verdict = 'High Confidence (Authentic)';
    else if (results.score > 70) results.verdict = 'Likely Authentic';
    else if (results.score > 50) results.verdict = 'Suspicious Patterns';
    else results.verdict = 'High Risk (Potential Cheating)';

    results.score = Math.max(0, results.score);

    return results;
}
