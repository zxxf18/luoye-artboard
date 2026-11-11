# 构建指南

[English](build.md) · [返回项目首页](../README.md)

## 预览与测试

安装 Node.js 22 或更高版本。编辑器没有 npm 包依赖。

```sh
npm test
npm run dev
```

打开 `http://127.0.0.1:4173`。浏览器预览运行共用的编辑器；原生文件对话框和 MIDI 播放由桌面宿主提供。

网站构建使用 `npm run build`，会保留可选的远程统计脚本。客户端构建使用 `npm run build:client`，会在构建期移除该脚本；macOS、Windows、Android 和 iOS 构建都使用客户端变体。

## macOS 应用

在 macOS 上构建，需要 Xcode Command Line Tools、Swift 6 和 macOS SDK：

```sh
npm run build:mac
```

当前目标为 Apple Silicon（arm64）、macOS 13+。应用输出到 `build/releases/v<version>/落叶画板.app`，其中 `<version>` 取自 `package.json`。构建脚本会移除网站统计脚本，但不执行应用签名和公证。

## 离线 Web App

```sh
npm run build:web:offline -- --store
```

将 `build/offline/` 发布到固定的 HTTPS 地址，例如 `https://board.yebuluo.com.cn/offline/`。仓库的 Docker 构建会把上线版离线包放到 `/offline/`。静态托管时保留目录结构，让 `/offline/` 返回 `index.html`，缺失的资源返回 404，并允许浏览器重新验证 `offline-worker.js` 与 `offline-precache.json`。本机可用 `python3 -m http.server 4173 --bind 127.0.0.1 --directory build` 在 `http://127.0.0.1:4173/offline/` 验证。

在 iPad 的 Safari 里打开离线版地址，点「分享 → 添加到主屏幕」。从主屏幕打开画板，保持联网直到显示「离线下载完成」。此后断网也能打开画板，草稿会自动保存在设备上，重开时可继续。Safari 普通网页、离线版和原生版的草稿分别保存，迁移作品时用「保存作品」导出工程文件，再在目标版本打开。离线包首次下载约 203 MiB，已安装的旧版会保留到新版下载完成并关闭旧页面。

已安装 Playwright 时，可以运行 `node tools/offline-web-acceptance.mjs` 验证本地构建的离线重开、素材读取、触控画画与草稿恢复。

## iPhone / iPad 应用

iOS 版本使用 UIKit + WKWebView。默认构建支持 iOS/iPadOS 16+，iPad 专用构建支持 iPadOS 15.8+。构建需要完整 Xcode（Command Line Tools 不包含 iOS SDK 和模拟器）：

```sh
npm run build:ios
```

构建 iPad 专用真机包时使用 `IOS_DEVICE=ipad SDK=iphoneos CONFIGURATION=Release npm run build:ios`。

默认输出模拟器应用。构建真机包时使用 `SDK=iphoneos CONFIGURATION=Release npm run build:ios`。脚本会先生成不含网站统计脚本的客户端 `dist/`，再将资源和音色库复制到临时的 `ios/Resources/`，最后调用 `xcodebuild`。文件保存/导入使用系统文档面板，画夹和草稿使用 WKWebView 持久化存储。iPad 固定全屏横屏；尺寸、触控、Apple Pencil、音频中断和后台恢复需要在模拟器及真机分别验收，不能只用浏览器测试替代。

## Windows 应用

安装 .NET 10 SDK。构建脚本优先使用 `LUOYE_DOTNET`，其次使用 `build/tooling/dotnet/` 下的本地 SDK，最后使用 PATH 中的 `dotnet`。

将官方 WebView2 x64 离线安装器放到：

```text
build/tooling/MicrosoftEdgeWebView2RuntimeInstallerX64.exe
```

然后运行：

```sh
npm run build:windows
```

x64 应用及其 .NET 运行时输出到 `build/releases/v<version>/windows-amd64/`，客户端资源不包含网站统计脚本。首次还原 NuGet 包需要联网。交叉构建出安装包不等于已在 Windows 上验证；分发前需在目标系统运行检查。

## Windows 安装器

先构建 Windows 应用。当前打包脚本还需要 `build/tooling/7zip-26.02/7zz` 中的 7-Zip 可执行文件，以及 `build/tooling/dotnet/dotnet` 中的 .NET SDK，或通过 `LUOYE_DOTNET` 显式指定 SDK 路径。

```sh
npm run build:windows:installer
```

安装器输出到 `build/releases/v<version>/windows-installer/`。分发时保留整个目录：安装器需要同目录的 DLL、JSON 文件，以及目标系统上的 .NET 10 Desktop Runtime。

桌面构建共用生成的编辑器资源，请依次构建各平台。
