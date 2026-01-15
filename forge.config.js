const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    name: 'Baristaflow',
    asar: true,
    icon: './assets/logo', // Electron will use .ico on Windows, .icns on macOS
    // Relative path from Desktop/ to the built Frontend assets
    extraResource: ['../Frontend/dist'],
  },
  rebuildConfig: {},
  outDir: 'production-exe',
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'Baristaflow',
        setupExe: 'Baristaflow-Setup.exe',
        iconUrl: 'file:///' + __dirname + '/assets/logo.ico',
        setupIcon: './assets/logo.ico',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Enable Electron fuses for security hardening
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
