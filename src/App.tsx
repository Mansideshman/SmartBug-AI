import { useState } from 'react';
import BugReportPage from './components/BugReportPage';
import SettingsPage from './components/SettingsPage';

type Tab = 'bug-report' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('bug-report');

  return (
    <div className="app-container">
      {/* Background glow effects */}
      <div className="bg-glow bg-glow-1"></div>
      <div className="bg-glow bg-glow-2"></div>
      <div className="bg-glow bg-glow-3"></div>

      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">🐛</span>
            <span className="logo-text">BugReport<span className="logo-accent">Enhancer</span></span>
          </div>
          <nav className="tab-nav">
            <button
              id="tab-bug-report"
              className={`tab-btn ${activeTab === 'bug-report' ? 'active' : ''}`}
              onClick={() => setActiveTab('bug-report')}
            >
              <span className="tab-icon">📋</span>
              Bug Report Enhancer
            </button>
            <button
              id="tab-settings"
              className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <span className="tab-icon">⚙️</span>
              Settings
            </button>
          </nav>
        </div>
      </header>

      <main className="app-main">
        <div className={`page-transition ${activeTab === 'bug-report' ? 'active' : ''}`}>
          {activeTab === 'bug-report' && <BugReportPage />}
        </div>
        <div className={`page-transition ${activeTab === 'settings' ? 'active' : ''}`}>
          {activeTab === 'settings' && <SettingsPage />}
        </div>
      </main>

      <footer className="app-footer">
        <span>© {new Date().getFullYear()} BugReportEnhancer</span>
      </footer>
    </div>
  );
}

export default App;
