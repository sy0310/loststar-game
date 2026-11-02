# V0.1 实测记录

测量时间：2026-11-02T17:49:03.841Z。硬件：Apple M2 Pro，darwin 25.5.0 arm64。

生产构建、本机 HTTP、全新浏览器上下文；每项连续采样 6 秒。rAF 帧间隔包含浏览器调度，Canvas draw 只统计 JS 发出绘制指令，不等于完整 GPU/合成耗时。

| 浏览器场景 | CSS 视口 | 帧样本 | 中位间隔 | P95 间隔 | Chromium JS 堆末值 |
| --- | --- | --- | --- | --- | --- |
| chromium-360 | 360×800 | 359 | 16.7 ms | 17.6 ms | 2.02 MiB |
| chromium-390 | 390×844 | 359 | 16.6 ms | 17.6 ms | 2.02 MiB |
| chromium-desktop | 1440×1000 | 359 | 16.7 ms | 17.5 ms | 1.65 MiB |
| chromium-390-cpu4x | 390×844 | 359 | 16.7 ms | 17.3 ms | 2.01 MiB |
| webkit-390 | 390×844 | 360 | 17.0 ms | 18.0 ms | 未测 |

**这些是桌面 headless 浏览器测量，不是 iOS/Android 真机认证。** 4× CPU 是 CDP 模拟，不能等同低端手机；未测持续发热、后台回收、GPU 内存、低端 WebView 和真实弱网。JS 堆不含图片解码与浏览器纹理。

- 首屏非 HTML 资源 encodedBodySize 总计：401,733 字节（401.7 KB，本机服务器已压缩 JS/CSS）。HTML 另约 0.44 KB。
- 全部构建资源（JS/CSS + 10 张 WebP，不含 HTML）：833,508 字节（833.5 KB，磁盘未压缩大小）。
- 生产美术 WebP 共 785,896 字节。最大单图 768×1024（基地）。
- 全部 10 张纹理若同时解码为 RGBA8，理论原始像素合计 7,174,144 字节（6.84 MiB）；这是尺寸推算，不是实测 GPU 占用。远征 Canvas 为 768×730，另有同尺寸静态星空缓存，各约 2.14 MiB 原始 RGBA。
- 基地背景不在远征首屏网络请求清单中；概念 PNG/MP4 全部排除构建。
- 实际运行录屏：12.00 秒，390×844、30/1，622.8 KB。录制时使用真实墙钟，无时间快进、无冻结帧。视频编码 30fps 不代表手机真机帧率。
- 四张遮挡关键帧通过 review 视觉时钟冻结复现；不修改存档或奖励。
- 录制页面 JS 异常：0。流程测试另检查页面错误与 404。

原始数据：[performance.json](../artifacts/performance.json)。复现：

```bash
npm ci
npm run build
npm run preview -- --port 4173
# 另一个终端；需安装 ffmpeg/ffprobe
npm run capture
node scripts/report.mjs
```
