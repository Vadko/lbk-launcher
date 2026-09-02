/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
module.exports = {
  appId: 'com.lbk.launcher',
  productName: 'LBK Launcher',
  copyright: 'Copyright © 2026 LBK UA',

  directories: {
    buildResources: 'resources',
    output: 'release/${version}',
  },

  files: [
    'out/**/*',
    '!node_modules/7zip-bin-full/**',
  ],

  extraResources: [
    {
      from: 'resources/icon-light.png',
      to: 'icon-light.png',
    },
    {
      from: 'resources/trayIconTemplate.png',
      to: 'trayIconTemplate.png',
    },
    {
      from: 'resources/trayIconTemplate@2x.png',
      to: 'trayIconTemplate@2x.png',
    },
    {
      from: 'resources/steam-shortcut',
      to: 'steam-shortcut',
      filter: ['**/*'],
    },
  ],

  asarUnpack: ['**/*.node'],

  electronLanguages: ['en-US', 'uk'],

  artifactName: "LBK-Launcher-${os}.${ext}",

  compression: 'store',

  publish: [
    {
      provider: 'github',
      owner: 'Vadko',
      repo: 'lbk-launcher',
      releaseType: 'release',
    },
  ],

  protocols: [
    {
      name: 'LBK Launcher Protocol',
      schemes: ['lbk'],
    },
  ],

  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
      {
        target: 'portable',
        arch: ['x64'],
      },
    ],
    icon: 'resources/icon-light.ico',
    azureSignOptions: process.env.AZURE_TENANT_ID
      ? {
          publisherName: process.env.AZURE_PUBLISHER_NAME,
          endpoint: process.env.AZURE_CODE_SIGNING_ENDPOINT,
          codeSigningAccountName: process.env.AZURE_CODE_SIGNING_ACCOUNT_NAME,
          certificateProfileName: process.env.AZURE_CERT_PROFILE_NAME,
        }
      : undefined,
    // Disable Authenticode re-verification of downloaded updates. Our installers
    // are signed via Azure Trusted Signing, whose root (Microsoft Identity
    // Verification Root CA 2020) is delivered by Windows Update (KB5022661) —
    // absent on machines with WU/auto root updates disabled, a large share of
    // our userbase, where WinVerifyTrust would reject the valid installer and
    // brick every update. Integrity still comes from electron-updater's SHA512
    // check against latest.yml over HTTPS. Same approach as
    // nordicsemi/pc-nrfconnect-launcher.
    verifyUpdateCodeSignature: false,
    forceCodeSigning: false,
    signExts: ['.dll', '.node'],
    legalTrademarks: '© 2026 LBK UA',
    extraResources: [
      {
        from: 'node_modules/7zip-bin-full/win',
        to: '7zip/win',
        filter: ['**/*'],
      },
      {
        from: 'resources/extensions/spellfix.dll',
        to: 'extensions/spellfix.dll',
      },
    ],
  },

  portable: {
    artifactName: "LBK-Launcher-${os}-Portable.${ext}",
  },

  linux: {
    target: ['AppImage', 'rpm'],
    artifactName: 'LBK-Launcher-${os}.${ext}',
    category: 'Utility',
    maintainer: 'LBK UA <info@lbklauncher.com>',
    executableName: 'lbk-launcher',
    icon: 'resources/icon-light.png',
    // Steam Deck compatibility
    executableArgs: ['--no-sandbox', '--disable-gpu-sandbox'],
    extraResources: [
      {
        from: 'node_modules/7zip-bin-full/linux',
        to: '7zip/linux',
        filter: ['**/*'],
      },
      {
        from: 'resources/extensions/spellfix.so',
        to: 'extensions/spellfix.so',
      },
      {
        from: 'resources/umu',
        to: 'umu',
        filter: ['**/*'],
      },
    ],
  },

  nsis: {
    oneClick: true,
    perMachine: false,
    allowToChangeInstallationDirectory: false,
    deleteAppDataOnUninstall: false,
    differentialPackage: true,
    artifactName: "LBK-Launcher-${os}-Setup.${ext}",
    // Ukrainian-only installer: `installerLanguages` limits the bundle to
    // uk_UA; `displayLanguageSelector` defaults to false so there's no picker.
    // (Do NOT set `multiLanguageInstaller: false` — langs.js forces langs back
    // to ['en_US'] in that mode, which would override our choice.)
    language: "1058",
    installerLanguages: ['uk_UA'],
    include: 'resources/installer.nsh',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "LBK Launcher",
    runAfterFinish: true,
    menuCategory: false,
    // Dark icon for Setup.exe + Uninstall.exe; installed app.exe stays light via win.icon.
    installerIcon: 'resources/icon-dark.ico',
    uninstallerIcon: 'resources/icon-dark.ico',
  },

  mac: {
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64'],
      },
      {
        target: 'zip',
        arch: ['x64', 'arm64'],
      },
    ],
    category: 'public.app-category.utilities',
    icon: 'resources/icon-mac.icon',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    darkModeSupport: true,
    minimumSystemVersion: '10.13.0',
    artifactName: 'LBK-Launcher-${arch}.${ext}',
    entitlements: 'resources/entitlements.mac.plist',
    entitlementsInherit: 'resources/entitlements.mac.plist',
    notarize: !!process.env.CI,
    extraResources: [
      {
        from: 'node_modules/7zip-bin-full/mac',
        to: '7zip/mac',
        filter: ['**/*'],
      },
      {
        from: 'resources/extensions/spellfix.dylib',
        to: 'extensions/spellfix.dylib',
      },
    ],
  },

  dmg: {
    contents: [
      {
        x: 410,
        y: 150,
        type: 'link',
        path: '/Applications',
      },
      {
        x: 130,
        y: 150,
        type: 'file',
      },
    ],
    window: {
      width: 540,
      height: 420,
    },
    icon: 'resources/icon-mac.icns',
    background: 'resources/dmg-background.png',
    artifactName: 'LBK-Launcher-${version}-${arch}.${ext}',
  },
};
