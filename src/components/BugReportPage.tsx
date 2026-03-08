import { useState, useCallback, useRef } from 'react';

function getEnvironmentInfo(): string {
  const ua = navigator.userAgent;
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';

  // Detect browser
  if (ua.includes('Edg/')) browser = 'Microsoft Edge ' + (ua.match(/Edg\/(\d+)/)?.[1] || '');
  else if (ua.includes('Chrome/') && !ua.includes('Edg')) browser = 'Google Chrome ' + (ua.match(/Chrome\/(\d+)/)?.[1] || '');
  else if (ua.includes('Firefox/')) browser = 'Mozilla Firefox ' + (ua.match(/Firefox\/(\d+)/)?.[1] || '');
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari ' + (ua.match(/Version\/(\d+)/)?.[1] || '');

  // Detect OS
  if (ua.includes('Windows NT 10')) os = 'Windows 10/11';
  else if (ua.includes('Windows NT')) os = 'Windows';
  else if (ua.includes('Mac OS X')) os = 'macOS ' + (ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, '.') || '');
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  const screenRes = `${window.screen.width}x${window.screen.height}`;
  const viewportSize = `${window.innerWidth}x${window.innerHeight}`;

  return `Browser: ${browser} | OS: ${os} | Screen: ${screenRes} | Viewport: ${viewportSize}`;
}

function BugReportPage() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [analysisText, setAnalysisText] = useState('');
  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setStatus({ type: 'error', message: 'Please drop an image file (PNG, JPG, etc.)' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl);
      setStatus({ type: 'idle', message: '' });
      setAnalysisText('');
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleAnalyzeAndCreate = async () => {
    if (!imageBase64) {
      setStatus({ type: 'error', message: 'Please drop a screenshot first.' });
      return;
    }

    setStatus({ type: 'loading', message: '🔍 Analyzing screenshot with Llama Scout...' });

    // Load settings from localStorage
    const localSettings = localStorage.getItem('bug-report-settings');
    const settings = localSettings ? JSON.parse(localSettings) : null;

    try {
      // Step 1: Analyze screenshot
      const environmentInfo = getEnvironmentInfo();

      const analyzeRes = await fetch('/api/analyze-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageBase64, 
          environmentInfo,
          settings // Pass settings to API
        }),
      });

      const analyzeData = await analyzeRes.json();

      if (!analyzeRes.ok || !analyzeData.success) {
        setStatus({ type: 'error', message: analyzeData.message || 'Analysis failed' });
        return;
      }

      setAnalysisText(analyzeData.analysis);
      setStatus({ type: 'loading', message: '📝 Creating YouTrack issue...' });

      // Extract first line as summary
      const lines = analyzeData.analysis.split('\n').filter((l: string) => l.trim());
      const summary = lines[0]?.replace(/^\*\*.*?\*\*:?\s*/, '').substring(0, 255) || 'Bug Report from Screenshot';

      // Step 2: Create YouTrack issue
      const createRes = await fetch('/api/create-youtrack-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary,
          description: analyzeData.analysis,
          additionalNotes,
          environmentInfo,
          imageBase64,
          settings // Pass settings to API
        }),
      });

      const createData = await createRes.json();

      if (createData.success) {
        setStatus({
          type: 'success',
          message: `✅ YouTrack issue ${createData.ticketKey} created successfully!`,
        });
      } else {
        setStatus({ type: 'error', message: createData.message });
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: `Error: ${err.message}` });
    }
  };

  const clearScreenshot = () => {
    setImagePreview(null);
    setImageBase64(null);
    setAnalysisText('');
    setStatus({ type: 'idle', message: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="page-content">
      <div className="card">
        <h2 className="card-title">
          <span className="card-icon">📸</span>
          Drop Your Screenshot
        </h2>

        {/* Drag and Drop Zone */}
        <div
          id="drop-zone"
          className={`drop-zone ${isDragging ? 'dragging' : ''} ${imagePreview ? 'has-image' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          {imagePreview ? (
            <div className="preview-container">
              <img src={imagePreview} alt="Screenshot preview" className="preview-image" />
              <button id="btn-clear-screenshot" className="clear-btn" onClick={(e) => { e.stopPropagation(); clearScreenshot(); }}>
                ✕
              </button>
            </div>
          ) : (
            <div className="drop-placeholder">
              <div className="drop-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p className="drop-text">Drag & Drop your screenshot here</p>
              <p className="drop-subtext">or click to browse files</p>
              <span className="drop-formats">PNG, JPG, GIF, WebP supported</span>
            </div>
          )}
          <input
            ref={fileInputRef}
            id="file-input"
            type="file"
            accept="image/*"
            className="hidden-input"
            onChange={handleFileSelect}
          />
        </div>
      </div>

      {/* Additional Notes */}
      <div className="card">
        <h2 className="card-title">
          <span className="card-icon">📝</span>
          Additional Notes
        </h2>
        <textarea
          id="additional-notes"
          className="notes-textarea"
          placeholder="Add any additional context, steps to reproduce, or notes about the bug..."
          value={additionalNotes}
          onChange={(e) => setAdditionalNotes(e.target.value)}
          rows={4}
        />
      </div>

      {/* Analysis Result */}
      {analysisText && (
        <div className="card analysis-card">
          <h2 className="card-title">
            <span className="card-icon">🤖</span>
            AI Analysis Result
          </h2>
          <pre className="analysis-text">{analysisText}</pre>
        </div>
      )}

      {/* Status Message */}
      {status.message && (
        <div className={`status-message status-${status.type}`}>
          {status.type === 'loading' && <span className="spinner"></span>}
          {status.message}
        </div>
      )}

      {/* Create Ticket Button */}
      <button
        id="btn-create-ticket"
        className="primary-btn"
        onClick={handleAnalyzeAndCreate}
        disabled={status.type === 'loading' || !imageBase64}
      >
        {status.type === 'loading' ? (
          <>
            <span className="spinner"></span>
            Processing...
          </>
        ) : (
          <>
            <span className="btn-icon">🚀</span>
            Analyze & Create YouTrack Issue
          </>
        )}
      </button>
    </div>
  );
}

export default BugReportPage;
