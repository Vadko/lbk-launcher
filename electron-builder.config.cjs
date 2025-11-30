/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
module.exports = {
  appId: 'com.littlebit.launcher',
  productName: 'Little Bit',
  copyright: 'Copyright © 2024 Little Bit UA',

  directories: {
    buildResources: 'resources',
    output: 'release/${version}',
  },

  files: ['out/**/*'],

  asarUnpack: ['**/*.node'],

  electronLanguages: ['en-US', 'uk'],

  artifactName: "${productName}-${os}.${ext}",

  compression: 'store',

  publish: [
    {
      provider: 'github',
      owner: 'Vadko',
      repo: 'littlebit-launcher',
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
    verifyUpdateCodeSignature: false,
  },

  linux: {
    target: ['AppImage', 'rpm'],
    category: 'Utility',
    maintainer: 'Little Bit UA <info@littlebit.org.ua>',
  },

  nsis: {
    oneClick: true,
    perMachine: false,
    allowToChangeInstallationDirectory: false,
    deleteAppDataOnUninstall: false,
    differentialPackage: true,
  },

  electronDist: 'node_modules/electron/dist',
  electronVersion: '28.0.0',
};
