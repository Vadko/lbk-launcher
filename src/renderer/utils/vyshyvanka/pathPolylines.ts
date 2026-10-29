import { fail } from './fail';

export type Point = readonly [number, number];

interface Polyline {
  readonly points: readonly Point[];
  readonly closed: boolean;
}

const TOKEN = /[MmLlHhVvZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;

// Straight segments only (M L H V Z, absolute or relative): a curve or an arc is refused rather than checked
export function pathPolylines(d: string): Polyline[] {
  if (d.replace(TOKEN, ' ').replace(/[\s,]+/g, '') !== '') {
    fail(`path ${d}: only straight segments (M L H V Z) are allowed`);
  }
  const tokens = d.match(TOKEN) ?? [];
  const lines: Array<{ points: Point[]; closed: boolean }> = [];
  let current: { points: Point[]; closed: boolean } | undefined;
  let start: Point = [0, 0];
  let at: Point = [0, 0];
  let command = '';
  let i = 0;
  const next = (): number => {
    const v = Number(tokens[i]);
    i += 1;
    return Number.isNaN(v) ? fail(`path ${d}: ${command} is missing a number`) : v;
  };
  const lineTo = (p: Point): void => {
    if (!current) {
      // After a Z, a drawing command starts a new subpath where the closed one started
      current = { points: [at], closed: false };
      lines.push(current);
    }
    current.points.push(p);
    at = p;
  };
  while (i < tokens.length) {
    if (/^[a-z]$/i.test(tokens[i])) {
      command = tokens[i];
      i += 1;
    } else if (command === '' || command.toUpperCase() === 'Z') {
      fail(`path ${d}: a number without a command`);
    }
    const [ox, oy] = command === command.toLowerCase() ? at : [0, 0];
    switch (command.toUpperCase()) {
      case 'M': {
        const p: Point = [ox + next(), oy + next()];
        current = { points: [p], closed: false };
        lines.push(current);
        start = p;
        at = p;
        // Further pairs after a moveto are linetos
        command = command === 'm' ? 'l' : 'L';
        break;
      }
      case 'L':
        lineTo([ox + next(), oy + next()]);
        break;
      case 'H':
        lineTo([ox + next(), at[1]]);
        break;
      case 'V':
        lineTo([at[0], oy + next()]);
        break;
      case 'Z':
        if (current) {
          current.closed = true;
        }
        current = undefined;
        at = start;
        break;
      default:
        fail(`path ${d}: unknown command ${command}`);
    }
  }
  return lines;
}
