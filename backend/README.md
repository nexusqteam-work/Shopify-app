# Flovix Backend — Complete Setup Guide

AI-powered Shopify SaaS backend. Node.js + Express + PostgreSQL + Prisma + Claude AI.

---

## 🗂️ Project Structure

```
Flovix/
├── src/
│   ├── index.js                  # Server entry point
│   ├── middleware/
│   │   ├── auth.js               # JWT authentication
│   │   ├── errorHandler.js       # Global error handler
│   │   ├── notFound.js           # 404 handler
│   │   └── rateLimiter.js        # Rate limiting
│   ├── routes/
│   │   ├── auth.js               # /api/auth
│   │   ├── shopify.js            # /api/shopify (OAuth)
│   │   ├── audit.js              # /api/audits
│   │   ├── issues.js             # /api/issues
│   │   ├── chat.js               # /api/chat
│   │   ├── competitors.js        # /api/competitors
│   │   ├── metrics.js            # /api/metrics
│   │   ├── reports.js            # /api/reports
│   │   ├── webhooks.js           # /api/webhooks
│   │   └── notifications.js      # /api/notifications
│   ├── services/
│   │   ├── shopify.js            # Shopify API client
│   │   ├── auditEngine.js        # Core AI audit logic
│   │   ├── chatService.js        # Claude AI chat
│   │   ├── reportService.js      # Weekly reports
│   │   └── emailService.js       # Nodemailer emails
│   ├── jobs/
│   │   └── scheduler.js          # Cron job scheduler
│   └── utils/
│       ├── db.js                 # Prisma client
│       ├── logger.js             # Winston logger
│       └── encryption.js         # AES-256 token encryption
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── migrations/
│       └── 001_init.sql          # Initial migration
├── scripts/
│   └── seed.js                   # Demo data seeder
├── Dockerfile
├── railway.toml
├── .env.example
└── package.json
```

---

## 🚀 Local Setup

### 1. Prerequisites
```bash
node --version    # v20+
psql --version    # PostgreSQL 15+
redis-cli ping    # Redis running
```

### 2. Install & Configure
```bash
git clone <your-repo>
cd Flovix
npm install
cp .env.example .env
# Edit .env with your values
```

### 3. Database Setup
```bash
# Create database
createdb Flovix

# Run migrations
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate

# Seed demo data
node scripts/seed.js
```

### 4. Start Dev Server
```bash
npm run dev
# Server at http://localhost:3001
# Health check: http://localhost:3001/health
```

---

## ☁️ Deploy to Railway

### One-Click Deploy
1. Push code to GitHub
2. Go to railway.app → New Project → Deploy from GitHub
3. Add PostgreSQL and Redis plugins
4. Set all environment variables from .env.example
5. Railway auto-detects `railway.toml` and deploys

### Required Environment Variables on Railway
```
DATABASE_URL        → auto-set by Railway PostgreSQL plugin
REDIS_URL           → auto-set by Railway Redis plugin
SHOPIFY_API_KEY     → from Shopify Partners dashboard
SHOPIFY_API_SECRET  → from Shopify Partners dashboard
ANTHROPIC_API_KEY   → from console.anthropic.com
JWT_SECRET          → generate: openssl rand -hex 32
ENCRYPTION_KEY      → generate: openssl rand -hex 16 (exactly 32 chars)
APP_URL             → your Railway app URL
FRONTEND_URL        → your Vercel/Netlify frontend URL
SMTP_HOST/USER/PASS → Gmail or any SMTP
```

---

## 📡 Complete API Reference

### Authentication
All protected routes require: `Authorization: Bearer <token>`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | /api/auth/me | Get current merchant |
| POST   | /api/auth/token | Get JWT from shopDomain |
| POST   | /api/auth/logout | Clear session |

### Shopify OAuth
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | /api/shopify/install?shop=store.myshopify.com | Start OAuth |
| GET    | /api/shopify/callback | OAuth callback (Shopify redirects here) |
| POST   | /api/shopify/billing/activate | Start paid plan |
| GET    | /api/shopify/billing/callback | Billing confirmed |

