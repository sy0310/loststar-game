# 音频源与测量

- user-music保留用户提供的两首MP3原始字节。
- user-music-manifest.json记录原始与运行文件SHA256、体积、时长、尾静音、响度与完整转换命令。
- import_music.py导出同源流媒体用的96kbps MP3。
- render_previews.cjs从实际运行音色渲染试听WAV。
- audition-report.json绑定30份试听的源代码哈希、文件哈希、时长、峰值和声部记录。
- verify_audio.cjs在独立HTTP端口执行Chromium／WebKit回归，包含MP3 Range／206路由。
- browser-verification.json绑定实际音频实现与浏览器结果。

音效和程序回退音乐为原创合成，默认背景使用用户认可的两首音乐。试听不会启动用户游戏或读取任何旧存档。真实手机与最终听感分别验收。

主说明位于上层AUDIO_DESIGN.md。运行音频实现位于prototypes/salvage-survivor-demo/src/audio-engine.js。主代理统一格式化该文件后，应重新运行浏览器回归和试听渲染，以更新源哈希绑定。

`recordingStream()`通过最终混音分流提供只读录制音轨。Chromium／WebKit独立回归另保存两段实际音乐与SFX混音录制。暂停状态与流式音乐回归均与源码SHA绑定。

CI可设置`SURVIVOR_AUDIO_REPORT=releases/audio-browser-verification.json`。报告写至指定路径，实际混音录音写至其同级audio-recordings目录，保留production下已提交的固定包证据。未设置时仍更新本目录证据。

## Linux录制验证修正

首次两份CI的Linux WebKit录制器均返回0字节，实际音乐与音效的总线RMS断言已通过。游戏本身不使用MediaRecorder。验证脚本现在使用AudioWorklet读取同一个最终总线的真实PCM，保存WAV，要求至少1秒非静音实际采样，同时保留原音乐／音效RMS断言、并发与32项覆盖。使用[W3C AudioWorklet处理规范](https://www.w3.org/TR/webaudio/#AudioWorkletProcessor)。

一次Mac复测在等待WebKit首曲播放5秒处超时，原报告缺少失败页面详情，原因尚未确定。新增完整失败页面状态诊断后，一次32项零重试全套通过。该次失败仍保留于artifacts/survivor-v061/audio-portability/initial-mac-timeout.json，手机首手势与后台恢复继续待实机。运行音频源码及TapTap469347包均未改动。
