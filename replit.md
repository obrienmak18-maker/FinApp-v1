# FinApp — Gestion Financière Personnelle

Application de gestion financière personnelle locale-first, premium et responsive, entièrement en français.

## Run & Operate

- `pnpm --filter @workspace/finapp run dev` — run the FinApp frontend (port assigned by workflow)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000, health check only)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + Tailwind CSS v4
- Routing: react-router-dom v7 (NOT wouter — FinApp uses BrowserRouter)
- Local DB: Dexie.js v4 (IndexedDB) + dexie-react-hooks
- Charts: Recharts
- Sync: Firebase Realtime Database
- Icons: Lucide React
- QR Code display: qrcode.react
- QR Code scan: html5-qrcode
- Exports: xlsx (Excel) + docx (Word)
- PWA: vite-plugin-pwa

## Where things live

- `artifacts/finapp/src/services/db.ts` — Dexie schema (source of truth for local data)
- `artifacts/finapp/src/services/firebase.ts` — Firebase sync config
- `artifacts/finapp/src/services/ai.ts` — AI chat logic (local + Gemini API)
- `artifacts/finapp/src/context/AppContext.tsx` — global settings, theme, PIN state
- `artifacts/finapp/src/components/` — Layout, Sidebar, BottomNav, FAB, modals
- `artifacts/finapp/src/pages/` — 9 main pages + AddTransactionModal
- `lib/api-spec/openapi.yaml` — API spec (health check only, no business logic)

## Architecture decisions

- **Local-first**: All data lives in IndexedDB via Dexie.js. No server-side persistence.
- **react-router-dom v7** (not wouter): Required for BrowserRouter with basename support for Replit proxy routing.
- **Firebase sync is optional**: The QR sync feature uses Firebase Realtime DB only when the user initiates a sync session.
- **Exchange rate caching**: Rates stored in localStorage with 1-hour TTL to avoid API hammering.
- **Historical rate lock**: Each transaction stores `tauxDuJour` — past amounts never recalculate if rates change.

## Product

- **Dashboard**: Balance overview, monthly income/expense, 6-month chart, top spending categories, active budgets
- **Transactions**: Full transaction list with filters, multi-step add form funnel, invoice scanner (beta)
- **Budgets**: Per-category monthly budgets with visual progress bars
- **Projects**: Savings goals (cagnottes) with contribution tracking
- **AI Chat**: Local financial analysis + Gemini API when online, typewriter effect, TTS in fr-FR
- **QR Sync**: Sync data between devices via Firebase, QR code or manual session code
- **Settings**: Theme, PIN, currency, primary color picker, Excel/Word exports

## User preferences

- UI entirely in French
- Dark mode by default
- Glassmorphism design with animated orbs background
- Revenues always green (emerald), expenses always red — no negative signs displayed
- FAB (+) button only visible on /transactions page

## Gotchas

- Google Fonts @import must be the VERY FIRST line of index.css (before @import "tailwindcss")
- All 'red' placeholder CSS variables in index.css must be replaced with real HSL values
- Do NOT use wouter — this app uses react-router-dom with BrowserRouter basename
- useLiveQuery from dexie-react-hooks for reactive Dexie queries
- qrcode.react: use named export `{ QRCodeSVG }`
- html5-qrcode: use `{ Html5QrcodeScanner }`
- Amounts always displayed as positive values — color coding conveys direction

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Firebase project: finapp-a0ba6 (Realtime Database for QR sync)
