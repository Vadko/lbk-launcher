# Weekly picks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A launcher home-page section with 3 translations shared by all users: rolled randomly (non-AI) by the server once the current set expires, replaceable by hand from the admin panel, synced to the launcher.

**Architecture:** Supabase owns the data: two tables, three SQL functions and an hourly pg_cron job (migration in lbk-admin). lbk-admin gets a tab plus `/api/admin/home-picks` routes that call the save and re-roll functions through the service-role client. The launcher reads one anon RPC in the main process, resolves the ids against its local SQLite catalog through the existing `fetchGamesByIds`, and renders a section like «Популярне у гравців».

**Tech Stack:** Postgres plpgsql + pg_cron, PGlite (SQL tests), Next.js 16 route handlers + zod 4 + React Query + next-intl (lbk-admin); Electron IPC, React 19, React Query, i18next (lbk-launcher); vitest in both.

**Spec:** `docs/superpowers/specs/2026-10-23-weekly-picks-design.md` (this repo, `lbk-launcher`).

## Global Constraints

- Repos: `D:\lbk\lbk-admin` (remote `origin`) and `D:\lbk\lbk-launcher` (remote `lb`, not `origin`). Feature branch `feat/weekly-picks` already exists in both, created from `main`.
- A set is exactly 3 translations; `home_pick_games.position` is 0..2. It lives 7 days (`expires_at = starts_at + interval '7 days'`); any admin save or re-roll creates a new set with `starts_at = now()`.
- Auto candidates: `approved = true`, `hide = false`, `ai IS NULL`, `status` not `planned` and not `tech-improvement`, one translation per `COALESCE(steam_app_id::text, 'slug:' || slug)`, excluding games from the last 8 sets (dropped if fewer than 3 remain). Manual picks: any approved, not hidden game, AI included.
- Title is optional, at most 60 characters, blank means `NULL`; the launcher shows «Добірка тижня» (`homeSections.weeklyPicks`) when it is `NULL`.
- Only `admin` role may use the admin tab and routes (`requireAuth({ requireRole: 'admin' })`). No new launcher setting; the existing `showRecommendations` toggle is unrelated.
- Migration number: `192` (highest on every branch today is `191`; re-check `ls supabase/migrations | sort | tail -1` and every open branch before creating it). Migrations are applied with `psql -1`: no `BEGIN`/`COMMIT`, no `CREATE INDEX CONCURRENTLY`. Never hand-edit generated `database.types.ts` (the bot regenerates it after the migration lands on `main`).
- Comments: English, one line, only where the code cannot say it. UI copy is Ukrainian; the Ukrainian word for a translation entry is «переклад», never «айтем». No emojis in UI.
- Commits: plain messages, no AI co-author or attribution trailers (both repos' CLAUDE.md). Do not push or open PRs unless the user asks.
- lbk-admin: Biome (width 100, `useBlockStatements`), named exports, `export function Name(props: NameProps)`, no `React.FC`, new routes get a co-located `route.test.ts`, every new `uk` dictionary key must also exist in `be` and `en` and be read by code (`dictionaries.test.ts`). The machine runs Node 26: if tests fail with `localStorage` undefined, prefix with `NODE_OPTIONS="--no-experimental-webstorage"`.
- lbk-launcher: Biome (width 90), named exports, `React.FC` components, `import type`, no `any`, `@/` alias only (never `@renderer`/`@components` from main), a file past 400 non-blank, non-comment lines warns, `knip` fails the build on an unused export, console logs carry a `[Module]` tag.

## Review Focus

- A featured game is later deleted, hidden or unapproved: the launcher must show the remaining cards, and hide the section when none remain. Pinned by Task 1 (`drops a deleted game from its set`) and Task 5 (`orderHomePickGames` rows for missing ids and an empty result).
- Blank, whitespace-only or over-long title: blank must become the default title, 61 characters must be rejected. Pinned by Task 1 (`stores an empty title as null`) and Task 2 (PUT 61-character title row).
- Fewer than 3 eligible games on the server (fresh catalog, strict filters): no half-set is stored, the previous set stays, and the admin sees a clear message. Pinned by Task 1 (`creates nothing when fewer than 3 games qualify at all`) and Task 2 (POST 409).
- The hourly cron stalls or the server is idle past expiry: the launcher must still get the last set, not an empty section. Pinned by Task 1 (`serves an expired set while no newer one exists`).
- The launcher is offline or the RPC fails on a refresh: the last good data must stay on screen, and a first-ever failure must leave the section hidden without noise. Pinned by Task 4 (`fetchHomePicks` returns `null` rows) and checked by hand in Task 6 (the query hook throws on `null`, so React Query keeps the previous data; there are no hook tests in this repo).

---

## Phase A — lbk-admin, database

### Task 1: Migration 192 and its SQL tests

**Repo:** `D:\lbk\lbk-admin`, branch `feat/weekly-picks`.

**Files:**
- Create: `supabase/migrations/192_home_picks.sql`
- Create: `src/lib/homePicks/homePicksSql.test.ts`
- Modify: `package.json`, `pnpm-lock.yaml` (root devDependency `@electric-sql/pglite`)

**Interfaces:**
- Produces (SQL, consumed by Tasks 2 and 4 through generated types):
  - tables `home_pick_sets(id uuid, source text, title text null, starts_at timestamptz, expires_at timestamptz, created_by uuid null)` and `home_pick_games(set_id uuid, position smallint, game_id uuid)`;
  - `generate_auto_home_picks(p_force boolean default false) returns uuid` (new set id, or `NULL` when nothing was created) — `EXECUTE` only for `service_role`;
  - `save_home_picks(p_game_ids uuid[], p_user uuid, p_title text default null) returns uuid` — raises `invalid_home_picks: …` with SQLSTATE `HP001` on bad input, `EXECUTE` only for `service_role`;
  - `get_home_picks() returns table (title text, starts_at timestamptz, expires_at timestamptz, game_ids uuid[])` — at most one row, `EXECUTE` for `anon` and `authenticated`.

- [ ] **Step 1: Add PGlite as a root devDependency**

Only `packages/scan-core` has it today; a test under `src/` cannot resolve it.

Run (in `D:\lbk\lbk-admin`): `pnpm add -D -w @electric-sql/pglite@0.5.4`
Expected: `package.json` gains `"@electric-sql/pglite": "0.5.4"` under `devDependencies`; the lockfile changes; no new version is downloaded (it is already installed for scan-core).

- [ ] **Step 2: Write the failing SQL test**

Create `src/lib/homePicks/homePicksSql.test.ts`:

```ts
// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

const MIGRATION = join(import.meta.dirname, '../../../supabase/migrations/192_home_picks.sql');
const ADMIN_ID = '8c1d2b7e-4f3a-4b9e-9d57-2a6f0c1e5b34';
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

let db: PGlite;

interface GameSeed {
  slug: string;
  steamAppId?: number | null;
  approved?: boolean;
  hide?: boolean;
  ai?: string | null;
  status?: string;
}

async function addGame({
  slug,
  steamAppId = null,
  approved = true,
  hide = false,
  ai = null,
  status = 'completed',
}: GameSeed) {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO games (slug, steam_app_id, approved, hide, ai, status)
     VALUES ($1::text, $2::int, $3::boolean, $4::boolean, $5::text, $6::game_status)
     RETURNING id`,
    [slug, steamAppId, approved, hide, ai, status]
  );
  return rows[0].id;
}

async function addGames(count: number, prefix = 'game') {
  const ids: string[] = [];
  for (let index = 0; index < count; index++) {
    ids.push(await addGame({ slug: `${prefix}-${index}` }));
  }
  return ids;
}

async function generate(force = false) {
  const { rows } = await db.query<{ id: string | null }>(
    'SELECT generate_auto_home_picks($1::boolean) AS id',
    [force]
  );
  return rows[0].id;
}

async function save(title: string | null, gameIds: string[]) {
  const { rows } = await db.query<{ id: string }>(
    'SELECT save_home_picks($1::uuid[], $2::uuid, $3::text) AS id',
    [gameIds, ADMIN_ID, title]
  );
  return rows[0].id;
}

async function gamesOf(setId: string | null) {
  const { rows } = await db.query<{ game_id: string }>(
    'SELECT game_id FROM home_pick_games WHERE set_id = $1 ORDER BY position',
    [setId]
  );
  return rows.map((row) => row.game_id);
}

async function countSets() {
  const { rows } = await db.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM home_pick_sets'
  );
  return rows[0].n;
}

async function expire(setId: string | null) {
  await db.query(
    `UPDATE home_pick_sets
     SET starts_at = now() - interval '8 days', expires_at = now() - interval '1 day'
     WHERE id = $1`,
    [setId]
  );
}

