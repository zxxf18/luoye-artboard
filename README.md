<p align="center">
  <img src="public/branding/app-icon.png" alt="Luoye Artboard" width="96">
</p>

<h1 align="center">Luoye Artboard</h1>

<p align="center">An offline, cross-platform painting studio for children.</p>

<p align="center"><a href="README.zh-CN.md">中文版</a> · <a href="LICENSE">License</a></p>

![Luoye Artboard interface](docs/images/interface.png)

## Highlights

- **A friendly painting studio** — pencil, spray, watercolor, marker, crayon, chalk, and effect brushes.
- **Layers that are easy to understand** — move, resize, rotate, mirror, duplicate, hide, and undo.
- **A large local art library** — backgrounds, stickers, frames, paper, textures, coloring pages, and animated characters.
- **Creative tools** — text, color fill, selections, cloning, warps, and image filters.
- **Music and sound feedback** — twenty local MIDI tracks with independent volume controls.
- **Private by design** — the editor works offline and keeps drafts on the device.
- **Cross-platform desktop apps** — native macOS and Windows hosts share the same editor engine.

## System requirements

- macOS 12 or later for the macOS app.
- Windows 10 or later with WebView2 for the Windows app.
- 4 GB RAM recommended.
- About 1 GB free disk space for the full source checkout and bundled artwork.

## Build requirements

- Node.js 22 or later.
- macOS builds: Xcode Command Line Tools and the macOS SDK.
- Windows builds: .NET 10 SDK and the WebView2 Runtime.

```sh
npm install
npm test
npm run build:mac
npm run build:windows
npm run build:windows:installer
```

For architecture and asset details, see [`docs/`](docs/).

If Luoye Artboard is useful to you, you can [buy me a coffee](https://www.buymeacoffee.com/).
