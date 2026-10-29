import type { StyleDefinition } from '@dicebear/core';
import { buildDefinition } from './buildDefinition';
import { checkDefinition } from './checkDefinition';
import { MIRRORS, TRANSPOSE } from './compose';
import type { Library } from './library';
import { rejectsWith } from './rejectsWith';
import {
  baseComponent,
  el,
  ref,
  type StyleAttributes,
  type StyleComponent,
  type StyleElement,
} from './styleDefinition';

const QUARTER_TURN = 'matrix(0 -1 1 0 0 26)';

// The border's zigzag, its inner points pushed along the ring by skew and the whole ring moved by dx, dy
function zigzag(skew: number, dx: number, dy: number): string {
  const points = Array.from({ length: 32 }, (_, k) => {
    const r = k % 2 === 0 ? 12.5 : 11.6;
    const t = ((k + (k % 2) * skew) * Math.PI) / 16;
    return `${(13 + dx + r * Math.cos(t)).toFixed(2)} ${(13 + dy + r * Math.sin(t)).toFixed(2)}`;
  });
  return `M${points.join('L')}z`;
}

const isRef = (e: StyleElement, name: string, transform: string): boolean =>
  e.type === 'component' &&
  e.name === name &&
  (e.attributes?.transform ?? '') === transform;

function mapElements(
  elements: readonly StyleElement[],
  fn: (e: StyleElement) => StyleElement[]
): StyleElement[] {
  return elements.flatMap((e) =>
    fn(e.children ? { ...e, children: mapElements(e.children, fn) } : e)
  );
}

// Rewrites the elements of every variant of every component, as a careless edit of the generator would
function rewrite(
  def: StyleDefinition,
  fn: (e: StyleElement) => StyleElement[]
): StyleDefinition {
  const components = Object.keys(def.components ?? {}).map((name) => {
    const c = baseComponent(def, name);
    const variants = Object.entries(c.variants).map(([v, variant]) => [
      v,
      { ...variant, elements: mapElements(variant.elements, fn) },
    ]);
    return [name, { ...c, variants: Object.fromEntries(variants) }];
  });
  return { ...def, components: Object.fromEntries(components) };
}

const withComponent = (
  def: StyleDefinition,
  name: string,
  component: StyleComponent
): StyleDefinition => ({ ...def, components: { ...def.components, [name]: component } });

function withVariant(
  def: StyleDefinition,
  name: string,
  variant: string,
  fn: (elements: readonly StyleElement[]) => StyleElement[]
): StyleDefinition {
  const c = baseComponent(def, name);
  const v = c.variants[variant];
  return withComponent(def, name, {
    ...c,
    variants: { ...c.variants, [variant]: { ...v, elements: fn(v.elements) } },
  });
}

const withAttributes = (e: StyleElement, attributes: StyleAttributes): StyleElement => ({
  ...e,
  attributes: { ...e.attributes, ...attributes },
});

// Careless edits of the generator, each with the guard message that must reject it
const BREAKAGES: ReadonlyArray<
  readonly [string, (def: StyleDefinition) => StyleDefinition, RegExp]
