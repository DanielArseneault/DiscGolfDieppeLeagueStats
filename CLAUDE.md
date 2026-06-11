# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # start dev server on :3000
npm run build        # production build (also type-checks)
npm run lint         # eslint
npm run prisma:generate  # regenerate Prisma client after schema changes
```

No test suite exists yet.

## Architecture

**Stack:** Next.js 16 (App Router) · React 19 · Prisma 7 (PostgreSQL via `@prisma/adapter-pg`) · NextAuth v5 beta · Tailwind CSS v4 · shadcn/ui (Radix primitives) · Supabase Storage (images) · xlsx (score import)

**App Router layout tree:**
```
app/
  layout.tsx            ← bare HTML shell only (fonts + body)
  (public)/
    layout.tsx          ← public header + footer
    page.tsx            ← standings homepage
    rounds/[id]/page.tsx
  admin/
    layout.tsx          ← dark admin nav bar; guards all admin routes via auth()
    page.tsx            ← dashboard
    import/page.tsx
    layouts/page.tsx
    leagues/page.tsx
    rounds/[id]/page.tsx
    rounds/[id]/image/page.tsx
    rounds/[id]/post/page.tsx
  api/                  ← all Route Handlers here
```

Public pages and admin pages use separate layout trees — the public header never appears in admin, and vice versa.

**Database (Prisma):**
- `League` → `Round[]` → `Result[]` (one result per player per round)
- `League` → `Player[]` (players belong to a league)
- `CourseLayout` → `HolePar[]`; rounds reference `blueLayoutId` / `redLayoutId`
- `Round` has optional `Post` and `NewspaperImage` children (1:1)
- Prisma client is generated to `src/generated/prisma/` (non-standard output path — always import from `@/generated/prisma/client`, not `@prisma/client`)
- `src/lib/db.ts` exports a singleton `prisma` instance using `PrismaPg` pool adapter

**Auth:** Single-password credential auth via NextAuth v5. `ADMIN_PASSWORD` env var is the password. `AUTH_SECRET` and `NEXTAUTH_URL` are required. The `auth()` function from `src/auth.ts` is called in `admin/layout.tsx` to protect all admin routes.

**Route Handler params:** Dynamic segments use `params: Promise<{ id: string }>` — must be awaited before use (Next.js 16 breaking change).

**Standings logic** (`src/lib/standings.ts`): Takes `leagueId`, counts only rounds where `weekNumber <= league.qualifyingWeeks`, sums the best `bestScoresCount` scores per player, marks players as `qualified` if `roundsPlayed >= minWeeks`.

**Import flow** (`/admin/import`): User uploads a UDisc `.xlsx` export. `src/lib/xlsx-parser.ts` parses it into `ParsedImport` (blue + red `ParsedResult[]`). The API creates/upserts players by `username` (or name if no username), then creates `Result` records. Import is tied to the most recent league (`orderBy: { year: "desc" }`).

**Image generation** (`/admin/rounds/[id]/image`): Uses `html2canvas` to screenshot a newspaper-style component (`src/components/newspaper/newspaper-preview.tsx`), then uploads to Supabase Storage via `src/lib/supabase-storage.ts`.

**Environment variables required:**
- `DATABASE_URL` — PostgreSQL connection string
- `ADMIN_PASSWORD` — admin login password
- `AUTH_SECRET` — NextAuth secret
- `NEXTAUTH_URL` — full URL (e.g. `http://localhost:3000`)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — for image storage
