# 落叶画板

基于金山画王安装文件分析和重新实现的离线儿童绘画客户端。用户确认的暖色界面基线固定为 Git 标签 `v1`（3ee9968，历史源码版本 0.4.0），后续工作在 `feature/v1-library-upgrade` 分批提交。

当前版本 1.2.0：macOS Apple Silicon 原生客户端与 Windows amd64 原生客户端。共用本地绘画界面和 Canvas 引擎，不运行本地 HTTP 服务，不依赖外部网页。Windows 构建已完成，Windows 实机验收尚未完成。

## 运行

macOS：双击 `build/落叶画板.app`。

Windows：完整解压 `build/落叶画板-1.2.0-windows-amd64.zip`，双击 `落叶画板.exe`；缺少 WebView2 时运行随包提供的微软 x64 离线安装器。无需 Node.js 或 .NET SDK。

默认新建 1920×1080 白纸，支持 2K 和可调整窗口、三档按钮大小。音乐默认 35% 音量播放。正常关闭会先保存工程与 PNG 到系统「图片／落叶画板作品／会话编号-修订号」。保存失败保持窗口打开。旧草稿保留在画夹「自动保留」。

## 本地构建与验证

```sh
npm test
npm run build:mac
npm run build:windows
```

Mac 构建需 Swift / macOS SDK。Windows 交叉构建用 `.NET SDK 10.0.400`，本机已安装在 `build/tooling/dotnet`；可通过 `LUOYE_DOTNET` 指定其他安装位置。构建会读取 `build/tooling/MicrosoftEdgeWebView2RuntimeInstallerX64.exe` 并复制到交付目录。依赖版本、安装位置、校验和与首次启动影响见 `design/12-v1-upgrade.md`。Windows NuGet 锁文件纳入 Git。

`npm run dev` 只用于开发验收，不是最终产品的运行方式。

## 素材状态

客户端目前仍是 38 组素材，不能视为已完成全库高清重制。原版完整库已解码为 1117 条目、3133 张图（含帧和封面），放在 `build/remaster/original`，清单位于 `build/remaster/manifest.json`。154 个仙女袋包 / 1825 帧已全部解析，异常修复有记录。待用户确认批量 AI 超分辨率或全部重绘方式后执行高清处理与替换。

原始 `jshw/` 保持只读，不提交到 Git；已有源文件 SHA256 清单位于 `design/evidence/files.csv`。原安装程序不属于跨平台运行依赖。

## 文档

- `design/01-current-state.md` 至 `design/05-implementation-plan.md`：安装包分析与还原路线。
- `design/11-child-friendly-interaction.md`：v1 暖色儿童界面基线和画笔迭代。
- `design/12-v1-upgrade.md`：本轮设计、保存可靠性、音乐根因、Windows 环境记录与验收状态。
- `CHANGELOG.md`：版本变化。
- `public/branding/PROVENANCE.md`：用户照片卡通图标的生成记录。

尚未实现的原版算法或尚未验证的还原行为继续在 design 中明确标注，不宣称与原版完全等价。

1.2 修复：笔迹／宽窄放到第一屏，底部素材栏不再挤小画纸；仙女袋支持预览、调大小、长按连续画，动态图整笔归层；背景替换、橡皮后重画和 Mac 画板刷新已补回归。图层改成卡片与常用动作，更多操作可展开。详情见 [交互修复记录](design/13-layer-and-fairy-interaction.md)。
