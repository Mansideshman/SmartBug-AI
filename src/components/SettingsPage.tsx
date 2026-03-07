import { useState, useEffect } from 'react';

interface JiraSettings {
  projectKey: string;
  apiToken: string;
  email: string;
  baseUrl: string;
  issueType: string;
}

interface GroqSettings {
  apiKey: string;
}

interface Settings {
  jira: JiraSettings;
  groq: GroqSettings;
}

function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    jira: { projectKey: '', apiToken: '', email: '', baseUrl: '', issueType: 'Bug' },
    groq: { apiKey: '' },
  });
  const [saveStatus, setSaveStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });
  const [jiraTestStatus, setJiraTestStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });
  const [groqTestStatus, setGroqTestStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        setSettings(data);
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus({ type: 'idle', message: '' });

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();

      if (data.success) {
        setSaveStatus({ type: 'success', message: '✅ Settings saved successfully!' });
      } else {
        setSaveStatus({ type: 'error', message: data.message });
      }
    } catch (err: any) {
      setSaveStatus({ type: 'error', message: `Failed to save: ${err.message}` });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus({ type: 'idle', message: '' }), 4000);
    }
  };

  const handleTestJira = async () => {
    setJiraTestStatus({ type: 'loading', message: 'Testing JIRA connection...' });

    // Save settings first to ensure we test against the latest values
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
    } catch {}

    try {
      const res = await fetch('/api/test-jira', { method: 'POST' });
      const data = await res.json();

      setJiraTestStatus({
        type: data.success ? 'success' : 'error',
        message: data.message,
      });
    } catch (err: any) {
      setJiraTestStatus({ type: 'error', message: `Connection failed: ${err.message}` });
    }
  };

  const handleTestGroq = async () => {
    setGroqTestStatus({ type: 'loading', message: 'Testing GROQ connection...' });

    // Save settings first
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
    } catch {}

    try {
      const res = await fetch('/api/test-groq', { method: 'POST' });
      const data = await res.json();

      setGroqTestStatus({
        type: data.success ? 'success' : 'error',
        message: data.message,
      });
    } catch (err: any) {
      setGroqTestStatus({ type: 'error', message: `Connection failed: ${err.message}` });
    }
  };

  const updateJira = (field: keyof JiraSettings, value: string) => {
    setSettings((prev) => ({ ...prev, jira: { ...prev.jira, [field]: value } }));
  };

  const updateGroq = (field: keyof GroqSettings, value: string) => {
    setSettings((prev) => ({ ...prev, groq: { ...prev.groq, [field]: value } }));
  };

  return (
    <div className="page-content settings-page">
      {/* JIRA Settings Card */}
      <div className="card">
        <h2 className="card-title">
          <span className="card-icon">🔗</span>
          JIRA Connection Details
        </h2>
        <div className="settings-grid">
          <div className="form-group">
            <label htmlFor="jira-project-key" className="form-label">Project Key</label>
            <input
              id="jira-project-key"
              type="text"
              className="form-input"
              placeholder="e.g. VWO"
              value={settings.jira.projectKey}
              onChange={(e) => updateJira('projectKey', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="jira-email" className="form-label">JIRA Email</label>
            <input
              id="jira-email"
              type="email"
              className="form-input"
              placeholder="your-email@company.com"
              value={settings.jira.email}
              onChange={(e) => updateJira('email', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="jira-api-token" className="form-label">API Token</label>
            <input
              id="jira-api-token"
              type="password"
              className="form-input"
              placeholder="Your JIRA API token"
              value={settings.jira.apiToken}
              onChange={(e) => updateJira('apiToken', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="jira-url" className="form-label">JIRA URL</label>
            <input
              id="jira-url"
              type="url"
              className="form-input"
              placeholder="https://yourcompany.atlassian.net"
              value={settings.jira.baseUrl}
              onChange={(e) => updateJira('baseUrl', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="jira-issue-type" className="form-label">Issue Type</label>
            <input
              id="jira-issue-type"
              type="text"
              className="form-input"
              placeholder="Bug"
              value={settings.jira.issueType}
              onChange={(e) => updateJira('issueType', e.target.value)}
            />
          </div>
        </div>

        <button
          id="btn-test-jira"
          className="test-btn"
          onClick={handleTestJira}
          disabled={jiraTestStatus.type === 'loading'}
        >
          {jiraTestStatus.type === 'loading' ? (
            <><span className="spinner"></span> Testing...</>
          ) : (
            <>🔌 Test JIRA Connection</>
          )}
        </button>

        {jiraTestStatus.message && (
          <div className={`status-message status-${jiraTestStatus.type} compact`}>
            {jiraTestStatus.message}
          </div>
        )}
      </div>

      {/* GROQ Settings Card */}
      <div className="card">
        <h2 className="card-title">
          <span className="card-icon">🧠</span>
          GROQ API Configuration
        </h2>
        <div className="settings-grid">
          <div className="form-group full-width">
            <label htmlFor="groq-api-key" className="form-label">GROQ API Key</label>
            <input
              id="groq-api-key"
              type="password"
              className="form-input"
              placeholder="gsk_..."
              value={settings.groq.apiKey}
              onChange={(e) => updateGroq('apiKey', e.target.value)}
            />
            <span className="form-hint">
              Get your free API key from{' '}
              <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer">
                console.groq.com
              </a>
            </span>
          </div>
        </div>

        <button
          id="btn-test-groq"
          className="test-btn"
          onClick={handleTestGroq}
          disabled={groqTestStatus.type === 'loading'}
        >
          {groqTestStatus.type === 'loading' ? (
            <><span className="spinner"></span> Testing...</>
          ) : (
            <>🧪 Test GROQ Connection</>
          )}
        </button>

        {groqTestStatus.message && (
          <div className={`status-message status-${groqTestStatus.type} compact`}>
            {groqTestStatus.message}
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="save-section">
        <button
          id="btn-save-settings"
          className="primary-btn save-btn"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <><span className="spinner"></span> Saving...</>
          ) : (
            <>💾 Save Settings</>
          )}
        </button>

        {saveStatus.message && (
          <div className={`status-message status-${saveStatus.type} compact`}>
            {saveStatus.message}
          </div>
        )}
      </div>
    </div>
  );
}

export default SettingsPage;
