export const config = {
  api: {
    bodyParser: true,
  },
};

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { apiRouter } from './routes/api.js';

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use('/api', apiRouter);

// app.listen(PORT, () => {
//   console.log(`⚡ CodeJudge AI server running on http://localhost:${PORT}`);
// });

export default app;