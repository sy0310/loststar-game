# v0.6 武器与战斗像素素材

20枚独立武器/辅助/进化/融合图标、9个战斗小精灵，以及6帧爆炸、4帧命中、4帧推进焰。统一24×24原生格，紫灰机械、暖金机构、冰蓝能量与珊瑚红威胁。光源位于左上，金属结构含暗边、受光面、凹槽与紧固件。

图标沿用本项目代码原生的像素图标制作方式，逐件设计轮廓和机构。爆炸由内置imagegen工具生成一张3×2六帧原图，实际原图和完整提示保存在generated。导出时按用户要求整理为24px固定色板和二值alpha，所有运行图从原生图NEAREST放大。原图存在半透明辉光，原生版以alpha150阈值清理，展开帧的亮白核心限制在小范围内。

## 实际文件

- source保存每项的@1x.png与可编辑OpenRaster。
- manifest.json记录32项资产、原生尺寸、完整帧边界、中心锚点、所有文件SHA256。
- palette.json包含共同24色色板。
- contact-sheet@4x.png展示全部资产。
- animations@4x.png展示14个连续动画帧。
- prototypes/salvage-survivor-demo/assets/weapons保存@2x.png与@4x.png正式运行图。

## 接入约定

静态对象和动画帧的原生图像中心为[12,12]。弹体与导弹朝上，方向为[0,-1]。

推进焰四帧共用喷口锚点nozzleAnchor [12,3]，喷口横截面为x=8～16、y=3，尾焰朝exhaustDirection [0,1]延伸。shipForward [0,-1]记录匹配的船首方向。贴合飞船喷口时使用nozzleAnchor，并与机身采用同一旋转角度。

图标与小精灵原生格均为24×24，透明外边界至少1像素。2×运行帧48×48，4×运行帧96×96。

三个动画atlas均为单行横排，帧坐标和单帧时长在manifest.json中。

| atlas | 帧数 | 原生整图 | 单帧时长 | 表现 |
|---|---:|---|---:|---|
| explosion | 6 | 144×24 | 65ms | 接触火星、展开、破裂环、碎屑消散 |
| hit | 4 | 96×24 | 45ms | 接触点、能量叉、离散火花、残余小点 |
| thruster | 4 | 96×24 | 65ms | 固定喷口基座，火焰末端交替伸缩 |

父级渲染器按真实碰撞、伤害与移动状态播放动画。像素资产本身不改变任何经济、伤害、存档或武器槽规则。

## 可重复导出与校验

```bash
python3 design/star-salvage/v06/production/weapons/export.py
python3 design/star-salvage/v06/production/weapons/verify.py
```

校验32项原生源、20图标/9精灵/14动画帧、二值透明度、色板、ORA合成、透明边界、精确整数导出和源文件SHA。视觉审核、实际运行映射、手机可读性与特效遮挡另行验证。
