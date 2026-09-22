# 网站部署方案

## 结论

可以直接做成网站部署，第一阶段不需要后端：执行 `npm run build`，把生成的 `dist/` 作为静态站点发布到支持 HTTPS 的 CDN/静态托管平台即可。浏览器端已经能完成绘画、素材、图层、撤销重做、图片导入、工程/录像下载、草稿、画夹和回收站。

推荐先交付“单设备、本地数据、静态托管”的 Web 版本，再根据是否需要账号、跨设备同步和分享决定是否增加后端。现在直接加入用户系统会改变数据模型、隐私边界、配额和恢复流程，不能因为“想做网站”就默认引入。

## 当前构建和部署边界

生产构建入口是 `npm run build`，实现见 `tools/build.mjs`：

- 清空并生成 `dist/`；
- 复制 `public/`；
- 生成合并后的 `app.js`；
- 生成 `canvas-assets.js`；
- 排除素材源文件、候选图和其他不应进入运行包的目录。

`tools/server.mjs` 是开发服务器，包含动态 bundle、source/test 路由，只用于本地开发和验收，不应直接暴露到公网。生产环境只上传 `dist/`。

当前发布包约 425MB、数千个素材文件。这在静态 CDN 上可行，但首屏不应预加载所有素材，也不应把整个包一次性做成 PWA 预缓存。素材应继续按同源路径和现有目录懒加载，并设置长期缓存。

### 小尺寸布局策略

当视口宽度不超过 860px，或视口高度不超过 600px 时，网页自动进入“画布优先”模式：左侧画笔盒、右侧工具栏和底部参数/素材栏收起，画框撑到工作区底部，画布尽量占满可用空间。顶部只保留五个紧凑入口，分别打开画笔、工具、参数、素材和画布抽屉；“画布”按钮可以随时回到专注模式。画笔抽屉把颜色、画笔卡片、画笔方式、图层操作分成稳定区域，画笔卡片在 640px 下四列、320px 下两列并可纵向滚动；橡皮、填充、几何等工具会自动切到画笔抽屉显示子选项。参数抽屉固定颜色条并为滑杆、组合和操作提供滚动区；素材抽屉让分类横向滚动、卡片纵向滚动，分页和提示不会被裁掉。调色板弹窗把预设色做成横向滚动带，同时保留色相平面、明度、不透明度、纹理和底部按钮。抽屉使用原来的 DOM 和事件，不复制工具状态，也不会改变工程数据。

宽度不超过 640px 或高度不超过 500px 时还会隐藏作品标题输入框，避免标题和操作按钮挤压画布。高密度 Android WebView 会进一步压缩顶栏、折叠创作单元标签、隐藏非必要画布状态栏，并以 CSS dp 计算实际画布空间；因此 800 × 480、420dpi 的逻辑窗口也能保留可用画布。桌面宽度恢复到 861px 以上后，三栏布局自动恢复。CSS 文件使用版本查询参数，Nginx 对未指纹化 CSS 返回 `no-cache`，避免 WebView 或浏览器继续使用旧版布局。

## 能力矩阵

| 能力 | 纯静态网站 | 说明 |
| --- | --- | --- |
| Canvas 绘画、图层、滤镜、撤销重做 | 支持 | 复用现有 Web 编辑器 |
| 本地素材库和图片导入 | 支持 | 使用同源资源和 `<input type=file>` |
| 工程/录像导入 | 支持 | 浏览器读取 JSON 后沿用现有校验 |
| PNG/JPEG、`.luoyex`、`.luoyer` 导出 | 支持 | 走 Blob + 下载；具体保存位置由浏览器决定 |
| 草稿、画夹、回收站、音效设置 | 支持但只在当前 origin/设备 | 依赖 IndexedDB/localStorage，不跨浏览器同步 |
| 背景 MIDI 20 首和 MIDI 导入 | 当前不支持 | `src/music-ui.js` 只在桌面 bridge 存在时启用 |
| 工具音效 | 支持 | 使用 Web Audio，需用户手势解锁音频 |
| 桌面窗口尺寸/原生全屏 | 降级 | `src/display-ui.js` 的 native bridge 不存在；可补 Fullscreen API |
| 账号、云同步、分享链接 | 不支持 | 需要后端、对象存储、鉴权和版本冲突处理 |

浏览器的 IndexedDB 适合本地草稿，但它是 origin 级存储，容量由浏览器和设备决定，并可能在存储压力下清理。网站应调用 `navigator.storage.estimate()` 展示占用，并在支持时请求 `navigator.storage.persist()`；重要作品仍应提示下载工程文件。

## 推荐部署形态

### Web MVP：静态站点

```text
源码仓库
  └─ npm run build
      └─ dist/
          ├─ index.html
          ├─ app.js / canvas-assets.js
          ├─ assets/catalog.js
          ├─ styles.css / playroom.css / tool-shelf.css
          ├─ 素材目录
          └─ music/（当前仅作为资源保留）

dist/ → Cloudflare Pages / Netlify / S3 + CDN / GitHub Pages
```