beforeAll(async () => {
  db = new PGlite();
  // Roles, schemas and the games table as Supabase has them; cron is stubbed because PGlite has no pg_cron
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id UUID PRIMARY KEY);
    INSERT INTO auth.users (id) VALUES ('${ADMIN_ID}');
    CREATE SCHEMA cron;
    CREATE FUNCTION cron.schedule(job_name TEXT, schedule TEXT, command TEXT)
      RETURNS BIGINT LANGUAGE sql AS 'SELECT 1::bigint';
    CREATE FUNCTION cron.unschedule(job_name TEXT)
      RETURNS BOOLEAN LANGUAGE sql AS 'SELECT true';
    CREATE TYPE game_status AS ENUM ('completed', 'in-progress', 'planned', 'tech-improvement');
    CREATE TABLE games (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug TEXT NOT NULL,
      steam_app_id INTEGER,
      approved BOOLEAN NOT NULL DEFAULT false,
      hide BOOLEAN NOT NULL DEFAULT false,
      ai TEXT,
      status game_status NOT NULL
    );
  `);
  await db.exec(readFileSync(MIGRATION, 'utf8'));
});

beforeEach(async () => {
  // The role may be left over from a test that failed inside SET ROLE
  await db.exec('RESET ROLE;');
  await db.exec('TRUNCATE home_pick_sets, games CASCADE;');
});

describe('generate_auto_home_picks', () => {
  it('rolls an auto set of 3 games that lasts 7 days when there is none', async () => {
    await addGames(6);

    const setId = await generate();

    expect(await gamesOf(setId)).toHaveLength(3);
    const { rows } = await db.query<{ source: string; week: boolean; creator: string | null }>(
      `SELECT source, expires_at - starts_at = interval '7 days' AS week, created_by AS creator
       FROM home_pick_sets WHERE id = $1`,
      [setId]
    );
    expect(rows[0]).toEqual({ source: 'auto', week: true, creator: null });
  });

  it('does nothing while the current set has not expired', async () => {
    await addGames(6);
    await generate();

    expect(await generate()).toBeNull();
    expect(await countSets()).toBe(1);
  });

  it('rolls the next set once the current one has expired', async () => {
    await addGames(6);
    await expire(await generate());

    expect(await generate()).not.toBeNull();
    expect(await countSets()).toBe(2);
  });

  it('force rolls a new set even while the current one is valid', async () => {
    await addGames(6);
    await generate();

    expect(await generate(true)).not.toBeNull();
    expect(await countSets()).toBe(2);
  });

  it('picks only approved, visible, non-AI translations that can be installed', async () => {
    const eligible = await addGames(3, 'ok');
    await addGame({ slug: 'ai', ai: 'gpt' });
    await addGame({ slug: 'hidden', hide: true });
    await addGame({ slug: 'unapproved', approved: false });
    await addGame({ slug: 'planned', status: 'planned' });
    await addGame({ slug: 'tech', status: 'tech-improvement' });

    const picked = await gamesOf(await generate());

    expect([...picked].sort()).toEqual([...eligible].sort());
  });

  it('never features two translations of one Steam game together', async () => {
    const first = await addGame({ slug: 'dup-a', steamAppId: 100 });
    const second = await addGame({ slug: 'dup-b', steamAppId: 100 });
    const others = [
      await addGame({ slug: 'solo-1', steamAppId: 200 }),
      await addGame({ slug: 'solo-2' }),
    ];

    const picked = await gamesOf(await generate());

    expect(picked).toHaveLength(3);
    expect(picked).toEqual(expect.arrayContaining(others));
    expect(picked.filter((id) => id === first || id === second)).toHaveLength(1);
  });

  it('skips games from recent sets while enough others remain', async () => {
    const ids = await addGames(6);

    const first = await gamesOf(await generate(true));
    const second = await gamesOf(await generate(true));

    expect([...first, ...second].sort()).toEqual([...ids].sort());
  });

  it('reuses recent games when there are too few fresh ones', async () => {
    await addGames(4);
    await generate(true);

    const second = await generate(true);

    expect(second).not.toBeNull();
    expect(new Set(await gamesOf(second)).size).toBe(3);
  });

  it('creates nothing when fewer than 3 games qualify at all', async () => {
    await addGames(2);

    expect(await generate()).toBeNull();
    expect(await countSets()).toBe(0);
  });
});

describe('save_home_picks', () => {
  it('stores a manual set in the given order and restarts the 7-day timer', async () => {
    const ids = await addGames(4);
    const picks = [ids[2], ids[0], ids[3]];

    const setId = await save('  Хелловін  ', picks);

    expect(await gamesOf(setId)).toEqual(picks);
    const { rows } = await db.query<{
      source: string;
      title: string | null;
      week: boolean;
      creator: string;
    }>(
      `SELECT source, title, expires_at - starts_at = interval '7 days' AS week, created_by AS creator
       FROM home_pick_sets WHERE id = $1`,
      [setId]
    );
    expect(rows[0]).toEqual({ source: 'manual', title: 'Хелловін', week: true, creator: ADMIN_ID });
  });

  it('stores an empty title as null', async () => {
    const setId = await save('   ', await addGames(3));

    const { rows } = await db.query<{ title: string | null }>(
      'SELECT title FROM home_pick_sets WHERE id = $1',
      [setId]
    );
    expect(rows[0].title).toBeNull();
  });

  it('accepts AI translations in a manual set', async () => {
    const ids = [await addGame({ slug: 'ai', ai: 'gpt' }), ...(await addGames(2))];

    await expect(save(null, ids)).resolves.toEqual(expect.any(String));
  });

  const rejections: [string, () => Promise<string[]>][] = [
    ['two ids', () => addGames(2)],
    ['four ids', () => addGames(4)],
    [
      'a duplicated id',
      async () => {
        const [first, second] = await addGames(2);
        return [first, second, first];
      },
    ],
    [
      'an unapproved game',
      async () => [...(await addGames(2)), await addGame({ slug: 'unapproved', approved: false })],
    ],
    [
      'a hidden game',
      async () => [...(await addGames(2)), await addGame({ slug: 'hidden', hide: true })],
    ],
    ['an unknown game', async () => [...(await addGames(2)), MISSING_ID]],
  ];

  it.each(rejections)('rejects %s', async (_label, build) => {
    const ids = await build();

    await expect(save(null, ids)).rejects.toThrow(/invalid_home_picks/);
    expect(await countSets()).toBe(0);
  });

  it('pushes the next auto roll a full week away', async () => {
    const ids = await addGames(6);
    const auto = await generate();
    await save(null, ids.slice(0, 3));

    // The old auto set lapses, but the manual set is the current one
    await expire(auto);
    expect(await generate()).toBeNull();

    // A week later the manual set lapses and the auto roll resumes
    await db.query(
      `UPDATE home_pick_sets SET expires_at = now() - interval '1 minute' WHERE source = 'manual'`
    );
    expect(await generate()).not.toBeNull();
  });
});

describe('get_home_picks', () => {
  it('returns nothing before the first set exists', async () => {
    const { rows } = await db.query('SELECT * FROM get_home_picks()');

    expect(rows).toEqual([]);
  });

  it('returns the latest set with ordered game ids', async () => {
    const ids = await addGames(6);
    await save('Перша', ids.slice(0, 3));
    const picks = [ids[5], ids[3], ids[4]];
    await save('Друга', picks);

    const { rows } = await db.query<{ title: string | null; game_ids: string[] }>(
      'SELECT title, game_ids FROM get_home_picks()'
    );

    expect(rows).toEqual([{ title: 'Друга', game_ids: picks }]);
  });

  it('serves an expired set while no newer one exists', async () => {
    const ids = await addGames(3);
    await expire(await save(null, ids));

    const { rows } = await db.query<{ game_ids: string[] }>(
      'SELECT game_ids FROM get_home_picks()'
    );

    expect(rows[0].game_ids).toEqual(ids);
  });

  it('drops a deleted game from its set', async () => {
    const ids = await addGames(3);
    await save(null, ids);
    await db.query('DELETE FROM games WHERE id = $1', [ids[1]]);

    const { rows } = await db.query<{ game_ids: string[] }>(
      'SELECT game_ids FROM get_home_picks()'
    );

    expect(rows[0].game_ids).toEqual([ids[0], ids[2]]);
  });
});

describe('access', () => {
  it('lets anon read the picks but not roll or save them', async () => {
    await db.exec('SET ROLE anon;');

    await expect(db.query('SELECT * FROM get_home_picks()')).resolves.toBeDefined();
    await expect(db.query('SELECT generate_auto_home_picks()')).rejects.toThrow(
      /permission denied/
    );
    await expect(
      db.query('SELECT save_home_picks(ARRAY[]::uuid[], NULL::uuid, NULL::text)')
    ).rejects.toThrow(/permission denied/);
  });

  it('keeps both tables behind row level security', async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `SELECT relname, relrowsecurity FROM pg_class
       WHERE relname IN ('home_pick_sets', 'home_pick_games') ORDER BY relname`
    );

    expect(rows).toEqual([
      { relname: 'home_pick_games', relrowsecurity: true },
      { relname: 'home_pick_sets', relrowsecurity: true },
    ]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/homePicks/homePicksSql.test.ts`
Expected: FAIL in `beforeAll` with `ENOENT … 192_home_picks.sql`.

- [ ] **Step 4: Write the migration**

Create `supabase/migrations/192_home_picks.sql`:

```sql
-- Home picks: 3 translations shown in the launcher's home page section.
-- pg_cron rolls an auto set when the current one expires; an admin save creates a manual set and restarts the 7-day timer.

CREATE TABLE IF NOT EXISTS home_pick_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('auto', 'manual')),
  title TEXT CHECK (title IS NULL OR char_length(title) BETWEEN 1 AND 60),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS home_pick_sets_starts_at_idx ON home_pick_sets (starts_at DESC);

CREATE TABLE IF NOT EXISTS home_pick_games (
  set_id UUID NOT NULL REFERENCES home_pick_sets(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL CHECK (position BETWEEN 0 AND 2),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  PRIMARY KEY (set_id, position),
  UNIQUE (set_id, game_id)
);

CREATE INDEX IF NOT EXISTS home_pick_games_game_id_idx ON home_pick_games (game_id);

-- No policies: the tables are read through get_home_picks() and written with the service role
ALTER TABLE home_pick_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_pick_games ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.generate_auto_home_picks(p_force BOOLEAN DEFAULT false)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expires TIMESTAMPTZ;
  v_ids UUID[];
  v_set_id UUID;
BEGIN
  -- Serialises with save_home_picks so a cron tick and an admin save cannot interleave
  PERFORM pg_advisory_xact_lock(hashtext('home_picks'));

  IF NOT p_force THEN
    SELECT s.expires_at INTO v_expires
    FROM home_pick_sets s
    ORDER BY s.starts_at DESC
    LIMIT 1;

    IF v_expires IS NOT NULL AND v_expires > now() THEN
      RETURN NULL;
    END IF;
  END IF;

  -- Pass 1 skips games from the last 8 sets, pass 2 drops that rule when it leaves fewer than 3
  FOR i IN 1..2 LOOP
    SELECT array_agg(p.id) INTO v_ids
    FROM (
      SELECT c.id
      FROM (
        SELECT DISTINCT ON (COALESCE(g.steam_app_id::text, 'slug:' || g.slug)) g.id
        FROM games g
        WHERE g.approved = true
          AND g.hide = false
          AND g.ai IS NULL
          AND g.status NOT IN ('planned', 'tech-improvement')
          AND (
            i = 2
            OR g.id NOT IN (
              SELECT hpg.game_id
              FROM home_pick_games hpg
              WHERE hpg.set_id IN (
                SELECT s.id FROM home_pick_sets s ORDER BY s.starts_at DESC LIMIT 8
              )
            )
          )
        ORDER BY COALESCE(g.steam_app_id::text, 'slug:' || g.slug), random()
      ) c
      ORDER BY random()
      LIMIT 3
    ) p;

    EXIT WHEN COALESCE(array_length(v_ids, 1), 0) = 3;
  END LOOP;

  IF COALESCE(array_length(v_ids, 1), 0) < 3 THEN
    RAISE WARNING 'generate_auto_home_picks: fewer than 3 eligible games';
    RETURN NULL;
  END IF;

  INSERT INTO home_pick_sets (source, starts_at, expires_at)
  VALUES ('auto', now(), now() + interval '7 days')
  RETURNING id INTO v_set_id;

  INSERT INTO home_pick_games (set_id, position, game_id)
  SELECT v_set_id, (u.ord - 1)::smallint, u.game_id
  FROM unnest(v_ids) WITH ORDINALITY AS u(game_id, ord);

  RETURN v_set_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_home_picks(
  p_game_ids UUID[],
  p_user UUID,
  p_title TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT := NULLIF(btrim(COALESCE(p_title, '')), '');
  v_set_id UUID;
BEGIN
  IF COALESCE(array_length(p_game_ids, 1), 0) <> 3
     OR (SELECT count(DISTINCT x) FROM unnest(p_game_ids) AS x) <> 3 THEN
    RAISE EXCEPTION 'invalid_home_picks: exactly 3 distinct games are required' USING ERRCODE = 'HP001';
  END IF;

  IF (
    SELECT count(*) FROM games g
    WHERE g.id = ANY (p_game_ids) AND g.approved = true AND g.hide = false
  ) <> 3 THEN
    RAISE EXCEPTION 'invalid_home_picks: games must exist, be approved and not hidden' USING ERRCODE = 'HP001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('home_picks'));

  INSERT INTO home_pick_sets (source, title, starts_at, expires_at, created_by)
  VALUES ('manual', v_title, now(), now() + interval '7 days', p_user)
  RETURNING id INTO v_set_id;

  INSERT INTO home_pick_games (set_id, position, game_id)
  SELECT v_set_id, (u.ord - 1)::smallint, u.game_id
  FROM unnest(p_game_ids) WITH ORDINALITY AS u(game_id, ord);

  RETURN v_set_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_home_picks()
RETURNS TABLE (title TEXT, starts_at TIMESTAMPTZ, expires_at TIMESTAMPTZ, game_ids UUID[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.title,
    s.starts_at,
    s.expires_at,
    ARRAY(
      SELECT hpg.game_id FROM home_pick_games hpg WHERE hpg.set_id = s.id ORDER BY hpg.position
    )
  FROM home_pick_sets s
  ORDER BY s.starts_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.generate_auto_home_picks(BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_auto_home_picks(BOOLEAN) TO service_role;

REVOKE ALL ON FUNCTION public.save_home_picks(UUID[], UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_home_picks(UUID[], UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.get_home_picks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_home_picks() TO anon, authenticated, service_role;

DO $$ BEGIN
  PERFORM cron.unschedule('generate-auto-home-picks');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'generate-auto-home-picks',
  '0 * * * *',
  'SELECT public.generate_auto_home_picks();'
);

-- The section has a set right after the deploy instead of waiting for the first cron tick
SELECT public.generate_auto_home_picks();
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run src/lib/homePicks/homePicksSql.test.ts`
Expected: PASS, 25 tests. If `rejects %s` rows fail on the message, print the thrown error: PGlite exposes the raise text in `error.message`.

- [ ] **Step 6: Run the repo gates**

Run: `pnpm biome:fix && pnpm typecheck && pnpm knip && pnpm vitest run src/i18n`
Expected: all pass (knip accepts the new devDependency because the test imports it; `lint` warnings baseline unchanged).

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml supabase/migrations/192_home_picks.sql src/lib/homePicks/homePicksSql.test.ts
git commit -m "Add home picks tables and weekly roll functions"
```

---

## Gate — ship the migration and wait for generated types (human step)

Tasks 2–6 type-check against `Database['public']['Functions']['get_home_picks']` and friends, which exist only after the bot regenerates the types. Do not start Phase B or C before this gate passes.

- [ ] **Step 1:** Ask the user to push `feat/weekly-picks` in `lbk-admin`, open the PR (CI: typecheck, lint, biome, knip, tests), and merge it. `generate-types.yml` then applies the migration on the production database and the bot commits `chore: update database types` to `lbk-admin`, `lbk-landing` and `lbk-launcher`. Do not push for them.
- [ ] **Step 2:** Verify the types landed:

```bash
git -C D:/lbk/lbk-admin fetch origin
git -C D:/lbk/lbk-admin grep -n "home_pick_sets" origin/main -- packages/db-types/src/database.types.ts
git -C D:/lbk/lbk-launcher fetch lb
git -C D:/lbk/lbk-launcher grep -n "get_home_picks" lb/main -- src/lib/database.types.ts
```
Expected: both print at least one match. If either is empty, the workflow has not finished: wait, do not hand-edit the type files.

- [ ] **Step 3:** Branch the admin work from the updated `main`, and bring the types into the launcher branch:

```bash
git -C D:/lbk/lbk-admin switch main
git -C D:/lbk/lbk-admin pull origin main
git -C D:/lbk/lbk-admin switch -c feat/weekly-picks-admin
git -C D:/lbk/lbk-launcher merge lb/main
```
Expected: the launcher merge brings only the types commit (plus whatever else landed on `main`); resolve nothing by hand unless git reports a conflict.

---

## Phase B — lbk-admin, API and tab

### Task 2: Dictionary keys and API routes

**Repo:** `D:\lbk\lbk-admin`, branch `feat/weekly-picks-admin`.

**Files:**
- Create: `src/lib/homePicks/types.ts`
- Create: `src/app/api/admin/home-picks/route.ts`, `src/app/api/admin/home-picks/route.test.ts`
- Create: `src/app/api/admin/home-picks/games/route.ts`, `src/app/api/admin/home-picks/games/route.test.ts`
- Modify: `supabase/functions/_shared/i18n/uk.ts`, `be.ts`, `en.ts`

**Interfaces:**
- Produces:
  - `HomePickGame { id: string; name: string; slug: string; team: string; ai: string | null }`, `HomePickSet { id: string; source: 'auto' | 'manual'; title: string | null; startsAt: string; expiresAt: string; games: HomePickGame[] }`, `HomePicksData { current: HomePickSet | null; history: HomePickSet[] }` from `@/lib/homePicks/types`;
  - `GET /api/admin/home-picks` → `{ success: true, current: HomePickSet | null, history: HomePickSet[] }` (history has at most 8 sets);
  - `PUT /api/admin/home-picks` body `{ title: string | null, gameIds: string[3] }` → `{ success: true, setId: string }`, 400 on bad input;
  - `POST /api/admin/home-picks` → `{ success: true, setId: string }`, 409 when fewer than 3 eligible games;
  - `GET /api/admin/home-picks/games?search=` → `{ success: true, games: HomePickGame[] }` (max 10; empty list for a term shorter than 2 characters);
  - dictionary keys `adminPanel.tabs.homePicks`, `homePicksApi.*`, `homePicksTab.*` (listed below).

- [ ] **Step 1: Add the dictionary keys to all three locales**

Read each file first (the Edit tool needs it). In `supabase/functions/_shared/i18n/uk.ts`, `be.ts` and `en.ts` make two edits each.

Edit A — the tab label, anchored on the end of `adminPanel.tabs`. uk: replace

```
      apiTokens: 'API-токени',
    },
  },
  adminTelegram: {
```
with
```
      apiTokens: 'API-токени',
      homePicks: 'Добірка тижня',
    },
  },
  adminTelegram: {
```
be: same anchor with `apiTokens: 'API-токены',` and added line `      homePicks: 'Падборка тыдня',`. en: anchor with `apiTokens: 'API tokens',` and added line `      homePicks: 'Picks of the week',`.

Edit B — two new top-level groups, inserted alphabetically right before the line `  imageLabels: {` (after `homePage`). uk:

```ts
  homePicksApi: {
    loadFailed: 'Не вдалося завантажити добірку',
    saveFailed: 'Не вдалося зберегти добірку',
    rerollFailed: 'Не вдалося створити випадкову добірку',
    searchFailed: 'Не вдалося знайти переклади',
    invalidBody: 'Некоректні дані добірки',
    invalidGames: 'Оберіть 3 різні схвалені переклади, які не приховані',
    notEnoughCandidates: 'Замало підходящих перекладів для випадкового вибору',
  },
  homePicksTab: {
    currentSet: 'Поточний набір',
    noCurrent: 'Набору ще немає. Збережіть добірку або створіть випадкову',
    sourceAuto: 'Автоматично',
    sourceManual: 'Вручну',
    expiresAt: 'Діє до {date}',
    titleLabel: 'Заголовок',
    defaultTitle: 'Добірка тижня',
    titleHelper: 'Порожнє поле означає стандартний заголовок',
    slot: 'Переклад {number}',
    replace: 'Замінити',
    searchPlaceholder: 'Назва, slug або команда',
    searchEmpty: 'Нічого не знайдено',
    aiBadge: 'ШІ',
    save: 'Зберегти',
    saveNote: 'Збереження запускає новий 7-денний відлік',
    saved: 'Добірку збережено',
    saveFailed: 'Не вдалося зберегти добірку',
    reroll: 'Випадкова трійка',
    rerollConfirmTitle: 'Створити випадкову добірку?',
    rerollConfirmMessage: 'Поточний набір буде замінено, а 7-денний відлік почнеться заново',
    rerolled: 'Створено нову випадкову добірку',
    rerollFailed: 'Не вдалося створити випадкову добірку',
    history: 'Історія',
    historyEmpty: 'Історії ще немає',
    loadError: 'Помилка: {message}',
  },
```
be:
```ts
  homePicksApi: {
    loadFailed: 'Не ўдалося загрузіць падборку',
    saveFailed: 'Не ўдалося захаваць падборку',
    rerollFailed: 'Не ўдалося стварыць выпадковую падборку',
    searchFailed: 'Не ўдалося знайсці пераклады',
    invalidBody: 'Некарэктныя даныя падборкі',
    invalidGames: 'Абярыце 3 розныя ўхваленыя пераклады, якія не схаваныя',
    notEnoughCandidates: 'Замала прыдатных перакладаў для выпадковага выбару',
  },
  homePicksTab: {
    currentSet: 'Бягучы набор',
    noCurrent: 'Набору яшчэ няма. Захавайце падборку або стварыце выпадковую',
    sourceAuto: 'Аўтаматычна',
    sourceManual: 'Уручную',
    expiresAt: 'Дзейнічае да {date}',
    titleLabel: 'Загаловак',
    defaultTitle: 'Падборка тыдня',
    titleHelper: 'Пустое поле азначае стандартны загаловак',
    slot: 'Пераклад {number}',
    replace: 'Замяніць',
    searchPlaceholder: 'Назва, slug або каманда',
    searchEmpty: 'Нічога не знойдзена',
    aiBadge: 'ШІ',
    save: 'Захаваць',
    saveNote: 'Захаванне запускае новы 7-дзённы адлік',
    saved: 'Падборку захавана',
    saveFailed: 'Не ўдалося захаваць падборку',
    reroll: 'Выпадковая тройка',
    rerollConfirmTitle: 'Стварыць выпадковую падборку?',
    rerollConfirmMessage: 'Бягучы набор будзе заменены, а 7-дзённы адлік пачнецца нанова',
    rerolled: 'Створана новая выпадковая падборка',
    rerollFailed: 'Не ўдалося стварыць выпадковую падборку',
    history: 'Гісторыя',
    historyEmpty: 'Гісторыі яшчэ няма',
    loadError: 'Памылка: {message}',
  },
```
en:
```ts
  homePicksApi: {
    loadFailed: 'Could not load the picks',
    saveFailed: 'Could not save the picks',
    rerollFailed: 'Could not create a random set',
    searchFailed: 'Could not search translations',
    invalidBody: 'Invalid picks data',
    invalidGames: 'Choose 3 different approved translations that are not hidden',
    notEnoughCandidates: 'Not enough eligible translations for a random pick',
  },
  homePicksTab: {
    currentSet: 'Current set',
    noCurrent: 'There is no set yet. Save one or create a random set',
    sourceAuto: 'Automatic',
    sourceManual: 'Manual',
    expiresAt: 'Valid until {date}',
    titleLabel: 'Title',
    defaultTitle: 'Picks of the week',
    titleHelper: 'An empty field means the default title',
    slot: 'Translation {number}',
    replace: 'Replace',
    searchPlaceholder: 'Name, slug or team',
    searchEmpty: 'Nothing found',
    aiBadge: 'AI',
    save: 'Save',
    saveNote: 'Saving starts a new 7-day timer',
    saved: 'Picks saved',
    saveFailed: 'Could not save the picks',
    reroll: 'Random three',
    rerollConfirmTitle: 'Create a random set?',
    rerollConfirmMessage: 'The current set will be replaced and the 7-day timer starts over',
    rerolled: 'A new random set was created',
    rerollFailed: 'Could not create a random set',
    history: 'History',
    historyEmpty: 'No history yet',
    loadError: 'Error: {message}',
  },
```

The `uk` keys used by Task 3 only (`homePicksTab.*`, `adminPanel.tabs.homePicks`) make `dictionaries.test.ts` fail ("has no key the code never reads") until Task 3 lands. That is expected: run the full suite only at the end of Task 3; in this task run the two route test files.

- [ ] **Step 2: Create the shared types**

Create `src/lib/homePicks/types.ts`:

```ts
export interface HomePickGame {
  id: string;
  name: string;
  slug: string;
  team: string;
  ai: string | null;
}

export interface HomePickSet {
  id: string;
  source: 'auto' | 'manual';
  title: string | null;
  startsAt: string;
  expiresAt: string;
  games: HomePickGame[];
}

export interface HomePicksData {
  current: HomePickSet | null;
  history: HomePickSet[];
}
```

- [ ] **Step 3: Write the failing tests for the main route**

Create `src/app/api/admin/home-picks/route.test.ts`:

```ts
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n/translator';
import { GET as _GET, POST as _POST, PUT as _PUT } from './route';

// Next.js route handlers return Response | void; in tests they always return Response
const GET = _GET as (req: NextRequest) => Promise<Response>;
const POST = _POST as (req: NextRequest) => Promise<Response>;
const PUT = _PUT as (req: NextRequest) => Promise<Response>;

const mockGetUser = vi.fn();
const mockUserQuery = vi.fn();
const mockSetsQuery = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/utils/supabase/admin', () => ({
  createClient: () => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    Object.assign(chain, {
      select: self,
      eq: self,
      order: self,
      single: () => mockUserQuery(),
      limit: () => mockSetsQuery(),
    });
    return { auth: { getUser: mockGetUser }, from: () => chain, rpc: mockRpc };
  },
}));

