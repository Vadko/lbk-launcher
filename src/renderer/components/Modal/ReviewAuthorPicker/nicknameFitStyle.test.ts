import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const FONT = { weight: 600, sizePx: 15 };

const measureText = vi.fn((text: string) => ({ width: text.length * 9 }));
const fontsCheck = vi.fn(() => true);

async function loadFitStyle() {
  vi.resetModules();
  const { nicknameFitStyle } = await import('./nicknameFitStyle');
  return nicknameFitStyle;
}

beforeEach(() => {
  vi.clearAllMocks();
  fontsCheck.mockReturnValue(true);
  const context = { font: '', measureText };
  vi.stubGlobal('document', {
    body: {},
    createElement: () => ({ getContext: () => context }),
    fonts: { check: fontsCheck },
  });
  vi.stubGlobal('getComputedStyle', () => ({
    fontFamily: '"Inter Variable", sans-serif',
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('nicknameFitStyle', () => {
  it('gives the text’s width in em with 2% to spare, rounded up', async () => {
    const fitStyle = await loadFitStyle();

    expect(fitStyle('Lys', FONT)).toEqual({ '--fit-em': 1.84 });
    expect(fitStyle('Meteorolohynia', { weight: 600, sizePx: 16 })).toEqual({
      '--fit-em': 8.04,
    });
  });

  it('measures a word once in the page’s body font', async () => {
    const fitStyle = await loadFitStyle();

    fitStyle('Vovk', FONT);
    fitStyle('Vovk', FONT);

    expect(measureText).toHaveBeenCalledOnce();
    expect(fontsCheck).toHaveBeenCalledWith(
      '600 15px "Inter Variable", sans-serif',
      'Vovk'
    );
  });

  it('measures again once the font has loaded', async () => {
    const fitStyle = await loadFitStyle();
    fontsCheck.mockReturnValueOnce(false);

    fitStyle('Vovk', FONT);
    fitStyle('Vovk', FONT);
    fitStyle('Vovk', FONT);

    expect(measureText).toHaveBeenCalledTimes(2);
  });

  it('leaves the font at its full size without a canvas', async () => {
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) });
    const fitStyle = await loadFitStyle();

    expect(fitStyle('Vovk', FONT)).toEqual({});
  });
});
