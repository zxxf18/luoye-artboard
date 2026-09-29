# 主题 Logo 变体

这些文件保留原始「小孩举画笔」插画，仅对整体色调和对比度做主题化处理，用于左上角品牌和关于页。所有文件为 256×256 PNG，适合 34–56px 的界面显示；原始高分辨率 Logo 仍保留在上一级目录，不被替换。

| 主题 | mac | Windows |
| --- | --- | --- |
| 春 | `app-icon-spring.png` | `app-icon-spring-windows.png` |
| 夏 | `app-icon-summer.png` | `app-icon-summer-windows.png` |
| 秋 | `app-icon-autumn.png` | `app-icon-autumn-windows.png` |
| 冬 | `app-icon-winter.png` | `app-icon-winter-windows.png` |
| 机械 | `app-icon-mechanical.png` | `app-icon-mechanical-windows.png` |
| 宇宙 | `app-icon-space.png` | `app-icon-space-windows.png` |
| 海洋 | `app-icon-ocean.png` | `app-icon-ocean-windows.png` |

生成基于对应平台原始 PNG，使用 ffmpeg 缩放与主题色调映射，单个文件约 55–80KB，避免主题切换引入大体积资源或网络请求。