const IDS = [
  '3f0c1b5e-6f0a-4c63-9a52-0b6f4c1d2a01',
  '3f0c1b5e-6f0a-4c63-9a52-0b6f4c1d2a02',
  '3f0c1b5e-6f0a-4c63-9a52-0b6f4c1d2a03',
];

function request(method: string, body?: unknown, authorized = true) {
  return new NextRequest(new URL('/api/admin/home-picks', 'http://localhost'), {
    method,
    headers: authorized
      ? { authorization: 'Bearer valid-token', 'content-type': 'application/json' }
      : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function signIn(role: 'admin' | 'moderator' = 'admin') {
  mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'admin-1' } }, error: null });
  mockUserQuery.mockResolvedValueOnce({ data: { role, approved: true }, error: null });
}

const game = (index: number) => ({
  id: IDS[index],
  name: `Game ${index}`,
  slug: `game-${index}`,
  team: 'Team',
  ai: null,
});

// Supabase may return a to-one embed as an object or as a one-element array
function setRow(
  id: string,
  source: string,
  title: string | null,
  wrap: (value: object) => unknown = (value) => value
) {
  return {
    id,
    source,
    title,
    starts_at: '2026-10-23T10:00:00Z',
    expires_at: '2026-10-30T10:00:00Z',
    home_pick_games: [
      { position: 2, games: wrap(game(2)) },
      { position: 0, games: wrap(game(0)) },
      { position: 1, games: wrap(game(1)) },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/admin/home-picks', () => {
  it('returns 401 without a token', async () => {
    const res = await GET(request('GET', undefined, false));

    expect(res.status).toBe(401);
  });

  it('returns 403 for a moderator', async () => {
    signIn('moderator');

    const res = await GET(request('GET'));

    expect(res.status).toBe(403);
  });

  it('maps the newest set to current and the rest to history', async () => {
    signIn();
    mockSetsQuery.mockResolvedValueOnce({
      data: [setRow('set-2', 'manual', 'Хелловін'), setRow('set-1', 'auto', null, (v) => [v])],
      error: null,
    });

    const res = await GET(request('GET'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.current).toEqual({
      id: 'set-2',
      source: 'manual',
      title: 'Хелловін',
      startsAt: '2026-10-23T10:00:00Z',
      expiresAt: '2026-10-30T10:00:00Z',
      games: [game(0), game(1), game(2)],
    });
    expect(body.history).toHaveLength(1);
    expect(body.history[0].games).toEqual([game(0), game(1), game(2)]);
    expect(body.history[0].source).toBe('auto');
  });

  it('returns no current set for an empty table', async () => {
    signIn();
    mockSetsQuery.mockResolvedValueOnce({ data: [], error: null });

    const body = await (await GET(request('GET'))).json();

    expect(body).toEqual({ success: true, current: null, history: [] });
  });

  it('returns 500 when the query fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    signIn();
    mockSetsQuery.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const res = await GET(request('GET'));

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe(t('homePicksApi.loadFailed'));
  });
});

describe('PUT /api/admin/home-picks', () => {
  it('returns 403 for a moderator', async () => {
    signIn('moderator');

    const res = await PUT(request('PUT', { title: null, gameIds: IDS }));

    expect(res.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it.each([
    ['two ids', { title: null, gameIds: IDS.slice(0, 2) }],
    ['a duplicated id', { title: null, gameIds: [IDS[0], IDS[0], IDS[1]] }],
    ['an id that is not a uuid', { title: null, gameIds: [IDS[0], IDS[1], 'nope'] }],
    ['a 61-character title', { title: 'x'.repeat(61), gameIds: IDS }],
    ['no body', undefined],
  ])('returns 400 for %s', async (_label, body) => {
    signIn();

    const res = await PUT(request('PUT', body));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(t('homePicksApi.invalidBody'));
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('saves the set through the RPC with the signed-in admin', async () => {
    signIn();
    mockRpc.mockResolvedValueOnce({ data: 'set-1', error: null });

    const res = await PUT(request('PUT', { title: 'Хелловін', gameIds: IDS }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, setId: 'set-1' });
    expect(mockRpc).toHaveBeenCalledWith('save_home_picks', {
      p_game_ids: IDS,
      p_user: 'admin-1',
      p_title: 'Хелловін',
    });
  });

  it('sends no title when it is blank', async () => {
    signIn();
    mockRpc.mockResolvedValueOnce({ data: 'set-1', error: null });

    await PUT(request('PUT', { title: '   ', gameIds: IDS }));

    expect(mockRpc).toHaveBeenCalledWith('save_home_picks', {
      p_game_ids: IDS,
      p_user: 'admin-1',
    });
  });

  it('maps the invalid_home_picks error to 400', async () => {
    signIn();
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'HP001', message: 'invalid_home_picks: games must exist' },
    });

    const res = await PUT(request('PUT', { title: null, gameIds: IDS }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(t('homePicksApi.invalidGames'));
  });

  it('returns 500 for any other RPC error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    signIn();
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'denied' } });

    const res = await PUT(request('PUT', { title: null, gameIds: IDS }));

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe(t('homePicksApi.saveFailed'));
  });
});

describe('POST /api/admin/home-picks', () => {
  it('returns 403 for a moderator', async () => {
    signIn('moderator');

    const res = await POST(request('POST'));

    expect(res.status).toBe(403);
  });

  it('forces a new auto set', async () => {
    signIn();
    mockRpc.mockResolvedValueOnce({ data: 'set-9', error: null });

    const res = await POST(request('POST'));

    expect(await res.json()).toEqual({ success: true, setId: 'set-9' });
    expect(mockRpc).toHaveBeenCalledWith('generate_auto_home_picks', { p_force: true });
  });

  it('returns 409 when there are too few eligible games', async () => {
    signIn();
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const res = await POST(request('POST'));

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe(t('homePicksApi.notEnoughCandidates'));
  });

  it('returns 500 when the RPC fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    signIn();
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const res = await POST(request('POST'));

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe(t('homePicksApi.rerollFailed'));
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `pnpm vitest run src/app/api/admin/home-picks/route.test.ts`
Expected: FAIL — `Failed to resolve import "./route"`.

- [ ] **Step 5: Implement the main route**

Create `src/app/api/admin/home-picks/route.ts`:

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { t } from '@/i18n/translator';
import { requireAuth } from '@/lib/auth/requireAuth';
import type { HomePickGame, HomePickSet } from '@/lib/homePicks/types';

const HISTORY_LIMIT = 8;
const INVALID_HOME_PICKS = 'HP001';

const SET_SELECT =
  'id, source, title, starts_at, expires_at, home_pick_games(position, games(id, name, slug, team, ai))';

const bodySchema = z.object({
  title: z.string().trim().max(60).nullable(),
  gameIds: z
    .array(z.guid())
    .length(3)
    .refine((ids) => new Set(ids).size === ids.length),
});

interface SetRow {
  id: string;
  source: string;
  title: string | null;
  starts_at: string;
  expires_at: string;
  home_pick_games: { position: number; games: HomePickGame | HomePickGame[] | null }[];
}

// A to-one embed may come back as an array from supabase-js
const first = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

function toHomePickSet(row: SetRow): HomePickSet {
  const games = [...row.home_pick_games]
    .sort((a, b) => a.position - b.position)
    .flatMap((entry) => first(entry.games) ?? []);

  return {
    id: row.id,
    source: row.source === 'manual' ? 'manual' : 'auto',
    title: row.title,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    games,
  };
}

// GET /api/admin/home-picks - the current set and recent history
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { requireRole: 'admin' });
    if (!auth.ok) {
      return auth.response;
    }

    const { data, error } = await auth.supabase
      .from('home_pick_sets')
      .select(SET_SELECT)
      .order('starts_at', { ascending: false })
      .limit(HISTORY_LIMIT + 1);

    if (error) {
      console.error('Error fetching home picks:', error);
      return NextResponse.json(
        { success: false, error: t('homePicksApi.loadFailed') },
        { status: 500 }
      );
    }

    const [current, ...history] = (data ?? []).map(toHomePickSet);
    return NextResponse.json({ success: true, current: current ?? null, history });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { success: false, error: t('common.internalServerError') },
      { status: 500 }
    );
  }
}

