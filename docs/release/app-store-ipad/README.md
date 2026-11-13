# iPad App Store 首发

iPad 专用，最低 iPadOS 15.8。一次性付费下载。画板、素材、音乐和隐私政策随包安装，更新由 App Store 分发。

## 1. 本地归档

```sh
IOS_DISTRIBUTION=store IOS_DEVICE=ipad SDK=iphoneos CONFIGURATION=Release IOS_ARCHIVE=1 npm run build:ios
```

本地检查归档位于 `build/releases/v1.12.0/落叶画板-ipad-iphoneos-store-unsigned.xcarchive`。得到 Apple Team ID 并在 Xcode 登录该团队后，使用同一命令并增加环境变量 `IOS_DEVELOPMENT_TEAM`。用 Xcode Organizer 的 App Store Connect 分发流程验证、签名和上传。保留 iPadOS 15.8 设置。

## 2. 准备商品页

- 简体中文填写 [listing-zh-Hans.md](listing-zh-Hans.md)，美国英语填写 [listing-en-US.md](listing-en-US.md)。
- 两种语言的 13 英寸截图在 `build/app-store-ipad/screenshots/` 的对应目录。App 图标取构建生成的 1024×1024 AppIcon。
- 将 [隐私政策](privacy.html) 和 [支持页面](support.html) 发布到同一个公开 HTTPS 目录。支持页面上线前补上可公开的联系邮箱，以及目标地区要求公开的联系地址或电话。确认访客无需登录即可打开页面，再将两条正式 URL 填进后台。
- 按 [发行权核对](rights-review.md) 确认素材来源、发行许可及准确的版权权利人。用与提交归档匹配的版本提供对应源码。

## 3. Apple 后台操作

1. 确认 Apple Developer Program 有效会员和发行团队。注册或确认 Bundle ID `cn.com.yebuluo.luoyeartboard`。在 App Store Connect 的 Apps 创建 iOS 记录，选中该 Bundle ID。建议 SKU 为 `luoye-artboard-ipad`，简体中文为主要语言。商品名以后台的可用性校验为准。
2. 账户持有人在 Business 接受 Paid Apps Agreement，填写银行和税务信息。然后在 Pricing and Availability 设一次性下载价格、基准地区和首发地区。
3. 填写审核联系人姓名、邮箱、含国家区号的电话。完成年龄分级、内容权利、隐私和出口合规问题。最终包的数据处理经核验后，隐私标签预计为 Data Not Collected。根据实际发行定位决定 Made for Kids 和年龄档。选择欧盟前完成 DSA 身份申报，选择中国大陆前确认 App 备案适用性及后台状态。各地区的状态以后台显示为准。
4. 签名并上传构建。在 TestFlight 用 iPad 真机确认断网冷启动、Apple Pencil、素材、音乐、草稿恢复、文件导出、离线隐私页和升级保留作品。最低支持系统优先用实机验证。提审时选已测试构建并粘贴审核备注，发布方式可先选手动发布。

[创建 App 记录](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/) · [上传构建](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/) · [定价](https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price/) · [提交审核](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app/)
