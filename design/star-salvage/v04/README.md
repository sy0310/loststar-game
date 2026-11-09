# 星海拾荒 0.4｜港口视觉确认与实施交接

**这一版按唯一认可画风实现为可玩开发自测0.4.0，用户画风与真实手机仍待审核。**

[实际试玩、开发二维码与交付](DELIVERY.md) · [模型/经济](IMPLEMENTATION.md) · [同包画面对照](VISUAL_REVIEW.md)

## 已写入 PR 分支

| 文件 | 作用 | 当前状态 |
|---|---|---|
| [PORT_UI_VISUAL_AND_SYSTEM_SPEC.md](PORT_UI_VISUAL_AND_SYSTEM_SPEC.md) | 统一主界面、固定像素尺寸、港口/商店/飞船/任务/航路完整规则 | **已入库** |
| [ASSET_REQUIREMENTS.json](ASSET_REQUIREMENTS.json) | 14项真实分层运行素材（背景2、飞船4、货物8）及设计源图的 SHA | **14项分层原生/ORA/2x/4x已制作并接入** |
| [home_layout_wireframe.svg](drafts/home_layout_wireframe.svg) | 390×844 可在 GitHub 浏览的按钮布局示意 | **已入库，但不是被认可的美术原画** |
| [原图与全部参考裁片](concepts/) | 用户认可画风的完整PNG、上一版风格板及五个参考分区 | **7份真实PNG已入库并完成字节核验** |
| [Codex 0.4 任务书](../../../codex/SALVAGE_V04_PORT_UI_IMPLEMENTATION_TASK.md) | 数据迁移、真实购船、任务接取、补满与资产拆分、测试、交付的完整指令 | **已执行，固定包与待测见交付记录** |

## 用户认可的参考原图

- 图名：`失物号_星海拾荒像素界面概念板.png`。
- 原图：1122×1402 PNG，**2,142,727 字节**。
- SHA256：`16289e481145f9c781d5ecf353de0f00861fb17fbc3df2185d94e77b978cacb0`。
- 之前一版风格参考：1055×1491 PNG，SHA256 `c731179efefbb6f95e92fb347fd4a451cc067c56883f4e4935581e446e7b3e66`。
- 本次会话工作区已制作 `loststar_v04_visual_handoff.zip`，包含上述两张源图及HOME/船舶商店/委托板/四船/货物图标的局部**参考裁片**，以及逐文件 SHA 清单。
- **已入库且校验成功：** [用户认可的完整原图](concepts/salvage_v04_approved_full.png) / [上一版风格参考](concepts/salvage_v04_style_predecessor.png) / [5张局部参考裁片](concepts/reference_crops/) 均是 GitHub 真正的 PNG 文件，不是线框或文字引用。原图 Git blob SHA `c101690bd726f303cb7244d81baf954637466cb8`，尺寸、字节和本地 SHA256 已核对。裁片仅供理解概念，不是透明生产精灵。
- **本机 Codex 直接从 Repo 拉取** `concepts/salvage_v04_approved_full.png`，用 `shasum -a 256` 或 `python3 scripts/import_salvage_v04_concept.py --find-local` 复核 SHA。已入库意味着概念参考可用，**不意味着14项真正生产美术已完成**；依照 `ASSET_REQUIREMENTS.json` 逐项重新制作分层素材。

## 已确认方向（避免下一版跑偏）

1. **只有一个港口主界面**：静态像素背景，现役飞船，四资源HUD，圆形货舱/商店/飞船/任务入口，一个出发按钮。
2. “飞船”能购买、查看、换装不同飞船，不是改装单页面；船舶属性和售价真实生效。
3. 任务可选择并主动接取，未接取不可自动得委托报酬。
4. 燃料/耐久可一键补满，显示总价与余额；原子扣款。
5. 货舱有可升级容量与托盘方向，**物品有真实像素图标和独立真实占格几何**。
6. 去掉底部固定“航迹/四Tab”导航，航行由场景信号入口承接；完整已走历史仍保留在二级界面与存档。
7. 不做无必要的全场景动画；一致中等密度像素比例，禁止粗糙几何占位冒充已认可画风。
8. 游戏价目/任务奖励只认经审核的配置；图中数值不是权威财务或策划参数。

## 交付状态

- **当前实际试玩**：0.3.0 / `799a36e` / TapTap 454472。
- **目标**：Codex 在同一 Draft PR #2 中实现 v0.4，提交实际 PNG/WEBP 源素材、真正可用的功能及实验验证，再上传**新的**开发自测包；用户实机感受仍单独待审。
- 没有代码和真实平台回读前，不得声称 0.4 完成；不合并、不绑定正式主包、不提审、不发布。
