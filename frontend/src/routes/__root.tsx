import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import faviconUrl from "../assets/favicon.png?url";
import { Sidebar } from "../components/Sidebar";
import { FloatingAdvisor } from "../components/FloatingAdvisor";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="display text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md gradient-emerald px-4 py-2 text-sm font-medium text-white"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          Something went wrong on our end.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md gradient-emerald px-4 py-2 text-sm font-medium text-white"
          >
            Try again
          </button>
          <a href="/" className="rounded-md border px-4 py-2 text-sm font-medium">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Flovix — AI Revenue Coach for Shopify" },
      { name: "description", content: "AI-powered Shopify dashboard that analyzes your store and gives actionable revenue recovery plans." },
      { property: "og:title", content: "Flovix — AI Revenue Coach for Shopify" },
      { name: "twitter:title", content: "Flovix — AI Revenue Coach for Shopify" },
      { property: "og:description", content: "AI-powered Shopify dashboard that analyzes your store and gives actionable revenue recovery plans." },
      { name: "twitter:description", content: "AI-powered Shopify dashboard that analyzes your store and gives actionable revenue recovery plans." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/46a5bd52-f7f2-4876-bc9a-db1b6f4518e4/id-preview-9bd22ceb--c4384e52-07cf-4cc1-ba51-a8b847df12ff.lovable.app-1780186195643.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/46a5bd52-f7f2-4876-bc9a-db1b6f4518e4/id-preview-9bd22ceb--c4384e52-07cf-4cc1-ba51-a8b847df12ff.lovable.app-1780186195643.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "icon", type: "image/png", href: faviconUrl },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

import { AuthProvider, useAuth } from "../contexts/AuthContext";

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const { location } = useRouter().state;
  const isPublicRoute = ['/connect', '/auth/callback', '/pricing'].includes(location.pathname);
  const showSidebar = isAuthenticated && !['/connect', '/auth/callback'].includes(location.pathname);

  if (isLoading) {
    return <div className="min-h-screen" style={{ background: "var(--background)" }} />;
  }

  if (!isAuthenticated && !isPublicRoute) {
    // Render nothing while redirect happens, or we can just redirect
    window.location.href = `/connect${window.location.search}`;
    return null;
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {showSidebar && <Sidebar />}
      <main className={showSidebar ? "lg:ml-60 min-h-screen pt-14 lg:pt-0" : "min-h-screen"}>
        <Outlet />
      </main>
      {showSidebar && <FloatingAdvisor />}
    </div>
  );
}
