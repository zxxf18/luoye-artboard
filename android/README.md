# Android 构建

这是一个 Kotlin + AndroidX WebView 宿主，包名为 `cn.com.yebuluo`。它在构建时执行仓库根目录的 `npm run build`，把生成的 `dist/` 同步到 `app/src/main/assets/www/`，然后通过 `WebViewAssetLoader` 使用同源 HTTPS URL 加载页面。

Activity 默认锁定横屏，并保持可调整窗口尺寸。手机横屏、平板横屏和分屏窄窗口由 Web 端响应式布局处理：画布优先保持可绘制宽度，小尺寸下左侧画笔盒、右侧工具栏和底部参数/素材栏自动收起，通过顶部抽屉入口打开，按钮和滑块保留至少 44dp 的触控目标。Android 真机仍需覆盖低分辨率手机、10 英寸平板和分屏模式做最终验收。

## 本地构建

要求：JDK 17、Android SDK 35、Gradle 8.11.1 或 Android Studio Ladybug 及以上。第一次构建需要访问 Google Maven 和 Maven Central 下载 Android Gradle Plugin、Kotlin、AndroidX WebKit 依赖。

在仓库根目录执行：

```sh
npm test
npm run build
cd android
gradle assembleDebug
```

仓库内也提供 `./gradlew`。在没有系统 JDK 17 的机器上，应显式设置 `JAVA_HOME` 指向 JDK 17；当前 Android 构建已用 `lintDebug assembleDebug` 验证。

APK 输出在 `android/app/build/outputs/apk/debug/app-debug.apk`。若使用 Android Studio，直接打开 `android/`，运行 `app` 配置即可。

独立模拟器的目录、安装清单、启动命令和清理方式见 [`design/platform/android-emulator-validation.md`](../design/platform/android-emulator-validation.md)。模拟器环境不写入仓库，也不影响 Gradle 构建缓存。

## 宿主边界

- `files`：使用 Android Storage Access Framework 读写作品、录像和图片；
- `music`：通过 `MediaPlayer` 尝试播放内置 MIDI。设备没有 MIDI codec 时，前端收到明确错误；
- `display`：映射全屏，窗口尺寸按钮在 Android 上保持当前窗口尺寸；
- `ready`：保留版本和能力 smoke 信号；
- `assets`：不注入原生 handler，素材直接通过 `WebViewAssetLoader` 同源读取。

第一版只加载受信任的 APK 内页面，关闭 file URL、混合内容和第三方 Cookie。`AndroidBridge` 只暴露 `post`、`closeResult` 和 `closeError` 三个带 `@JavascriptInterface` 的方法。

## 资源体积

完整 `dist/` 当前约 425MB。技术验证可以生成包含完整素材的 debug APK；正式发布应把素材拆成核心资源与 Play Asset Delivery/受控 CDN，避免全部进入 base APK。
