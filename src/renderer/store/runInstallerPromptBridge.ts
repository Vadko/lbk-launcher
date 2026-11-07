import { t } from '@/shared/i18n/i18n';
import type { RunInstallerRequest } from '@/shared/types';
import { useModalStore } from './useModalStore';

function promptMessage({ gameName: name, isExe, protons }: RunInstallerRequest): string {
  if (protons) {
    return isExe
      ? t('runInstaller.exeProtonMessage', { name })
      : t('runInstaller.scriptProtonMessage', { name });
  }
  return isExe
    ? t('runInstaller.exeAskMessage', { name })
    : t('runInstaller.scriptAskMessage', { name });
}

function showPrompt(request: RunInstallerRequest, protonPath: string | undefined): void {
  const { gameId, installerPath, isExe, protons } = request;
  // The skip answer keeps protonPath too: reinstall and uninstall reuse it.
  const respond = (run: boolean) =>
    window.electronAPI.respondRunInstaller(gameId, { run, protonPath });
  useModalStore.getState().showModal({
    key: `run-installer:${gameId}`,
    title: isExe ? t('runInstaller.exeTitle') : t('runInstaller.scriptTitle'),
    message: promptMessage(request),
    type: 'info',
    mandatory: true,
    selectConfig: protons
      ? {
          options: protons.map((p) => ({ name: p.name, value: p.path })),
          selectedValue: protonPath,
          onSelectionChange: (value) => showPrompt(request, value),
          placeholder: t('runInstaller.protonPlaceholder'),
        }
      : undefined,
    actions: [
      {
        label: t('runInstaller.openFolder'),
        onClick: () => window.electronAPI.showItemInFolder(installerPath),
        variant: 'secondary',
        keepOpen: true,
      },
      { label: t('runInstaller.run'), onClick: () => respond(true), variant: 'primary' },
      {
        label: t('runInstaller.skip'),
        onClick: () => respond(false),
        variant: 'secondary',
      },
    ],
  });
}

// Main's install waits on the answer, so the prompt shows on whatever page the player is.
export function initRunInstallerPrompts(): void {
  window.electronAPI?.onRequestRunInstallerConfirm?.((request) =>
    showPrompt(request, request.protonPath)
  );
}
