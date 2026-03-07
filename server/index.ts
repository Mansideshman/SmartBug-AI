import express from 'express';
import cors from 'cors';
import { settingsRouter } from './routes/settings.js';
import { testConnectionRouter } from './routes/testConnection.js';
import { bugReportRouter } from './routes/bugReport.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// API Routes
app.use('/api', settingsRouter);
app.use('/api', testConnectionRouter);
app.use('/api', bugReportRouter);

app.listen(PORT, () => {
  console.log(`🚀 Bug Report Enhancer API running on http://localhost:${PORT}`);
});
