<p align="center">
  <img src="public/branding/app-icon.png" alt="落叶画板 App 图标" width="128" height="128">
</p>

<h1 align="center">落叶画板 · Luoye Artboard</h1>

<p align="center"><strong>小小画室，装下大大的想象。</strong></p>

<p align="center">一款面向儿童的离线桌面绘画应用，涂涂画画，拼出自己的小世界。</p>

<p align="center">
  <a href="README.en.md">English</a> ·
  <a href="#开始画画">开始画画</a> ·
  <a href="#主要功能">主要功能</a> ·
  <a href="#系统要求">系统要求</a> ·
  <a href="#从源码构建">源码构建</a>
</p>

## 认识落叶画板

- **从白纸或一片风景开始。** 选个背景，放上喜欢的小伙伴，再添上自己的想象。
- **按自己的节奏探索。** 图示工具、画笔预览和温暖的配色，帮助孩子找到想用的工具。
- **离线也能安心创作。** 作品、草稿、素材库和音乐都保存在本机。

![落叶画板桌面应用：山间蓝湖背景与绘画工具](docs/images/interface.png)

## 主要功能

| | 可以怎么玩 |
| --- | --- |
| **九种画笔** | 用铅笔勾线、喷笔画点、水彩叠色，也可以试试刷子、麦克笔、蜡笔、粉笔、颜料管和星光笔。 |
| **背景与涂色本** | 在森林、湖边、农场或太空开始一幅画，也可以给不同主题的涂色页填色、添画。 |
| **魔法袋与动画伙伴** | 盖上单张图案、组合花样，把会动的小伙伴放进画里。 |
| **图层与编辑** | 移动、缩放、旋转、镜像、复制和隐藏画中元素；尝试过程中随时撤销、重做。 |
| **图形、文字与特效** | 画图形、写文字、圈选与仿制局部，再试试变形和图像滤镜。 |
| **音乐与工具音效** | 伴着 20 首内置 MIDI 音乐画画，分别调节音乐与工具音效的音量。 |
| **保存与分享** | 保存可继续编辑的工程、恢复本地草稿、导入图片，将作品导出为 PNG 或 JPEG。 |

## 开始画画

1. 打开[发布页面](https://github.com/zxxf18/luoye-artboard/releases)，选择适合自己系统的安装包。
2. 启动落叶画板，从白纸开始，或通过 **图库 → 彩色背景** 选一片风景。
3. 拿起画笔或打开魔法袋。保存工程方便继续编辑，导出图片方便分享。

当前界面为简体中文。从源码运行编辑器的方式见[构建指南](docs/build.zh-CN.md)。

## 系统要求

| 平台 | 要求 |
| --- | --- |
| **macOS** | macOS 13 或更高版本，Apple Silicon（arm64）。 |
| **Windows** | Windows 10/11，x64，安装 Microsoft Edge WebView2 Runtime。应用自带 .NET 运行时；安装器需要 .NET 10 Desktop Runtime。 |

## 从源码构建

| 目标 | 所需工具 |
| --- | --- |
| **编辑器与测试** | Node.js 22 或更高版本。 |
| **macOS 应用** | macOS、包含 Swift 6 的 Xcode Command Line Tools，以及 macOS SDK。 |
| **Windows 应用** | .NET 10 SDK、WebView2 x64 离线安装器。 |
| **Windows 安装器** | 已构建的 Windows 应用、.NET 10 SDK 和 7-Zip。 |

```sh
npm test
npm run dev
```

在浏览器中打开 `http://127.0.0.1:4173` 预览。打包桌面应用时，按目标平台运行：

```sh
npm run build:mac
# 或
npm run build:windows
```

工具路径和安装器打包步骤见[构建指南](docs/build.zh-CN.md)。

## 更多信息

[文档](docs/README.md) · [反馈问题](https://github.com/zxxf18/luoye-artboard/issues) · [许可证](LICENSE)

如果落叶画板对你有用，可以请我喝杯咖啡。