### Audits
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | /api/audits/run | Trigger new audit |
| GET    | /api/audits | List all audits |
| GET    | /api/audits/latest | Get latest completed |
| GET    | /api/audits/:id | Get specific audit |
| GET    | /api/audits/:id/status | Poll audit progress |

### Issues
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | /api/issues | List issues (filter: ?status=open&category=SPEED) |
| PATCH  | /api/issues/:id/fix | Mark as fixed |
| PATCH  | /api/issues/:id/unfix | Unmark as fixed |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | /api/chat/message | Send message, get AI reply |
| GET    | /api/chat/sessions | List chat sessions |
| GET    | /api/chat/history/:sessionId | Get session messages |
| DELETE | /api/chat/history/:sessionId | Clear session |

### Metrics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | /api/metrics/summary?days=30 | Dashboard summary |
| GET    | /api/metrics/daily?days=30 | Daily breakdown |
| POST   | /api/metrics/sync | Force Shopify sync |

### Competitors
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | /api/competitors | List competitors |
| POST   | /api/competitors | Add competitor |
| DELETE | /api/competitors/:id | Remove competitor |
| POST   | /api/competitors/:id/refresh | Re-scan |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | /api/reports | List reports |
| GET    | /api/reports/:id | Get report data |
| POST   | /api/reports/generate | Generate now |
| POST   | /api/reports/:id/email | Re-send email |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | /api/notifications | Get all + unread count |
| PATCH  | /api/notifications/read-all | Mark all read |
| PATCH  | /api/notifications/:id/read | Mark one read |
| DELETE | /api/notifications/:id | Delete |

### Webhooks (Shopify → Your Server)
| Method | Endpoint | Topic |
|--------|----------|-------|
| POST   | /api/webhooks/app-uninstalled | app/uninstalled |
| POST   | /api/webhooks/orders-create | orders/create |
| POST   | /api/webhooks/orders-updated | orders/updated |
| POST   | /api/webhooks/products-create | products/create |
| POST   | /api/webhooks/products-update | products/update |
| POST   | /api/webhooks/shop-update | shop/update |

---

## 🔄 Background Jobs Schedule

| Job | Schedule | Description |
|-----|----------|-------------|
| Daily Audit | 2:00 AM IST | Auto-scan all GROWTH+ stores |
| Weekly Report | Mon 8:00 AM IST | Generate + email reports |
| Competitor Scan | 3:00 AM IST | Refresh competitor data (PRO+) |
| Metrics Sync | Every 6 hours | Pull order data from Shopify |
| Data Cleanup | Sunday 1:00 AM IST | Remove old chat/notifications |

---

## 🔒 Security

- **Shopify tokens** encrypted with AES-256-GCM before DB storage
- **Webhook HMAC** verified on every incoming Shopify webhook
- **JWT auth** with 7-day expiry on all merchant routes
- **Rate limiting** — 100 req/15min general, 20 req/min chat, 5/hr audit
- **CORS** — restricted to frontend URL and Shopify admin domains
- **Helmet** — security headers on all responses

---

## 💰 Plan Limits Enforced

| Feature | FREE | GROWTH | PRO | AGENCY |
|---------|------|--------|-----|--------|
| Daily Auto-Audit | ❌ | ✅ | ✅ | ✅ |
| Weekly Report | ❌ | ✅ | ✅ | ✅ |
| Competitors | 1 | 3 | 10 | 25 |
| Competitor Scan | Manual | Daily | Daily | Daily |
| Chat Messages | 10/day | 100/day | Unlimited | Unlimited |

---

## 📊 Shopify App Store Submission Checklist

- [ ] App passes Shopify app review requirements
- [ ] OAuth flow tested on real store
- [ ] All webhooks responding with 200 in < 5s
- [ ] GDPR webhooks implemented (customers/redact, shop/redact)
- [ ] Billing tested in Shopify dev store
- [ ] App listing: icon, screenshots, description, keywords
- [ ] Privacy policy + terms of service pages live
- [ ] App responds correctly when embedded in Shopify Admin
