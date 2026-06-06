import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { API_URL } from '../config/env';
import { authApi } from '../lib/api';
import logoUrl from '../assets/Logo.png';
import { Sparkles } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden gradient-mesh">
      {/* Decorative Orbs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-[color-mix(in_oklab,var(--emerald-brand)_8%,transparent)] blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-[color-mix(in_oklab,var(--electric)_8%,transparent)] blur-[120px] pointer-events-none" />

      <div className="glass-card w-full max-w-md p-8 sm:p-10 rounded-3xl border border-[var(--border)] shadow-2xl relative z-10 animate-fade-up">
        <div className="text-center mb-8">
          <div className="mx-auto size-16 bg-white rounded-2xl flex items-center justify-center mb-5 border shadow-md overflow-hidden relative group" style={{ borderColor: 'var(--border)' }}>
            <div className="absolute inset-0 bg-gradient-to-tr from-[var(--emerald-brand)]/5 to-[var(--electric)]/5 opacity-0 group-hover:opacity-100 transition duration-300" />
            <img src={logoUrl} alt="Flovix Logo" className="size-11 object-contain relative z-10 transition duration-300 group-hover:scale-105" />
          </div>
          <h1 className="display text-[26px] font-extrabold tracking-tight mb-2 text-foreground">Connect your Shopify store</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {isLoading
              ? 'We are finalizing your Shopify connection.'
              : 'Enter your store domain to get started with Flovix.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="shopDomain" className="block text-sm font-semibold mb-1.5">
              Store URL
            </label>
            <input
              id="shopDomain"
              type="text"
              placeholder="yourstore.myshopify.com"
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value)}
              disabled={isLoading}
              className="w-full px-4 py-3 border rounded-xl bg-white/70 focus:outline-none focus:ring-2 focus:ring-[var(--emerald-brand)] focus:border-[var(--emerald-brand)] transition"
              style={{ borderColor: 'var(--border)' }}
            />
            {error && <p className="mt-1.5 text-sm text-[var(--danger)]">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 gradient-emerald text-white rounded-xl font-semibold hover:opacity-95 active:scale-[0.99] transition duration-200 glow-emerald shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect Store'
            )}
          </button>
        </form>

        {/* Benefits List */}
        <div className="mt-8 pt-6 border-t border-[var(--border)] space-y-3.5">
          <div className="flex items-start gap-3">
            <div className="size-5 rounded-full bg-[color-mix(in_oklab,var(--emerald-brand)_10%,white)] flex items-center justify-center text-[var(--emerald-brand)] mt-0.5 shrink-0">
              <Sparkles className="size-3" />
            </div>
            <div>
              <div className="text-[12.5px] font-semibold text-foreground">AI Conversion Audits</div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">Real-time scans of product & checkout pages to find leaks.</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="size-5 rounded-full bg-[color-mix(in_oklab,var(--emerald-brand)_10%,white)] flex items-center justify-center text-[var(--emerald-brand)] mt-0.5 shrink-0">
              <Sparkles className="size-3" />
            </div>
            <div>
              <div className="text-[12.5px] font-semibold text-foreground">Auto-applied Code Fixes</div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">Fast, one-click CSS fixes applied directly to your theme.</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="size-5 rounded-full bg-[color-mix(in_oklab,var(--emerald-brand)_10%,white)] flex items-center justify-center text-[var(--emerald-brand)] mt-0.5 shrink-0">
              <Sparkles className="size-3" />
            </div>
            <div>
              <div className="text-[12.5px] font-semibold text-foreground">Competitor Audits</div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">Automated visual and pricing intelligence updates.</div>
            </div>
          </div>
        </div>

        <div className="text-center mt-6 text-[11px] font-medium text-[var(--text-muted)] flex items-center justify-center gap-1.5">
          <span>🔒 Secure OAuth via Shopify Partner API</span>
        </div>
      </div>
    </div>
  );
}
