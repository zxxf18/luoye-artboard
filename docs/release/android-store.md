# Android 商店版准备

本轮范围：重绘魔法袋连续/动态素材和动画图库、替换品牌背景、增加渠道显示开关、建立正式签名。没有向任何应用商店提交。

## 构建与入口开关

普通客户端默认显示项目地址和支持作者入口。两个渠道共用当前素材索引。

```sh
node tools/build-client.mjs
```

上架版默认关闭两个入口。“关于”保留应用名、版本、图标和返回按钮。

```sh
node tools/build-client.mjs --store
# 可分别覆盖默认值：
node tools/build-client.mjs --store --project-link=on --donation-link=off
```

Android 渠道构建（需要 JDK 17 和本地 Android SDK）：

```sh
cd android
./gradlew -Pdistribution=store assembleRelease
```

签名后 APK：`android/app/build/outputs/apk/release/app-release.apk`。
社区版本使用 `-Pdistribution=community`（默认值）。切换渠道会使 Web 资源同步任务重新运行，不复用错误渠道的缓存。

## 正式签名

本机密钥目录：`~/.android-keystores/luoye-release/`。

- `luoye-release.jks`：RSA 3072 位发布私钥，别名 `luoye-release`，有效期 30 年。
- `signing.properties`：密钥路径、别名和随机密码，权限为 600；目录权限为 700。
- 公开证书：仓库 `android/release-certificate.crt`。公开证书可以提供给商店，私钥和密码不可提供。
- 证书主体：`CN=zhaoxin, O=zhaoxin, L=shanghai, ST=shanghai, C=CN`。

Gradle 默认读取上述配置；其他构建机通过 `LUOYE_SIGNING_PROPERTIES` 指向私密配置。配置字段是 `storeFile`、`storePassword`、`keyAlias`、`keyPassword`。不要把真实配置放入 Git，也不要在日志中打印。

请将密钥和密码分别做加密备份。丢失发布密钥可能导致现有安装无法继续更新；不要为每次版本重新生成密钥。release 缺少签名材料时必须构建失败，debug 构建仍可使用。

已有测试签名包不能直接覆盖安装新的正式签名包。卸载测试包前导出作品并确认可以恢复。后续商店更新保持包名和签名兼容，递增 versionCode。

## 素材与许可

- 重绘计划和完整提示词：`tools/assets/manifests/store-refresh.json`。
- 生成方式：内置 ImageGen；原始帧表在 `local-only/store-art/masters/`，不随 APK 分发。
- 发布工具：`node tools/assets/publish-store-art.mjs`。检查全批次齐全、透明图含 alpha 后，切帧并更新两个目录索引。
- 新版分类、ID、分组数及帧间隔保持不变；动态分组由原创动作帧生成不同配色。
- `tools/assets/asset-distribution.mjs` 为各渠道及开发服务器读取同一份素材索引。版权核查后，111 个旧版条目及对应文件已移出公开素材目录。详细记录见 [发行素材核查](app-store-ipad/rights-review.md)。
- 新增替换背景中，充电停车场、交付中心充电区采用原创无品牌写实摄影风格；其他绘本背景及原有其余风格继续保留。
- 原创无品牌设计可降低侵权风险，不代表法律上的绝对无争议保证。
- 商店开关只控制推广入口。客户端包保留 `LICENSE.txt` 和 `SOURCE.txt`，不取消 AGPL 的声明及对应源码义务。正式分发前，应将对应版本完整源码以满足许可证的方式提供，并核对所有其他素材的权利链。

## 提交前剩余事项

向学而思确认主体、备案、软著、包体上限和渠道要求；完成目标学习机上的文件保存、草稿恢复、家长管控退出和升级验收。当前签名构建并不等同于通过商店审核。

## 本轮完成与验证

- 32 组连续图片、22 组动态图片及 45 组独立动画，共 99 张原创帧表；保留 944 张魔法袋帧与 360 张动画帧的数量和分类契约。
- 12 张停车场/交付中心背景替换为原创无品牌场景；完整提示词与生成来源、原图 SHA-256 记录在 `tools/assets/manifests/store-refresh-provenance.json`。
- `node tools/assets/audit-store-art.mjs`：99 张帧表全部通过逐帧透明度、非空和切分边界检查。
- 220 项 Node 测试通过；浏览器 frames、stamps、tablet-shell 回归通过。平板测试修复了持有导航前 about:blank 文档的竞态，验收条件和等待时限保持不变。
- 商店“关于”窗口在 1600×1000、2000×1200、1000×600 下检查通过，无空白链接行、无越界、无运行错误。
- Android `lintRelease assembleRelease` 成功；`apksigner verify` 通过 v1/v2 签名验证；缺少签名配置的 release 构建按预期失败。
- APK 内 4368 个运行素材路径齐全；未夹带索引之外的图片，也没有旧的 12 张品牌背景文件。许可文件保留。
- 包体约 473 MiB，需向学而思确认允许的上限；没有为减小体积而新增联网资源下载。
- 这些是本地自动化和浏览器验证，不替代学而思目标设备的最终验收；没有提交上架。

Android 也可单独覆盖入口（会参与构建缓存判定）：

```sh
./gradlew -Pdistribution=store -PprojectLink=on -PdonationLink=off assembleRelease
```

证书 SHA-256：`633ffa7a00cb52c6c65f6a07c1faabfa133980a2cd166eae8b86aec12c4772d4`。
动画预览：`build/store-art-preview.gif`；无品牌背景总览：`build/store-backgrounds.png`。

## 新旧素材的构建选择

非上线 Android 版本（新旧素材并存）：

```sh
./gradlew -Pdistribution=community assembleRelease
```

上线 Android 版本（只含新素材）：

```sh
./gradlew -Pdistribution=store assembleRelease
```

Web 资源同样支持 `npm run build -- --store`。不加 `--store` 时采用 community 的入口默认值，两种配置使用同一套素材。

两种 APK 分别保存于 `build/releases/android-community/app-release.apk` 和 `build/releases/android-store/app-release.apk`，均使用已创建的同一正式签名。应用包名相同，用于不同发行场景，不是可并行安装的两个应用。

历史增补包的验证和旧素材范围见 [v1.12.0 社区补包记录](v1.12.0-community-refresh.md)。已下载的历史包保留当时的素材。
