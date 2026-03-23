import { Router, Request, Response } from 'express';
import Groq from 'groq-sdk';
import { loadSettings } from './settings.js';

export const testConnectionRouter = Router();

// Helper function to get detailed fetch error message
function getFetchErrorMessage(err: any): string {
  if (err.cause) {
    return `${err.message} (Cause: ${err.cause.message || err.cause})`;
  }
  if (err.code) {
    const errorCodes: Record<string, string> = {
      'ENOTFOUND': 'DNS lookup failed - check the URL',
      'ECONNREFUSED': 'Connection refused - server may be down or port blocked',
      'ECONNRESET': 'Connection reset by server',
      'ETIMEDOUT': 'Connection timed out',
      'CERT_HAS_EXPIRED': 'SSL certificate has expired',
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE': 'SSL certificate verification failed',
      'DEPTH_ZERO_SELF_SIGNED_CERT': 'Self-signed SSL certificate not trusted',
      'ENOTEMPTY': 'Host not found',
    };
    return errorCodes[err.code] || `${err.message} (Code: ${err.code})`;
  }
  return err.message;
}

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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const responseText = await response.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        res.status(400).json({
          success: false,
          message: `YouTrack returned invalid response. Status: ${response.status}. Response: ${responseText.substring(0, 500)}`,
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
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      throw fetchErr;
    }
  } catch (err: any) {
    console.error('YouTrack connection error details:', err);
    const detailedMessage = getFetchErrorMessage(err);
    res.status(500).json({
      success: false,
      message: `YouTrack connection error: ${detailedMessage}`,
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
