# luoye-artboard · 落叶画板

面向儿童的离线绘画客户端，当前版本 **1.6.4**。macOS 使用 Swift / WKWebView，Windows 使用 .NET / WebView2，共用本地绘画引擎和界面；正式客户端不运行 HTTP 服务。

支持九种画笔、图层、魔法袋、动画伙伴、背景与涂色页、文字、分形、滤镜和音乐。未保存修改退出时可选择保存并退出、不保存退出或继续画画。Mac 已完成原生验证；Windows 已交叉构建，尚未实机验收。

## 构建

需要 Node.js 22+。Mac 另需 Xcode Command Line Tools 和 macOS SDK；Windows 构建需 .NET 10 SDK。

```sh
npm test
npm run build:mac
npm run build:windows
```

两个平台的构建请依次执行。产物放在 `build/releases/v1.6.4/`，不提交 Git。`npm run dev` 仅用于开发验收。

Windows 可通过 `LUOYE_DOTNET` 指定 SDK；需将官方 Microsoft Edge WebView2 x64 离线安装器放在 `build/tooling/MicrosoftEdgeWebView2RuntimeInstallerX64.exe`。首次还原 NuGet 依赖需要网络。完整环境记录见 [环境记录](design/06-environment-log.md) 和版本设计文档。

## 仓库内容

- `src/`：绘画引擎与界面。
- `native/`：Mac、Windows 宿主和运行必需的音乐音色库及许可。
- `public/`：当前运行资源，包含 1,132 个素材入口及新动画矢量源码。
- `tests/`、`tools/`：验证与构建工具。
- `design/versions/`：分版本设计、变更和文本验证记录。

不上传构建产物、SDK、缓存、测试截图和测试工程；已废弃素材与大型重制母版保留在本地 `local-only/`，不参与运行和标准构建。素材重制工具属于离线制作流程，可能需要本地归档母版、原始安装文件和额外图像处理环境。

原版安装文件 `local-only/reference/` 不提交。数据格式、数据库及原生应用标识已统一为 luoye；同结构旧工程支持导入，同源旧草稿复制迁移并保留原数据。项目名称为 `luoye-artboard`，应用显示名称仍为“落叶画板”。

远程仓库为 `git@github.com:zxxf18/luoye-artboard.git`。`main` 从清理后的版本建立；此前完整 Git 历史保留在本地分支与标签，没有推送到远程。历史设计内的旧产物、截图和母版链接可能仅在本地归档中可用。

[版本记录](CHANGELOG.md) · [设计索引](design/versions/README.md)