// PUT /api/admin/home-picks - save a manual set; this restarts the 7-day timer
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { requireRole: 'admin' });
    if (!auth.ok) {
      return auth.response;
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: t('homePicksApi.invalidBody') },
        { status: 400 }
      );
    }

    const { data, error } = await auth.supabase.rpc('save_home_picks', {
      p_game_ids: parsed.data.gameIds,
      p_user: auth.user.id,
      p_title: parsed.data.title === '' ? undefined : (parsed.data.title ?? undefined),
    });

    if (error) {
      if (error.code === INVALID_HOME_PICKS) {
        return NextResponse.json(
          { success: false, error: t('homePicksApi.invalidGames') },
          { status: 400 }
        );
      }
      console.error('Error saving home picks:', error);
      return NextResponse.json(
        { success: false, error: t('homePicksApi.saveFailed') },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, setId: data });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { success: false, error: t('common.internalServerError') },
      { status: 500 }
    );
  }
}

// POST /api/admin/home-picks - roll a new random set now; this restarts the 7-day timer
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { requireRole: 'admin' });
    if (!auth.ok) {
      return auth.response;
    }

    const { data, error } = await auth.supabase.rpc('generate_auto_home_picks', {
      p_force: true,
    });

    if (error) {
      console.error('Error rolling home picks:', error);
      return NextResponse.json(
        { success: false, error: t('homePicksApi.rerollFailed') },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: t('homePicksApi.notEnoughCandidates') },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, setId: data });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { success: false, error: t('common.internalServerError') },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 6: Run the main route tests**

Run: `pnpm vitest run src/app/api/admin/home-picks/route.test.ts`
Expected: PASS, 19 tests (GET 5, PUT 10 counting each `it.each` row, POST 4).

- [ ] **Step 7: Write the failing tests for the search route**

Create `src/app/api/admin/home-picks/games/route.test.ts`:

```ts
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n/translator';
import { buildIlikeOrFilter } from '@/lib/postgrestSearch';
import { GET as _GET } from './route';

// Next.js route handlers return Response | void; in tests they always return Response
const GET = _GET as (req: NextRequest) => Promise<Response>;

const mockGetUser = vi.fn();
const mockUserQuery = vi.fn();
const mockGamesQuery = vi.fn();
const mockOr = vi.fn();

vi.mock('@/utils/supabase/admin', () => ({
  createClient: () => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    Object.assign(chain, {
      select: self,
      eq: self,
      order: self,
      or: (filter: string) => {
        mockOr(filter);
        return chain;
      },
      single: () => mockUserQuery(),
      limit: () => mockGamesQuery(),
    });
    return { auth: { getUser: mockGetUser }, from: () => chain };
  },
}));

function request(search: string, authorized = true) {
  return new NextRequest(
    new URL(`/api/admin/home-picks/games?search=${encodeURIComponent(search)}`, 'http://localhost'),
    { headers: authorized ? { authorization: 'Bearer valid-token' } : {} }
  );
}

function signIn(role: 'admin' | 'moderator' = 'admin') {
  mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'admin-1' } }, error: null });
  mockUserQuery.mockResolvedValueOnce({ data: { role, approved: true }, error: null });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/admin/home-picks/games', () => {
  it('returns 401 without a token', async () => {
    expect((await GET(request('ab', false))).status).toBe(401);
  });

  it('returns 403 for a moderator', async () => {
    signIn('moderator');

    expect((await GET(request('ab'))).status).toBe(403);
  });

  it.each([['an empty term', ''], ['one character', 'a'], ['spaces only', '   ']])(
    'returns an empty list for %s without querying games',
    async (_label, term) => {
      signIn();

      const body = await (await GET(request(term))).json();

      expect(body).toEqual({ success: true, games: [] });
      expect(mockGamesQuery).not.toHaveBeenCalled();
    }
  );

  it('searches name, slug and team with the term escaped', async () => {
    signIn();
    const games = [{ id: 'g1', name: 'Witcher', slug: 'witcher', team: 'Team', ai: null }];
    mockGamesQuery.mockResolvedValueOnce({ data: games, error: null });

    const body = await (await GET(request('a,b%'))).json();

    expect(body).toEqual({ success: true, games });
    expect(mockOr).toHaveBeenCalledWith(buildIlikeOrFilter(['name', 'slug', 'team'], 'a,b%'));
  });

  it('returns 500 when the query fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    signIn();
    mockGamesQuery.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const res = await GET(request('ab'));

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe(t('homePicksApi.searchFailed'));
  });
});
```

