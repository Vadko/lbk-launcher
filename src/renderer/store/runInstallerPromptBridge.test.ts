import { beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/shared/i18n/i18n';
import type { RunInstallerRequest } from '@/shared/types';
import { initRunInstallerPrompts } from './runInstallerPromptBridge';
import { useModalStore } from './useModalStore';

const respondRunInstaller = vi.fn();
let emit: (request: RunInstallerRequest) => void = () => undefined;

vi.stubGlobal('window', {
  electronAPI: {
    onRequestRunInstallerConfirm: (callback: typeof emit) => {
      emit = callback;
      return () => undefined;
    },
    respondRunInstaller,
    showItemInFolder: vi.fn(),
  },
});

const PROTONS = [
  { name: 'Proton 9', path: '/proton/9' },
  { name: 'Proton 10', path: '/proton/10' },
];

const request = (gameId: string, extra: Partial<RunInstallerRequest> = {}) => ({
  gameId,
  gameName: `Game ${gameId}`,
  installerPath: `/games/${gameId}/setup.exe`,
  isExe: true,
  ...extra,
});

const config = () => useModalStore.getState().config;

// What GlobalModal does on a click
const click = (label: string) => {
  const action = config()?.actions?.find((a) => a.label === label);
  action?.onClick();
  if (!action?.keepOpen) {
    useModalStore.getState().closeModal();
  }
};

initRunInstallerPrompts();

beforeEach(() => {
  respondRunInstaller.mockReset();
  useModalStore.setState({ isOpen: false, config: null, queue: [] });
});

describe('run installer prompts', () => {
  it.each([
    ['an installer', request('a'), t('runInstaller.exeAskMessage', { name: 'Game a' })],
    [
      'a script',
      request('a', { isExe: false }),
      t('runInstaller.scriptAskMessage', { name: 'Game a' }),
    ],
    [
      'an installer under Proton',
      request('a', { protons: PROTONS, protonPath: '/proton/9' }),
      t('runInstaller.exeProtonMessage', { name: 'Game a' }),
    ],
  ])('names the game in the prompt for %s', (_case, req, message) => {
    emit(req);

    expect(config()).toMatchObject({ mandatory: true, message });
  });

  it('answers every prompt, one after another', () => {
    emit(request('a'));
    emit(request('b'));
    useModalStore.getState().showModal({ title: 'Installed', message: '' });

    click(t('runInstaller.run'));
    click(t('runInstaller.skip'));

    expect(respondRunInstaller.mock.calls).toEqual([
      ['a', { run: true, protonPath: undefined }],
      ['b', { run: false, protonPath: undefined }],
    ]);
    expect(config()?.title).toBe('Installed');
  });

  it('starts from the preselected Proton and answers with the one picked', () => {
    emit(request('a', { protons: PROTONS, protonPath: '/proton/10' }));
    expect(config()?.selectConfig?.selectedValue).toBe('/proton/10');

    config()?.selectConfig?.onSelectionChange?.('/proton/9');
    expect(config()?.selectConfig?.selectedValue).toBe('/proton/9');
    expect(useModalStore.getState().queue).toEqual([]);

    click(t('runInstaller.run'));
    expect(respondRunInstaller).toHaveBeenCalledWith('a', {
      run: true,
      protonPath: '/proton/9',
    });
  });

  it('keeps the prompt open while the folder opens', () => {
    emit(request('a'));
    click(t('runInstaller.openFolder'));

    expect(config()?.title).toBe(t('runInstaller.exeTitle'));
    expect(respondRunInstaller).not.toHaveBeenCalled();
  });
});
