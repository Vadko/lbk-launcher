/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
module.exports = {
  appId: 'com.littlebit.launcher',
  productName: 'LBK Launcher',
  copyright: 'Copyright © 2025 LB UA',

  directories: {
    buildResources: 'resources',
    output: 'release/${version}',
  },

  files: ['out/**/*'],

  extraResources: [
    {
      from: 'resources/icon.png',
      to: 'icon.png',
    },
  ],

  icon: 'resources/icon.png',

  asarUnpack: ['**/*.node', '**/7zip-bin-full/**'],

  electronLanguages: ['en-US', 'uk'],

  artifactName: "${productName}-${os}.${ext}",

  compression: 'store',

  publish: [
    {
      provider: 'github',
      owner: 'Vadko',
      repo: 'littlebit-launcher',
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
    icon: 'resources/icon.png',
    verifyUpdateCodeSignature: false,
    forceCodeSigning: false,
    legalTrademarks: '© 2025 LB UA',
  },

  portable: {
    artifactName: "${productName}-${os}-Portable.${ext}",
  },

  linux: {
    target: ['AppImage', 'rpm'],
    category: 'Utility',
    maintainer: 'LB UA <info@littlebit.org.ua>',
    // Steam Deck compatibility
    executableArgs: ['--no-sandbox', '--disable-gpu-sandbox'],
  },

  nsis: {
    oneClick: true,
    perMachine: false,
    allowToChangeInstallationDirectory: false,
    deleteAppDataOnUninstall: false,
    differentialPackage: true,
    artifactName: "${productName}-${os}-Setup.${ext}",
    language: "1058",
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "LBK Launcher",
    runAfterFinish: true,
    menuCategory: false,
  },

  mac: {
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64'],
      },
    ],
    category: 'public.app-category.utilities',
    icon: 'resources/icon.icns',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    darkModeSupport: true,
    minimumSystemVersion: '10.13.0',
    artifactName: '${productName}-${version}-${arch}.${ext}',
    // Підписування: використовує CSC_LINK та CSC_KEY_PASSWORD з env
    entitlements: 'resources/entitlements.mac.plist',
    entitlementsInherit: 'resources/entitlements.mac.plist',
    notarize: true,
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
      height: 380,
    },
    icon: 'resources/icon.icns',
    backgroundColor: '#323232',
    artifactName: '${productName}-${version}-${arch}.${ext}',
  },
};
