<p align="center">
  <img src="public/branding/app-icon.png" alt="落叶画板" width="96">
</p>

<h1 align="center">落叶画板</h1>

<p align="center">一款面向儿童的离线跨平台绘画工作室。</p>

<p align="center"><a href="README.md">English</a> · <a href="LICENSE">许可证</a></p>

![落叶画板界面](docs/images/interface.png)

## 主要功能

- **亲切的绘画工作室**：铅笔、喷笔、水彩、麦克笔、蜡笔、粉笔和特效笔。
- **易于理解的图层**：移动、缩放、旋转、镜像、复制、隐藏和撤销。
- **丰富的本地素材库**：背景、贴纸、画框、纸张、纹理、涂色页和动画角色。
- **创作工具**：文字、填色、选区、仿制、变形和图像滤镜。
- **音乐与音效反馈**：20 首本地 MIDI 音乐，可独立调节音量。
- **隐私优先**：编辑器离线运行，草稿保存在本机。
- **跨平台桌面应用**：macOS 与 Windows 原生宿主共用同一套编辑器引擎。

## 系统要求

- macOS 应用需要 macOS 12 或更高版本。
- Windows 应用需要 Windows 10 或更高版本，并安装 WebView2。
- 建议至少 4 GB 内存。
- 完整源码和内置素材约需 1 GB 可用磁盘空间。

## 构建要求

- Node.js 22 或更高版本。
- macOS 构建需要 Xcode Command Line Tools 和 macOS SDK。
- Windows 构建需要 .NET 10 SDK 和 WebView2 Runtime。

```sh
npm install
npm test
npm run build:mac
npm run build:windows
npm run build:windows:installer
```

架构和素材说明请参阅 [`docs/`](docs/)。

如果落叶画板对你有帮助，可以[请我喝杯咖啡](https://www.buymeacoffee.com/)。
