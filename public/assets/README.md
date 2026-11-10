# 素材目录

运行时素材按业务类型组织，目录名不绑定版本号：

- `background/`：背景图，按 `masters/`、`sprites/`、`thumbs/` 保存源图、运行图和缩略图。
- `sticker/`：贴纸素材。
- `fairy/`：动态角色及角色帧。
- `animation/`：动画素材及矢量帧。
- `frame/`：画框。
- `paper/`：纸张。
- `texture/`：纹理。

`catalog.json` 是唯一运行时索引，`catalog.js` 是浏览器直接加载的同内容副本。新增素材先归入业务目录，再更新这两个索引文件。

本次重绘素材归入 `background/store/`、`animation/store/` 和 `fairy/store/`，各自包含 `sprites/` 与 `thumbs/`。旧素材保留原路径，通过仓库的 `resources/assets/legacy-catalog.json` 在非上线版中追加；上线版只打包当前索引引用的图片。

素材工具位于 `tools/assets/`，提示词及来源清单位于 `tools/assets/manifests/`。生成原图、预览与 APK 分别保存在 `local-only/` 和 `build/`，不放入公开素材目录。
