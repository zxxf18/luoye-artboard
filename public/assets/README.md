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
