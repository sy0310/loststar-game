# 失物号 · 宣传标题字体

本次将普通系统黑体的封面、片名和主字幕，统一为具有前倾速度感的粗斜字形。配合深空背景、紫金电弧和实体像素机体，以暖金字面、短紫色侧影、窄暗边和少量方形推进切边形成识别度。

![层级与字标](type-system-preview.png)

## 层级

| 用途 | 处理 | 边界 |
| --- | --- | --- |
| 封面标题、片尾片名 | 得意黑，暖金渐变字面，紫色厚度，少量切边 | 最高强调；保留字腔与主角、血条 |
| 视频短字幕 | 同一得意黑字形，白色／局部金色，4像素侧影 | 装饰收敛；一到两行，移动端可读 |
| 来源标记、说明、小字 | 简洁系统黑体，稳定字距 | 信息优先，字体不挤占游戏HUD |
| 游戏内信息字体 | 保持现有清晰的信息字形 | 本轮为宣传视频字效修改，没有更新正式游戏或包体 |

字形使用 [Smiley Sans / 得意黑 v2.0.1](https://github.com/atelier-anchor/smiley-sans/releases/tag/v2.0.1)。原字体以 [SIL OFL 1.1](https://github.com/atelier-anchor/smiley-sans/blob/v2.0.1/LICENSE) 分发，本目录保留原始TTF、完整许可和来源摘要；没有修改字体二进制。`typography.py` 只在渲染时生成颜色、外沿与侧影。字效为本项目制作，不引入其他游戏Logo。

## 可复用素材

- `wordmark-transparent.png`：透明底片名，分成“失物号／星海突进”两行。
- `type-system-preview.png`：标题、短字幕、信息小字的层级总览。
- `typography.py`：同字形下的两档字效，可用于以后宣传图和视频。
- `fonts/provenance.json`：官方发布版本、下载地址、许可和SHA256。

字体文件与OFL许可随此目录保留。若后续要把艺术字用于游戏标题，可使用透明字标，避免把整个大字体打入移动端运行包；游戏数值、按钮和说明仍按可读性处理。本轮未替换平台Logo或线上游戏标题。

仓库根目录执行 `python3 design/star-salvage/promo-typography/build_specimen.py` 可重建总览与字标。示例信息小字使用Mac系统黑体；宣传片渲染器另支持`PROMO_FONT`和`PROMO_FONT_INDEX`指定本机信息字体。
