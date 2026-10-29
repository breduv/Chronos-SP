// Personal Chronos-SP distribution. Never publish to upstream release channels.
module.exports = {
  extends: './electron-builder.yaml',
  appId: 'io.github.breduv.chronossp',
  productName: 'Chronos-SP',
  extraMetadata: {
    name: 'chronos-sp',
    productName: 'Chronos-SP',
    version: '19.3.1-chronos.1',
  },
  directories: { output: '.tmp/chronos-builds' },
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    executableName: 'Chronos-SP',
    publish: null,
  },
  nsis: {
    artifactName: 'Chronos-SP-Setup-19.3.1-chronos.1-x64.${ext}',
    shortcutName: 'Chronos-SP',
    uninstallDisplayName: 'Chronos-SP',
  },
  publish: null,
};
