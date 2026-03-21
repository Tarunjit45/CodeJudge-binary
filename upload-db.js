import fs from 'fs';
import mongoose from 'mongoose';
import { addToLeaderboard } from './server/services/leaderboard.js';

const data = JSON.parse(fs.readFileSync('./server/data/leaderboard.json', 'utf8'));

async function upload() {
  console.log(`Uploading ${data.length} records from leaderboard.json to MongoDB...`);
  
  // Wait just to make sure mongoose connection hooks up
  await new Promise(r => setTimeout(r, 2000));
  
  for (const item of data) {
    try {
      await addToLeaderboard(item);
      console.log(`✅ Uploaded: ${item.name}`);
    } catch (e) {
      console.log(`❌ Failed to upload ${item.name}`);
    }
  }
  console.log('Upload Sequence Complete!');
  process.exit(0);
}

upload();
