# 落叶画板

基于金山画王安装文件分析和重新实现的离线儿童绘画客户端。用户确认的暖色界面基线固定为 Git 标签 `v1`（3ee9968，历史源码版本 0.4.0），后续工作分批提交，当前分支为 `codex/v1.5-fairy-animation-filters`。

当前版本 1.5.0：macOS Apple Silicon 原生客户端与 Windows amd64 原生客户端。共用本地绘画界面和 Canvas 引擎，不运行本地 HTTP 服务，不依赖外部网页。Windows 构建已完成，Windows 实机验收尚未完成。

## 运行

macOS：双击 `build/落叶画板.app`。

Windows：完整解压 `build/落叶画板-1.5.0-windows-amd64.zip`，双击 `落叶画板.exe`；缺少 WebView2 时运行随包提供的微软 x64 离线安装器。无需 Node.js 或 .NET SDK。

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

客户端已接入全部 1,117 个原版条目：背景 99、角色 675（含 1 张原版备用帆船）、动画 45、仙女袋 154、相框 41、纸样 21、纹理 82。原库解码输出 3,153 张图，原仙女袋 1,825 帧及分组保留为来源记录，154 个入口已替换为新绘图案（470 组、1,044 张播放图）；修正了 20 对纹理编号冲突。在原库对应入口中，30 张黑白底稿已按原主题新绘。本轮另新增 6 张涂色页、4 个相框、1 张彩色背景，加上既有新绘入口，运行索引共 1132 个条目。图库按分类翻页、图片按需读取。

**仙女袋全量重绘完成，其他原库的全量高清重制仍未完成。** 仙女袋单图与静态组合使用 132 张新生成母图；动态包使用 82 组原创矢量动画并保留 2048×2048 母图。客户端按显示与播放需求使用切片，动态帧上限 480 像素。静态生成母图实际为 1254×1254，组合切片小于母图，不能统一称为单张 2K。来源、具体尺寸和验证结果见 `design/16-fairy-animation-filters.md`。

复现素材导出：使用带 Pillow / NumPy 的 Python 运行 `tools/prepare-full-library.py`，再运行 `tools/publish-library.py`。前者只读原安装目录，后者更新客户端素材目录与索引。

原始 `jshw/` 保持只读，不提交到 Git；已有源文件 SHA256 清单位于 `design/evidence/files.csv`。原安装程序不属于跨平台运行依赖。

## 文档

- `design/01-current-state.md` 至 `design/05-implementation-plan.md`：安装包分析与还原路线。
- `design/11-child-friendly-interaction.md`：v1 暖色儿童界面基线和画笔迭代。
- `design/12-v1-upgrade.md`：本轮设计、保存可靠性、音乐根因、Windows 环境记录与验收状态。
- `design/16-fairy-animation-filters.md`：仙女袋重绘、动画缩放、滤镜响应与调色交互。
- `CHANGELOG.md`：版本变化。
- `public/branding/PROVENANCE.md`：用户照片卡通图标的生成记录。

尚未实现的原版算法或尚未验证的还原行为继续在 design 中明确标注，不宣称与原版完全等价。

1.2 修复：笔迹／宽窄放到第一屏，底部素材栏不再挤小画纸；仙女袋支持预览、调大小、长按连续画，动态图整笔归层；背景替换、橡皮后重画和 Mac 画板刷新已补回归。图层改成卡片与常用动作，更多操作可展开。详情见 [交互修复记录](design/13-layer-and-fairy-interaction.md)。

1.3 修复：默认整张画纸绘画与填色；橡皮擦除每个已存在的前景图层，保留动画和独立移动；后续笔迹、新背景不继承擦除区域。变形、暗房和仿制覆盖整张画；涂鸦／直线用图示互斥按钮，预览使用实际画笔算法；移除操作 toast，异常在底栏显示。含擦除蒙版的工程使用格式版本 2，1.3 可读旧工程；旧客户端会拒绝新格式，避免静默丢失擦除结果。

1.4 修复：相框四边贴合画纸，动态仙女袋预览不再带虚线框。独立涂色本提供 30 张原主题新绘和 6 张新主题，新增 4 个卡通相框与 1 张彩色背景。素材栏、卡片数量和画笔设置随窗口变化，打开图库保持画纸框不变。详情见 [相框与涂色本记录](design/15-frames-coloring-responsive.md)。