- [ ] **Step 8: Run it to verify it fails**

Run: `pnpm vitest run src/app/api/admin/home-picks/games/route.test.ts`
Expected: FAIL — `Failed to resolve import "./route"`.

- [ ] **Step 9: Implement the search route**

Create `src/app/api/admin/home-picks/games/route.ts`:

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { t } from '@/i18n/translator';
import { requireAuth } from '@/lib/auth/requireAuth';
import { buildIlikeOrFilter } from '@/lib/postgrestSearch';

const MIN_SEARCH_LENGTH = 2;
const RESULT_LIMIT = 10;

// GET /api/admin/home-picks/games?search= - approved, visible translations to pick from
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { requireRole: 'admin' });
    if (!auth.ok) {
      return auth.response;
    }

    const search = request.nextUrl.searchParams.get('search')?.trim() ?? '';
    if (search.length < MIN_SEARCH_LENGTH) {
      return NextResponse.json({ success: true, games: [] });
    }

    const { data, error } = await auth.supabase
      .from('games')
      .select('id, name, slug, team, ai')
      .eq('approved', true)
      .eq('hide', false)
      .or(buildIlikeOrFilter(['name', 'slug', 'team'], search))
      .order('name', { ascending: true })
      .limit(RESULT_LIMIT);

    if (error) {
      console.error('Error searching games for home picks:', error);
      return NextResponse.json(
        { success: false, error: t('homePicksApi.searchFailed') },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, games: data ?? [] });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { success: false, error: t('common.internalServerError') },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 10: Run both route suites, then the gates for this task**

Run: `pnpm vitest run src/app/api/admin/home-picks && pnpm biome:fix && pnpm typecheck`
Expected: route tests PASS (main: 19, search: 7); typecheck passes (the generated types now know `home_pick_sets`, `save_home_picks`, `generate_auto_home_picks`). Do not run `pnpm knip` or the dictionaries test yet: the new `homePicksTab.*` keys have no reader until Task 3.

- [ ] **Step 11: Commit**

```bash
git add supabase/functions/_shared/i18n src/lib/homePicks/types.ts src/app/api/admin/home-picks
git commit -m "Add home picks admin API"
```

---

### Task 3: Client hooks, tab UI and AdminPanel wiring

**Repo:** `D:\lbk\lbk-admin`, branch `feat/weekly-picks-admin`.

**Files:**
- Create: `src/lib/homePicks/formatPickDate.ts`
- Create: `src/hooks/useHomePicksQuery.ts`, `src/hooks/useHomePicksQuery.test.ts`
- Create: `src/components/admin/HomePickSourceBadge.tsx`, `HomePickSlot.tsx`, `HomePicksHistory.tsx`, `HomePicksTab.tsx`, `HomePicksTab.test.tsx`
- Modify: `src/lib/queryKeys.ts`, `src/components/admin/AdminPanel.tsx`, `src/components/admin/AdminPanel.test.tsx`

**Interfaces:**
- Consumes: `HomePickGame`, `HomePickSet`, `HomePicksData` (Task 2), the four endpoints (Task 2), dictionary keys (Task 2).
- Produces (used inside this task): `useHomePicks(): UseQueryResult<HomePicksData>`, `prefetchHomePicks(queryClient: QueryClient): void`, `useHomePickSearch(term: string): UseQueryResult<HomePickGame[]>` (enabled from 2 characters), `useSaveHomePicks()` (`mutateAsync({ title: string | null, gameIds: string[] }): Promise<void>`), `useRerollHomePicks()` (`mutateAsync(): Promise<void>`), `formatPickDate(iso: string): string`.

- [ ] **Step 1: Add the query keys**

In `src/lib/queryKeys.ts`, after the line `  apiTokens: ['apiTokens'] as const,` add:

```ts

  // Home page picks (admin)
  homePicks: {
    all: ['homePicks'] as const,
    current: () => [...queryKeys.homePicks.all, 'current'] as const,
    search: (term: string) => [...queryKeys.homePicks.all, 'search', term] as const,
  },
```

- [ ] **Step 2: Write the failing hook tests**

Create `src/hooks/useHomePicksQuery.test.ts`:

```ts
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectPrefetchServesHook } from '@/test/prefetchTestUtils';

const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;

// Used by fetchWithAuth
vi.mock('@/lib/auth/session', () => ({
  getCurrentSession: vi.fn().mockResolvedValue({ access_token: 'test-token' }),
}));

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

const DATA = { success: true, current: null, history: [] };

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('useHomePicks', () => {
  it('loads the current set and history', async () => {
    mockFetch.mockImplementation(async () => jsonResponse(DATA));
    const { useHomePicks } = await import('./useHomePicksQuery');

    const { result } = renderHook(() => useHomePicks(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ current: null, history: [] });
    expect(mockFetch.mock.calls[0][0]).toBe('/api/admin/home-picks');
  });

  it('surfaces the API error message', async () => {
    mockFetch.mockImplementation(async () => jsonResponse({ success: false, error: 'boom' }, 500));
    const { useHomePicks } = await import('./useHomePicksQuery');

    const { result } = renderHook(() => useHomePicks(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('boom');
  });

  it('prefetchHomePicks warms what HomePicksTab opens with', async () => {
    mockFetch.mockImplementation(async () => jsonResponse(DATA));
    const { prefetchHomePicks, useHomePicks } = await import('./useHomePicksQuery');

    await expectPrefetchServesHook(prefetchHomePicks, () => useHomePicks(), mockFetch);
  });
});

describe('useSaveHomePicks', () => {
  it('PUTs the title and the three ids', async () => {
    mockFetch.mockImplementation(async () => jsonResponse({ success: true, setId: 's1' }));
    const { useSaveHomePicks } = await import('./useHomePicksQuery');
    const { result } = renderHook(() => useSaveHomePicks(), { wrapper: createWrapper() });

    await result.current.mutateAsync({ title: 'Хелловін', gameIds: ['a', 'b', 'c'] });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/admin/home-picks');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ title: 'Хелловін', gameIds: ['a', 'b', 'c'] });
  });

  it('rejects with the API error message', async () => {
    mockFetch.mockImplementation(async () => jsonResponse({ success: false, error: 'bad' }, 400));
    const { useSaveHomePicks } = await import('./useHomePicksQuery');
    const { result } = renderHook(() => useSaveHomePicks(), { wrapper: createWrapper() });

    await expect(result.current.mutateAsync({ title: null, gameIds: ['a', 'b', 'c'] })).rejects.toThrow(
      'bad'
    );
  });
});

describe('useRerollHomePicks', () => {
  it('POSTs to the picks endpoint', async () => {
    mockFetch.mockImplementation(async () => jsonResponse({ success: true, setId: 's2' }));
    const { useRerollHomePicks } = await import('./useHomePicksQuery');
    const { result } = renderHook(() => useRerollHomePicks(), { wrapper: createWrapper() });

    await result.current.mutateAsync();

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/admin/home-picks');
    expect(init.method).toBe('POST');
  });
});

describe('useHomePickSearch', () => {
  it('does not query for a term shorter than 2 characters', async () => {
    const { useHomePickSearch } = await import('./useHomePicksQuery');

    renderHook(() => useHomePickSearch('a'), { wrapper: createWrapper() });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('searches with the encoded term', async () => {
    const games = [{ id: 'g1', name: 'Witcher', slug: 'witcher', team: 'Team', ai: null }];
    mockFetch.mockImplementation(async () => jsonResponse({ success: true, games }));
    const { useHomePickSearch } = await import('./useHomePicksQuery');

    const { result } = renderHook(() => useHomePickSearch('a&b'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data).toEqual(games));
    expect(mockFetch.mock.calls[0][0]).toBe('/api/admin/home-picks/games?search=a%26b');
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm vitest run src/hooks/useHomePicksQuery.test.ts`
Expected: FAIL — `Failed to resolve import "./useHomePicksQuery"`.

- [ ] **Step 4: Implement the hooks**

Create `src/hooks/useHomePicksQuery.ts`:

```ts
'use client';

import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { t } from '@/i18n/translator';
import { assertResponseOk, fetchWithAuth } from '@/lib/auth/fetchWithAuth';
import type { HomePickGame, HomePicksData } from '@/lib/homePicks/types';
import { queryKeys } from '@/lib/queryKeys';

const SEARCH_MIN_LENGTH = 2;

interface SavePayload {
  title: string | null;
  gameIds: string[];
}

async function fetchHomePicks(): Promise<HomePicksData> {
  const response = await fetchWithAuth('/api/admin/home-picks');
  await assertResponseOk(response, t('homePicksApi.loadFailed'));

  const data = await response.json();
  return { current: data.current, history: data.history };
}

async function saveHomePicks(payload: SavePayload): Promise<void> {
  const response = await fetchWithAuth('/api/admin/home-picks', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  await assertResponseOk(response, t('homePicksApi.saveFailed'));
}

async function rerollHomePicks(): Promise<void> {
  const response = await fetchWithAuth('/api/admin/home-picks', { method: 'POST' });
  await assertResponseOk(response, t('homePicksApi.rerollFailed'));
}

async function searchGames(term: string): Promise<HomePickGame[]> {
  const response = await fetchWithAuth(
    `/api/admin/home-picks/games?search=${encodeURIComponent(term)}`
  );
  await assertResponseOk(response, t('homePicksApi.searchFailed'));

  const data = await response.json();
  return data.games;
}

const homePicksQueryOptions = queryOptions({
  queryKey: queryKeys.homePicks.current(),
  queryFn: fetchHomePicks,
  staleTime: 60 * 1000,
});

export function useHomePicks() {
  return useQuery(homePicksQueryOptions);
}

export function prefetchHomePicks(queryClient: QueryClient): void {
  void queryClient.prefetchQuery(homePicksQueryOptions);
}

export function useHomePickSearch(term: string) {
  return useQuery({
    queryKey: queryKeys.homePicks.search(term),
    queryFn: () => searchGames(term),
    enabled: term.length >= SEARCH_MIN_LENGTH,
    staleTime: 30 * 1000,
  });
}

export function useSaveHomePicks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveHomePicks,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.homePicks.current() }),
  });
}

export function useRerollHomePicks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: rerollHomePicks,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.homePicks.current() }),
  });
}
```

- [ ] **Step 5: Run the hook tests**

Run: `pnpm vitest run src/hooks/useHomePicksQuery.test.ts`
Expected: PASS, 8 tests. The `JSON.parse` in the test is in a test file; if lint flags `no-restricted-syntax` on it, add `// eslint-disable-next-line no-restricted-syntax -- test reads its own JSON` above that line.

- [ ] **Step 6: Create the small presentational pieces**

Create `src/lib/homePicks/formatPickDate.ts`:

```ts
const formatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeStyle: 'short' });

export function formatPickDate(iso: string): string {
  return formatter.format(new Date(iso));
}
```

Create `src/components/admin/HomePickSourceBadge.tsx`:

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import type { HomePickSet } from '@/lib/homePicks/types';

interface HomePickSourceBadgeProps {
  source: HomePickSet['source'];
}

