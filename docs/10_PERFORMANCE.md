# 首星打磨版：实际资源与性能记录

测量时间：2026年11月2日 GMT-5 16:17:31（America/New_York）。硬件：Apple M2 Pro，darwin 25.5.0 arm64。

生产构建、本机 HTTP、全新浏览器上下文，动画正常运行；每项连续采样 6 秒。没有用假时间测 FPS。rAF 帧间隔包含浏览器调度；Canvas draw 只统计 JS 提交绘制，不代表完整 GPU/合成耗时。

| 场景 | CSS 视口 | 帧样本 | 中位间隔 | P95 间隔 | Chromium JS 堆末值 |
| --- | --- | --- | --- | --- | --- |
| chromium-360 | 360×800 | 359 | 16.6ms | 18.4ms | 1.93 MiB |
| chromium-390 | 390×844 | 359 | 16.7ms | 18.1ms | 1.96 MiB |
| chromium-desktop | 1440×1000 | 359 | 16.7ms | 17.7ms | 1.97 MiB |
| chromium-390-cpu4x | 390×844 | 359 | 16.7ms | 17.9ms | 1.87 MiB |
| webkit-390 | 390×844 | 258 | 17.0ms | 19.0ms | 未测 |

**以上是桌面 headless 浏览器测量，不是 Android/iOS 真机认证。** CDP 4× CPU 不等同低端手机，未测持续发热、GPU 内存、后台回收、真实弱网和低端 WebView。JS 堆不含全部图片解码或 GPU 占用。

- 远征首屏非 HTML encodedBodySize 总计 **676,600 字节**（676.6 KB，本机服务器已压缩 JS/CSS）。HTML 另约 0.44 KB。
- 全部构建资源（JS/CSS + 25 张 WebP，不含 HTML）：**1,546,078 字节**（1.55 MB，磁盘未压缩大小）。
- 运行时美术 WebP 共 1,446,482 字节；最大单图 768×1024。概念参考 PNG/MP4 没有进入构建。
- 全部纹理若同时按 RGBA8 解码，理论原始像素合计 12,680,448 字节（12.09 MiB）；这是尺寸推算，**不是实测 GPU 内存**。
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

## PR #2 Phase 1.5 冷加载与声音

- 首次默认基地，远征图集延后到首次进入远征加载。基地背景为显式高优先级图片，解码后才显示角色与展品。
- 桌面 Chromium、禁用缓存、180ms 延迟、96KB/s 下载、64KB/s 上传，真实墙钟 8335ms 后基地整体就绪；是一次桌面限速首访样本，不是移动设备弱网认证。
- [冷首次视频](../artifacts/phase1-5/cold-base-first-visit.mp4)、[请求日志](../artifacts/phase1-5/cold-network.json)、[当前逐帧和字号证据](../artifacts/phase1-5/index.html)。
- 音效实时合成，无额外网络音频资源。WAV 审听文件只在开发证据中，不进入 Vite 构建。
- npm run capture:review 复现冷加载、字体、日记、音效和放大片段；需生产预览 4173 与开发服务 5173。日记用测试时钟模拟，不是实际 60 分钟稳定性测试。

### WebKit 样本差异

本轮主记录的 WebKit 六秒窗口获得 258 个帧间隔样本；中位数不能证明全程稳定 60fps。未隔离该次样本缺口的原因，保留原始记录。额外独立六秒探针获得 359 帧，平均 16.68ms，最大 34.0ms，超过 50ms 的间隔 0 个。两次结果均仅代表桌面 WebKit，不能据此宣称 iOS 稳定性通过。原始 [诊断 JSON](../artifacts/phase1-5/webkit-diagnostic.json)，可由 capture:review 重现。
