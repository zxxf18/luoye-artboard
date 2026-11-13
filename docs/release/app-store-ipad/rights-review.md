# 发行素材核查

2026-11-13 核查了素材索引、构建入口、图库缩略图及部分重绘图与旧程序源图的对照，并核对了音乐的上游许可。新构建使用 795 个图库和魔法袋条目。随包署名见 `credits.txt`。

| 内容 | 核查与处理 |
|---|---|
| 历史素材 | 移出社区版额外提供的 111 项历史条目，包括旧停车场和交付中心背景，以及历史动画、组合图案和动态画笔。社区版、商店版、网页版和离线版共用一个索引。 |
| 贴纸、魔法袋单张、纸样与纹理 | 并排对照发现部分 v1.6 重绘保留了旧软件中的特有轮廓、构图和配色。移出这批旧图，保留可追溯的独立作品。补入 48 张独立贴纸、9 种纸样、9 种纹理，并从其中 42 张贴纸共享图片补齐魔法袋单张。仅用文字生成的提示词和原图 SHA-256 见 `tools/assets/manifests/rights-redraw.json`。 |
| 汽车和背景 | 移除仍可辨认的车型及带红十字标志的救护车。新车使用虚构造型，救援车使用蓝色斜条。两张写实停车场及充电区换成无车辆的独立场景，交付中心名称去除第三方品牌。另替换一张飞船和环形装置容易联想到影视作品的太空图。 [ICRC 标志使用说明](https://www.icrc.org/en/our-emblems) |
| 笔触纸纹 | 两张旧纸纹为旧软件位图直接转换，已用项目自生成的图案替换。生成脚本为 `tools/prepare-materials.py`。 |
| 相框、动画及 283 张界面图 | 相框保留项目重绘版本。图库动画和魔法袋组合及动态保留已重绘的帧。界面图由项目的绘图脚本生成。来源记录见 `tools/assets/manifests/`。 |
| 图标、主题图标和启动插画 | 项目方确认原参考照片可用于商业改编和发行。保留现有角色及 iPad 秋日插画。照片原件不随包分发。生成记录见 `public/branding/PROVENANCE.md`。 |
| 背景音乐 | 保留 20 首 MIDI，逐一复核了对应的 10 个 Mutopia 数字版本，页面均标为 Public Domain。文件、曲目和处理说明随包存于 `music/SOURCES.md`。 [Mutopia 许可说明](https://www.mutopiaproject.org/legal.html) |
| 钢琴音色库 | GeneralUser GS 作者允许软件使用，但声明部分采样的来源无法完全追溯。iPad 和 Windows 已改为共享的 `Luoye-Piano.sf2`，仅使用经哈希核验的 CC0 Meta Piano 样本。来源与许可证随包保留。 [Meta Piano 来源及授权](https://github.com/facebookincubator/Meta-open-sound/tree/514c926efecdb3c7812bf00eedf8e5c8d61dd681/systems/instruments/meta-piano) |
| 字体 | 应用从设备读取系统或已安装字体，构建未包含 TTF、OTF、WOFF 或 WOFF2 字体文件。 |

保存的画作和录制文件包含当时使用的图像数据，可以继续打开。旧安装包和已部署的版本需要以新构建替换，才能让用户收到这次清理。

上架时按实际持有的权利填写版权字段及内容权利问卷。程序发行另按根目录 AGPLv3 处理，确认分发条款和对应源码。若发行主体选择另行授权，需要持有相关代码贡献的再许可权。 [Apple 知识产权审核条款](https://developer.apple.com/app-store/review/guidelines/#intellectual-property)
