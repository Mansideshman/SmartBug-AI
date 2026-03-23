import { Router, Request, Response } from 'express';
import Groq from 'groq-sdk';
import { loadSettings } from './settings.js';

export const bugReportRouter = Router();

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

// Analyze screenshot using GROQ Llama Scout (vision model)
bugReportRouter.post('/analyze-screenshot', async (req: Request, res: Response) => {
  try {
    const { imageBase64, environmentInfo, settings: passedSettings } = req.body;
    const settings = loadSettings(passedSettings);
    const { apiKey } = settings.groq;

    if (!apiKey) {
      res.status(400).json({
        success: false,
        message: 'GROQ API Key is not configured. Please go to Settings.',
      });
      return;
    }


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

Format the output as plain text suitable for a YouTrack issue description.`,
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

// Create YouTrack issue
bugReportRouter.post('/create-youtrack-issue', async (req: Request, res: Response) => {
  try {
    const { summary, description, additionalNotes, environmentInfo, imageBase64, settings: passedSettings } = req.body;
    const settings = loadSettings(passedSettings);
    const { baseUrl, token, projectId } = settings.youtrack;

    if (!baseUrl || !token || !projectId) {
      res.status(400).json({
        success: false,
        message: 'YouTrack is not fully configured. Please go to Settings.',
      });
      return;
    }

    const fullDescription = `
${description}

---

**Environment:**
${environmentInfo || 'Not provided'}

${additionalNotes ? `**Additional Notes:**\n${additionalNotes}` : ''}
    `.trim();

    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    const createIssueUrl = `${cleanBaseUrl}/api/issues`;

    const youtrackPayload = {
      project: { id: projectId },
      summary: summary || 'Bug Report from Screenshot Analysis',
      description: fullDescription,
    };

    console.log(`Creating YouTrack issue at: ${createIssueUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    let response: Response;
    try {
      response = await fetch(createIssueUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(youtrackPayload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      throw fetchErr;
    }

    const responseText = await response.text();
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      res.status(400).json({
        success: false,
        message: `YouTrack returned invalid response.`,
      });
      return;
    }

    if (!response.ok) {
      res.status(response.status).json({
        success: false,
        message: `Failed to create YouTrack issue (${response.status}): ${data.error_description || data.message || responseText}`,
      });
      return;
    }

    const issueId = data.id;
    const issueKey = data.idReadable || issueId;
    let attachmentStatus = '';

    // Step 2: Attach the screenshot
    if (issueId && imageBase64) {
      try {
        const attachUrl = `${cleanBaseUrl}/api/issues/${issueId}/attachments`;
        
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        const formData = new FormData();
        const blob = new Blob([imageBuffer], { type: 'image/png' });
        formData.append('file', blob, 'screenshot.png');

        const attachRes = await fetch(attachUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
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
      message: `YouTrack issue ${issueKey} created successfully!${attachmentStatus}`,
      ticketKey: issueKey,
      ticketUrl: `${cleanBaseUrl}/issue/${issueKey}`,
    });

  } catch (err: any) {
    console.error('YouTrack issue creation error:', err);
    const detailedMessage = getFetchErrorMessage(err);
    res.status(500).json({
      success: false,
      message: `YouTrack issue creation error: ${detailedMessage}`,
    });
  }
});
