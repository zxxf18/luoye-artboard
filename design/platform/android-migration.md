# Android 版本迁移方案

## 结论

推荐先做一个 **Kotlin 原生壳 + AndroidX WebView + 受限 JS bridge** 的 Android 版本，不重写 `src/engine.js`、`src/drawing.js`、`src/editor.js`、`src/recording.js` 和素材目录。

当前项目本质上是一个依赖 Canvas 2D 的静态 Web 编辑器：`npm run build` 将 `public/` 复制到 `dist/`，再把 `src/` 按固定顺序合并成 `dist/app.js`（见 `tools/build.mjs`、`tools/bundle.mjs`）。桌面端已经把文件、素材、音乐、窗口控制和 ready 信号抽象成 bridge（见 `src/storage.js`、`src/bundled-images.js`、`src/music-ui.js`、`src/display-ui.js`、`native/windows/Program.cs`、`native/macos/Main.swift`），这给 Android 提供了可复用的宿主边界。

当前 `dist/` 约 425MB，素材约 1,582 项，主要体积集中在背景、杂项图库、动画和纹理。技术验证可以先把完整 `dist/` 放进 APK；正式分发不应把所有素材都塞进 base APK。应把素材按核心内置、install-time asset pack、fast-follow/on-demand asset pack 或受控 CDN 分层，产品若必须“完全离线全素材”，优先使用 Android 的 Play Asset Delivery 方案并对素材索引和版本做校验。

不推荐第一版用 Compose/Skia 重写。那会同时重建画布、图层、动画素材、滤镜、录像回放、工程格式和测试体系，功能风险和长期维护成本都远高于加一个 WebView 宿主。

Capacitor 可以作为后续选择，但不是当前最短路径。项目没有现代前端构建框架和依赖管理，现有 bridge 也不是 Capacitor API；引入它仍需要迁移构建结构、重写宿主协议、增加插件和 Android 调试层。

## 目标与非目标

第一版目标：

- Android 设备离线打开完整绘画工作台；
- 复用当前工程格式 `.luoyex`、图片导入导出、IndexedDB 草稿、画夹和五段录像；
- 支持手指、触控笔和系统返回键；
- 对低内存设备给出明确的容量边界和可恢复错误；
- 保持桌面端和 Web 端的 JS 行为一致。

第一版不承诺：

- 直接复用桌面端的 MIDI 播放实现；
- Android 后台持续播放音乐；
- 云端账号、同步和多人协作；
- 以原生 Android 控件重做整套编辑器界面。

## 推荐架构

```text
Android Activity
  └─ WebView
      ├─ WebViewAssetLoader → APK 内 dist/ 静态文件
      ├─ Canvas / IndexedDB / Web Audio → 复用现有 Web 代码
      └─ window.webkit.messageHandlers shim
          └─ Kotlin AndroidBridge → SAF / 音频播放器 / 生命周期
```

使用 `WebViewAssetLoader` 通过 `https://appassets.androidplatform.net/assets/...` 加载 APK 内资源。Android 官方文档明确建议用这种 HTTP(S) 同源方式加载本地 HTML、JS、CSS 和图片，并避免生产环境使用 `file://`；这对 IndexedDB、`fetch` 和同源资源解析更可靠。

Android 宿主只允许加载 APK 内页面，关闭远程导航、file access 和 universal file access。bridge 只接受固定 channel 和固定参数，不暴露任意路径、任意命令或反射入口。

## JS bridge 契约

第一阶段保持现有 JS 调用面不变，在 Android 页面启动前注入等价 shim：

```js
window.webkit = { messageHandlers: {
  files:  { postMessage: payload => AndroidBridge.post('files', payload) },
  assets: { postMessage: payload => AndroidBridge.post('assets', payload) },
  music:  { postMessage: payload => AndroidBridge.post('music', payload) },
  display:{ postMessage: payload => AndroidBridge.post('display', payload) },
  ready:  { postMessage: payload => AndroidBridge.post('ready', payload) }
} };
```

建议的 channel 行为：

