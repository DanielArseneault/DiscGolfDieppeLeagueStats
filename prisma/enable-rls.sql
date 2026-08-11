-- Enable Row Level Security on all public tables.
--
-- This app never queries Postgres through Supabase's PostgREST/client API —
-- all DB access goes through Prisma using the `postgres` role (DATABASE_URL),
-- which owns these tables and therefore bypasses RLS regardless of policies.
--
-- The NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (anon key) is shipped to the
-- browser. Without RLS, anyone holding that key can call the PostgREST API
-- directly and read/write every row in every table below. Enabling RLS with
-- no policies denies all access via anon/authenticated roles while leaving
-- Prisma unaffected.
--
-- Run this in the Supabase SQL editor (or `psql "$DIRECT_URL" -f prisma/enable-rls.sql`).

ALTER TABLE public."League" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CourseLayout" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HolePar" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Player" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Round" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Result" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RoundCheckIn" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RoundWinner" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CtpWinner" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AceWinner" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ChampionshipPoolWinner" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BobTag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RoundReaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PageView" ENABLE ROW LEVEL SECURITY;