export function HomePickSourceBadge({ source }: HomePickSourceBadgeProps) {
  const t = useTranslations('homePicksTab');

  return source === 'manual' ? (
    <Badge color="accent" text={t('sourceManual')} />
  ) : (
    <Badge color="main" text={t('sourceAuto')} />
  );
}
```

Create `src/components/admin/HomePicksHistory.tsx`:

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { formatPickDate } from '@/lib/homePicks/formatPickDate';
import type { HomePickSet } from '@/lib/homePicks/types';
import { HomePickSourceBadge } from './HomePickSourceBadge';

interface HomePicksHistoryProps {
  sets: HomePickSet[];
}

export function HomePicksHistory({ sets }: HomePicksHistoryProps) {
  const t = useTranslations('homePicksTab');

  return (
    <section>
      <h2 className="text-xl font-semibold text-primary mb-4">{t('history')}</h2>
      {sets.length === 0 ? (
        <p className="text-secondary">{t('historyEmpty')}</p>
      ) : (
        <ul className="space-y-3">
          {sets.map((set) => (
            <li
              key={set.id}
              className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4"
            >
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <span className="font-medium text-primary">{set.title ?? t('defaultTitle')}</span>
                <HomePickSourceBadge source={set.source} />
                <span className="text-sm text-secondary">{formatPickDate(set.startsAt)}</span>
              </div>
              <p className="text-sm text-secondary">
                {set.games.map((game) => game.name).join(', ')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

Create `src/components/admin/HomePickSlot.tsx`:

```tsx
'use client';

import { debounce } from 'es-toolkit';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { useHomePickSearch } from '@/hooks/useHomePicksQuery';
import type { HomePickGame } from '@/lib/homePicks/types';

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_LENGTH = 2;

interface HomePickSlotProps {
  index: number;
  game: HomePickGame | null;
  takenIds: string[];
  onPick: (game: HomePickGame) => void;
}

