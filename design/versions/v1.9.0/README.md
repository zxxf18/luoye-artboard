# v1.9.0 · 画笔与工具反馈

九种画笔、橡皮、油漆桶、魔法袋、圈选、几何、变形、滤镜和其他工具，共 54 种状态使用独立图示光标和短切换音效。光标复用工具栏的绘本图示，尺寸为 40×40，左上角定位点对应画纸上的实际操作位置。切换由最终工具状态统一驱动；重复选择同一状态不重复发声，快速切换停止上一段音效。

音乐盒统一控制画笔和工具音效，默认开启，兼容已有的关闭设置。背景音乐记住内置曲目、音量、播放/停止状态；零音量也会保留。原生音乐加载支持不自动播放，避免重启时短暂发声再停止。音乐与音效设置独立于画纸重置。外部导入 MIDI 的文件内容仍只在当前会话使用。

验收发现渐变图示的 SVG ID 与 `fill-gradient` 复选框重名，已分配独立图示 ID，防止读取或切换渐变时选错控件。

验证结果：

- 50 项 Node 测试通过，覆盖偏好恢复、错误存储、静音期间取消待播放音效、工具状态和独立音色等。
- 浏览器实际逐项点击全部 54 种状态；SVG 解码后逐像素摘要各不相同，OfflineAudioContext 渲染出的 54 段声音也各不相同且峰值低于 0.1。
- 独立 Chrome 配置完整关闭重启：恢复音乐 17、2% 音量、停止状态和音效关闭；开启音效及播放状态也能恢复。音乐设置测试使用测试专用原生消息模拟器，不冒充真实 MIDI 播放验证。
- 1440×900、900×650 音乐窗口与键盘开关验收通过，未捕获未处理的浏览器异常。
- macOS WKWebView 实机验收 12 项通过：真实 Web Audio 上下文运行、非零音效采样峰值约 0.044、静音有效、SVG 光标解码、真实原生 MIDI 操作，以及 WebView 重载后恢复音乐 17、23% 音量、停止状态和关闭音效。
- macOS 应用、Windows win-x64 自包含程序和 Windows 安装器构建通过。Windows NuGet 漏洞数据查询因网络不可用报告 NU1900；Windows 尚未实机验收。

复验：`npm test`；开发服务运行后执行 `node tools/verify-tool-feedback.mjs`（可用 `LUOYE_PLAYWRIGHT` 指向 Playwright）；Mac 构建后执行 `LUOYE_SMOKE_RELOAD=1 node tools/native-acceptance.mjs native-tool-feedback`。

文本证据在 `evidence/browser-report.json`、`evidence/native-tool-feedback.checks.json` 和 `windows-build.json`；截图与音效试听文件仅在本地 evidence 目录保留。正式产物保留在 `build/releases/v1.9.0/`，临时测试配置与安装器打包目录清理。
