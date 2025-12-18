import { useState } from 'react';
import {
  AuditLogQueryComponent,
  ActivityApiClient,
  type Event,
} from '@miloapis/activity-ui';

function App() {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [apiUrl, setApiUrl] = useState('');
  const [token, setToken] = useState('');
  const [client, setClient] = useState<ActivityApiClient | null>(null);

  const handleConnect = () => {
    const newClient = new ActivityApiClient({
      baseUrl: apiUrl,
      token: token || undefined,
    });
    setClient(newClient);
  };

  const handleEventSelect = (event: Event) => {
    setSelectedEvent(event);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">DATUM</div>
      </header>

      {!client ? (
        <div className="connection-form">
          <h2>Welcome</h2>
          <p style={{ marginBottom: '1.5rem', fontSize: '0.95rem' }}>
            Connect to Activity to start exploring audit logs
          </p>
          <div className="form-group">
            <label htmlFor="api-url">
              API Server URL
              <span style={{ fontWeight: 'normal', color: '#9ca3af', marginLeft: '0.5rem' }}>
                (usually proxied through your local machine)
              </span>
            </label>
            <input
              id="api-url"
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:6443"
              className="input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="token">
              Bearer Token
              <span style={{ fontWeight: 'normal', color: '#9ca3af', marginLeft: '0.5rem' }}>
                (optional - leave blank if using client certificates)
              </span>
            </label>
            <input
              id="token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Leave blank if not required"
              className="input"
            />
          </div>
          <button onClick={handleConnect} className="connect-button">
            Connect to API
          </button>

          <div className="example-queries">
            <h3>What can you do with Activity Explorer?</h3>
            <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.9rem' }}>
              Here are some common scenarios to get you started:
            </p>
            <div className="use-case-grid">
              <div className="use-case">
                <h4>🔒 Security Auditing</h4>
                <p>Who's accessing your secrets?</p>
                <code>objectRef.resource == "secrets" && verb in ["get", "list"]</code>
              </div>
              <div className="use-case">
                <h4>📋 Compliance</h4>
                <p>Track deletions in production</p>
                <code>verb == "delete" && objectRef.namespace == "production"</code>
              </div>
              <div className="use-case">
                <h4>🔍 Troubleshooting</h4>
                <p>Find failed pod operations</p>
                <code>{'objectRef.resource == "pods" && responseStatus.code >= 400'}</code>
              </div>
              <div className="use-case">
                <h4>👤 User Activity</h4>
                <p>Monitor admin actions</p>
                <code>user.username.contains("admin") && verb in ["create", "update", "delete"]</code>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="main-content">
          <div className="disconnect-section">
            <button onClick={() => setClient(null)} className="disconnect-button">
              Disconnect
            </button>
          </div>

          <AuditLogQueryComponent
            client={client}
            onEventSelect={handleEventSelect}
            initialFilter='verb == "delete"'
            initialLimit={50}
          />

          {selectedEvent && (
            <div className="event-detail-modal">
              <div className="modal-content">
                <div className="modal-header">
                  <h3>Event Details</h3>
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="close-button"
                  >
                    ×
                  </button>
                </div>
                <div className="modal-body">
                  <pre>{JSON.stringify(selectedEvent, null, 2)}</pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <footer className="app-footer">
        <p>
          Powered by <strong>Activity</strong> (activity.miloapis.com/v1alpha1)
        </p>
        <p className="footer-links">
          <a href="https://github.com/datum-cloud/activity" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          {' | '}
          <a href="/docs" target="_blank" rel="noopener noreferrer">
            Documentation
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
