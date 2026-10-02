# iPhone / iPad 版本

iOS 版本沿用 `dist/` 中的绘画页面，由 UIKit + WKWebView 提供原生容器。这样画笔、素材、图层、辅助、主题、动画、草稿和画夹只维护一套实现，iPhone 和 iPad 通过同一份 Pointer Events 代码支持手指与 Apple Pencil。

目标为 iOS 16 及以上，Universal target 同时包含 iPhone（1）和 iPad（2），默认以横向布局优先，但允许竖屏、iPad 分屏和 Stage Manager。WKWebView 使用持久化 `WKWebsiteDataStore`，因此 IndexedDB 草稿、画夹以及主题/音乐/界面大小偏好会跨次启动保留。

## 构建

这台机器需要安装完整 Xcode（不是只安装 Command Line Tools）：

```sh
npm run build:ios
```

默认构建 iOS Simulator；构建真机包时：

```sh
SDK=iphoneos CONFIGURATION=Release npm run build:ios
```

构建脚本会先生成当前 `dist/`，复制到应用资源，再复制已授权的 `GeneralUser-GS.sf2` 音色库及其许可证，最后调用 `xcodebuild`。资源目录是临时生成的并被 Git 忽略，不应手工提交。

Debug 构建还会把 `tests/native-*.js` 放进应用资源，可用 launch arguments 在模拟器中运行现有原生烟测。结果会写到应用沙盒的 `Documents/<输出前缀>.checks.json` 和 `Documents/<输出前缀>.png`；使用 `LUOYE_SMOKE_FILES=1` 时，工程、PNG 和 JPEG 会写到同一前缀下，便于 `simctl` 拉取。示例：

```sh
CONFIGURATION=Debug npm run build:ios
xcrun simctl install booted build/releases/v1.10.4/落叶画板-iphonesimulator.app
xcrun simctl launch booted cn.com.yebuluo.luoyeartboard \
  -LUOYE_SMOKE_SCRIPT native-child-journey.js \
  -LUOYE_SMOKE_OUTPUT child \
  -LUOYE_SMOKE_FILES 1 \
  -LUOYE_SMOKE_RELOAD 1
xcrun simctl get_app_container booted cn.com.yebuluo.luoyeartboard data
```

烟测默认使用内存中的 WebKit 数据库，避免污染日常草稿；需要验证跨次启动持久化时追加 `-LUOYE_SMOKE_PERSISTENT 1`。完成后用 `xcrun simctl terminate booted cn.com.yebuluo.luoyeartboard` 结束应用。Release 构建不执行烟测脚本。

## 本机交互映射

| 页面功能 | iPhone / iPad 行为 |
| --- | --- |
| 打开工程、导入图片、导入 MIDI | 系统 `UIDocumentPickerViewController`，iCloud Drive 和“文件”中的文件会先复制到应用临时目录 |
| 保存工程、导出 PNG/JPEG | 系统文件导出面板，可保存到“文件”、iCloud 或其他文档提供方 |
| 画夹、自动草稿、主题偏好 | WKWebView 持久化 IndexedDB / localStorage |
| 音乐 20 首、播放、停止、音量、MIDI 导入 | `AVAudioSequencer + AVAudioUnitSampler + GeneralUser-GS.sf2`，电话/音频中断时暂停 |
| 界面大小 | 不改变 iOS 窗口尺寸；“全屏／返回”只切换状态栏和 Home indicator，其他尺寸按钮按当前可用空间适配 |

## 验收

提交前在安装 Xcode 的 Mac 上执行：

```sh
npm test
node --test tests/ios-support.test.js
xcodebuild -project ios/LuoyeArtboard.xcodeproj -scheme LuoyeArtboard -sdk iphonesimulator build CODE_SIGNING_ALLOWED=NO
```

模拟器至少检查 iPhone SE（375×667）、iPhone 横屏（667×375）、iPad 横屏（1024×768）、iPad 分屏（约 507×768）。真机还必须补测 Apple Pencil 压力、音频中断、后台恢复、文件提供方和 VoiceOver；当前仓库所在机器没有 iOS SDK/Simulator，不能把这些真机检查标记为已通过。