> = [
  [
    'a mirror replaced by a quarter-turn',
    (def) =>
      rewrite(def, (e) => [isRef(e, 'q', MIRRORS[1]) ? ref('q', QUARTER_TURN) : e]),
    /the quarter must be placed exactly/,
  ],
  [
    'a quarter reference dropped',
    (def) => rewrite(def, (e) => (isRef(e, 'q', MIRRORS[3]) ? [] : [e])),
    /the quarter must be placed exactly/,
  ],
  [
    'the second arm drawn from an alias',
    (def) =>
      withComponent(
        rewrite(def, (e) => [isRef(e, 'a', TRANSPOSE) ? ref('a2', TRANSPOSE) : e]),
        'a2',
        { extends: 'a' }
      ),
    /extends would let/,
  ],
  [
    'a second quarter variant',
    (def) => {
      const q = baseComponent(def, 'q');
      return withComponent(def, 'q', {
        ...q,
        variants: { ...q.variants, w: q.variants.v },
      });
    },
    /needs exactly one variant/,
  ],
  [
    'a rotated corner',
    (def) =>
      withComponent(def, 'x', {
        ...baseComponent(def, 'x'),
        rotate: { min: 0, max: 90 },
      }),
    /rotate would let/,
  ],
  [
    'an optional arm',
    (def) => withComponent(def, 'a', { ...baseComponent(def, 'a'), probability: 50 }),
    /must always be drawn/,
  ],
  [
    'a part nested into another',
    (def) => withVariant(def, 'k', 'dot', (elements) => [...elements, ref('x', '')]),
    /parts may not reference components/,
  ],
  [
    'a mirrored quarter wrapped in a rotated group',
    (def) =>
      rewrite(def, (e) =>
        isRef(e, 'q', MIRRORS[1])
          ? [el('g', { transform: 'rotate(90 13 13)' }, [e])]
          : [e]
      ),
    /only a plain <g>/,
  ],
  [
    'a quarter reference offset by x',
    (def) => rewrite(def, (e) => [isRef(e, 'q', '') ? withAttributes(e, { x: '2' }) : e]),
    /may carry only a transform/,
  ],
  [
    'the palette reference offset by x',
    (def) => ({
      ...def,
      canvas: { ...def.canvas, elements: [withAttributes(ref('p', ''), { x: '2' })] },
    }),
    /may carry only a transform/,
  ],
  [
    'a raw path in the quarter',
    (def) =>
      withVariant(def, 'q', 'v', (elements) => [
        ...elements,
        el('path', { d: 'M0 1h2' }),
      ]),
    /component q: expected/,
  ],
  [
    'a sawtooth border, a bent-tooth wheel',
    (def) =>
      withVariant(def, 'b', 'teeth', (elements) =>
        elements.map((e) => withAttributes(e, { d: zigzag(0.8, 0, 0) }))
      ),
    /lost its mirror axes/,
  ],
  [
    'a zigzag border dropped off the horizontal axis',
    (def) =>
      withVariant(def, 'b', 'teeth', (elements) =>
        elements.map((e) => withAttributes(e, { d: zigzag(0, 0, 0.5) }))
      ),
    /lost its mirror axes/,
  ],
  [
    'a zigzag border pushed off the vertical axis',
    (def) =>
      withVariant(def, 'b', 'teeth', (elements) =>
        elements.map((e) => withAttributes(e, { d: zigzag(0, 0.5, 0) }))
      ),
    /lost its mirror axes/,
  ],
  [
    'a running stitch shifted off the axes',
    (def) =>
      withVariant(def, 'b', 'running', (elements) =>
        elements.map((e) => withAttributes(e, { 'stroke-dashoffset': '0' }))
      ),
    /leave the mirror axes/,
  ],
  [
    'a border ring off the centre',
    (def) =>
      withVariant(def, 'b', 'line', (elements) =>
        elements.map((e) => withAttributes(e, { cx: '13.5' }))
      ),
    /must sit on the centre/,
  ],
  [
    'a canvas rect short of the frame',
    (def) =>
      rewrite(def, (e) => [
        e.name === 'rect' && e.attributes?.class === undefined
          ? withAttributes(e, { width: '25' })
          : e,
      ]),
    /must cover its whole/,
  ],
  [
    'a texture tile that does not divide the canvas',
    (def) =>
      rewrite(def, (e) => [e.name === 'pattern' ? withAttributes(e, { width: '3' }) : e]),
    /must tile the canvas evenly/,
  ],
  [
    'a texture tile sized by the bounding box',
    (def) =>
      rewrite(def, (e) => [
        e.name === 'pattern'
          ? withAttributes(e, { patternUnits: 'objectBoundingBox' })
          : e,
      ]),
    /must tile the canvas evenly/,
  ],
  [
    'a transform on the whole avatar',
    (def) => ({ ...def, attributes: { transform: 'rotate(10 13 13)' } }),
    /root attributes/,
  ],
  [
    'a border ring turned by a transform',
    (def) =>
      withVariant(def, 'b', 'running', (elements) =>
        elements.map((e) => withAttributes(e, { transform: 'rotate(5 13 13)' }))
      ),
    /may not carry transform/,
  ],
  [
    'a border ring spun by an animation',
    (def) =>
      withVariant(def, 'b', 'running', (elements) =>
        elements.map((e) => ({
          ...e,
          children: [
            el('animateTransform', {
              attributeName: 'transform',
              type: 'rotate',
              from: '0 13 13',
              to: '360 13 13',
              dur: '9s',
            }),
          ],
        }))
      ),
    /may not have children/,
  ],
  [
    'a palette style that turns the texture',
    (def) =>
      rewrite(def, (e) => [
        e.name === 'style'
          ? { ...e, children: [{ type: 'text', value: '.t{transform:rotate(9deg)}' }] }
          : e,
      ]),
    /style may only hide the texture/,
  ],
  [
    'a core path that draws an extra cell',
    (def) =>
      withVariant(def, 'k', 'dot', (elements) =>
        elements.map((e, i) =>
          i === 0 ? withAttributes(e, { d: `M0 1h2${String(e.attributes?.d)}` }) : e
        )
      ),
    /dot: thread A draws/,
  ],
];

// The definition guards must accept the real definition and reject every breakage with their own message
export function definitionSelfTest(lib: Library): void {
  const good = buildDefinition(lib);
  checkDefinition(good, lib);
  for (const [label, breakage, expected] of BREAKAGES) {
    rejectsWith(label, () => checkDefinition(breakage(good), lib), expected);
  }
}
