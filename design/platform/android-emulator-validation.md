# Android 模拟器环境与验收记录

## 环境边界

高密度目标设备的独立回归记录见 [`android-2880x1840-validation.md`](./android-2880x1840-validation.md)。

模拟器实验环境放在仓库外的 `/private/tmp/luoye-android-lab`（`/tmp` 是同一目录的别名），不写入系统 Android SDK，也不把 AVD、系统镜像或运行快照提交到仓库。SDK、AVD、用户配置和缓存都通过环境变量放在该目录内，删除它不会影响源码、Gradle 缓存或项目构建。

当前目标设备是 Apple Silicon 主机上的 Android 35 ARM64 Google APIs 镜像。AVD `luoye-phone-api35` 使用 Pixel 2 配置，物理分辨率为 1080 × 1920，初始方向设为横屏，因此应用窗口默认为 1920 × 1080；需要小尺寸回归时可用 `adb shell wm size 800x480` 临时覆盖，测试后执行 `adb shell wm size reset`。后续要覆盖平板时，在同一个实验目录新增 AVD 即可，不需要改项目配置。

## 安装内容记录

安装根目录：`/private/tmp/luoye-android-lab`。截至本次验证，`sdkmanager --list_installed` 的实际清单为：

- `cmdline-tools/latest`（Command-line Tools revision 19.0）：`sdkmanager`、`avdmanager`、`apkanalyzer`；
- `emulator` 37.1.11：Apple Silicon 模拟器；
- `platform-tools` 37.0.1：`adb`；
- `platforms;android-35` revision 2：Android 35 编译平台；
- `build-tools;34.0.0` 和 `build-tools;35.0.0`：APK 打包与检查工具；
- `system-images;android-35;google_apis;arm64-v8a` revision 9：ARM64 Google APIs 系统镜像；
- AVD `luoye-phone-api35`：Pixel 2、`arm64-v8a`、初始横屏，AVD 文件在 `/private/tmp/luoye-android-lab/avd/`。

安装日志保留在 `/tmp/luoye-android-lab-install-online.log`，系统镜像补装日志在 `/tmp/luoye-android-lab-image-retry.log`，AVD 创建日志在 `/tmp/luoye-android-lab-avd-create.log`。重新安装或排查时，先读取日志和 `sdkmanager --list_installed`，不要并发执行多个 `sdkmanager`。

启动前必须先设置下面的 `ANDROID_USER_HOME` 和 `ANDROID_AVD_HOME`。早期未设置这两个变量的启动可能在 `~/.android/` 留下模拟器用户文件；这些文件不属于 lab，确认没有其他 AVD 使用后再单独清理。

## 创建、启动和清理

```sh
export ANDROID_SDK_ROOT=/private/tmp/luoye-android-lab
export ANDROID_HOME=$ANDROID_SDK_ROOT
export ANDROID_USER_HOME=$ANDROID_SDK_ROOT/user
export ANDROID_AVD_HOME=$ANDROID_SDK_ROOT/avd
export PATH=$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$PATH

printf 'no\n' | avdmanager create avd \
  --name luoye-phone-api35 \
  --path "$ANDROID_AVD_HOME/luoye-phone-api35.avd" \
  --package 'system-images;android-35;google_apis;arm64-v8a' \
  --device 'pixel_2' \
  --force

emulator -avd luoye-phone-api35 \
  -no-snapshot -no-boot-anim -no-audio \
  -gpu swiftshader_indirect

adb wait-for-device
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n cn.com.yebuluo/.MainActivity
```

结束模拟器后可以只删除 AVD，保留 SDK 供下一轮复用：

```sh
adb emu kill 2>/dev/null || true
pkill -f "$ANDROID_SDK_ROOT/emulator/emulator" 2>/dev/null || true
avdmanager delete avd --name luoye-phone-api35
```

整个实验环境不再需要时直接删除。由于 `ANDROID_USER_HOME` 和 `ANDROID_AVD_HOME` 都在 lab 内，下面的命令会同时清理 SDK、系统镜像、AVD、用户配置和运行缓存：

```sh
adb emu kill 2>/dev/null || true
pkill -f "/private/tmp/luoye-android-lab/emulator/emulator" 2>/dev/null || true
rm -rf /private/tmp/luoye-android-lab
```

删除前可用 `adb devices` 确认没有其他设备；不要为了清理 lab 删除系统级 Android SDK、其他 AVD 的 `~/.android` 文件，或项目的 `/tmp/luoye-gradle`、`/tmp/luoye-jdk17` 缓存。

## 验收项

- [x] ADB 识别设备，安装输出为 `Success`，包名为 `cn.com.yebuluo`，`versionName=1.10.2`；
- [x] 冷启动 `Status: ok`，默认横屏，正常窗口为 1920 × 1080，Activity 不因旋转重建丢失页面；
- [x] WebView 首屏可见，默认横屏；画笔、参数、素材抽屉均可打开，画笔卡片、参数滑杆、素材分页和调色板在高密度 WebView 中可用；
- [x] SAF 桥接已实测：点击“打开”进入 `com.google.android.documentsui` 的 `PickActivity`，返回应用后点击“保存”进入同一系统文件保存器；本次未选择真实文件提交，避免把测试数据写入模拟器；
- [x] 800 × 480（420dpi，约 305 × 183 CSS dp）进入画布优先模式，三栏收起，画布区域明显大于旧版；本轮真实模拟器窗口为 1920 × 1080，画布、画笔、参数、素材和调色板均已抓图核对；
- [ ] 返回键先关闭弹窗/抽屉，再执行保存或退出流程；
- [x] 本次冷启动和小尺寸复测无 `FATAL EXCEPTION`、`AndroidRuntime` 或 WebView 崩溃；模拟器 Chromium 的 `variations_seed_loader` 签名提示属于镜像初始化噪声；
- [ ] 音乐设备不支持时界面显示可恢复错误，不影响绘画。

补充边界：`AndroidMusic` 已将内置资源路径统一为 `www/music/...`，避免 APK `assets/www` 层级不一致。Android `MediaPlayer` 是否能解码 MIDI 仍由设备固件决定，当前 Pixel 2 API 35 镜像没有把 MIDI 播放作为发布保证，正式验收需在目标设备再测一次。

截图证据保存在临时目录：`/tmp/luoye-android-screen-small-final.png`（800 × 480 画布优先首屏）、`/tmp/luoye-android-screen-tools-final.png`（工具抽屉）以及本轮 `/private/tmp/luoye-android-lab/android-final.png`、`android-brush.png`、`android-options.png`、`android-library.png`、`android-palette.png`、`android-after-palette.png`。这些文件不进入仓库，删除 lab 时一并清理。
