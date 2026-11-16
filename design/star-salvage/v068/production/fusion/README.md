# v0.6.8 融合武装实体层

内建 ImageGen 分别生成三份原创透明主体参考。原字节文件保存在 originals，完整提示保存在 prompts.json。生产流程复用 v0.6.5 的原生网格归一和既有武器色板，再整理轮廓、导电接点及中心孔洞，全部实际像素变更保存在 native-edits.json。

| id | 原生尺寸 | 实体内容 | 中心 |
| --- | --- | --- | --- |
| eventhorizon_core | 64×64 | 金白双亮弧吸积盘与暗紫孔缘，中心透明 | 32,32 |
| eventhorizon_ring | 64×64 | 六段紫晶机械外环与黄铜夹具，内部透明 | 32,32 |
| thunder_relay | 40×40 | 四向双叉金白电极、导电环、六角中空插座 | 20,20 |
| blastwheel_hub | 48×48 | 六槽机械轮毂、金橙反应核心 | 24,24 |

## 接入

eventhorizon_core 与 eventhorizon_ring 共用原生64×64画布及32,32旋转中心，可分别反向旋转并叠合。吸积盘的亮弧、暗紫孔缘与机械外环都采用二值透明边缘。中心透明孔洞显示游戏深空，实际范围由运行时真实引力井决定。

thunder_relay 是独立挂载。四个方向各有两个金白实体接点，八个叉尖与四个主连线端点均见 geometry.json。原生整理将灰紫中心改为带透明内腔的深色六角插座，叉尖保留白色高光、奶金接触面及金色连接颈。蜂机间闪电由运行时连接这些端点。

blastwheel_hub 包含完整六槽轮毂与金橙核心。六个实体槽位及方向见 geometry.json，外围刀刃由运行时沿真实轨道独立绘制。

## 源文件与导出

四份 ORA 与原生1× PNG 保存在 native。ORA的实体层分别为孔缘／吸积盘、机械外环、插座／导电环／电极、轮毂外壳／反应核。各实体层的独立透明 PNG 保存在 native/layers，保留相同画布与旋转中心，方便继续原生修改。

运行时目录只包含四项主体的2×与4× PNG。全部导出采用整数最近邻，alpha仅含0和255，颜色使用既有26色武器色板。contact-sheet@2x.png 按实际2×尺寸排版，contact-sheet.png 同时提供4×像素细节，eventhorizon-composition@4x.png 提供双层叠合对照。

```bash
python3 design/star-salvage/v068/production/fusion/export.py
python3 design/star-salvage/v068/production/fusion/verify.py
```

本目录记录静态资源、分层、透明孔洞、接点和整数导出校验。运行时连续运动、实际战斗和手机视觉由父线程接入后验证，最终用户美术验收待审。
