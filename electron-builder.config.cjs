/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
module.exports = {
  appId: 'com.littlebit.launcher',
  productName: 'LB Launcher',
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

  asarUnpack: ['**/*.node'],

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
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    allowElevation: false,
    deleteAppDataOnUninstall: false,
    differentialPackage: true,
    artifactName: "${productName}-${os}-Setup.${ext}",
    language: "1058",
    installerLanguages: ["uk_UA"],
    unicode: true,
    include: "resources/installer.nsh",
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "LB Launcher",
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
    hardenedRuntime: false,  // Вимкнено без сертифіката
    gatekeeperAssess: false,
    darkModeSupport: true,
    minimumSystemVersion: '10.13.0',
    artifactName: '${productName}-${version}-${arch}.${ext}',
    identity: null, 
    notarize: false, // Вимкнути нотаризацію
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