| channel | Android 行为 | 回传事件 |
| --- | --- | --- |
| `files` | 使用 Storage Access Framework（`ACTION_OPEN_DOCUMENT` / `ACTION_CREATE_DOCUMENT`）；保存前限制 MIME、文件名和 payload 大小 | `native-file-result` |
| `assets` | 不注入原生 handler；素材通过 `WebViewAssetLoader` 的 APK 同源 URL 读取，避免每张图片经过 JS/base64 往返 | 无需回传 |
| `music` | 使用 Android `MediaPlayer` 尝试播放内置和导入 MIDI；设备没有 MIDI codec 时回传可见错误，后续可切换预渲染 AAC/OGG | `native-music-result` |
| `display` | Activity 默认锁定横屏；支持沉浸式全屏和按当前 WebView 尺寸适配，不实现桌面窗口尺寸 | `native-display-result` |
| `ready` | 记录版本、画布、资源和工具数量，供 smoke test 和诊断使用 | 无需回传 |

SAF 是 Android 系统提供的用户可见文件选择和保存机制，适合工程、录像和图片的导入导出。不能假设 WebView 的 `<a download>` 一定把文件可靠地落到用户指定目录。

## 数据与兼容性

- 工程格式沿用 `validateProject()` 允许的 `luoye-studio` v1/v2；Android 不新增第二套工程格式。
- 草稿、画夹、回收站和录像继续使用 `IndexedDB('luoye-studio', 2)`，直接复用 `src/storage.js`。
- Android 首次启动时调用 `navigator.storage.estimate()`，在设备支持时申请持久化存储；达到预算时先提示用户导出工程，再停止继续写入。
- `.luoyex`、`.luoyer` 仍是 JSON + 内嵌 PNG，打开前沿用现有校验和容量限制。
- 任何 Android bridge 错误都要回传可识别的错误字符串，前端保持当前“保存失败仍保留当前作品”的行为。

当前代码的硬边界包括：画布最大 4096×4096 且不超过 8.39MP、最多 200 图层、单工程约 128MiB 校验边界、历史约 96MiB，以及大量动画精灵的像素预算（见 `src/core.js`、`src/recording.js`）。这些边界在低端 Android 上不能直接当作性能保证。首版应增加移动设备预算：默认工作区不超过 1920×1080；在内存压力或编码失败时，不创建并行的全尺寸临时 Canvas，并给出“请缩小画布或先导出”的恢复路径。

## 当前 Android 容器与尺寸策略

- Android applicationId、namespace 和 Kotlin 包名统一为 `cn.com.yebuluo`，源文件目录为 `android/app/src/main/java/cn/com/yebuluo/`。
- Manifest 将 Activity 默认方向设为横屏，并打开 `resizeableActivity` 与 `adjustResize`；这满足手机横屏和平板横屏，同时保留分屏窗口的重排机会。
- Web 端在 `public/playroom.css` 的窄宽度规则中将三栏工作区改成“画布优先 + 三组抽屉”，在不牺牲功能的情况下解决横屏手机和分屏宽度下画布只剩几百像素的问题；触控按钮和滑块保持 44px 以上。
- Android 的 `fit`、`1080`、`2k` 窗口动作只回报当前可用 WebView 尺寸，不伪造桌面窗口尺寸；横屏锁定由系统负责，画布缩放由 Web 端 `ResizeObserver` 和 `layoutCanvas()` 负责。
- 本机已用 `lintDebug assembleDebug` 和 `aapt dump badging` 验证包名为 `cn.com.yebuluo`、target SDK 35、默认方向为 landscape。当前没有连接真机或模拟器，低分辨率手机、平板和分屏的最终视觉验收仍是后续工作。

## 分阶段实施

### P0：可启动壳和资源加载（1–2 个工作日）

1. 新建独立 `android/` Gradle 工程，最低版本、目标版本和 ABI 先根据实际设备与上架要求确定。
2. 技术验证阶段把 `npm run build` 生成的 `dist/` 复制到 `android/app/src/main/assets/www/`；不要提交 `dist/` 之外的开发测试路由。发布阶段改成核心资源 + asset pack/CDN，避免 425MB 全量进入 base APK。
3. 用 `WebViewAssetLoader` 加载 `www/index.html`，配置 CSP、硬件加速、触控和屏幕方向。
4. 注入 bridge shim，实现 `ready` 和空实现 `display`，跑通首屏、画笔、素材点击和退出。
5. 建立 Android smoke test：页面加载、首笔、素材放置、刷新后草稿仍在。

