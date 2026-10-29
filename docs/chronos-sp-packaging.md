# Chronos-SP personal installers

These packages use the existing production Angular build. Windows is an x64
NSIS installer; Android is a release-signed F-Droid flavor with the full interface
inside the APK, forced to offline launch mode. No local server is required.

## Build in WSL

Install the Node version in `.nvmrc`, project dependencies, Linux JDK 21, Android
SDK platform 36/build-tools 35.0.0, and Wine with 32-bit support. Windows tooling
such as Visual Studio and Android Studio is not required.

```bash
bash tools/chronos-package.sh windows
bash tools/chronos-package.sh android
# Or both:
bash tools/chronos-package.sh all
```

The builder configuration is [electron-builder.chronos.cjs](../electron-builder.chronos.cjs).
Outputs are `.tmp/chronos-builds/Chronos-SP-Setup-19.3.1-chronos.2-x64.exe`
and `android/app/build/outputs/apk/fdroid/release/app-fdroid-release.apk`.
Android staging is replaced before copying, so chunks from older frontend builds
do not remain in the APK.
The script does not publish releases or upload builds. Update notifications query
the Chronos-SP GitHub releases and link to this fork. Until a release is published,
automatic checks fail quietly; a manual check can report an unavailable release.

The frontend retains its upstream base version (19.3.1); package versions add
`-chronos.1`. Increase the Android `versionCode` for each future release and update
the package version/artifact names together. Preserve both application IDs.

## Signing and reinstalling

Windows uses the stable app ID `io.github.breduv.chronossp`, product name
`Chronos-SP`, and profile `%APPDATA%\Chronos-SP`. The installer has no publisher
certificate. This does not prevent reinstalling or updating; Windows can show an
unknown-publisher warning. Normal in-place installation retains the profile.
Deleting the profile or opting to remove user data removes the local database;
export a backup or sync before a deliberate full reset.

Android uses `io.github.breduv.chronossp` independently of the retained Kotlin
namespace. Static shortcuts target that application ID and the original fully
qualified activity class. The APK does not replace the original upstream app.

Android updates need the same private key, package ID, and a higher versionCode.
The personal key and its environment file are outside Git:

- WSL: `~/.local/share/chronos-sp/signing/chronos-sp.jks` and `release.env`
- Private Windows backup: `C:\Users\gleb\.chronos-sp\signing\`

Keep this directory when reinstalling WSL or rebuilding the project. Restore it
to the WSL path before building. Do not publish the key or the environment file.
An app reinstall does not require these files; they are needed to build future
compatible APKs.

The packaging script loads `release.env`, or accepts the standard
`RELEASE_KEYSTORE_FILE`, `RELEASE_KEYSTORE_ALIAS`, `RELEASE_KEYSTORE_PASSWORD`,
and `RELEASE_KEY_PASSWORD` environment variables. Credentials are never committed.
`-PchronosLaunchMode=2` makes the APK use its bundled UI without changing local
developer launch preferences.

## Verification

Check the actual packaged executable, not only the development server. The first
Windows package was launched on Windows with a temporary profile: Russian default,
quick activity start/stop, completed interval, and history after reload all passed.
The NSIS archive integrity and packaged Electron relative requires also passed.

APK signature, package identity, bundled frontend, and native JVM tests are
checked separately. The first package passed 208 native JVM tests with no
failures or skips. Generate their inputs with
`node tools/generate-android-crypto-fixtures.mjs` before running
`./gradlew testFdroidReleaseUnitTest -PchronosLaunchMode=2` from `android/`. A completed build is not evidence of device-specific Android
background reminder delivery; that still needs a real device or emulator.
