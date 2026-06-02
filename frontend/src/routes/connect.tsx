import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { API_URL } from '../config/env';

export const Route = createFileRoute('/connect')({
  component: Connect,
});

function Connect() {
  const [shopDomain, setShopDomain] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const domain = shopDomain.trim().toLowerCase();

    if (!domain) {
      setError('Please enter your store URL');
      return;
    }

    if (!domain.endsWith('.myshopify.com')) {
      setError('Store URL must end in .myshopify.com');
      return;
    }

    setIsLoading(true);
    window.location.href = `${API_URL}/api/shopify/install?shop=${domain}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="surface-card w-full max-w-md p-8 animate-fade-up">
        <div className="text-center mb-8">
          <div className="mx-auto size-12 bg-[var(--emerald-brand)] rounded-xl flex items-center justify-center mb-4">
            <svg className="size-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Connect your Shopify store</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Enter your store domain to get started with StoreCoach.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="shopDomain" className="block text-sm font-medium mb-1.5">
              Store URL
            </label>
            <input
              id="shopDomain"
              type="text"
              placeholder="yourstore.myshopify.com"
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
              style={{ borderColor: 'var(--border)', focusRing: 'var(--emerald-brand)' }}
            />
            {error && <p className="mt-1.5 text-sm text-[var(--danger)]">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 gradient-emerald text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {isLoading ? 'Connecting...' : 'Connect Store'}
          </button>
        </form>
      </div>
    </div>
  );
}
