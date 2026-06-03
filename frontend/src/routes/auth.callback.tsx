import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { authApi } from '../lib/api';

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setError('Authentication failed: No token provided in the callback URL.');
      return;
    }

    // Save the token immediately
    localStorage.setItem('sc_token', token);

    // Verify token by fetching merchant data
    authApi.getMe()
      .then((data: any) => {
        if (data.success && data.merchant) {
          // Force a full reload to dashboard to initialize AuthContext properly
          window.location.href = '/';
        } else {
          setError('Authentication failed: Invalid token.');
          localStorage.removeItem('sc_token');
        }
      })
      .catch((err: any) => {
        console.error('Callback auth error:', err);
        setError('Authentication failed: Could not verify token with the server.');
        localStorage.removeItem('sc_token');
      });
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="surface-card w-full max-w-md p-8 text-center animate-fade-up">
          <div className="mx-auto size-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mb-4">
            <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2">Login Failed</h1>
          <p className="text-sm text-[var(--danger)] mb-6">{error}</p>
          <button
            onClick={() => navigate({ to: '/connect' })}
            className="w-full py-2.5 px-4 bg-[var(--border)] rounded-lg font-medium hover:bg-opacity-80 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center animate-pulse">
        <div className="mx-auto size-12 border-4 border-[var(--border)] border-t-[var(--emerald-brand)] rounded-full animate-spin mb-4"></div>
        <h1 className="text-xl font-bold mb-2">Connecting to your store...</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Please wait while we finalize your authentication.
        </p>
      </div>
    </div>
  );
}
