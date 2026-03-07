import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_PATH = path.join(__dirname, '..', 'settings.json');

export interface AppSettings {
  jira: {
    projectKey: string;
    apiToken: string;
    email: string;
    baseUrl: string;
    issueType: string;
  };
  groq: {
    apiKey: string;
  };
}

const defaultSettings: AppSettings = {
  jira: {
    projectKey: '',
    apiToken: '',
    email: '',
    baseUrl: '',
    issueType: 'Bug',
  },
  groq: {
    apiKey: '',
  },
};

export function loadSettings(): AppSettings {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = fs.readFileSync(SETTINGS_PATH, 'utf-8');
      return { ...defaultSettings, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
  return defaultSettings;
}

function saveSettings(settings: AppSettings): void {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
}

export const settingsRouter = Router();

settingsRouter.get('/settings', (_req: Request, res: Response) => {
  const settings = loadSettings();
  res.json(settings);
});

settingsRouter.post('/settings', (req: Request, res: Response) => {
  try {
    const settings: AppSettings = req.body;
    saveSettings(settings);
    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to save settings' });
  }
});
