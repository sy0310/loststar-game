# TapTap 国际版交付记录

## 当前范围

英文名称采用 `Lostship: Star Surge`。国际版增加可切换的中英文显示和独立 Android 宿主，沿用现有十五分钟生存玩法、九种主动装备、八种辅助、六加六槽位与原经济数值。

用户已授权国际版上传与发布，并明确同意 Android SDK 协议及安装构建。代码继续提交 Draft PR #2。

## 运行包

| 项目 | 实际值 |
| --- | --- |
| 运行源码 | `daf3c44076567b5e0b3e9313ac49f8b67536ff52` |
| 版本 | `0.6.10-global.1`，VersionCode 1 |
| 包名 | `com.shuhua.lostship.starsurge` |
| 文件 | `releases/survivor-global/lostship-star-surge-daf3c44.apk` |
| 大小 | 6,389,739 字节 |
| SHA256 | `9f6ded5ba48dcdc7492635d35ec7b6680cfbd5d3872c9c10f3197e077b2ee556` |
| 系统声明 | 最低 Android 8，目标 Android 15 |
| 内容 | 87 个运行资源，已逐文件比对 APK 解包内容 |
| 签名 | 自有 RSA 4096 证书，APK v2 签名及 zipalign 验证通过 |

可复现构建与测试命令见 `prototypes/salvage-survivor-demo/international/README.md`。签名私钥及凭据保存在本机 `~/.local/share/lostship/signing/`，未来更新需要继续使用这套签名。

Android 使用本地 HTTPS app-assets 加载游戏。主界面及暂停页提供语言切换，语言选择在本机保存。Android 返回键接入原暂停逻辑，后台切换请求原暂停动作。应用处理系统栏和屏幕安全区。包内清单没有网络或用户资料权限。

## 兼容与修复

83 个原运行源文件与中文基线 `937db29` 的哈希相同。`src/game.js` 补了一行界面更新，恢复存档并解除输入锁后，重新更新原刷新按钮。该修复解决升级页续玩后残留“保存中”及按钮不可用的问题。国际导出层另将两处 Canvas 短提示接入翻译。

升级价格、掉落、随机模型、进化条件及持久化实现保持原版本逻辑。浏览器回归覆盖原星球、章节、航路命名空间的隔离和旧生存档迁移。Android 安装拥有独立应用存储。

## 测试证据

| 验证 | 记录 |
| --- | --- |
| 英文与切换 | 20/20，通过 Chromium、WebKit，360×800 与 390×844 |
| 持久化与经济 | 60/60，同一国际版 HTTP 运行资源 |
| 规则脚本 | 当前 `npm test` 输出 121 条 PASS |
| APK 资源 | 87/87 哈希匹配，包体 SHA256 匹配 |
| Android lint | 0 错误，7 警告，详情在 `artifacts/survivor-global/android-lint.json` |
| Android 原生操作 | 两项通过，签名 Release 的 MotionEvent 位移 341.25 世界像素、返回暂停、语言保持与冷启动续玩 |
| 真机 | 待测 |

`artifacts/survivor-global/package-verification.json` 记录运行包、原文件差异和完整资源哈希。`browser.json` 与 `storage.json` 记录新包的实际执行结果。

模拟器使用独立 AVD `lostship-global-35`。启动时明确指定本机 SDK 的 `platform-tools/adb`。硬件图形进程在第一项完成后挂起退出，后续使用官方 SwiftShader 后端恢复验证。冷启动后继续了已保存的 3.2833 秒进度并正常结算。`android/summary.json` 记录两个阶段的运行源码及渲染后端，Android 模拟器结果与手机实测分开记录。

## 英文素材

`design/star-salvage/international/STORE_COPY_EN.md` 保存实际英文商店文案。

`design/star-salvage/international/media/` 包含已批准 Logo、英文宣传图、900×600 视频封面、六张英文运行截图和三十秒连续战斗录像。

六张截图使用同一正式玩家入口恢复合法的准备配置。展示敌群、紫金雷网、Boss、引力融合、普通升级和精英融合选择。截图为 780×1688，捕获版本与运行源码一致。完整画面和配置来源记录在 `artifacts/survivor-global/gallery-capture.json`。

录像从中后期合法配置的检查点进入，保留真实输入、敌人、损伤、升级与游戏输出音轨。每五秒核验位移和输入活跃度。录像按桌面浏览器来源标注，Android 功能截图另存。

英文海报基于已认可宣传图改制。生成原图、提示词、技术导出与哈希见素材目录的 `provenance.json`。

## 平台状态

已在国际版开发者后台创建游戏草稿。

| 项目 | 后台读取值 |
| --- | --- |
| 厂商 | ShuHua，33869464 |
| 游戏 | Lostship: Star Surge，34263229 |
| 资料版本 | V-20261115 |
| 状态 | 未发布 |
| 已核对字段 | Logo、英文名、简介、更新说明、推荐语、开发者说明 |

后台编辑入口为 https://developer.taptap.io/33869464/app/34263229/update-app-v2?panel=promote_data&version=V-20261115 。

素材与 APK 的最终绑定、提审回执仍需完成。浏览器文件上传要求 ChatGPT 扩展允许访问文件网址。用户已授权该权限，扩展设置页受当前工具的 URL 安全策略拦截，已请求用户手动开启。系统文件选择器可传输图片，后台切页及保存过程中出现恢复旧草稿的情况，最终材料需要重新绑定并回读。

当前状态据实际后台记录填写。最终审核和公开上架状态以平台回执更新。

## 尚待验证

- Android 实体手机的拖动、音效、音乐、刘海安全区、锁屏恢复及低端机性能。
- Android 8 至 14 的设备与 WebView 组合。最低系统版本属于安装声明，当前实测环境为 Android 15 模拟器。
- 英文内容与实际趣味的用户审核。
- 国际版素材绑定、APK 解析、提交审核及平台最终结果。
