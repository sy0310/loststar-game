# 同机短测性能对照（待真机）

M2 Pro，390×844、DPR2，每场10秒、串行1上下文、不录屏。下表为实际绘制，不以rAF当绘制。

|引擎 / 场景|V043绘制帧/P95ms|V044绘制帧/P95ms|
|---|---|---|
|chromium / collection|595 / 17.4|600 / 17.2|
|chromium / receipt|600 / 16.7|600 / 16.7|
|chromium / tape|600 / 16.7|601 / 16.7|
|chromium / bell|601 / 16.7|600 / 16.7|
|chromium / tape-ii|600 / 16.7|600 / 16.7|
|chromium / bell-active|601 / 16.7|601 / 16.8|
|webkit / collection|417 / 34.0|600 / 19.0|
|webkit / receipt|600 / 18.0|600 / 19.0|
|webkit / tape|585 / 18.0|600 / 19.0|
|webkit / bell|600 / 18.0|599 / 19.0|
|webkit / tape-ii|591 / 18.0|600 / 19.0|
|webkit / bell-active|594 / 18.0|599 / 19.0|

旧版重复采样存在波动：收藏室598帧/19ms；收据559帧/33ms而rAF仍正常。原始重复轨迹保留在baseline-trace。此次修正绘制节拍丢弃正常抖动帧的问题，并停止不可见近景的无关绘制；不据此宣称纹理解码是根因。新包12场>100ms绘制间隔均0。

短测不证明手机稳定60fps。实际TapTap/低端WebView、锁屏、发热及GPU常驻未测。
