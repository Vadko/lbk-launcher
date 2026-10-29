import type { StyleDefinition } from '@dicebear/core';
import { fail } from './fail';

export type StyleElement = StyleDefinition['canvas']['elements'][number];
export type StyleAttributes = NonNullable<StyleElement['attributes']>;
export type StyleComponent = NonNullable<StyleDefinition['components']>[string];
type StyleComponentBase = Exclude<StyleComponent, { readonly extends: string }>;
export type StyleVariant = StyleComponentBase['variants'][string];

export const el = (
  name: string,
  attributes: StyleAttributes,
  children?: readonly StyleElement[]
): StyleElement => ({
  type: 'element',
  name,
  attributes,
  ...(children ? { children } : {}),
});

export const ref = (name: string, transform: string): StyleElement => ({
  type: 'component',
  name,
  ...(transform ? { attributes: { transform } } : {}),
});

export function baseComponent(def: StyleDefinition, name: string): StyleComponentBase {
  const component = def.components?.[name] ?? fail(`component ${name} missing`);
  return 'extends' in component
    ? fail(`component ${name}: extends would let a reference differ from its mirror`)
    : component;
}
