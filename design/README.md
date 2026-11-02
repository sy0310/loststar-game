# 美术设计稿来源、目录和导入方法

**当前仓库的 PNG/MP4 原件导入状态：待补充。** 此文档不是“已全部上传”的证明；清单以 ASSET_MANIFEST.json 为准。

## 原始交付包
- 原始 ZIP：失物星球_V01_完整美术设计稿.zip
- 约 24.7 MB（24,713,443 字节）
- SHA256：2221cba637cadd20c281a87716a3a55fb0cc3751c5c57f186550a6a6f409e87c
- 内含 16 张编号设计稿、3 张额外参考 PNG、1 段 MP4 动画，以及原始 README 与 HTML 浏览页。
- 用户可从提供这些设计稿的 ChatGPT 会话下载原始 ZIP；GitHub 不保证能够读取该会话的 sandbox 下载链接，所以必须上传真实文件。

## 预期目录
design/reference/v0.1/00_总览与设计范围.png 至 15_六星球代表生物与动作意向.png（16 张）
design/reference/v0.1/参考_六星球概念总览.png
design/reference/v0.1/参考_球面探索动作关键帧.png
design/reference/v0.1/参考_远征8秒动画.mp4
design/reference/v0.1/参考_退货箱星完整设定.png
design/reference/v0.1/README_设计说明.md
design/reference/v0.1/index.html（原始离线图库，仅供参考）

## 导入（在 Codex 的工作树内执行）
用户先把 ZIP 下载并交给 Codex 或放在 Codex 可以读取的工作目录；不要假定 ChatGPT 的 /mnt/data 路径在 Codex 环境存在。

例子（将 ZIP_PATH 修改成真实路径）：
~~~bash
ZIP_PATH="/实际位置/失物星球_V01_完整美术设计稿.zip"
mkdir -p /tmp/loststar-originals design/reference/v0.1
unzip -q "$ZIP_PATH" -d /tmp/loststar-originals
cp -a /tmp/loststar-originals/失物星球_V01_完整设计稿/. design/reference/v0.1/
python3 - <<'PY'
import json, hashlib, pathlib
m=json.load(open('design/ASSET_MANIFEST.json',encoding='utf-8'))
missing=[]; mismatched=[]
for a in m['assets']:
 p=pathlib.Path(a['repoPath'])
 if not p.exists(): missing.append(str(p)); continue
 digest=hashlib.sha256(p.read_bytes()).hexdigest()
 if p.stat().st_size!=a['sizeBytes'] or not digest.startswith(a['sha256Prefix']):
  mismatched.append(str(p))
print('missing:',missing); print('mismatched:',mismatched)
assert not missing and not mismatched
PY
~~~
核对通过后更新 ASSET_MANIFEST.json 的 uploaded 状态和 status 字段，提交真实原图文件。不要直接把 ZIP 与已解压文件一起提交以免重复占用仓库空间。

## 分类索引
- 00：总览、设计范围
- 01：基地首页（方向已认可）
- 02：远征球体（方向已认可，遮挡待优化）
- 03：未知雷达（最重要的无剧透规则）
- 04：定位与星球发现
- 05：图鉴详情
- 06：奇物展柜/互动
- 07：飞船、雷达、回收设备升级
- 08：归航和离线结算
- 09：异常事件和奇物
- 10：六星环境（内部策划，不在游戏开局显示）
- 11：退货箱星生物、奇物
- 12：机器人、飞船、怪物动画与遮挡
- 13：UI 色板像素密度
- 14：审核表
- 15：六星球生物及动作意向

## 重要声明
这些是 AI 辅助生成的视觉参考和拼版，不含逐角色透明原画/美术源工程文件。正式游戏资产须基于参考拆分并重制，所有图中文字和数值必须以 docs 为准核对。