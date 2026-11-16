# v0.6.1 声音与音乐设计

默认背景音乐采用用户已提供并认可的 Nebula Groove、Nebula Loop。武器与交互音效由原创 WebAudio 合成。音频模块接收战斗事件与播放状态，音量偏好由主游戏保存。

## 两首实际音乐

| 曲目 | 原始时长 | 原始字节 | H5字节 | H5码率 |
|---|---:|---:|---:|---:|
| Nebula Groove | 200.0秒 | 4,853,599 | 2,400,932 | 96kbps |
| Nebula Loop | 185.2秒 | 4,354,951 | 2,223,192 | 96kbps |

两首运行文件合计4,624,124字节，双声道44.1kHz。原始文件逐字节保存在 production/audio/user-music。转换程序、原始SHA256、运行SHA256、ffprobe结果和响度测量由 production/audio/user-music-manifest.json 记录。用户提供的两首原件均已实际读取。

两遍响度处理目标为−17LUFS、真峰值上限−2dBTP。MP3编码后的实际测量均约−17.41LUFS，真峰值分别为−4.76／−4.68dBTP。检测阈值−52dB，未发现超过0.35秒的尾部静音，保留原时长。文件末端保留0.15秒短淡出，运行时使用约2秒等功率交叉淡化。

正常播放依次为 Groove → Loop → Groove。结算与暂停保留当前位置，下一局或继续时接续当前曲。阶段提高时仅做轻微背景电平调整，升级卡期间音乐继续并降低约28%。Boss、进化、融合与结算短音会短暂压低背景音乐。

## 武器音色

| ID | 对象 | 声音要点 | 同类最短间隔 |
|---|---|---|---:|
| cannon | 脉冲主炮 | 短促三角波下滑、窄脉冲起音，进化后延长并带锯齿能量边 | 75ms |
| drone | 追踪无人机 | 分离的双电子定位声，进化与融合增加可区分的多机节拍 | 90ms |
| arc | 电弧线圈 | 带通电噪与快速电压扫频，进化提高频谱与持续感 | 130ms |
| missile | 震荡导弹 | 低通喷射与低频下降，进化为短序列推进脉冲 | 180ms |
| blade | 旋刃护卫 | 金属刃切高频瞬态，融合叠加低频爆裂尾音 | 150ms |
| shield | 离子护盾 | 柔和双音共振，进化加入护壁低频脉冲 | 220ms |
| prism | 折跃棱镜 | 三枚分离的玻璃质高音，具有轻微左右展开 | 160ms |
| gravity | 引力锚 | 低频吸入扫音与滤波气流，进化延长坍缩感 | 450ms |

`play(id,{evolved,fused,strength})` 控制强化版本和事件强度。强化保留每种武器的声学身份。连续攻击通过同类限流保持听觉清晰，重要反馈可替换较低优先级的武器短音。

## 公共事件

| ID | 反馈 |
|---|---|
| hit | 轻金属接触与短高通碎片声 |
| explosion | 低频冲击与衰减噪声 |
| pickup | 单枚上扬晶体声 |
| scrap | 两枚短促零件确认声 |
| heal | 温暖三音修复回应 |
| hurt | 下行受击声，暂时压低背景 |
| upgrade | 三音上行，升级卡期间继续背景 |
| evolution | 明确的上行能量展开 |
| fusion | 两侧展开并汇聚的合成提示 |
| boss | 三段低频接近信号 |
| victory | 较完整的上行完成句 |
| defeat | 克制的下行结束句 |

音效采用自有振荡器、噪声、包络和滤波器。音频随机流与游戏随机流分开。所有控制均无需读取游戏存档。

## 音量和声部

默认主音量0.8、音乐0.25、音效0.55。三者均支持0～1连续调整，另有静音开关。背景音乐与音效分属独立总线，重要短音使用背景duck。

合成总声部上限24，音效上限18，程序音乐上限8。默认流式音乐只有两个HTMLAudio元素，交叉淡化期间同时播放两路，其余时间一条。合成音效与流式音乐同时运行时最多20个播放源。`inspect()` 分别记录合成声部、媒体元素、调度器、实际总峰值和限流计数。

两首长曲交给HTMLAudio流式播放，源码没有对整首MP3调用decodeAudioData。默认MP3读取同源assets路径，支持Range／206的预览服务便于Safari定位和循环衔接。外部URL替换需要服务器允许音频跨源读取；单首加载失败会选择另一首，全部失败时使用原创程序音乐回退，战斗仍继续。

## 稳定段实测电平

独立浏览器使用默认主音量0.8、音乐0.25，阶段2的媒体增益0.935，HTMLAudio自身volume为1。两首在曲内约5.16秒后采样1秒，2秒入场／交叉淡化已结束。无SFX，duck为1，限幅压缩量接近0dB。

| 浏览器 | 曲目 | 实际混音RMS | RMS dBFS | 窗口峰值dBFS |
|---|---|---:|---:|---:|
| Chromium | Groove | 0.01127 | −38.96 | −24.02 |
| Chromium | Loop | 0.01455 | −36.75 | −25.22 |
| WebKit | Groove | 0.01215 | −38.31 | −24.02 |
| WebKit | Loop | 0.01633 | −35.74 | −22.24 |

