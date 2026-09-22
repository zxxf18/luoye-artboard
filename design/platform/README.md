# 平台化方案

- [Android 版本迁移方案](android-migration.md)：Kotlin WebView 宿主、JS bridge、SAF、音乐和分阶段实施。
- [Android 模拟器环境与验收记录](android-emulator-validation.md)：独立 SDK/AVD 目录、安装清单、启动与清理命令。
- [网站部署方案](web-deployment.md)：静态站点、PWA、云端版本和浏览器能力边界。
- [Web 本地部署功能验收](web-local-validation.md)：保存、导入、音乐、显示和 IndexedDB 的本地实测结果。

两份文档共同遵循：编辑器和工程格式继续由 Web 层维护，平台差异集中在文件、素材、音乐、窗口和生命周期适配。
