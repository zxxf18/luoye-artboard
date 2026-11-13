# 素材目录

运行时素材按业务类型组织，目录名不绑定版本号：

- `background/`：背景图，按 `masters/`、`sprites/`、`thumbs/` 保存源图、运行图和缩略图。
- `sticker/`：贴纸素材。
- `fairy/`：动态角色及角色帧。
- `animation/`：动画素材及矢量帧。
- `frame/`：画框。
- `paper/`：纸张。
- `texture/`：纹理。

`catalog.json` 是所有版本共用的素材索引，`catalog.js` 是浏览器加载的精简副本。新增素材先归入业务目录，再用 `renderRuntimeAssetCatalog` 生成浏览器索引。

重绘素材仍放在 `background/store/`、`animation/store/` 和 `fairy/store/`。社区版和商店版共用同一索引。旧版图片已移出公开素材目录。两个固定入口的笔触纸纹由 `tools/prepare-materials.py` 生成。

素材工具位于 `tools/assets/`，提示词及来源清单位于 `tools/assets/manifests/`。生成原图、预览与 APK 分别保存在 `local-only/` 和 `build/`，不放入公开素材目录。
