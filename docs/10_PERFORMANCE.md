# 首星打磨版：实际资源与性能记录

测量时间：2026年11月2日 GMT-5 15:23:11（America/New_York）。硬件：Apple M2 Pro，darwin 25.5.0 arm64。

生产构建、本机 HTTP、全新浏览器上下文，动画正常运行；每项连续采样 6 秒。没有用假时间测 FPS。rAF 帧间隔包含浏览器调度；Canvas draw 只统计 JS 提交绘制，不代表完整 GPU/合成耗时。

| 场景 | CSS 视口 | 帧样本 | 中位间隔 | P95 间隔 | Chromium JS 堆末值 |
| --- | --- | --- | --- | --- | --- |
| chromium-360 | 360×800 | 359 | 16.7ms | 18.0ms | 2.20 MiB |
| chromium-390 | 390×844 | 359 | 16.7ms | 18.1ms | 2.46 MiB |
| chromium-desktop | 1440×1000 | 360 | 16.7ms | 18.3ms | 2.46 MiB |
| chromium-390-cpu4x | 390×844 | 359 | 16.6ms | 18.2ms | 2.45 MiB |
| webkit-390 | 390×844 | 360 | 17.0ms | 19.0ms | 未测 |

**以上是桌面 headless 浏览器测量，不是 Android/iOS 真机认证。** CDP 4× CPU 不等同低端手机，未测持续发热、GPU 内存、后台回收、真实弱网和低端 WebView。JS 堆不含全部图片解码或 GPU 占用。

- 远征首屏非 HTML encodedBodySize 总计 **607,565 字节**（607.6 KB，本机服务器已压缩 JS/CSS）。HTML 另约 0.44 KB。
- 全部构建资源（JS/CSS + 23 张 WebP，不含 HTML）：**1,362,244 字节**（1.36 MB，磁盘未压缩大小）。
- 运行时美术 WebP 共 1,280,874 字节；最大单图 768×1024。概念参考 PNG/MP4 没有进入构建。
- 全部纹理若同时按 RGBA8 解码，理论原始像素合计 10,812,672 字节（10.31 MiB）；这是尺寸推算，**不是实测 GPU 内存**。
- 场景 Canvas 与静态星空缓存均为 832×740，每张约 2.35 MiB RGBA。非远征页不继续重绘远征 Canvas，模拟计时仍继续。
- 实际运行录屏 42.00 秒，390×844，编码 30/1，文件 2.27 MB。**全程真实墙钟，无时间快进、无冻结帧、无脚本点击**；包含收据与拆封鼠两次实际发现。编码 30fps 不表示手机实测 30fps。
- 12 秒短片是同一连续录屏 9.5–21.5 秒的裁切，无快进。
- 五页图像以 CSS 390×844 视口输出精确 390×844 PNG，并提供 @2x 780×1688 版本。流程静态图使用加速测试时钟；遮挡关键帧只冻结视觉时钟和对应 HUD，不修改存档或奖励。
- 录制页面 JS 异常：0；E2E 另检查缺图、页面错误和导航遮挡。

原始数据：[performance.json](../artifacts/phase1/performance.json)。复现：

```bash
npm ci
npm run build
npm run preview -- --port 4173
# 另一个终端；需 ffmpeg/ffprobe
npm run capture
npm run report
```
