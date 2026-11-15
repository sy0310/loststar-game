# Lostship: Star Surge 英文宣传图

## 审核文件

[1920×1080 PNG](taptap-banner-lostship-star-surge-1920x1080.png)

本轮交付一个方案，画面标题分为 Lostship 与 Star Surge 两行。生成使用内置 image_gen 定点编辑，完整提示保存在 [prompt.txt](prompt.txt)。工具原件保存在 [generated/taptap-banner-lostship-star-surge-original.png](generated/taptap-banner-lostship-star-surge-original.png)。

## 输入来源

- 已认可无文字图位于 `design/star-salvage/v068/store-media/exports/taptap-keyvisual-no-text-1920x1080.png`，作为背景参照。
- 既有中文标题图位于 `design/star-salvage/v0610/test-materials/art/exports/taptap-banner-title-only-1920x1080.png`，作为标题局部编辑目标。
- 输入、生成原件与导出的尺寸、字节数、SHA256 记录在 [provenance.json](provenance.json)。

## 技术导出

工具原件为 1672×941 PNG。使用 ffmpeg 最近邻缩放对完整画幅重采样至 1920×1080，画幅比例校正约 0.053%。详细命令已记录，原件字节保留。

## 已检查

- 英文标题 Lostship / Star Surge 拼写可读，采用用户允许的双行排版。
- 原有紫金像素科幻配色、大飞船、右上晶体 Boss 和环带构图延续。
- 已检查宣传图中文字、额外元素及 PNG 尺寸，文件为 2,187,971 字节。

## 明显缺点及待审

- 模型对标题外的舰体面板、驾驶舱、星点和环带纹理进行了细微重绘，主智能体需对照批准原图审核这些差异。
- 本次使用最近邻技术导出；非整数缩放可能使个别像素阶梯宽度不均。
- 双行排版省略了可见冒号。
- 主智能体内部审核已通过英文标题、构图与主体，并决定保留本张；用户视觉验收待完成。
