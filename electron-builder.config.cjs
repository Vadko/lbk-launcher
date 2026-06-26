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
    forceCodeSigning: false,
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
    ],
  },

  nsis: {
    // Assisted installer required to show branded welcome/finish sidebar.
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: false,
    deleteAppDataOnUninstall: false,
    differentialPackage: true,
    artifactName: "LBK-Launcher-${os}-Setup.${ext}",
    language: "1058",
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "LBK Launcher",
    runAfterFinish: true,
    menuCategory: false,
    installerSidebar: 'resources/installerSidebar.bmp',
    installerHeader: 'resources/installerHeader.bmp',
    include: 'resources/installer.nsh',
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
