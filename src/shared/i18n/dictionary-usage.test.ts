import * as fs from 'node:fs';
import * as path from 'node:path';
import { uk } from '@lbk/i18n/uk';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

interface Dictionary {
  [key: string]: string | Dictionary;
}

const ROOT = path.resolve(__dirname, '../../..');
const SOURCE_DIRS = ['src', 'packages'];
const DICTIONARY_DIR = path.join(ROOT, 'packages/lbk-i18n/src');

function flatten(dictionary: Dictionary, prefix = ''): string[] {
  return Object.entries(dictionary).flatMap(([key, value]) => {
    const keyPath = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [keyPath] : flatten(value, keyPath);
  });
}

function listSources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'node_modules' ||
        entry.name.startsWith('.') ||
        entryPath === DICTIONARY_DIR
        ? []
        : listSources(entryPath);
    }
    return /\.tsx?$/.test(entry.name) && !/\.(test|fixture|d)\.tsx?$/.test(entry.name)
      ? [entryPath]
      : [];
  });
}

// A template without letters (`${major}.${minor}`) is a key only when `t` itself gets it.
function templatePattern(node: ts.TemplateExpression) {
  const parts = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)];
  const escape = (part: string) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const call = node.parent;
  const passedToT =
    ts.isCallExpression(call) &&
    call.arguments[0] === node &&
    ts.isIdentifier(call.expression) &&
    call.expression.text === 't';
  return parts.some((part) => /[a-z]/i.test(part)) || (passedToT && parts.some(Boolean))
    ? new RegExp(`^${parts.map(escape).join('(.+?)')}$`)
    : null;
}

function findUnusedKeys(keys: string[]) {
  const literals = new Set<string>();
  const propertyNames = new Set<string>();
  const templates: RegExp[] = [];
  const dictionaryPaths: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteralLike(node)) {
      literals.add(node.text);
    } else if (ts.isTemplateExpression(node)) {
      const pattern = templatePattern(node);
      if (pattern) {
        templates.push(pattern);
      }
    } else if (
      (ts.isPropertyAssignment(node) ||
        ts.isShorthandPropertyAssignment(node) ||
        ts.isPropertySignature(node)) &&
      ts.isIdentifier(node.name)
    ) {
      propertyNames.add(node.name.text);
    } else if (
      ts.isPropertyAccessExpression(node) &&
      !ts.isPropertyAccessExpression(node.parent)
    ) {
      const chain: string[] = [];
      let target: ts.Expression = node;
      while (ts.isPropertyAccessExpression(target)) {
        chain.unshift(target.name.text);
        target = target.expression;
      }
      if (ts.isIdentifier(target) && target.text === 'uk') {
        dictionaryPaths.push(chain.join('.'));
      }
    }
    ts.forEachChild(node, visit);
  };
  for (const file of SOURCE_DIRS.flatMap((dir) => listSources(path.join(ROOT, dir)))) {
    visit(
      ts.createSourceFile(
        file,
        fs.readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true
      )
    );
  }
  const values = new Set([...literals, ...propertyNames]);
  const isRead = (key: string) =>
    literals.has(key) ||
    templates.some((pattern) =>
      pattern
        .exec(key)
        ?.slice(1)
        .every((part) => values.has(part))
    ) ||
    dictionaryPaths.some(
      (read) => read === key || key.startsWith(`${read}.`) || read.startsWith(`${key}.`)
    );

  return keys.filter((key) => {
    const withoutPlural = key.replace(/_(zero|one|two|few|many|other)$/, '');
    return ![key, withoutPlural, withoutPlural.replace(/_[^_.]+$/, '')].some(isRead);
  });
}

describe('uk dictionary', () => {
  it('has no key the code never reads', () => {
    expect(findUnusedKeys(flatten(uk))).toEqual([]);
  });
});
