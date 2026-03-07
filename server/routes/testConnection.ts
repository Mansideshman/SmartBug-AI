import { Router, Request, Response } from 'express';
import Groq from 'groq-sdk';
import { loadSettings } from './settings.js';

export const testConnectionRouter = Router();

// Test JIRA connection
testConnectionRouter.post('/test-jira', async (_req: Request, res: Response) => {
  try {
    const settings = loadSettings();
    const { baseUrl, email, apiToken } = settings.jira;

    if (!baseUrl || !email || !apiToken) {
      res.status(400).json({
        success: false,
        message: 'Please fill in JIRA URL, Email, and API Token first.',
      });
      return;
    }

    // Normalize the URL — strip trailing slash, ensure no double slashes
    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    const url = `${cleanBaseUrl}/rest/api/2/myself`;
    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');

    console.log(`Testing JIRA connection to: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    const contentType = response.headers.get('content-type') || '';
    const responseText = await response.text();

    // Check if we got HTML back (usually means wrong URL or redirect to login)
    if (!contentType.includes('application/json')) {
      res.status(400).json({
        success: false,
        message: `JIRA returned non-JSON response (${response.status}). This usually means the JIRA URL is incorrect. Make sure the URL looks like: https://yourcompany.atlassian.net (no trailing path). Received content-type: ${contentType}`,
      });
      return;
    }

    // Try to parse the JSON response
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      res.status(400).json({
        success: false,
        message: `JIRA returned invalid JSON. Status: ${response.status}. Response: ${responseText.substring(0, 200)}`,
      });
      return;
    }

    if (response.ok) {
      // Also fetch available projects to help user
      let projectInfo = '';
      let issueTypeInfo = '';
      try {
        const projUrl = `${cleanBaseUrl}/rest/api/2/project`;
        const projResponse = await fetch(projUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
          },
        });
        if (projResponse.ok) {
          const projects = await projResponse.json();
          const projectKeys = projects.map((p: any) => `${p.key} (${p.name})`).join(', ');
          projectInfo = ` | Available projects: ${projectKeys}`;
        }
      } catch {}

      // Fetch issue types for the configured project
      const { projectKey } = settings.jira;
      if (projectKey) {
        try {
          const issueTypeUrl = `${cleanBaseUrl}/rest/api/2/project/${projectKey}`;
          const itResponse = await fetch(issueTypeUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Accept': 'application/json',
            },
          });
          if (itResponse.ok) {
            const projData = await itResponse.json();
            const issueTypes = projData.issueTypes?.map((it: any) => it.name).join(', ') || 'none found';
            issueTypeInfo = ` | Issue types for ${projectKey}: ${issueTypes}`;
          }
        } catch {}
      }

      res.json({
        success: true,
        message: `Connected successfully! Logged in as: ${data.displayName} (${data.emailAddress})${projectInfo}${issueTypeInfo}`,
      });
    } else {
      const errorMsg = data.errorMessages?.join(', ') || data.message || responseText.substring(0, 300);
      res.status(response.status).json({
        success: false,
        message: `JIRA connection failed (${response.status}): ${errorMsg}`,
      });
    }
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: `JIRA connection error: ${err.message}`,
    });
  }
});

// Test GROQ connection
testConnectionRouter.post('/test-groq', async (_req: Request, res: Response) => {
  try {
    const settings = loadSettings();
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
