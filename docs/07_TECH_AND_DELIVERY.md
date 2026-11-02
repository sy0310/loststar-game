# H5 实现建议与分阶段交付
## 技术选择（建议非强制）
- Vite + TypeScript，2D 场景建议 PixiJS/Phaser 二选一，UI 可用标准 HTML/CSS；避免为多个静态页面引入重复庞大的 UI 框架。
- 球体先做可控的 2.5D 分层预渲染，确保高精细视觉；如果真的使用 Three.js/WebGL 3D，先提交性能/遮挡对照实验再引入。
- 保证手机竖屏、安全区域和高 DPI 可读。场景以灵活尺寸渲染、UI 独立适配。
- 参考海报只供人工对照，不要随 H5 正式首屏下载；运行时用导出的纹理集与压缩资源。

## 推荐数据结构
Planet: id、nameInternal、theme、unlockState、regions、artRefs、contentPacks。
Region: id、planetId、visualTheme、discoverableIds、eventIds、progressionRules。
Discovery: id、kind (creature/artifact/event)、rarity、title、desc、sourceRegion、unlockCondition、interaction。
RadarSignal: id、state (undetected/detected/located/revealed)、progress、targetPlanetId (internal only)。
SaveData: version、lastSavedAt、discoveredPlanets、radarSignals、explorationState、upgrades、collection、claimedEvents。
注意：内部数据可完整，UI 严格不渲染未发现星球条目或数目。

## 开发阶段
P0 资产核验：16 张概念图＋4 参考文件导入、建立分类、确认目标画质与遮挡风险。
P1 动态美术：退货箱星完整球体、机器人、飞船及一只生物的真实动画，至少一轮“走→扫→拾→回”与前后轨道验证。
P2 可玩切片：基地↔星图↔远征↔图鉴、雷达异常揭晓、回收结算、升级、保存离线。
P3 六星矩阵：将首版六星作为独立主题数据包并补齐基础表现，后续可继续新增星球/区域。
P4 体验打磨：精细 UI、场景资源优化、移动端验证、问题修复、测试记录和预览构建。

## 包体/性能
- 每屏加载必要资源；图鉴/尚未发现星球的完整美术不要在新玩家首屏加载。
- 记录首次加载体积、FPS、内存和最大纹理占用；避免单张 2K 拼版充当动态场景。
- 在低端设备降低粒子数量，不牺牲基本轮廓、像素密度和 UI 清晰度。
- 离线计时需防止重复领取和负时间；使用本地存档，后续可升级服务端。

## 交付
- 可运行 H5 工程、源素材/导出素材及授权记录、数据配置、README、测试脚本、录屏、截图差异对照、Draft PR。
- 未通过真机性能/设计审核的项目明确标为未验收，不写“全部完成”。
- 用户决定是否合并上线；默认保留 Draft PR。