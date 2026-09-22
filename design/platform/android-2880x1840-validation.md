# Android 2.3 英寸等效高密度测试记录

## 测试目标

本轮新增独立 AVD：`luoye-2880x1840-api35`。

| 项目 | 值 |
| --- | --- |
| Android 镜像 | Android 35 / Google APIs / ARM64 |
| 模拟器硬件模板 | Pixel 2（仅复用硬件模板，不代表真实目标设备） |
| 逻辑分辨率 | 2880 × 1840，横屏 |
| 模拟密度 | 1486 dpi |
| 2.3 英寸处理 | `sqrt(2880² + 1840²) / 2.3 ≈ 1486 dpi`，用于得到接近目标物理尺寸的 CSS dp |
| 实测 WebView 视口 | 311 × 199 CSS px，`devicePixelRatio ≈ 9.2875` |
| 包名 | `cn.com.yebuluo` |
| APK | `android/app/build/outputs/apk/debug/app-debug.apk` |
| 实验目录 | `/private/tmp/luoye-android-lab` |

Android 模拟器没有真实的屏幕玻璃尺寸和触控面板，2.3 英寸只能通过密度换算做布局等效测试。这个 AVD 能验证高分辨率、小 CSS 视口、横屏和触控流程，不能替代真实 2.3 英寸硬件上的 GPU、内存、触控精度和系统键行为验收。

## 创建和启动

实验环境沿用 [`android-emulator-validation.md`](./android-emulator-validation.md) 中的隔离 SDK。首次创建目标 AVD：

```sh
export ANDROID_SDK_ROOT=/private/tmp/luoye-android-lab
export ANDROID_HOME=$ANDROID_SDK_ROOT
export ANDROID_USER_HOME=$ANDROID_SDK_ROOT/user
export ANDROID_AVD_HOME=$ANDROID_SDK_ROOT/avd
export PATH=$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$PATH

printf 'no\n' | avdmanager create avd \
  --name luoye-2880x1840-api35 \
  --path "$ANDROID_AVD_HOME/luoye-2880x1840-api35.avd" \
  --package 'system-images;android-35;google_apis;arm64-v8a' \
  --device pixel_2 --force
```

创建后在该 AVD 的 `config.ini` 中设置：

```ini
hw.initialOrientation = landscape
hw.lcd.width = 2880
hw.lcd.height = 1840
hw.lcd.density = 1486
showDeviceFrame = no
fastboot.forceChosenSnapshotBoot = no
fastboot.forceFastBoot = no
firstboot.saveToLocalSnapshot = no
```

启动、安装和连接 WebView 调试：

```sh
emulator -avd luoye-2880x1840-api35 \
  -no-window -no-snapshot -no-boot-anim -no-audio \
  -gpu swiftshader_indirect

adb wait-for-device
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n cn.com.yebuluo/.MainActivity
adb shell wm size
adb shell wm density
```

本轮实际输出为 `Physical size: 2880x1840`、`Physical density: 1486`。模拟器因为高分辨率自动将运行内存提高到 4 GiB，不能把本轮结果当作 2 GiB 设备的内存压力结论。

## 功能和操作回归

| 功能 | 操作 | 结果 |
| --- | --- | --- |
| 冷启动 | 启动 Activity，检查方向、画布和 WebView | 通过；横屏，CSS 视口 311×199，画布优先显示 |
| 画笔抽屉 | 打开画笔、切换水彩、滚动到画法和图层操作 | 通过；颜色区、画笔卡片、画法、底部操作无重叠，底部操作可滚动到 |
| 真实绘画 | `adb shell input swipe 850 950 1450 1030 350` | 通过；撤销按钮变为可用 |
| 撤销/重做 | 点击撤销再点击重做 | 通过；状态分别为 undo disabled、redo enabled，再恢复 |
| 工具抽屉 | 打开工具，滚动工具列表，真实触控点击橡皮 | 通过；13 个工具可访问，橡皮切换后进入画笔抽屉 |
| 参数抽屉 | 调整笔尖大小 14→28，滚动参数区 | 通过；滑杆和数值同步，参数区可滚动 |
| 调色板 | 打开“更多颜色”，选择苹果红，滚到底部确认 | 通过；确认后颜色为 `#ef5350`，底部操作可滚动到 |
| 素材分类 | 打开素材，切换“彩色背景” | 通过；分类状态同步 |
| 素材加入 | 点击背景素材，等待异步图片加载 | 通过；素材进入画面，撤销变为可用，工具切换为画笔 |
| 素材分页 | 点击下一页 | 通过；从 `1 / 151` 切换到 `2 / 151` |
| 素材滚动 | 滚动素材抽屉到底部 | 通过；分页按钮在抽屉内可见可操作 |
| 新建画纸 | 触发新画纸 | 通过；历史状态恢复为空，工具保持画笔 |
| 导出 | 打开导出弹窗，滚动到底部，检查 PNG/取消/导出 | 通过；按钮可达，本轮取消导出，未写入测试文件 |
| SAF 保存 | 点击保存，观察系统文件保存器，返回键取消 | 通过；进入 `com.google.android.documentsui/com.android.documentsui.picker.PickActivity`，取消后返回应用 |
| SAF 打开 | 关闭抽屉和全屏提示后真实点击打开，返回键取消 | 通过；进入同一 `PickActivity`，取消后返回应用 |
| 音乐 | 打开音乐，播放音乐 1，停止，音量调至 10% | 通过；本镜像能播放 MIDI，界面显示播放进度，停止和音量同步 |
| 全屏 | 点击全屏/返回，退出沉浸模式 | 通过；出现 Android 首次全屏提示，向下滑动后恢复工具栏 |
| 图层 | 打开图层弹窗，滚动操作列表，返回画纸 | 通过；弹窗可滚动，返回后页面存活 |
| 返回键 | 弹窗打开时按 Android 返回键 | 通过；先关闭弹窗，WebView 和 Activity 保持运行 |

调色板、导出、音乐和图层等弹窗在此视口下都采用内部纵向滚动；画笔和素材抽屉也允许滚动访问被视口高度压缩的底部操作和分页。

## 证据和日志

截图保存在隔离实验目录，不进入仓库：

- `/private/tmp/luoye-android-lab/android-2880x1840-start.png`
- `/private/tmp/luoye-android-lab/android-2880x1840-brush.png`
- `/private/tmp/luoye-android-lab/android-2880x1840-tools.png`
- `/private/tmp/luoye-android-lab/android-2880x1840-final.png`

Android 构建和 Web 回归：

```sh
npm run build
npm test                         # 55 passed
cd android && ./gradlew lintDebug assembleDebug --no-daemon
```

构建结果为 `BUILD SUCCESSFUL`，lint 为 0 errors、5 warnings。功能回归期间没有发现 `FATAL EXCEPTION`、`AndroidRuntime` 或 WebView 崩溃日志。

## 清理

只删除本次新增 AVD，保留共享 SDK 和原有手机 AVD：

```sh
adb emu kill 2>/dev/null || true
avdmanager delete avd --name luoye-2880x1840-api35
```

如果整个 Android 实验环境都不再需要，再按原文档删除 `/private/tmp/luoye-android-lab`。不要删除项目源码、Gradle 缓存或系统中的其他 AVD。
