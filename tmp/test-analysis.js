import fetch from 'node-fetch';

async function testAnalysis() {
    const url = 'https://github.com/facebook/react'; // Large public repo to test signals
    console.log(`[TEST] Submitting ${url} to local API...`);

    try {
        const res = await fetch('http://localhost:3001/api/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
        });

        if (!res.ok) {
            const err = await res.json();
            console.error('[TEST] API Error:', err);
            return;
        }

        const data = await res.json();
        console.log('[TEST] Success! Project Info received.');
        console.log('--- Project Details ---');
        console.log(`Name: ${data.name}`);
        console.log(`Total Commits: ${data.totalCommits}`);

        if (data.authenticity) {
            console.log('\n--- TIMELINE TRUTH (Authenticity) ---');
            console.log(`Score: ${data.authenticity.score}/100`);
            console.log(`Verdict: ${data.authenticity.verdict}`);
            console.log('Flags:', JSON.stringify(data.authenticity.flags, null, 2));
            console.log('Stats:', JSON.stringify(data.authenticity.stats, null, 2));
        } else {
            console.error('[TEST] FAILED: Authenticity data missing from response!');
        }

    } catch (err) {
        console.error('[TEST] Request failed (is the server running?):', err.message);
    }
}

testAnalysis();
