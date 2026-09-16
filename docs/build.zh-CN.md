# 构建指南

[English](build.md) · [返回项目首页](../README.md)

## 预览与测试

安装 Node.js 22 或更高版本。编辑器没有 npm 包依赖。

```sh
npm test
npm run dev
```

打开 `http://127.0.0.1:4173`。浏览器预览运行共用的编辑器；原生文件对话框和 MIDI 播放由桌面宿主提供。

## macOS 应用

在 macOS 上构建，需要 Xcode Command Line Tools、Swift 6 和 macOS SDK：

```sh
npm run build:mac
```

当前目标为 Apple Silicon（arm64）、macOS 13+。应用输出到 `build/releases/v<version>/落叶画板.app`，其中 `<version>` 取自 `package.json`。构建脚本不执行应用签名和公证。

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

x64 应用及其 .NET 运行时输出到 `build/releases/v<version>/windows-amd64/`。首次还原 NuGet 包需要联网。交叉构建出安装包不等于已在 Windows 上验证；分发前需在目标系统运行检查。

## Windows 安装器

先构建 Windows 应用。当前打包脚本还需要 `build/tooling/7zip-26.02/7zz` 中的 7-Zip 可执行文件，以及 `build/tooling/dotnet/dotnet` 中的 .NET SDK，或通过 `LUOYE_DOTNET` 显式指定 SDK 路径。

```sh
npm run build:windows:installer
```

安装器输出到 `build/releases/v<version>/windows-installer/`。分发时保留整个目录：安装器需要同目录的 DLL、JSON 文件，以及目标系统上的 .NET 10 Desktop Runtime。

桌面构建共用生成的编辑器资源，请依次构建各平台。