export function HomePickSlot({ index, game, takenIds, onPick }: HomePickSlotProps) {
  const t = useTranslations('homePicksTab');
  const [isSearching, setIsSearching] = useState(false);
  const showSearch = game === null || isSearching;
  const [term, setTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const updateDebouncedTerm = useMemo(() => debounce(setDebouncedTerm, SEARCH_DEBOUNCE_MS), []);
  useEffect(() => () => updateDebouncedTerm.cancel(), [updateDebouncedTerm]);

  const { data: results = [], isFetching } = useHomePickSearch(debouncedTerm);
  const options = results.filter((candidate) => !takenIds.includes(candidate.id));

  const changeTerm = (value: string) => {
    setTerm(value);
    updateDebouncedTerm(value.trim());
  };

  const pick = (candidate: HomePickGame) => {
    onPick(candidate);
    setIsSearching(false);
    changeTerm('');
  };

  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4">
      <p className="text-xs text-secondary mb-2">{t('slot', { number: index + 1 })}</p>
      {game && (
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="font-semibold text-primary truncate">{game.name}</p>
            <p className="text-sm text-secondary truncate">{game.team}</p>
          </div>
          {game.ai && <Badge color="warning" text={t('aiBadge')} />}
        </div>
      )}
      {showSearch ? (
        <div>
          <Input
            wrapperClassName="mb-2"
            value={term}
            placeholder={t('searchPlaceholder')}
            onChange={(event) => changeTerm(event.target.value)}
            onClear={() => changeTerm('')}
          />
          {debouncedTerm.length >= SEARCH_MIN_LENGTH && (
            <ul className="max-h-56 overflow-y-auto space-y-1">
              {isFetching && (
                <li className="flex justify-center py-2">
                  <Spinner size="sm" />
                </li>
              )}
              {!isFetching && options.length === 0 && (
                <li className="text-sm text-secondary py-2">{t('searchEmpty')}</li>
              )}
              {options.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    className="w-full text-left rounded-lg px-3 py-2 hover:bg-main/10"
                    onClick={() => pick(option)}
                  >
                    <span className="block font-medium text-primary">{option.name}</span>
                    <span className="block text-xs text-secondary">
                      {option.team}
                      {option.ai ? ` · ${t('aiBadge')}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setIsSearching(true)}>
          {t('replace')}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Write the failing tab test**

Create `src/components/admin/HomePicksTab.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n/translator';
import type { HomePicksData } from '@/lib/homePicks/types';
import { HomePicksTab } from './HomePicksTab';

const mockHomePicks = vi.fn();
const mockSaveAsync = vi.fn();
const mockRerollAsync = vi.fn();
const mockShowAlert = vi.fn();
const mockShowConfirm = vi.fn();
const mockSearch = vi.fn();

vi.mock('@/contexts/ModalContext', () => ({
  useModal: () => ({ showAlert: mockShowAlert, showConfirm: mockShowConfirm }),
}));

vi.mock('@/hooks/useHomePicksQuery', () => ({
  useHomePicks: () => mockHomePicks(),
  useSaveHomePicks: () => ({ mutateAsync: mockSaveAsync }),
  useRerollHomePicks: () => ({ mutateAsync: mockRerollAsync }),
  useHomePickSearch: (term: string) => mockSearch(term),
}));

const game = (index: number, ai: string | null = null) => ({
  id: `game-${index}`,
  name: `Game ${index}`,
  slug: `game-${index}`,
  team: `Team ${index}`,
  ai,
});

const CURRENT = {
  id: 'set-1',
  source: 'manual' as const,
  title: 'Хелловін',
  startsAt: '2026-10-23T10:00:00Z',
  expiresAt: '2026-10-30T10:00:00Z',
  games: [game(1), game(2), game(3)],
};

function withData(data: Partial<HomePicksData> = {}) {
  mockHomePicks.mockReturnValue({
    data: { current: CURRENT, history: [], ...data },
    isLoading: false,
    error: null,
  });
}

const saveButton = () => screen.getByRole('button', { name: t('homePicksTab.save') });

beforeEach(() => {
  vi.clearAllMocks();
  mockSearch.mockReturnValue({ data: [], isFetching: false });
  mockSaveAsync.mockResolvedValue(undefined);
  mockRerollAsync.mockResolvedValue(undefined);
});

describe('HomePicksTab', () => {
  it('shows the current set with its source, title and games', () => {
    withData();

    render(<HomePicksTab />);

    expect(screen.getByText(t('homePicksTab.sourceManual'))).toBeInTheDocument();
    expect(screen.getByDisplayValue('Хелловін')).toBeInTheDocument();
    expect(screen.getByText('Game 1')).toBeInTheDocument();
    expect(screen.getByText('Game 3')).toBeInTheDocument();
  });

  it('marks AI translations', () => {
    withData({ current: { ...CURRENT, games: [game(1, 'gpt'), game(2), game(3)] } });

    render(<HomePicksTab />);

    expect(screen.getAllByText(t('homePicksTab.aiBadge'))).toHaveLength(1);
  });

  it('keeps Save disabled until all three slots are filled', () => {
    withData({ current: null });

    render(<HomePicksTab />);

    expect(saveButton()).toBeDisabled();
  });

  it('saves the trimmed title with the three game ids', async () => {
    withData();
    render(<HomePicksTab />);

    fireEvent.change(screen.getByDisplayValue('Хелловін'), { target: { value: '  Нова назва  ' } });
    fireEvent.click(saveButton());

    await waitFor(() =>
      expect(mockSaveAsync).toHaveBeenCalledWith({
        title: 'Нова назва',
        gameIds: ['game-1', 'game-2', 'game-3'],
      })
    );
    await waitFor(() =>
      expect(mockShowAlert).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }))
    );
  });

  it('saves a blank title as null', async () => {
    withData({ current: { ...CURRENT, title: null } });
    render(<HomePicksTab />);

    fireEvent.click(saveButton());

    await waitFor(() =>
      expect(mockSaveAsync).toHaveBeenCalledWith({
        title: null,
        gameIds: ['game-1', 'game-2', 'game-3'],
      })
    );
  });

  it('shows the error when saving fails', async () => {
    withData();
    mockSaveAsync.mockRejectedValue(new Error('bad'));
    render(<HomePicksTab />);

    fireEvent.click(saveButton());

    await waitFor(() =>
      expect(mockShowAlert).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'error', message: 'bad' })
      )
    );
  });

  it('replaces a game picked from the search results', async () => {
    withData();
    mockSearch.mockImplementation((term: string) => ({
      data: term.length >= 2 ? [game(9)] : [],
      isFetching: false,
    }));
    render(<HomePicksTab />);

    fireEvent.click(screen.getAllByRole('button', { name: t('homePicksTab.replace') })[1]);
    fireEvent.change(screen.getByPlaceholderText(t('homePicksTab.searchPlaceholder')), {
      target: { value: 'ga' },
    });
    fireEvent.click(await screen.findByText('Game 9'));
    fireEvent.click(saveButton());

    await waitFor(() =>
      expect(mockSaveAsync).toHaveBeenCalledWith({
        title: 'Хелловін',
        gameIds: ['game-1', 'game-9', 'game-3'],
      })
    );
  });

  it('does not offer a game that is already in another slot', async () => {
    withData();
    mockSearch.mockImplementation((term: string) => ({
      data: term.length >= 2 ? [game(1), game(9)] : [],
      isFetching: false,
    }));
    render(<HomePicksTab />);

    fireEvent.click(screen.getAllByRole('button', { name: t('homePicksTab.replace') })[1]);
    fireEvent.change(screen.getByPlaceholderText(t('homePicksTab.searchPlaceholder')), {
      target: { value: 'ga' },
    });

    await screen.findByText('Game 9');
    // Game 1 is already shown in slot 1, so it must not appear a second time as an option
    expect(screen.getAllByText('Game 1')).toHaveLength(1);
  });

  it('asks for confirmation before rolling a random set', async () => {
    withData();
    mockShowConfirm.mockResolvedValue(false);
    render(<HomePicksTab />);

    fireEvent.click(screen.getByRole('button', { name: t('homePicksTab.reroll') }));

    await waitFor(() => expect(mockShowConfirm).toHaveBeenCalled());
    expect(mockRerollAsync).not.toHaveBeenCalled();
  });

  it('rolls the random set after confirmation', async () => {
    withData();
    mockShowConfirm.mockResolvedValue(true);
    render(<HomePicksTab />);

    fireEvent.click(screen.getByRole('button', { name: t('homePicksTab.reroll') }));

    await waitFor(() => expect(mockRerollAsync).toHaveBeenCalled());
  });

  it('lists the history with the default title for a set without one', () => {
    withData({
      history: [
        {
          id: 'set-0',
          source: 'auto',
          title: null,
          startsAt: '2026-10-16T10:00:00Z',
          expiresAt: '2026-10-23T10:00:00Z',
          games: [game(4), game(5), game(6)],
        },
      ],
    });

    render(<HomePicksTab />);

    expect(screen.getByText(t('homePicksTab.defaultTitle'))).toBeInTheDocument();
    expect(screen.getByText('Game 4, Game 5, Game 6')).toBeInTheDocument();
  });

  it('shows the load error', () => {
    mockHomePicks.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') });

    render(<HomePicksTab />);

    expect(screen.getByText(t('homePicksTab.loadError', { message: 'boom' }))).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Run it to verify it fails**

Run: `pnpm vitest run src/components/admin/HomePicksTab.test.tsx`
Expected: FAIL — `Failed to resolve import "./HomePicksTab"`.

- [ ] **Step 9: Implement the tab**

Create `src/components/admin/HomePicksTab.tsx`:

```tsx
'use client';

import { Save, Shuffle } from 'lucide';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { useModal } from '@/contexts/ModalContext';
import { useActionPhase } from '@/hooks/useActionPhase';
import { useHomePicks, useRerollHomePicks, useSaveHomePicks } from '@/hooks/useHomePicksQuery';
import { formatPickDate } from '@/lib/homePicks/formatPickDate';
import type { HomePickGame } from '@/lib/homePicks/types';
import { HomePickSlot } from './HomePickSlot';
import { HomePickSourceBadge } from './HomePickSourceBadge';
import { HomePicksHistory } from './HomePicksHistory';

const SLOT_COUNT = 3;
const TITLE_MAX_LENGTH = 60;

export function HomePicksTab() {
  const t = useTranslations('homePicksTab');
  const tCommon = useTranslations('common');
  const { showAlert, showConfirm } = useModal();
  const { data, isLoading, error } = useHomePicks();
  const saveMutation = useSaveHomePicks();
  const rerollMutation = useRerollHomePicks();
  const savePhase = useActionPhase();
  const rerollPhase = useActionPhase();

  const current = data?.current ?? null;
  const [title, setTitle] = useState('');
  const [slots, setSlots] = useState<(HomePickGame | null)[]>(() =>
    Array.from({ length: SLOT_COUNT }, () => null)
  );

  // The draft follows the server's current set, so a save or a re-roll refreshes it
  useEffect(() => {
    setTitle(current?.title ?? '');
    setSlots(Array.from({ length: SLOT_COUNT }, (_, index) => current?.games[index] ?? null));
  }, [current?.id]);

  const picked = slots.filter((slot): slot is HomePickGame => slot !== null);
  const pickedIds = picked.map((pick) => pick.id);
  const canSave = picked.length === SLOT_COUNT && new Set(pickedIds).size === SLOT_COUNT;

  const replaceSlot = (index: number, game: HomePickGame) =>
    setSlots((previous) => previous.map((slot, slotIndex) => (slotIndex === index ? game : slot)));

  const handleSave = async () => {
    const trimmed = title.trim();
    try {
      await savePhase.run(() =>
        saveMutation.mutateAsync({ title: trimmed === '' ? null : trimmed, gameIds: pickedIds })
      );
      showAlert({ title: tCommon('success'), message: t('saved'), variant: 'success' });
    } catch (err) {
      showAlert({
        title: tCommon('error'),
        message: err instanceof Error ? err.message : t('saveFailed'),
        variant: 'error',
      });
    }
  };

  const handleReroll = async () => {
    const confirmed = await showConfirm({
      title: t('rerollConfirmTitle'),
      message: t('rerollConfirmMessage'),
      variant: 'warning',
      confirmText: t('reroll'),
    });
    if (!confirmed) {
      return;
    }
    try {
      await rerollPhase.run(() => rerollMutation.mutateAsync());
      showAlert({ title: tCommon('success'), message: t('rerolled'), variant: 'success' });
    } catch (err) {
      showAlert({
        title: tCommon('error'),
        message: err instanceof Error ? err.message : t('rerollFailed'),
        variant: 'error',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-[var(--error)]">
        {t('loadError', { message: error.message })}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h2 className="text-xl font-semibold text-primary">{t('currentSet')}</h2>
          {current && (
            <>
              <HomePickSourceBadge source={current.source} />
              <span className="text-sm text-secondary">
                {t('expiresAt', { date: formatPickDate(current.expiresAt) })}
              </span>
            </>
          )}
        </div>
        {!current && <p className="text-secondary mb-4">{t('noCurrent')}</p>}
        <Input
          label={t('titleLabel')}
          value={title}
          maxLength={TITLE_MAX_LENGTH}
          placeholder={t('defaultTitle')}
          helperText={t('titleHelper')}
          onChange={(event) => setTitle(event.target.value)}
        />
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          {slots.map((game, index) => (
            <HomePickSlot
              key={index}
              index={index}
              game={game}
              takenIds={pickedIds}
              onPick={(next) => replaceSlot(index, next)}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button
            icon={Save}
            phase={savePhase.phase}
            disabled={!canSave || savePhase.isBusy}
            onClick={handleSave}
          >
            {t('save')}
          </Button>
          <Button
            variant="secondary"
            icon={Shuffle}
            phase={rerollPhase.phase}
            disabled={rerollPhase.isBusy}
            onClick={handleReroll}
          >
            {t('reroll')}
          </Button>
          <p className="text-sm text-secondary">{t('saveNote')}</p>
        </div>
      </section>
      <HomePicksHistory sets={data?.history ?? []} />
    </div>
  );
}
```

- [ ] **Step 10: Run the tab tests**

Run: `pnpm vitest run src/components/admin/HomePicksTab.test.tsx`
Expected: PASS, 12 tests. If `getByText(t('homePicksTab.sourceManual'))` finds two nodes, the history also rendered a manual set: the test data keeps `history: []` for that case, so check `withData`.

- [ ] **Step 11: Wire the tab into AdminPanel**

In `src/components/admin/AdminPanel.tsx` make these edits:

1. After `import { prefetchAllGames, prefetchApprovalGames } from '@/hooks/useGamesQuery';` add `import { prefetchHomePicks } from '@/hooks/useHomePicksQuery';`.
2. After `import { GameApprovalsTab } from './GameApprovalsTab';` add `import { HomePicksTab } from './HomePicksTab';`.
3. In `type TabType`, after `| 'banners'` add `| 'homePicks'`.
4. In `TAB_PREFETCH`, after `banners: prefetchBanners,` add `homePicks: prefetchHomePicks,`.
5. In `tabs`, after the `banners` row add `{ id: 'homePicks', label: t('homePicks'), visible: isAdmin },`.
6. After `{activeTab === 'banners' && <BannersTab />}` add `{activeTab === 'homePicks' && <HomePicksTab />}`.

In `src/components/admin/AdminPanel.test.tsx`: after the `vi.mock('./BannersTab', …)` block add

```tsx
vi.mock('./HomePicksTab', () => ({
  HomePicksTab: () => <div data-testid="home-picks-tab">HomePicksTab</div>,
}));
```
and after the test `should not show Banners tab for moderator` add

```tsx
    it('should show the Home picks tab for admin only', () => {
      const { unmount } = render(<AdminPanel userRole="admin" />);
      expect(screen.getByText(t('adminPanel.tabs.homePicks'))).toBeInTheDocument();
      unmount();

      render(<AdminPanel userRole="moderator" />);
      expect(screen.queryByText(t('adminPanel.tabs.homePicks'))).not.toBeInTheDocument();
    });
```

- [ ] **Step 12: Run the whole admin gate chain**

Run: `pnpm biome:fix && pnpm typecheck && pnpm lint && pnpm biome:check && pnpm knip && pnpm test:run`
Expected: typecheck, biome and knip clean; lint warning count not above the baseline (compare with `git stash`-free run on `main` if in doubt: only the count of *new* warnings matters); the full suite passes including `src/i18n/dictionaries.test.ts` (every new `uk` key is now read by code, `be` and `en` match structurally). Fix any `dictionaries` failure by checking the `{date}`, `{number}`, `{message}` arguments match across the three locales.

- [ ] **Step 13: Commit**

```bash
git add src
git commit -m "Add home picks admin tab"
```

---

## Phase C — lbk-launcher

All commands run in `D:\lbk\lbk-launcher` on branch `feat/weekly-picks` after the Gate (types merged from `lb/main`).

### Task 4: Shared types, main fetch, IPC channel and preload

**Files:**
- Create: `src/shared/home-picks-types.ts`
- Create: `src/main/db/home-picks-api.ts`, `src/main/db/home-picks-api.test.ts`
- Create: `src/main/ipc/home-picks.ts`
- Modify: `src/shared/types.ts`, `src/preload/index.ts`, `src/main/index.ts`

**Interfaces:**
- Produces:
  - `HomePicks { title: string | null; startsAt: string; expiresAt: string; gameIds: string[] }` and `HomePicksAPI { fetchHomePicks: () => Promise<HomePicks | null> }` from `@/shared/home-picks-types`;
  - `fetchHomePicks(): Promise<HomePicks | null>` from `@/main/db/home-picks-api` (null on RPC error, no rows, or a set without games);
  - `setupHomePicksHandlers(): void` registering the IPC channel `fetch-home-picks`;
  - `window.electronAPI.fetchHomePicks(): Promise<HomePicks | null>`.

- [ ] **Step 1: Create the shared types**

Create `src/shared/home-picks-types.ts`:

```ts
export interface HomePicks {
  title: string | null;
  startsAt: string;
  expiresAt: string;
  gameIds: string[];
}

export interface HomePicksAPI {
  fetchHomePicks: () => Promise<HomePicks | null>;
}
```

- [ ] **Step 2: Write the failing test**

Create `src/main/db/home-picks-api.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('./supabase-client', () => ({ getSupabaseClient: () => ({ rpc }) }));

const { fetchHomePicks } = await import('./home-picks-api');

const row = {
  title: 'Хелловін',
  starts_at: '2026-10-23T10:00:00Z',
  expires_at: '2026-10-30T10:00:00Z',
  game_ids: ['g1', 'g2', 'g3'],
};

beforeEach(() => {
  rpc.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('fetchHomePicks', () => {
  it('maps the current set', async () => {
    rpc.mockResolvedValue({ data: [row], error: null });

    await expect(fetchHomePicks()).resolves.toEqual({
      title: 'Хелловін',
      startsAt: row.starts_at,
      expiresAt: row.expires_at,
      gameIds: row.game_ids,
    });
    expect(rpc).toHaveBeenCalledWith('get_home_picks');
  });

  it('keeps a missing title as null', async () => {
    rpc.mockResolvedValue({ data: [{ ...row, title: null }], error: null });

    await expect(fetchHomePicks()).resolves.toMatchObject({ title: null });
  });

  it.each([
    ['no rows', { data: [], error: null }],
    ['null data', { data: null, error: null }],
    ['a set without games', { data: [{ ...row, game_ids: [] }], error: null }],
    ['an rpc error', { data: null, error: { message: 'boom' } }],
  ])('returns null for %s', async (_label, response) => {
    rpc.mockResolvedValue(response);

    await expect(fetchHomePicks()).resolves.toBeNull();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm vitest run src/main/db/home-picks-api.test.ts`
Expected: FAIL — `Failed to resolve import "./home-picks-api"`.

- [ ] **Step 4: Implement the fetch**

Create `src/main/db/home-picks-api.ts`:

```ts
import type { HomePicks } from '../../shared/home-picks-types';
import { getSupabaseClient } from './supabase-client';

export async function fetchHomePicks(): Promise<HomePicks | null> {
  const { data, error } = await getSupabaseClient().rpc('get_home_picks');

  if (error) {
    console.warn('[HomePicks] Failed to fetch the current set:', error.message);
    return null;
  }

  const row = data?.[0];
  if (!row || row.game_ids.length === 0) {
    return null;
  }

  return {
    title: row.title,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    gameIds: row.game_ids,
  };
}
```

- [ ] **Step 5: Run the test**

Run: `pnpm vitest run src/main/db/home-picks-api.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Add the IPC handler, ElectronAPI member, preload method and registration**

Create `src/main/ipc/home-picks.ts`:

```ts
import { ipcMain } from 'electron';
import type { HomePicks } from '../../shared/home-picks-types';
import { fetchHomePicks } from '../db/home-picks-api';

export function setupHomePicksHandlers(): void {
  ipcMain.handle('fetch-home-picks', (): Promise<HomePicks | null> => fetchHomePicks());
}
```

In `src/shared/types.ts`:
- add `import type { HomePicksAPI } from './home-picks-types';` in the import block just before the `import type { … } from './plugin-host-types';` block;
- change `export interface ElectronAPI {` to `export interface ElectronAPI extends HomePicksAPI {`.

In `src/preload/index.ts`, directly after

```ts
  fetchTrendingGames: (days?: number, limit?: number) =>
    ipcRenderer.invoke('fetch-trending-games', days, limit),
```
add

```ts
  fetchHomePicks: () => ipcRenderer.invoke('fetch-home-picks'),
```

In `src/main/index.ts`:
- after `import { setupGamesHandlers } from './ipc/games';` add `import { setupHomePicksHandlers } from './ipc/home-picks';`;
- after the call `setupTgNewsHandlers();` (inside the single-instance `else` branch, next to the other `setup*Handlers()` calls) add `setupHomePicksHandlers();`.

- [ ] **Step 7: Run the gates**

Run: `pnpm format && pnpm type-check && pnpm test:unit && pnpm lint && pnpm find-unused`
Expected: all pass. `type-check` proves `fetchHomePicks` in the preload object satisfies `ElectronAPI` and that `get_home_picks` exists in the generated types. `find-unused` must not flag `HomePicks`, `HomePicksAPI` or `setupHomePicksHandlers` (each is imported).

- [ ] **Step 8: Commit**

```bash
git add src
git commit -m "Add home picks IPC channel"
```

---

### Task 5: Ordering function and query hook

**Files:**
- Create: `src/renderer/utils/homePicks.ts`, `src/renderer/utils/homePicks.test.ts`
- Create: `src/renderer/queries/useHomePicks.ts`

**Interfaces:**
- Consumes: `window.electronAPI.fetchHomePicks(): Promise<HomePicks | null>` (Task 4); `window.electronAPI.fetchGamesByIds(gameIds: string[], searchQuery?: string, hideAiTranslations?: boolean): Promise<Game[]>` (existing, returns only visible local games, applies `ai IS NULL` when `hideAiTranslations`); `useSyncAwareQuery` (existing).
- Produces:
  - `orderHomePickGames(gameIds: string[], games: Game[]): Game[]`;
  - `useHomePicks(hideAiTranslations: boolean)`: a query whose `data` is `{ title: string | null; games: Game[] } | undefined`.

- [ ] **Step 1: Write the failing test**

Create `src/renderer/utils/homePicks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Game } from '../../shared/types';
import { orderHomePickGames } from './homePicks';

const game = (id: string) => ({ id }) as Game;

describe('orderHomePickGames', () => {
  it.each([
    ['keeps the server order, not the catalog order', ['b', 'a', 'c'], ['a', 'b', 'c'], ['b', 'a', 'c']],
    ['drops ids missing from the local catalog', ['a', 'x', 'c'], ['a', 'c'], ['a', 'c']],
    ['drops a duplicated id', ['a', 'a', 'b'], ['a', 'b'], ['a', 'b']],
    ['ignores local games the set does not name', ['a'], ['a', 'z'], ['a']],
    ['gives nothing for an empty set', [], ['a'], []],
    ['gives nothing while no game is local yet', ['a', 'b'], [], []],
  ])('%s', (_label, ids, local, expected) => {
    expect(orderHomePickGames(ids, local.map(game)).map((item) => item.id)).toEqual(expected);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/renderer/utils/homePicks.test.ts`
Expected: FAIL — `Failed to resolve import "./homePicks"`.

- [ ] **Step 3: Implement the function**

Create `src/renderer/utils/homePicks.ts`:

```ts
import type { Game } from '../../shared/types';

export function orderHomePickGames(gameIds: string[], games: Game[]): Game[] {
  const byId = new Map(games.map((game) => [game.id, game]));
  const seen = new Set<string>();

  return gameIds.flatMap((id) => {
    const game = byId.get(id);
    if (!game || seen.has(id)) {
      return [];
    }
    seen.add(id);
    return [game];
  });
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm vitest run src/renderer/utils/homePicks.test.ts`
Expected: PASS, 6 rows.

- [ ] **Step 5: Create the query hook**

Create `src/renderer/queries/useHomePicks.ts`:

```ts
import type { Game } from '../../shared/types';
import { orderHomePickGames } from '../utils/homePicks';
import { useSyncAwareQuery } from './useSyncAwareQuery';

const ONE_HOUR = 60 * 60 * 1000;

interface HomePicksWithGames {
  title: string | null;
  games: Game[];
}

const homePicksKeys = {
  all: ['home-picks'] as const,
  withGames: (hideAiTranslations: boolean) =>
    [...homePicksKeys.all, 'with-games', hideAiTranslations] as const,
};

export function useHomePicks(hideAiTranslations: boolean) {
  return useSyncAwareQuery({
    queryKey: homePicksKeys.withGames(hideAiTranslations),
    queryFn: async (): Promise<HomePicksWithGames> => {
      const picks = await window.electronAPI.fetchHomePicks();
      if (!picks) {
        // Throwing keeps the last good data while a refresh fails; with none, the section stays hidden
        throw new Error('No current home picks');
      }

      const games = await window.electronAPI.fetchGamesByIds(
        picks.gameIds,
        undefined,
        hideAiTranslations
      );
      return { title: picks.title, games: orderHomePickGames(picks.gameIds, games) };
    },
    staleTime: ONE_HOUR,
    gcTime: ONE_HOUR,
    refetchInterval: ONE_HOUR,
    // The app turns this off globally; the launcher sits in the tray for days and a set rolls weekly
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
```

- [ ] **Step 6: Run the gates**

Run: `pnpm format && pnpm type-check && pnpm test:unit && pnpm lint && pnpm find-unused`
Expected: all pass. `find-unused` is satisfied once Task 6 imports `useHomePicks`; until then it flags it, so run `find-unused` again at the end of Task 6 and ignore it here.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "Add home picks query"
```

---

### Task 6: Section component, copy, MainPage wiring and final verification

**Files:**
- Create: `src/renderer/components/MainContent/HomePicksSection.tsx`
- Modify: `src/renderer/components/MainContent/MainPage.tsx`, `packages/lbk-i18n/src/uk.ts`, `packages/lbk-i18n/src/be.ts`, `packages/lbk-i18n/src/en.ts`

**Interfaces:**
- Consumes: `useHomePicks(hideAiTranslations: boolean)` (Task 5); `GameListItem`, `useIsTranslationInstalled`, `useStore` (`gamesWithUpdates`, `isGameDetected`), `useSettingsStore` (`hideAiTranslations`), `trackEvent` (all existing).
- Produces: `HomePicksSection: React.FC` (no props).

- [ ] **Step 1: Add the default title to the three dictionaries**

Read each file around `homeSections`, then add one line after the `recommended` line, using the two-line anchor so the edit is unique.

`packages/lbk-i18n/src/uk.ts`: replace
```
    installedGames: 'Знайдено встановлені ігри',
    recommended: 'Вас може зацікавити',
```
with
```
    installedGames: 'Знайдено встановлені ігри',
    recommended: 'Вас може зацікавити',
    weeklyPicks: 'Добірка тижня',
```
`packages/lbk-i18n/src/be.ts`: anchor `installedGames: 'Знойдзеныя ўсталяваныя гульні',` + `recommended: 'Вас можа зацікавіць',`, new line `    weeklyPicks: 'Падборка тыдня',`.
`packages/lbk-i18n/src/en.ts`: anchor `installedGames: 'Installed games found',` + `recommended: 'You might like',`, new line `    weeklyPicks: 'Picks of the week',`.

- [ ] **Step 2: Create the section**

Create `src/renderer/components/MainContent/HomePicksSection.tsx`:

```tsx
import { motion } from 'framer-motion';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useHomePicks } from '@/renderer/queries/useHomePicks';
import { useSettingsStore } from '@/renderer/store/useSettingsStore';
import { useStore } from '@/renderer/store/useStore';
import { trackEvent } from '@/renderer/utils/analytics';
import { t } from '@/shared/i18n/i18n';
import { useIsTranslationInstalled } from '../../hooks/useInstalledTranslations';
import { GameListItem } from '../Sidebar/GameListItem';

export const HomePicksSection: React.FC = () => {
  const isInstalled = useIsTranslationInstalled();
  const navigate = useNavigate();
  const hideAiTranslations = useSettingsStore((state) => state.hideAiTranslations);
  const { gamesWithUpdates, isGameDetected } = useStore(
    useShallow((state) => ({
      gamesWithUpdates: state.gamesWithUpdates,
      isGameDetected: state.isGameDetected,
    }))
  );
  const { data } = useHomePicks(hideAiTranslations);

  if (!data || data.games.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-8">
        <h2 className="text-4xl font-head font-semibold text-text-main">
          {data.title ?? t('homeSections.weeklyPicks')}
        </h2>
      </div>
      <div className="grid grid-cols-3 gap-8">
        {data.games.map((game, index) => (
          <motion.div
            key={game.id}
            id={`home-pick-${game.slug}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: Math.min(index * 0.03, 0.5),
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          >
            <GameListItem
              game={game}
              isSelected={false}
              isCardStyle={true}
              hasUpdate={gamesWithUpdates.has(game.id)}
              isGameDetected={isGameDetected(game.id)}
              isInstalled={isInstalled(game.id)}
              isTranslationAvailable={
                game.status !== 'planned' && game.status !== 'tech-improvement'
              }
              onClick={() => {
                trackEvent('Select game', {
                  'Is home pick': true,
                  'Home pick title': data.title ?? 'default',
                  'Game Id': game.id,
                  'Game Name': game.name,
                });
                navigate(`/game/${game.id}`);
              }}
            />
          </motion.div>
        ))}
      </div>
    </section>
  );
};
```

- [ ] **Step 3: Put it on the main page**

In `src/renderer/components/MainContent/MainPage.tsx`:
- after `import { t } from '@/shared/i18n/i18n';` keep imports sorted and add `import { HomePicksSection } from './HomePicksSection';` before `import { InstalledGamesSection } from './InstalledGamesSection';`;
- directly after `<InstalledGamesSection showLimit={3} />` add `<HomePicksSection />`.

- [ ] **Step 4: Run every launcher gate in CI order**

Run: `pnpm format && pnpm type-check && pnpm test:unit && pnpm lint && pnpm format:check && pnpm find-unused`
Expected: all pass. `packages/lbk-i18n/src/dictionaries.test.ts` passes (the new key exists in all three locales). `find-unused` is clean now that `useHomePicks` and `HomePicksSection` are imported.

- [ ] **Step 5: Check the e2e selectors this change could touch**

Run: `git grep -nE "h2|section|data-gamepad-card|Новинки|Популярне" -- e2e/tests`
Expected: no spec counts sections or cards on the home page. If one does (for example the number of `[data-gamepad-card]` on the main page), adjust that assertion to allow up to 3 extra cards, and say so in the commit message.

- [ ] **Step 6: Manual check in the running app (there are no component or hook tests)**

Run: `pnpm dev` with `.env` pointing at a Supabase that has migration 192 applied and at least 6 eligible games. Verify, in this order:
1. After the catalog sync finishes, the section appears directly under the installed-games block with 3 cards, titled «Добірка тижня».
2. Clicking a card opens `/game/<id>`.
3. In the admin tab save a set titled «Хелловін», then in the launcher focus the window after an hour is simulated by clearing the cache (`clear-cache-only` in Settings) or by restarting: the new title and games show.
4. Pick an AI translation by hand, enable «Приховати ШІ-переклади» in Settings: that card disappears and the other two stay.
5. Disconnect the network, restart: no section, no crash, one `[HomePicks]` warning in the console. Reconnect, focus the window: nothing changes until the data is an hour old; restart to see it return.
6. Use the `gamepad-drive` skill to confirm the new cards are reachable with the D-pad from the installed-games block.

Record anything that fails as a new task; do not patch it silently.

- [ ] **Step 7: Commit**

```bash
git add src packages/lbk-i18n
git commit -m "Add weekly picks section to the home page"
```

---

## Out of this plan

- Pushing branches, opening PRs and merging (the user decides; the gate needs the admin PR merged first).
- A release: `package.json` version and an `src/shared/changelog.json` entry for it. The changelog is append-only and must hold the entry for version N before tag `vN` is cut (`changelog.ts` reads the file as it was at that tag), so add it in the release commit, not here.
- Realtime push, per-user personalisation, a launcher setting for the section, a landing-page block, a «view all» page and a queue of future sets (see the spec's out-of-scope list).
