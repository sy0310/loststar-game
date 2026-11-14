# 中后期成型配装实操录屏

本片用于替换首轮站立自动开火的 19 秒实机视频。玩家已明确要求持续操作，以及中后期武器成型的画面。

- [完整 60 秒视频](../../../../artifacts/survivor-v0610-active-video/late-loadout-active.mp4)
- [录制首帧](../../../../artifacts/survivor-v0610-active-video/first-frame.png)
- [连续片段抽帧](../../../../artifacts/survivor-v0610-active-video/contact-sheet.jpg)
- [输入轨迹、配装与源文件摘要](../../../../artifacts/survivor-v0610-active-video/evidence.json)

## 实际内容

录制从约 11 分 52 秒的成型配装开始，持续约 60 秒。装备包括雷暴蜂群，以及脉冲主炮、折跃棱镜、旋刃护卫、震荡导弹。连续拖动会显示原生摇杆，飞船在敌潮中移动，武器自动攻击，受伤与经验收集由当前规则结算。

片中实际击败精英后出现了 3 级随机强化，选择界面展示棱镜、导弹、主炮分别从 3 级升至 4 级，随后继续战斗。音乐与音效直接录自游戏输出混音。前 5 秒已开始战斗，录制前已先拖动并运行约 7 秒。

本片通过准备好的合法中后期配装检查点进入普通玩家界面。装备、进化、融合均使用当前模型的合法操作建立，默认船体 100，初始无敌计时为 0，敌人按正常生成规则出现。拍摄采用隔离浏览器上下文，实际发送持续的指针拖动和确认按钮输入。原始输入与运行轨迹已保存。

录制环境为桌面 Chromium，390×844 CSS 视口与 DPR2。原始页面视频按实际时间裁去进入页面和准备部分，以最近邻导出 780×1688，H.264／AAC，约 25 帧每秒。成片为 59.997 秒，27,235,313 字节，SHA256 为 `4d336e8d9a4126ed219d4c455cd8cd756af0d3c1148806702351e4c7743a7955`。

## 检查

15 秒预演和 60 秒正式录制均完成，页面错误为 0。每个 5 秒窗口的真实移动路径均超过 621 像素，指针输入有效比例最低为 93.75%。录像后段出现正常损伤，片末船体约 53。录制过程中触发的强化由实际界面提交。

视频拥有实际游戏音轨，平均电平约 -29.1 dB，峰值约 -12.7 dB。手机上的播放、听感及长局设备表现交由后续实机测试核验。

运行源码为 `ea26e29d3061542913e7a587a1fe6cc889250d33`，对应 H5 包 480638。素材库视频编号为 6092025，目标为 V-20261114 资料版本的实机录屏字段。平台生效进度记录在 Draft PR #2 的交付回执。

## 复现

在仓库根目录执行，HTTP 入口应提供同一冻结运行包。

```bash
node design/star-salvage/v0610/test-materials/record_active_gameplay.cjs --rehearse
node design/star-salvage/v0610/test-materials/record_active_gameplay.cjs
python3 design/star-salvage/v0610/test-materials/export_active_gameplay.py \
  releases/survivor-v0610-private/active-video/recording \
  releases/survivor-v0610-private/active-video/recording/exported.mp4
```

正式录制应在预演检查通过后进行。导出脚本会验证每个 5 秒窗口的移动和输入，低于阈值时停止导出。原始页面录像和实时音轨保存在本机忽略目录中，公开素材包含成片及可核对的摘要。
