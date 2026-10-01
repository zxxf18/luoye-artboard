# Build guide

[简体中文](build.zh-CN.md) · [Back to the project](../README.en.md)

## Preview and test

Install Node.js 22 or later. The editor has no npm package dependencies.

```sh
npm test
npm run dev
```

Open `http://127.0.0.1:4173`. This browser preview runs the shared editor; native file dialogs and MIDI playback are provided by the desktop hosts.

## macOS app

Build on macOS with Xcode Command Line Tools, Swift 6, and the macOS SDK:

```sh
npm run build:mac
```

The current target is Apple Silicon (arm64), macOS 13+. The application is written to `build/releases/v<version>/落叶画板.app`, where `<version>` comes from `package.json`. The build script does not sign or notarize the app.

## iPhone / iPad app

The iOS target uses UIKit and WKWebView, supports iOS 16+, and includes both iPhone and iPad. A full Xcode installation is required; Command Line Tools do not include the iOS SDK or Simulator:

```sh
npm run build:ios
```

This builds a Simulator app by default. Use `SDK=iphoneos CONFIGURATION=Release npm run build:ios` for a device build. The script rebuilds `dist/`, copies the web resources and SoundFont into the ignored `ios/Resources/` staging directory, and invokes `xcodebuild`. File import/export uses the system document picker, while drafts and the gallery use persistent WKWebView storage. Touch, Apple Pencil, audio interruptions, background recovery, and iPad split views must be checked on Simulator and a real device separately.

## Windows app

Install the .NET 10 SDK. The build script uses `LUOYE_DOTNET` when set, then a local SDK under `build/tooling/dotnet/`, then `dotnet` on PATH.

Place the official WebView2 x64 offline installer at:

```text
build/tooling/MicrosoftEdgeWebView2RuntimeInstallerX64.exe
```

Then run:

```sh
npm run build:windows
```

The x64 application is written to `build/releases/v<version>/windows-amd64/` with its .NET runtime. The first NuGet restore requires network access. Cross-building a package does not verify it on Windows; run the app on the target system before distributing it.

## Windows installer

Build the Windows app first. The current packaging script also requires a 7-Zip executable at `build/tooling/7zip-26.02/7zz` and a .NET SDK at `build/tooling/dotnet/dotnet`, or an explicit `LUOYE_DOTNET` path.

```sh
npm run build:windows:installer
```

The installer is written to `build/releases/v<version>/windows-installer/`. Distribute the whole folder together: the installer needs its companion DLL and JSON files, and .NET 10 Desktop Runtime on the target machine.

Build one desktop target at a time; the packaging scripts share the generated editor resources.
