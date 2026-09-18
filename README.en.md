<p align="center">
  <img src="public/branding/app-icon-windows.png" alt="Luoye Artboard app icon" width="128" height="128">
</p>

<h1 align="center">Luoye Artboard · 落叶画板</h1>

<p align="center"><strong>A little painting studio for big imaginations.</strong></p>

<p align="center">Draw, color, and build little worlds with an offline desktop painting app for children.</p>

<p align="center">
  <a href="README.md">简体中文</a> ·
  <a href="#getting-started">Get started</a> ·
  <a href="#features">Features</a> ·
  <a href="#system-requirements">System requirements</a> ·
  <a href="#build-from-source">Build</a>
</p>

## About Luoye

- **Start with a blank page or a landscape.** Choose a background, add characters, and make the scene your own
- **Explore at your own pace.** Illustrated tools, brush previews, and a warm color palette help children find their way around
- **Keep creating offline.** Artwork, drafts, the art library, and music stay on your device

![Luoye Artboard desktop app with a mountain lake background and painting tools](docs/images/interface.png)

## Features

| | What you can do |
| --- | --- |
| **Nine brushes** | Sketch with a pencil, spray soft dots, layer watercolor, or try a brush, marker, crayon, chalk, paint tube, and star brush. |
| **Backgrounds and coloring pages** | Start a picture in a forest, by a lake, on a farm, or in space; fill and paint themed coloring pages. |
| **Magic bag and animated characters** | Stamp individual pictures, combine patterns, and add moving characters to a scene. |
| **Layers and editing** | Move, resize, rotate, mirror, duplicate, and hide objects; undo and redo while you experiment. |
| **Shapes, text, and effects** | Draw shapes, add words, select and clone areas, and explore warps and image filters. |
| **Music and tool sounds** | Draw along to 20 built-in MIDI tracks; adjust music and tool sound volumes separately. |
| **Save and share** | Save editable projects, recover local drafts, import pictures, and export artwork as PNG or JPEG. |

## Getting started

1. Open [Releases](https://github.com/zxxf18/luoye-artboard/releases) and choose the package for your system
2. Launch Luoye Artboard and start with a blank page, or choose **Gallery → Colored backgrounds** to set a scene
3. Pick a brush or open the magic bag. Save your project to keep editing, or export an image to share

The current interface is in Simplified Chinese. See the [build guide](docs/build.md) to run the editor from source

## System requirements

### macOS

- macOS 13 or later
- Apple Silicon (arm64)

### Windows

- Windows 10 or Windows 11
- x64 architecture
- Microsoft Edge WebView2 Runtime
- .NET runtime bundled with the app
- .NET 10 Desktop Runtime required by the installer

## Build from source

### Editor and tests

- Node.js 22 or later

### macOS app

- macOS
- Xcode Command Line Tools with Swift 6
- macOS SDK

### Windows app

- .NET 10 SDK
- WebView2 x64 offline installer

### Windows installer

- A built Windows app
- .NET 10 SDK
- 7-Zip

```sh
npm test
npm run dev
```

Open `http://127.0.0.1:4173` for the browser preview. To package a desktop app, run the command for your target

```sh
npm run build:mac
# or
npm run build:windows
```

See the [build guide](docs/build.md) for tool paths and installer packaging

## macOS installation note

Without a paid Apple Developer membership, the macOS app is unsigned and unnotarized, so Gatekeeper may block it with a “damaged” message; that message alone does not establish file corruption

Download the package from this project's release page and compare its SHA-256 with the published value, replacing `{package_path}` with the downloaded file's path

```sh
shasum -a 256 "{package_path}"
```

After confirming a trusted source and a matching checksum, run this command and replace `{app_path}` with the extracted `.app` path

```sh
sudo xattr -rd com.apple.quarantine "{app_path}"
```

Then open the app again

## Learn more

- [Documentation](docs/README.md) · Build, assets, and local development
- [Report an issue](https://github.com/zxxf18/luoye-artboard/issues) · Features, layout, or bugs
- [License](LICENSE) · AGPLv3
- [Donate](docs/donate.md) · Buy the author a coffee
