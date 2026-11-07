import { beforeEach, describe, expect, it } from 'vitest';
import { useModalStore } from './useModalStore';

type Config = Parameters<ReturnType<typeof useModalStore.getState>['showModal']>[0];

const modal = (title: string, extra: Partial<Config> = {}): Config => ({
  title,
  message: '',
  ...extra,
});
const prompt = (game: string, title = `prompt ${game}`) =>
  modal(title, { key: `run-installer:${game}`, mandatory: true });

const shown = () => useModalStore.getState().config?.title ?? null;
const queued = () => useModalStore.getState().queue.map((config) => config.title);
const show = (...configs: Config[]) => {
  for (const config of configs) {
    useModalStore.getState().showModal(config);
  }
};

beforeEach(() => {
  useModalStore.setState({ isOpen: false, config: null, queue: [] });
});

describe('useModalStore', () => {
  it.each<[string, Config[], string | null, string[]]>([
    ['an empty slot', [modal('a')], 'a', []],
    ['a modal over another', [modal('a'), modal('b')], 'b', []],
    ['a modal over a mandatory prompt', [prompt('A'), modal('b')], 'prompt A', ['b']],
    ['a prompt over a modal', [modal('a'), prompt('A')], 'a', ['prompt A']],
    ['a prompt over a prompt', [prompt('A'), prompt('B')], 'prompt A', ['prompt B']],
    [
      'the shown prompt of the same flow',
      [prompt('A'), prompt('A', 'prompt A, Proton 9')],
      'prompt A, Proton 9',
      [],
    ],
    [
      'a queued prompt of the same flow',
      [prompt('A'), prompt('B'), modal('c'), prompt('B', 'prompt B, Proton 9')],
      'prompt A',
      ['prompt B, Proton 9', 'c'],
    ],
  ])('shows %s in its place', (_case, configs, expectedShown, expectedQueue) => {
    show(...configs);

    expect(shown()).toBe(expectedShown);
    expect(queued()).toEqual(expectedQueue);
  });

  it('shows what waited, in order, as each one closes', () => {
    show(prompt('A'), modal('b'), prompt('C'));

    const order = [shown()];
    while (useModalStore.getState().isOpen) {
      useModalStore.getState().closeModal();
      order.push(shown());
    }

    expect(order).toEqual(['prompt A', 'b', 'prompt C', null]);
  });
});
