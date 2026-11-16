# 收据重画 · 原始静态方案与已审核生产接线

用户拒绝439256的黄旧卷纸/拼片轮廓。本批只重画并接线收据，不修改其余五物的素材、收费、存档或既有能力效果。最初阶段仅供视觉审核；已批准的生产接线见本文最后一节。静态图不能代替正式游戏运行证据。

## 参考与新源

唯一形状正参考：`design/visual-renewal/approved/03_curio_restoration_and_collection.png` 左上收据面板。旧439256只出现在负面对照，没有作为生成正参考。

- `paper-atlas-v1.png`：内置image_gen首次重画，保留候选来源。
- `paper-atlas-v2.png`：内置image_gen定向修正后的三态纸面，现代细长矩形热敏票据，浅色纸、紫墨、同一印刷身份与内容。不是旧卷纸rig的继续修补。
- `purple-clamps-atlas.png`：内置image_gen独立绘制的四角紫色机械夹，浅上下夹爪、铜转轴；不是纸补丁。

提示词核心：参考认可图左上现代收据轮廓；A有真实压皱、局部接触污、短裂口与原缺角；B清污展开为完整矩形且靠独立四角紫夹承托，原折痕未固定；C同一张原纸压稳，旧折痕/缺角保留。保留 `RET-031` / `P03` 和空白签收框，不生成红勾、签名或新的交易事实。两长边规整，不画羊皮纸卷轴、巨大星球徽章或随意拼接纸片。源图不含玻璃/展柜/工作台。

## 分层与对照

运行 `node scripts/export_receipt_proposal.mjs`，只写全新的 `assets/runtime/visual-renewal/receipt-proposal/` 和 `artifacts/receipt-redesign-static/`，不覆盖正式curios目录。

- 三份 `paper-*.png` 只含纸，不含夹具、玻璃、台面。统一384×384等宽cell缩放，仅平移注册，不单件重新fit或重绘文字。
- 四夹分别导出behind/front，实际合成顺序为夹具后爪→纸→前夹体。后续能力采边只应读取paper PNG的alpha，不读取support合成图。
- `display-context-only.png` 与C的390静态图复用现Museum Lv0玻璃前后层；玻璃没有烘焙到纸sprite。
- `proposal-registration.json` 记录原图cell、位移、夹爪接触点、层级和PNG SHA256。
- `artifacts/receipt-redesign-static/comparison-1170.png` 为原稿→旧版→候选对照。原稿裁图只用于审核，不作为运行纹理。
- 三张 `receipt-*-390.png` 是390×844静态像素合成，**不是浏览器/真实手机运行截图**；未运行Playwright，尚未接动画。

## 历史保留

原62份生产源、旧18张PNG/18张WebP及相关注册/代码已逐文件复制核对到本机ignored路径 `releases/receipt-rejected-439256/`，其 `manifest.json` 含原路径、大小与SHA256。旧生产源及其余五件状态仍保留，原收据状态入口由新版有意替换，Git历史和上述备份可回读旧版。新版不改正式存档或余额。

## 已审核后的生产接线

Root 先后批准现代矩形纸A/B/C、四角独立紫夹、C黄铜归档承托，以及单纸扫读的I/II方案。本批正式导出命令为 `node scripts/export_modern_receipt.mjs`，活跃资产位于 `assets/runtime/visual-renewal/receipt-modern/`；纸面三态仍从原游戏的 `curios/receipt-{found,clean,stabilized}.png/webp` 入口读取。

生产使用 **v2图集C格的同一张纸、同一印刷内容** 作为唯一master，A/B/C由连续整纸形变、局部接触污和独立折痕层确定性合成；不用三张不一致的文字做整纸溶解，不把缺角填成新票。逆向像素采样每个目标像素只取一次原纸，避免透明网格漏透。泥污与折痕都严格裁在master alpha内。B四夹后爪/前体分层，C归档背板/底托/脚独立；玻璃继续由Museum提供。

`receipt-paper-model.ts`、`receipt-paper-renderer.ts` 是新的单纸渲染通路。原黄旧卷纸rig仅保留历史源、备份与回归工件，客户端不再加载它；现代收据不会拼接旧纸翼。本体I/II保留原核验效果、真实已记录箱标与空签收，独立读数只是既有记录的显示，不产生证据、费用、收藏或奖励。

原静态三张390图是审核候选，不能当作正式浏览器/手机证据。运行集成后的390连续视频由root单独录制审查。源图、旧18态、旧代码及旧权益仍可通过Git历史与本机备份回读；正式三态入口将有意替换为新收据，其余五件不变。