稳定段数据由browser-verification.json记录实际媒体位置和各级gain。录制接口冒烟检查中的较低音乐值取自淡入中的安静开头，不能代表整首响度。音量模型仅对音乐总线应用一次0.25，媒体增益负责阶段强度及淡化。默认值维持原批准设置，最终听感仍需实际游戏混音审核。

## 手势与生命周期

首次用户手势调用`unlock()`，它只等待AudioContext恢复。音乐的两个元素在同一手势中发起静音预解锁，加载结果异步处理；网络较慢时，SFX与开局操作可先使用。首次手势之前不会创建播放AudioContext或媒体元素。浏览器恢复音频的请求设置1.5秒等待上限，未完成时释放等待，下一次手势可重试。迟到的running状态会按当前游戏状态恢复单套调度，游戏流程无需等待音频成功。

`playing:false,paused:false`用于结算或菜单，只停止音乐，胜败短音可以播完。`paused:true`用于真实暂停，停止短音、音乐与交叉淡化调度。文档隐藏和pagehide也会停止输出，恢复时依据主游戏传入的暂停状态处理。继续同一个AudioContext，保持一套音乐调度。

升级卡使用`playing:true,paused:false,upgrade:true`，背景保持播放并适度降低。选卡后传入`upgrade:false`恢复电平。

```js
// 在用户点击开始、继续或音频开关的处理函数中调用。
void window.SurvivorAudio.unlock();
window.SurvivorAudio.configure({master:0.8,music:0.25,sfx:0.55,muted:false});
window.SurvivorAudio.setState({playing:true,paused:false,phase:1,boss:false,upgrade:false});
window.SurvivorAudio.play('prism',{evolved:true,strength:1});

// 结算允许胜利提示播完。
window.SurvivorAudio.setState({playing:false,paused:false});
window.SurvivorAudio.play('victory');

// 可替换为用户之后提供的同源音乐，null恢复当前两首曲目。
window.SurvivorAudio.configure({musicUrl:'./assets/audio/user-theme.mp3'});
window.SurvivorAudio.configure({musicUrl:null});
```

AudioContext不可用时，接口返回安全状态，游戏可继续。音量配置为数值类型。主游戏负责独立保存偏好。

## 实际录制总线

`recordingStream()`在已创建播放AudioContext后，首次调用才将最终limiter分流至MediaStreamDestination，返回一个音频MediaStream。重复调用返回同一流。尚未解锁、浏览器不支持时返回null。两首HTMLAudio的MediaElementSource和全部SFX均经过这一最终混音总线。

原扬声器线路继续保留，录制总线包含当前主音量、音乐／音效电平、duck和限幅。此接口不请求麦克风或系统音频。暂停、后台和静音规则同时作用于录制输出。主集成可将游戏Canvas的视频轨与该流的音频轨交给MediaRecorder。录制器结束时保留共享音频轨，避免调用track.stop()中断下一次录制。

独立Chromium／WebKit回归实际采集音乐段及SFX段，分别测得非零RMS，并保存短录音至production/audio/auditions。该隔离证据包含真实混音，战斗音画合成由主集成另行录制。

## 实际试听与复现

production/audio/auditions保存8种基础武器、8种强化版本及12种公共事件的1.3秒WAV。另有约43.64秒原创合成回退音乐和4秒声部压力试听。所有文件由实际运行音色通过OfflineAudioContext渲染，峰值、RMS、DC、时长和源文件SHA由audition-report.json记录。

- [主炮](production/audio/auditions/cannon.wav)
- [电弧](production/audio/auditions/arc.wav)
- [棱镜](production/audio/auditions/prism.wav)
- [引力锚](production/audio/auditions/gravity.wav)
- [融合](production/audio/auditions/fusion.wav)
- [原创合成回退音乐](production/audio/auditions/original-fallback-music-44s.wav)
- [运行版Groove](../../../prototypes/salvage-survivor-demo/assets/audio/nebula-groove.mp3)
- [运行版Loop](../../../prototypes/salvage-survivor-demo/assets/audio/nebula-loop.mp3)

```bash
node --check prototypes/salvage-survivor-demo/src/audio-engine.js
python3 design/star-salvage/v061/production/audio/import_music.py
node design/star-salvage/v061/production/audio/verify_audio.cjs
node design/star-salvage/v061/production/audio/render_previews.cjs
```

首次导入从用户给出的Mac真实路径读取，归档原件可供后续复现。两个浏览器的独立HTTP回归实际验证了手势解锁、同源MP3、2秒曲目交叉淡化、暂停续播、结果短音、静音、声部限流、失效音乐回退及无AudioContext路径。5秒音乐网络延迟夹具下，解锁实测样本为Chromium约326ms、WebKit约173ms，SFX可先播放。采样时长属于桌面回归样本。

用户已认可两首原音乐。运行编码后的听感、音效混音、真实Safari／TapTap手机的输出与锁屏恢复，由主集成回归和用户实机继续确认。