部署要求：

1. 使用 HTTPS 或 `localhost`，不要让用户用 `file://` 打开；
2. 配置 `index.html` 的根路径 fallback；
3. `index.html`、`app.js` 和 `assets/catalog.js` 使用版本发布策略，避免 HTML 和资源错配；
4. 图片、动画素材和 CSS 可使用带版本号或内容哈希的长期缓存；
5. 保留当前 CSP，只允许同源脚本和 `data:` / `blob:` 图片；
6. 上传前运行 `npm test`、`npm run build`、真实浏览器验收。

如果使用 GitHub Pages，需要额外处理项目路径前缀和资源相对路径；如果希望自定义域名和较大素材 CDN，Cloudflare Pages 或对象存储 + CDN 更合适。平台选型是成本和运维偏好，不影响编辑器本身。

### PWA：第二阶段的离线增强

PWA 可以让用户把网站安装到桌面或移动主屏，并在网络中断时打开应用壳。建议只预缓存 `index.html`、CSS、`app.js`、`catalog.js` 和小型图标；约 425MB 的素材不能默认全部预缓存。素材按访问写入 Cache Storage，并用版本号清理旧缓存。

PWA 不能替代工程导出：Cache Storage 和 IndexedDB 都受浏览器配额、清理策略和设备存储压力影响。离线能力要用“最近访问素材可用”来描述，不要承诺“全部素材永远离线可用”。

### 云端版本：有明确业务需求后再做

当出现以下需求时，再增加后端：跨设备继续创作、作品分享链接、家长/教师账号、作品备份、素材远程更新。

建议的后端边界：

- 前端仍用 `validateProject()` 校验工程形状和大小；
- 项目 JSON 和导出图片分别进入对象存储，数据库只保存用户、项目元数据、版本号和对象 key；
- 上传接口使用幂等项目版本号，避免网络重试产生重复版本；
- 下载和恢复使用明确的版本号/更新时间，冲突时保留两个版本，不静默覆盖；
- 增加用户配额、删除恢复、病毒/类型检查、审计日志和错误监控；
- 先保持本地导出导入可用，云端故障不能阻断离线绘画。

## 必要的 Web 适配改动

这些改动不改变绘画引擎，可独立于部署完成：

1. 在 `visibilitychange`、`pagehide` 和应用关闭前调用当前草稿 flush，补上网页刷新/关闭时最近一次 debounce 尚未完成的窗口；
2. 对 IndexedDB 写入失败、配额不足和浏览器拒绝持久化给出可恢复提示；
3. 没有 `music` bridge 时，将音乐入口明确显示为“桌面版功能”，或将 20 首 MIDI 构建期预渲染为 AAC/OGG 并用 `<audio loop>` 播放；
4. 用 Fullscreen API 实现网站全屏，替代当前禁用的原生窗口尺寸按钮；
5. 已增加窄屏布局和抽屉验收；发布前仍应在真实移动浏览器上确认图库、弹窗、画布缩放和虚拟键盘不会遮挡操作；
6. 显示当前 origin 的本地存储使用量，并把重要作品的工程下载放在明显位置。

## 上线验收

- `npm test` 通过；
- `npm run build` 后只发布 `dist/`，不发布 `tools/server.mjs`、`src/` 和测试目录；
- Chrome/Edge/Safari/Firefox 至少各完成一次首笔、素材、图片导入、工程保存/打开、画夹保存/恢复、录像导出/导入；
- 移动浏览器完成竖屏和横屏绘画、缩放、滚动、弹窗输入；
- HTTPS 下刷新和关闭页面后草稿可恢复；
- 配额不足、下载取消、文件类型错误和音乐不可用均有明确反馈；
- 素材 404、CSP 错误、JS 未捕获异常和 IndexedDB 失败接入错误监控；
- 用真实 CDN 检查 MIME、缓存、压缩、范围请求和冷启动首屏时间。

## 与 Android 方案的关系

网站和 Android 都复用 `dist`、Canvas、工程格式、IndexedDB 语义和前端测试。网站使用浏览器下载和 Web Audio；Android 使用 SAF 和 Android 宿主能力。两者共用的 bridge 契约只保留协议语义，不把桌面端的 Swift/C# 实现直接搬过去。

本地 Docker 功能验收记录见 [Web 本地部署功能验收](web-local-validation.md)。这次验收已经确认下载、IndexedDB 画夹、音效设置、能力降级，以及合法 `.luoyex` 和 PNG 文件的真实上传；旧版 `.fly` 与录像文件导入仍需用历史样本在 Chrome/Edge/Safari/Firefox 或 Android SAF 上补一次端到端验收。

## 参考资料

- [Android：加载应用内 Web 内容](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)
- [MDN Storage API：配额、持久化和清理](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API)
- [Capacitor 官方文档](https://capacitorjs.com/docs)
