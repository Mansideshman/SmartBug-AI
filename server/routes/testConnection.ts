import { Router, Request, Response } from 'express';
import Groq from 'groq-sdk';
import { loadSettings } from './settings.js';

export const testConnectionRouter = Router();

// Test YouTrack connection
testConnectionRouter.post('/test-youtrack', async (req: Request, res: Response) => {
  try {
    const settings = loadSettings(req.body);
    const { baseUrl, token } = settings.youtrack;

    if (!baseUrl || !token) {
      res.status(400).json({
        success: false,
        message: 'Please fill in YouTrack URL and Permanent Token first.',
      });
      return;
    }

    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    const url = `${cleanBaseUrl}/api/users/me?fields=name,login,email`;

    console.log(`Testing YouTrack connection to: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      res.status(400).json({
        success: false,
        message: `YouTrack returned invalid response. Status: ${response.status}.`,
      });
      return;
    }

    if (response.ok) {
      res.json({
        success: true,
        message: `Connected successfully! Logged in as: ${data.name || data.login} (${data.email || 'no email'})`,
      });
    } else {
      res.status(response.status).json({
        success: false,
        message: `YouTrack connection failed (${response.status}): ${data.error_description || data.message || responseText}`,
      });
    }
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: `YouTrack connection error: ${err.message}`,
    });
  }
});

// Test GROQ connection
testConnectionRouter.post('/test-groq', async (req: Request, res: Response) => {
  try {
    const settings = loadSettings(req.body);
    const { apiKey } = settings.groq;

    if (!apiKey) {
      res.status(400).json({
        success: false,
        message: 'Please fill in the GROQ API Key first.',
      });
      return;
    }

    const groq = new Groq({ apiKey });

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: 'Say "Connection successful" in one sentence.' }],
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 30,
    });

    const reply = completion.choices[0]?.message?.content || 'No response';
    res.json({
      success: true,
      message: `GROQ connected successfully! Model response: "${reply}"`,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: `GROQ connection error: ${err.message}`,
    });
  }
});
