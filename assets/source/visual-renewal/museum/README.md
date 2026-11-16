# 收藏室与纸生态：生产源图

这些是本轮基于批准三张方向板独立生成的生产图，不是方向板裁片。生成工具为内置 `image_gen`，原始字节保留在此目录。原工具缓存保留不删除。

- `room-empty-source.png`：全新空房间；没有烘焙柜、物品或机器人，落地面与机器人通道由同镜头注册。
- `case-0..3-source.png`：空容器四级结构。0清透玻璃罩和托盘；1暖灯冠与铭牌高台；2侧控温柱/铜管和转台；3独立铰链重框/锁扣/脚座。后一档以先前一档作生成参考，保持材质、角度与身份。
- `mouse/hermit/tagbird-poses-source.png`：三居民各三姿（醒着/自然工作/睡眠），真透明背景，非概念稿截图。
- `habitat-*-source.png`：各居民独立纸生态背景，不烘焙生物或前玻璃。

`node scripts/export_renewal_museum.mjs` 可重新导出所有运行素材和注册/hash。它只使用已保存原图进行确定性最近邻缩放、三姿分格与 alpha 区域注册、玻璃前反光分层；不重新生成原图，不改存档。

## 提示词记录

共同规范：refined detailed pixel art, crisp square clusters, 2.5D near-frontal slight top-down camera, main light upper-left, deep violet #241342 / warm brass #e3a454 / paper #f5c986; no text, no UI, no concept-poster framing. 实际调用以以下目标和约束逐张生成，未调用外部模型API。

1. 空房：portrait 4:5，紫墙星窗、边缘纸档案、暖铜灯；下60%空地，三列两排位置留空，底14%机器人通道；no cabinets, no plinths, no artifacts, no robot。
2. 基础柜：isolated empty glass rounded-rectangular dome on a short octagonal brass/violet tray; transparent glass interior and background; minimal edge-only glass highlights; no collectible or robot; no tall pedestal。
3. 灯座柜：precise-object-edit level zero，same camera/cavity/palette，增加 substantial low pedestal + centered blank brass plaque、upper copper canopy + actual amber lamp，内腔无横板。
4. 微环境柜：precise-object-edit level one，同家族，增加右侧climate/control column + copper pipes、双层通风抽屉和inner specimen turntable，保留透明空内腔。
5. 独立典藏舱：precise-object-edit level two，增加heavy hinged outer vault frame + corner bolts、独立脚座/锁扣，保留透明空内腔，不加宝石/物品。
6. 拆封鼠：transparent horizontal three-pose same cream-peach mouse with violet ears, brass paperclip collar; alert idle right / nibbling a tiny paper scrap / curled sleeping；no scene or words。
7. 箱寄居蟹：transparent horizontal three-pose same peach crab wearing orange delivery-box shell; walking right / carrying folded paper / withdrawn behind lowered box flap；no scene or words。
8. 标签鸟：transparent horizontal three-pose same cream-paper bird with violet wing tips, orange beak and blank ankle tag; perched / wings raised flying / sleeping with folded wing；no branch/cage/scene。
9. 鼠生态：wide 3:1，左纸隧道、后纸堆、暖灯，前景空地给独立鼠路径；no animal/front glass/UI。
10. 蟹生态：wide 3:1，左后空纸箱壳、卷地址条、瓦楞纸地面、暖灯，中右给独立蟹路径；no animal/front glass/UI。
11. 鸟生态：wide 3:1，左铜栖枝、右紫纸巢、后吊空标签、暖灯，中间飞行空间；no bird/front glass/UI。

## 注册与分层

完整源/hash/运行尺寸/脚点见 `REGISTRATION.json`。房间逻辑画布768×960。六柜落点为 `(160,500) (384,500) (608,500) (160,825) (384,825) (608,825)`；机器人足迹走廊中心270/500，近景经相同注册缩放。柜体结构源依等级作上下定高、中间玻璃延展，保留156逻辑像素的可读内腔。正面反光不含第二套底座。

层次：房间 → 同柜后玻璃/结构 → 专属托架与接触影 → 三态奇物 → 正玻璃反光 → 独立真实中文铭牌。房间中柜与机器人按真实脚点排序，取放只移动同一实体。免费基础展示具备承托；高级结构只读取已有等级，不收费。

三居民脚点：176cell，鼠/蟹 `(88,158)`，鸟爪 `(88,142)`（标签挂在爪点以下）。自然行为使用原持久昼夜钟；睡眠/飞行/工作姿各独立。工作窗试验仅本地播放2.6秒不改变模型。

12. `furnishings-source.png`：单一透明四格生产图集，分别为暖铜串灯、折纸叶盆栽、空白铜框纪念牌、无行星节点的铜环星仪。共用相同像素色组/视角/左上主光；no text, no UI, no characters, no collectible。导出对低于128的生成透明雾清零，避免边缘晕染；实物轮廓保留。

## 既购设施映射

`light`仍对应真实暖光和1/2/3段灯带；`deco-0..3`映射新串灯、纸叶、真实Canvas的LR–01铭牌、缓动星仪，不重复收费。`dock`使用本轮新飞船图集及落地泊位，1/2/3级增加泊位灯、铜夹座、青色引导灯；离线承载由原模型计算。

安装时台面与藏品稳定，两侧铜夹实际托住柜顶，顶冠沿短行程落槽后松开。取放采用共享新机器人分层rig，材质脚点、前后手套和最终放置位置共用注册。减少动态设置关闭灰尘与星仪摆动，保留整理路径。
