# 首星打磨版视觉复审

2026-11-02。新构图、像素质量与连续运动由用户最终确认；本轮不继续制作后续星球。

## 实现选择与变化

继续 Canvas 2D 独立分层 2.5D，保留完整纸箱球体，而不是引入真正 3D。新制八姿势机器人图集、箱寄居蟹、标签鸟、分拣机、奇物与设备图像；地表灯与小动件独立渲染。没有用整张概念拼版当运行场景，没有测试或虚构 3D 性能对比。

| 检查点 | 上轮切片 | 当前首星打磨版 |
| --- | --- | --- |
| 主角 | 65×79 组合切片，小且容易完全被遮住 | 144 像素对齐单元中的约 90×125 可见角色，八姿势；去程经后方、回程在前庭 |
| 飞船 | 朝向在左右切换点硬翻 | 14 秒连续轨道、切线朝向、随深度平滑缩放、背轨完全遮挡 |
| 微缩场景 | 球体、仓库、一个居民 | 保留球体材质；加入独立分拣机、管线灯、传送动件、纸屑和随发现出现的居民 |
| UI | 细线功能块，详情/工坊偏文本 | 同一套邮政科幻面板、角饰、像素藏品、设备图、归航清单，重要说明字号提高 |
| 发现 | 最近发现文字卡 | 奇物/居民/事件三类非阻塞演出、独特短句、地表局部像素强调与声音事件接口 |
| 基地 | 三件展柜、单张静态机器人 | 六件展柜、机器人活动、灯与星光、小邻居反馈 |

机器人姿态图仍为 AI 辅助制作，有细微一致性和递交接触可手工细磨；飞船已补四个独立方向视角，随切线短混合切换并只作轻微倾斜，保持 2.5D；连续视频与局部放大见 Phase 1.5 审核页。源 PNG、提示词和确定性导出脚本见 [assets](../assets/README.md)。

## 当前证据

- [42 秒连续实际运行](../artifacts/phase1/expedition-42s.mp4)：三轮前后轨道、机器人探索、两次实际发现，没有快进或视觉冻结。
- [12 秒同源节选](../artifacts/phase1/expedition-12s.mp4)：从连续片段裁切，没有加速。
- 精确 390×844：[远征](../artifacts/phase1/390-expedition.png)、[雷达](../artifacts/phase1/390-radar.png)、[图鉴](../artifacts/phase1/390-collection.png)、[基地](../artifacts/phase1/390-base.png)、[工坊](../artifacts/phase1/390-workshop.png)。另提供 @2x PNG。
- [飞船球背](../artifacts/phase1/ship-back.png)、[球前](../artifacts/phase1/ship-front.png)、[机器人仓库后](../artifacts/phase1/robot-behind.png)、[扫描](../artifacts/phase1/robot-scan.png)、[卸货](../artifacts/phase1/robot-unload.png)。关键帧冻结纯视觉时钟和相应 HUD，不改奖励。
- [收据演出](../artifacts/phase1/discovery-receipt.png)、[拆封鼠演出](../artifacts/phase1/discovery-mouse.png)来自真实时间录制过程；[夜班事件](../artifacts/phase1/discovery-night-shift.png)、[完整图鉴](../artifacts/phase1/archive-complete.png)、[六件展柜](../artifacts/phase1/base-complete.png)、[离线归航](../artifacts/phase1/offline-return.png)用加速测试时钟验证后期状态，不冒充新手开局。
- [浏览器审核页](../artifacts/phase1/index.html)：开发服务器打开 `/artifacts/phase1/index.html`，可看原概念、旧版与当前五页、连续视频和细节。

具体内容密度、节奏、迁移和已知优化事项见 [第一阶段说明](11_FIRST_PLANET_POLISH.md)；当前 [性能记录](10_PERFORMANCE.md)为桌面浏览器实测，手机真机未验收。
