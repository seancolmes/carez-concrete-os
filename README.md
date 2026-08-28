# Carez Concrete OS — v0.3

Private, mobile-first operating system designed specifically for Carez Concrete.

## Current modules

- Private owner login
- Live Lead / Bid Pipeline
- Projects
- Crew
- Dashboard
- Supabase authentication and database
- Per-company row-level security
- Responsive PWA shell

## Required environment variables

Add these in the hosting provider:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `PLAID_CLIENT_ID`
- `PLAID_SECRET`

Never commit Supabase service-role keys, database passwords, Plaid secrets, or bank access tokens.

## Build sequence

1. v0.1 — Shell and core domain ✅
2. v0.2 — Supabase database + private authentication ✅
3. v0.3 — Real lead entry + bid pipeline ✅
4. v0.4 — Projects + timecards + daily logs
5. v0.5 — Job costing + cash exposure
6. v0.6 — Estimating + proposals
7. v0.7 — Pour planner + on-call labor bench
8. v1.0 — Production release + accounting integration
