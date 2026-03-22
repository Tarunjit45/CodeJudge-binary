import mongoose from 'mongoose';
import { getLeaderboard, addToLeaderboard } from './api/services/leaderboard.js';
import dotenv from 'dotenv';
dotenv.config();

async function testDB() {
  console.log('Testing Database Connection...');

  // Wait a second for mongoose connection (established in leaderboard.js)
  await new Promise(r => setTimeout(r, 2000));

  try {
    const initialData = await getLeaderboard();
    console.log(`Current leaderboard entries: ${initialData.length}`);

    console.log('Inserting test entry...');
    const testEntry = {
      name: 'test-project',
      score: 42,
      roast: 'This is a test roast to verify database connectivity.',
      topFix: 'A completely functional database is the best fix.',
      url: 'https://github.com/test/test'
    };

    const newDoc = await addToLeaderboard(testEntry);
    console.log('Inserted entry successfully. Assigned Rank:', newDoc.rank);

    const finalData = await getLeaderboard();
    console.log(`Final leaderboard entries: ${finalData.length}`);

    if (finalData.length > initialData.length) {
      console.log('✅ DATABASE TEST PASSED SUCCESSFULLY!');
    } else {
      console.log('❌ DATABASE TEST FAILED (Entry count did not increase).');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Database Test Error:', err);
    process.exit(1);
  }
}

testDB();
