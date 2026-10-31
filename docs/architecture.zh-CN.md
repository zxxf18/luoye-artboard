# 架构与代码组织

面向后续开发的模块地图与必须遵守的约束。改动前先读这里，可以避开历史上踩过的坑。

## 模块分层

```
public/index.html          应用外壳：静态控件 + CSP + 资源清单
src/platform/app.js        装配入口：创建引擎并按依赖顺序挂载各 mount*() 模块
src/core/engine.js         PaintEngine：图层模型、合成与缓存、采样合并、序列化
src/core/editor.js         EditorEngine：选区、填充、回放命令（继承 PaintEngine）
src/core/drawing.js        DrawingEngine：笔触/贴图/刮刮画/辅助对称（继承 EditorEngine）
src/core/brushes.js        11 种笔刷的绘制规则与渐变停靠点缓存
src/core/assist.js         对称几何（纯函数，含快速路径描述符）
src/core/paper-tools.js    画板级橡皮/变形手势（engine 首参的独立函数）
src/core/input-sampling.js 指针采样：合并样本 + 橡皮原始指针流判定
src/ui/animation-editor.js 小动画编辑器（独立的 DrawingEngine 实例 + 时间轴模型）
src/ui/pixel-art.js        像素画编辑器（独立模型 + 弹窗）
UI 挂载模块                 classic-ui（编排）、classic-scratch（刮刮画面板）、
                           classic-mobile（小屏抽屉）、palette-ui、assist-ui、
                           studio-ui、gallery-ui、recorder-ui、text/creative/
                           music/materials/display/theme-ui、tool-feedback 等
```

挂载顺序有依赖：`src/platform/app.js` 先建 animation/pixel 编辑器再调 `mountClassic`，
因为工具栏第三页通过 `features` 回调直接打开它们。

## 打包约束（最重要）

- `tools/bundle.mjs` 把所有模块**拼接进同一个 IIFE 作用域**并剥掉
  import/export。因此：
  - 新增 src 文件必须加入 files 列表，且排在依赖它的人之前；
  - **任何两个模块不得声明同名顶层函数/常量**（历史事故：两个
    `shapePath` 互相遮蔽，发布版几何工具全坏而源码测试全绿）。
  - `tests/bundle-collision.test.js` 直接扫描打包产物守护这条规则，
    新增模块后必须保持它通过。
- `package.json` 的 version 变化会改变 `app.js?v=` 查询串；开发时浏览器
  可能缓存旧脚本，验证界面行为时优先相信 `tools/browser-acceptance.mjs`
  （每次全新 Chrome + 全新端口），而不是常驻标签页。
- `npm run build` 生成网站资源并保留可选的远程统计脚本；
  `tools/build-client.mjs` 生成客户端资源并在构建期移除该脚本。
  macOS、Windows、Android 和 iOS 构建都必须使用客户端入口，不能依赖
  WebView 运行时判断是否联网。

## 测试层次

| 层 | 位置 | 说明 |
| --- | --- | --- |
| 单元/源码断言 | `tests/*.test.js`（`npm test`） | 纯逻辑 + 对源码正则断言（断言路径要跟随模块拆分更新） |
| 浏览器验收 | `tests/*.html` + `tools/browser-acceptance.mjs` | 真实浏览器里驱动打包产物与源码两套路径 |
| 模拟画布 | `tests/helpers/canvas-double.js` | node 侧构造引擎的共享器具；animation-editor 的像素传递模拟是刻意独立的另一套 |

## DOM 契约

- 工具按钮保持"全部在 DOM、按页 hidden"的形态（`#tool-page` 循环翻页，
  每页 7 个）；`tests/layout.js` 的翻页断言按"翻到可见"而非"存在与否"。
- 图库与工具的穿插状态由 `body.library-open` / `dataset.librarySurface`
  / `dataset.classicTool` 驱动，`#library-groups` 在左侧栏与图库间移动。
  新工具要同时过 `checkParameterConsistency` 与 `checkToolGalleryInterleave`。
- 参数架共享控件的字号统一走
  `clamp(14px, 16px×--u, 17px)`；窄容器（≤640px）下降级为 16px，且
  数值输出不得换行到第二行（会越过固定行高与下一行控件重叠）。

## 已知的历史包袱（有意保留）

- `src/ui/recording.js` 与 `src/ui/recorder-ui.js`：绘画录像的录制、恢复和回放，
  兼容边界由录像格式校验守护。
- `public/classic.css` 与 `styles.css` 的基础层：旧外壳样式，playroom/
  tool-shelf 在其上覆盖。
