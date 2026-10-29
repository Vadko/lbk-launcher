import { describe, expect, it } from 'vitest';
import { sha256 } from '@/main/utils/hash';
import { playerAvatarUri } from './playerAvatar';
import vyshyvanka from './vyshyvanka.json';

const MIRRORS = [
  '',
  'matrix(-1 0 0 1 26 0)',
  'matrix(1 0 0 -1 0 26)',
  'matrix(-1 0 0 -1 26 26)',
];
const TRANSPOSE = 'matrix(0 1 1 0 0 0)';
// Server seeds are 12 hex characters
const SEEDS = Array.from({ length: 2000 }, (_, i) =>
  (((i + 1) * 2654435761) % 2 ** 48).toString(16).padStart(12, '0')
);

interface Use {
  readonly transform: string;
  readonly href: string;
}

function svgOf(seed: string): string {
  const uri = playerAvatarUri(seed);
  return decodeURIComponent(uri.slice(uri.indexOf(',') + 1));
}

const usesIn = (fragment: string): Use[] =>
  [...fragment.matchAll(/<use(?: transform="([^"]*)")? href="#([^"]+)"\/>/g)].map(
    (m) => ({
      transform: m[1] ?? '',
      href: m[2],
    })
  );

const idsIn = (svg: string): string[] =>
  [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);

function quarter(svg: string): { id: string; uses: Use[] } {
  const defs = [...svg.matchAll(/<g id="(q-[^"]+)">((?:<use[^>]*\/>)*)<\/g>/g)];
  expect(defs).toHaveLength(1);
  return { id: defs[0][1], uses: usesIn(defs[0][2]) };
}

describe('playerAvatarUri', () => {
  it('draws an SVG data URI', () => {
    expect(playerAvatarUri('0a1b2c3d4e5f')).toMatch(/^data:image\/svg\+xml/);
  });

  it('draws the same avatar for a seed every time', () => {
    const first = playerAvatarUri('0a1b2c3d4e5f');
    // A cold cache must give the same art as a warm one
    for (let i = 0; i < 250; i++) {
      playerAvatarUri(i.toString(16).padStart(12, '0'));
    }
    expect(playerAvatarUri('0a1b2c3d4e5f')).toBe(first);
  });

  it('draws different avatars for different seeds', () => {
    expect(playerAvatarUri('0a1b2c3d4e5f')).not.toBe(playerAvatarUri('ffffffffffff'));
  });

  // A player keeps the avatar the server gave the seed: a DiceBear or style change that alters any of these is a redraw of everyone
  it.each([
    ['0a1b2c3d4e5f', 'd4dd42d8c1f4d0da1d3b942871fd3d887fe122393ec4525adafc69f5f173d326'],
    ['ffffffffffff', '9e6c031563278648abc42d066dfb451507f36201b68613639111b00a00725054'],
    ['000000000000', 'a577e84bb158ef0074321716fee38425a5d167bace60334fcf9e50ee09dcc287'],
    ['c0ffee15900d', 'c13d2b50ada2b66b3a488264467976b236e54300a1e57f9166bdacb6c8f80b20'],
    ['9b3d27e4a6f0', 'b38d350fefa0fc83743faa2fb0ab1104780867557ee05080a83a0e1f57603034'],
    ['7c9e2d41b0a3', '63aef7dc12b8231da09a9777f8ce2a539d7b1bfdada9cb53e0a19c4bbc59d51f'],
    ['1234567890ab', '8d0e1b6f3c9792080063cc0067b5fe0894b9ce017c8dbb479a1a70562a89d884'],
    ['a5a5a5a5a5a5', '2a51a3441d24115e2a032fb911cbd7bd11596d103cac8510be626a8386fd39d8'],
    ['002d7e1a2b3c', '3ef4395b96274bf68b426a9d9fe174f4866b8cfdc2556d4441f7848975f56921'],
  ])('draws seed %s exactly as before', (seed, digest) => {
    expect(sha256(playerAvatarUri(seed))).toBe(digest);
  });

  // The test seeds draw every variant, so a redraw of any palette, border or part changes this
  it('draws all test seeds exactly as before', () => {
    expect(sha256(SEEDS.map(playerAvatarUri).join('\n'))).toBe(
      'ee90122397af4a7b0c84dae6b4d485340b17d4c982821f606cf2e3c46f8332f9'
    );
  });

  it('draws every variant of the style among the test seeds', () => {
    const drawn = new Set(
      SEEDS.flatMap((seed) =>
        [...svgOf(seed).matchAll(/<g id="([a-z]+)-(\w+)-[0-9a-f]{8}">/g)].map(
          (m) => `${m[1]}.${m[2]}`
        )
      )
    );
    const variants = Object.entries(vyshyvanka.components).flatMap(([name, c]) =>
      Object.keys(c.variants).map((v) => `${name}.${v}`)
    );
    expect(variants.filter((v) => !drawn.has(v))).toEqual([]);
  });
});

// Mirror symmetry rests on DiceBear drawing one definition per component per avatar and placing it by reference
describe('player avatar symmetry', () => {
  it.each(SEEDS)(
    'places one quarter four times, by the identity and the mirrors only: %s',
    (seed) => {
      const svg = svgOf(seed);
      const ids = idsIn(svg);
      expect(ids).toEqual([...new Set(ids)]);
      const { id } = quarter(svg);
      const placed = usesIn(svg).filter((u) => u.href.startsWith('q-'));
      expect(placed.map((u) => u.href)).toEqual([id, id, id, id]);
      expect(placed.map((u) => u.transform).sort()).toEqual([...MIRRORS].sort());
      // Nothing around the references may turn or move them, and no reference escapes the strict pattern
      expect(svg).not.toMatch(/<g[^>]*\btransform=/);
      expect(svg.match(/<use\b/g)).toHaveLength(usesIn(svg).length);
    }
  );

  it.each(SEEDS)(
    'draws both arms from one arm definition, and the parts nowhere else: %s',
    (seed) => {
      const svg = svgOf(seed);
      const ids = new Set(idsIn(svg));
      const { uses } = quarter(svg);
      expect(uses.map((u) => `${u.href.split('-')[0]}:${u.transform}`)).toEqual([
        'k:',
        'a:',
        `a:${TRANSPOSE}`,
        'x:',
      ]);
      expect(uses[1].href).toBe(uses[2].href);
      expect(uses.map((u) => u.href).filter((href) => !ids.has(href))).toEqual([]);
      expect(usesIn(svg).filter((u) => /^[kax]-/.test(u.href))).toHaveLength(uses.length);
    }
  );

  it('keeps ids apart between avatars, so several can share one page', () => {
    const owner = new Map<string, string>();
    const patterns = new Map<string, string>();
    for (const seed of SEEDS.slice(0, 300)) {
      const svg = svgOf(seed);
      for (const id of idsIn(svg)) {
        const first = owner.get(id);
        if (first !== undefined && first !== seed) {
          expect(id, seed).toMatch(/^t-[A-Za-z]+$/);
        }
        owner.set(id, first ?? seed);
      }
      for (const m of svg.matchAll(/<pattern id="([^"]+)"[^>]*>.*?<\/pattern>/g)) {
        expect(patterns.get(m[1]) ?? m[0], seed).toBe(m[0]);
        patterns.set(m[1], m[0]);
      }
    }
  });
});