### P1：文件、生命周期与移动交互（3–5 个工作日）

1. 实现 `files` channel 与 SAF；覆盖 `.luoyex`、`.luoyer`、PNG、JPEG 和用户图片导入。
2. 将 Android `onPause`、`onStop`、`onSaveInstanceState` 映射到前端 flush；前端补充 `visibilitychange` / `pagehide` 保存兜底。
3. 返回键按“关闭弹窗 → 结束当前手势 → 请求关闭确认”的顺序处理，复用 `src/close-flow.js` 的语义。
4. 验证手指绘画、触控笔压力（若设备提供）、双指滚动和画布缩放；保留 `touch-action:none` 与 pointer capture。
5. 用真实设备验证 Android WebView 的 IndexedDB 配额、升级、清理数据和进程被杀后的恢复。

### P2：内存、素材和录像（3–5 个工作日）

1. 在 2GB、4GB 和 8GB RAM 设备上分别压测最大推荐画布、图层、动画印章、撤销重做和滤镜。
2. 记录 Canvas 内存、PNG 编码峰值、录像导入/回放耗时和失败原因。
3. 对大图导入先缩放到画布预算；避免同一时刻保留原图、全尺寸 data URL、滤镜中间图和历史快照的四份副本。
4. 验证录像容量、回放取消、进程重启后的录像草稿和损坏文件拒绝。

### P3：音乐能力（2–4 个工作日）

当前实现使用 Android `MediaPlayer` 播放从 APK 临时复制出的 MIDI 文件，并支持导入 MIDI；这样绕过了压缩 APK asset 不能直接取得文件描述符的问题。Android 平台是否带 MIDI codec 取决于设备，播放失败会沿 bridge 回传到界面。

如果目标设备覆盖面要求稳定一致，下一步应把 20 首内置曲目构建期预渲染为 AAC/OGG，并将 MIDI 导入改为明确提示“当前设备不支持”或引入独立软音源。不能把 `MediaPlayer` 的 codec 能力当成所有 Android 设备的保证。

## 验收标准

- `npm test` 和 Android 构建均通过；
- 冷启动后首屏在目标设备上 3 秒内可交互（以测试设备实测为准）；
- 画笔、橡皮、填色、图层、素材、文字、滤镜、撤销重做和图片导出各有一条真实设备用例；
- 工程保存、关闭、重新打开、导入错误文件、SAF 取消和权限拒绝都有明确结果；
- 进程被系统杀死后，最近一次成功 flush 的草稿可恢复；
- 大图、录像和滤镜达到预算时不闪退，错误可恢复；
- bridge 只接受白名单 channel、路径和参数，远程页面不能调用宿主能力；
- 2GB RAM 设备完成一轮 30 分钟连续绘画和 20 次撤销重做后不发生 OOM。

## 主要风险和取舍

| 选择 | 优点 | 代价与边界 |
| --- | --- | --- |
| Kotlin + WebView（推荐） | 复用现有代码最多；最快得到离线 Android；bridge 可沿用桌面协议 | WebView Canvas 和 Android 内存峰值必须实测；需要自行维护 SAF、MIDI 和生命周期 |
| Capacitor | 以后接插件、推送、分享和多平台能力更方便 | 需要迁移构建和宿主协议；当前项目没有 npm 依赖基础；自定义 MIDI 仍需原生插件 |
| Compose/Skia 重写 | 原生渲染和交互控制强 | 重写量最大，工程、动画、录像和效果容易出现行为差异；不适合作为快速迁移 |

## 参考资料

- [Android：加载应用内 Web 内容](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)
- [AndroidX WebViewAssetLoader API](https://developer.android.com/reference/androidx/webkit/WebViewAssetLoader)
- [Capacitor 官方文档](https://capacitorjs.com/docs)
- [MDN Storage API：配额与持久化](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API)
