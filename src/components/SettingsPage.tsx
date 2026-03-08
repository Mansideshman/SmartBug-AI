import { useState, useEffect } from 'react';

interface YoutrackSettings {
  projectId: string;
  token: string;
  baseUrl: string;
}

interface GroqSettings {
  apiKey: string;
}

interface Settings {
  youtrack: YoutrackSettings;
  groq: GroqSettings;
}

function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    youtrack: { projectId: '', token: '', baseUrl: '' },
    groq: { apiKey: '' },
  });
  const [saveStatus, setSaveStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });
  const [youtrackTestStatus, setYoutrackTestStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string }>({
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
    // Try localStorage first (better for web/Vercel)
    const local = localStorage.getItem('bug-report-settings');
    if (local) {
      try {
        setSettings(JSON.parse(local));
        return;
      } catch (e) {
        console.error('Failed to parse local settings', e);
      }
    }

    // Fallback to server (for local dev)
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus({ type: 'idle', message: '' });

    // Save to localStorage
    localStorage.setItem('bug-report-settings', JSON.stringify(settings));

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      
      setSaveStatus({ type: 'success', message: '✅ Settings saved successfully!' });
    } catch (err: any) {
      // We still show success if it saved to localStorage but maybe failed on server (e.g. Vercel)
      setSaveStatus({ type: 'success', message: '✅ Settings saved in browser!' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus({ type: 'idle', message: '' }), 4000);
    }
  };

  const handleTestYoutrack = async () => {
    setYoutrackTestStatus({ type: 'loading', message: 'Testing YouTrack connection...' });

    try {
      const res = await fetch('/api/test-youtrack', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings) 
      });
      const data = await res.json();

      setYoutrackTestStatus({
        type: data.success ? 'success' : 'error',
        message: data.message,
      });
    } catch (err: any) {
      setYoutrackTestStatus({ type: 'error', message: `Connection failed: ${err.message}` });
    }
  };

  const handleTestGroq = async () => {
    setGroqTestStatus({ type: 'loading', message: 'Testing GROQ connection...' });

    try {
      const res = await fetch('/api/test-groq', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();

      setGroqTestStatus({
        type: data.success ? 'success' : 'error',
        message: data.message,
      });
    } catch (err: any) {
      setGroqTestStatus({ type: 'error', message: `Connection failed: ${err.message}` });
    }
  };

  const updateYoutrack = (field: keyof YoutrackSettings, value: string) => {
    setSettings((prev) => ({ ...prev, youtrack: { ...prev.youtrack, [field]: value } }));
  };

  const updateGroq = (field: keyof GroqSettings, value: string) => {
    setSettings((prev) => ({ ...prev, groq: { ...prev.groq, [field]: value } }));
  };

  return (
    <div className="page-content settings-page">
      {/* YouTrack Settings Card */}
      <div className="card">
        <h2 className="card-title">
          <span className="card-icon">🔗</span>
          YouTrack Connection Details
        </h2>
        <div className="settings-grid">
          <div className="form-group">
            <label htmlFor="youtrack-project-id" className="form-label">Project ID</label>
            <input
              id="youtrack-project-id"
              type="text"
              className="form-input"
              placeholder="e.g. 0-0 (or project name)"
              value={settings.youtrack.projectId}
              onChange={(e) => updateYoutrack('projectId', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="youtrack-token" className="form-label">Permanent Token</label>
            <input
              id="youtrack-token"
              type="password"
              className="form-input"
              placeholder="Your YouTrack Permanent Token"
              value={settings.youtrack.token}
              onChange={(e) => updateYoutrack('token', e.target.value)}
            />
          </div>

          <div className="form-group full-width">
            <label htmlFor="youtrack-url" className="form-label">YouTrack Base URL</label>
            <input
              id="youtrack-url"
              type="url"
              className="form-input"
              placeholder="https://example.youtrack.cloud"
              value={settings.youtrack.baseUrl}
              onChange={(e) => updateYoutrack('baseUrl', e.target.value)}
            />
          </div>
        </div>

        <button
          id="btn-test-youtrack"
          className="test-btn"
          onClick={handleTestYoutrack}
          disabled={youtrackTestStatus.type === 'loading'}
        >
          {youtrackTestStatus.type === 'loading' ? (
            <><span className="spinner"></span> Testing...</>
          ) : (
            <>🔌 Test YouTrack Connection</>
          )}
        </button>

        {youtrackTestStatus.message && (
          <div className={`status-message status-${youtrackTestStatus.type} compact`}>
            {youtrackTestStatus.message}
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
