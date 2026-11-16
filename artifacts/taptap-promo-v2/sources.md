# v2来源

画面复用v1提交 `9e8271ed3ea1f231ee0e1559a6f8d0ef9ad8e600` 中的实际精选片段，捕获源码为 `4ba48981fa2b63ed6e26ebc5f658a92cc643a9a5`。完整的180秒普通新局、14秒进化、22秒融合和45秒后期实操记录见 [父版来源](../taptap-promo-v1/sources.md) 与 [实际采集证据](../taptap-promo-v1/recording-evidence.json)。

本版新增取用原融合录制5.5～14.5秒，导出为 `source-footage/fusion-after.mp4`。九秒画面从同次录制的真实视频和音效对齐导出，展示融合后蜂机继续走位、射击和放电。原录像和音轨分别为本机 `releases/taptap-promo-v1-private/fusion/raw-page.webm` 与 `game-sfx.webm`，所取区间全程为正常战斗。`sources.json` 保存新增区间与全部输入文件摘要。

普通新局镜头用于4～14秒。高级镜头使用已验证的合法配装快照，通过普通继续入口运行，记录正常敌人、伤害和输入。34～54秒对应后期原录制3.164～23.164秒。片中来源标签按实际镜头变化。

新配乐《Relay Chase》由 `compose_music.py` 在本项目中创作并合成，144 BPM、48kHz立体声。鼓、低音、琶音与旋律通过振荡器及固定种子噪声生成，和声为D小调、降B、F、C，旋律与节奏完整保存在脚本。`music-provenance.json` 绑定脚本和WAV摘要。游戏攻击、爆炸、升级与融合声音继续采用对应画面的实际录制音轨。

封面从实际战斗底片提取，字体沿用本机系统黑体简体字面。成片为1080×1920，源视频25fps以重复原帧转为30fps，完整游戏视口保持原比例。
