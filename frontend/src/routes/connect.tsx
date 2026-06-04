import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { API_URL } from '../config/env';
import { authApi } from '../lib/api';
import logoUrl from '../assets/Logo.png';

export const Route = createFileRoute('/connect')({
  component: Connect,
});

function Connect() {
  const [shopDomain, setShopDomain] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shop = params.get('shop')?.trim().toLowerCase();
    const installError = params.get('error');

    if (installError === 'install_failed') {
      setError('Shopify installation failed. Please try connecting the store again.');
      return;
    }

    if (!shop || !shop.endsWith('.myshopify.com')) {
      return;
    }

    if (localStorage.getItem('sc_token')) {
      return;
    }

    setShopDomain(shop);
    setIsLoading(true);
    setError('');

    authApi.getMe()
      .then((data: any) => {
        if (!data?.success || !data?.merchant) {
          throw new Error('No active session');
        }

        window.location.href = `/${window.location.search}`;
      })
      .catch((err: any) => {
        console.error('Embedded Shopify login failed:', err);
        setError('');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

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
          <div className="mx-auto size-14 bg-white rounded-2xl flex items-center justify-center mb-4 border shadow-sm overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <img src={logoUrl} alt="StoreCoach Logo" className="size-10 object-contain" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Connect your Shopify store</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {isLoading
              ? 'We are finalizing your Shopify connection.'
              : 'Enter your store domain to get started with StoreCoach.'}
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
              style={{ borderColor: 'var(--border)' }}
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
