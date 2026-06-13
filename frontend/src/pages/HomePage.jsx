import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { BuildingLogo } from '../components/ui/BuildingLogo';

export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    api.getDriveStatus()
      .then((result) => {
        if (cancelled) return;
        setStatus(result);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to read Drive status:', err);
        setError('Could not reach backend to check Google Drive status.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const justConnected = searchParams.get('drive') === 'connected';
  const configured = Boolean(status?.configured);
  const connected = Boolean(status?.connected);

  useEffect(() => {
    if (!loading && justConnected && connected) {
      navigate('/city?drive=connected', { replace: true });
    }
  }, [loading, justConnected, connected, navigate]);

  const signInWithDrive = () => {
    if (!configured) return;
    window.location.href = '/api/drive/auth';
  };

  return (
    <div className="home-page">
      <main className="home-hero glass-panel">
        <div className="home-brand home-brand--centered">
          <BuildingLogo size={18} className="home-brand__mark" />
          <span>DISTRICT</span>
        </div>
        <p className="home-hero__eyebrow">Google Drive Spatial Workspace</p>
        <h1>Turn your Drive into a city you can navigate.</h1>
        <p className="home-hero__copy">
          Sign in once, map top-level folders into districts, and explore your docs in an interactive 3D environment.
        </p>

        <div className="home-cta-row">
          <button
            type="button"
            className="home-drive-btn"
            onClick={signInWithDrive}
            disabled={!configured || loading}
          >
              <BuildingLogo size={18} />
            <span>
              {loading
                ? 'Checking Drive status...'
                : configured
                  ? 'Sign in with Google Drive'
                  : 'Google Drive OAuth Not Configured'}
            </span>
          </button>
        </div>

        {connected && !justConnected && (
          <button type="button" className="home-secondary-btn" onClick={() => navigate('/city')}>
            Enter City
          </button>
        )}

        {(justConnected || connected) && !loading && (
          <p className="home-status home-status--ok">Google Drive connected.</p>
        )}

        {error && <p className="home-status home-status--error">{error}</p>}

        {!loading && !configured && (
          <p className="home-status">
            Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in .env, then restart backend.
          </p>
        )}
      </main>
    </div>
  );
}
