import { Router, Request, Response } from 'express';
import Groq from 'groq-sdk';
import { loadSettings } from './settings.js';

export const bugReportRouter = Router();

// Analyze screenshot using GROQ Llama Scout (vision model)
bugReportRouter.post('/analyze-screenshot', async (req: Request, res: Response) => {
  try {
    const settings = loadSettings();
    const { apiKey } = settings.groq;

    if (!apiKey) {
      res.status(400).json({
        success: false,
        message: 'GROQ API Key is not configured. Please go to Settings.',
      });
      return;
    }

    const { imageBase64, environmentInfo } = req.body;

    if (!imageBase64) {
      res.status(400).json({
        success: false,
        message: 'No image provided.',
      });
      return;
    }

    const groq = new Groq({ apiKey });

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are a QA engineer analyzing a screenshot of a bug. Provide a detailed, structured bug report based on what you see in this screenshot.
              
User Environment Data (DO NOT GUESS, USE THIS):
${environmentInfo || 'Unknown'}

Report Structure:
1. **Summary**: A one-line summary of the bug
2. **Description**: Detailed description of what appears wrong
3. **Steps to Reproduce**: Best guess based on the UI state visible
4. **Expected Behavior**: What should have happened
5. **Actual Behavior**: What actually happened (as seen in the screenshot)
6. **Severity**: Critical / Major / Minor / Trivial
7. **Environment**: ${environmentInfo || 'See screenshot'}

Format the output as plain text suitable for a JIRA ticket description.`,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageBase64.startsWith('data:')
                  ? imageBase64
                  : `data:image/png;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 1500,
    });

    const analysisText = completion.choices[0]?.message?.content || 'No analysis generated.';

    res.json({
      success: true,
      analysis: analysisText,
    });
  } catch (err: any) {
    console.error('Screenshot analysis error:', err);
    res.status(500).json({
      success: false,
      message: `Screenshot analysis failed: ${err.message}`,
    });
  }
});

// Create JIRA ticket
bugReportRouter.post('/create-jira-ticket', async (req: Request, res: Response) => {
  try {
    const settings = loadSettings();
    const { baseUrl, email, apiToken, projectKey, issueType } = settings.jira;

    if (!baseUrl || !email || !apiToken || !projectKey) {
      res.status(400).json({
        success: false,
        message: 'JIRA is not fully configured. Please go to Settings.',
      });
      return;
    }

    const { summary, description, additionalNotes, environmentInfo, imageBase64 } = req.body;

    const fullDescription = `
${description}

---

*Environment:*
${environmentInfo || 'Not provided'}

${additionalNotes ? `*Additional Notes:*\n${additionalNotes}` : ''}
    `.trim();

    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    const createIssueUrl = `${cleanBaseUrl}/rest/api/2/issue`;
    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');

    const jiraPayload = {
      fields: {
        project: { key: projectKey },
        summary: summary || 'Bug Report from Screenshot Analysis',
        description: fullDescription,
        issuetype: { name: issueType || 'Bug' },
      },
    };

    console.log(`Creating JIRA ticket at: ${createIssueUrl}`);

    const response = await fetch(createIssueUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(jiraPayload),
    });

    const contentType = response.headers.get('content-type') || '';
    const responseText = await response.text();

    if (!contentType.includes('application/json')) {
      res.status(400).json({
        success: false,
        message: `JIRA returned non-JSON response (${response.status}).`,
      });
      return;
    }

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      res.status(400).json({
        success: false,
        message: `JIRA returned invalid JSON.`,
      });
      return;
    }

    if (!response.ok) {
      const errorMsg = data.errorMessages?.join(', ') || (data.errors ? JSON.stringify(data.errors) : responseText.substring(0, 300));
      res.status(response.status).json({
        success: false,
        message: `Failed to create JIRA ticket (${response.status}): ${errorMsg}`,
      });
      return;
    }

    const issueKey = data.key;
    let attachmentStatus = '';

    // Step 2: Attach the screenshot
    if (issueKey && imageBase64) {
      try {
        const attachUrl = `${cleanBaseUrl}/rest/api/2/issue/${issueKey}/attachments`;
        
        // Remove data URL prefix if present
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        // JIRA Attachment API requires X-Atlassian-Token: no-check
        const formData = new FormData();
        const blob = new Blob([imageBuffer], { type: 'image/png' });
        formData.append('file', blob, 'screenshot.png');

        const attachRes = await fetch(attachUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'X-Atlassian-Token': 'no-check',
          },
          body: formData,
        });

        if (attachRes.ok) {
          attachmentStatus = ' (Screenshot attached)';
        } else {
          attachmentStatus = ' (Failed to attach screenshot)';
          console.error('Attachment failed:', await attachRes.text());
        }
      } catch (attachErr) {
        console.error('Error attaching file:', attachErr);
        attachmentStatus = ' (Error attaching screenshot)';
      }
    }

    res.json({
      success: true,
      message: `JIRA ticket ${issueKey} created successfully!${attachmentStatus}`,
      ticketKey: issueKey,
      ticketUrl: `${cleanBaseUrl}/browse/${issueKey}`,
    });

  } catch (err: any) {
    console.error('JIRA ticket creation error:', err);
    res.status(500).json({
      success: false,
      message: `JIRA ticket creation error: ${err.message}`,
    });
  }
});
