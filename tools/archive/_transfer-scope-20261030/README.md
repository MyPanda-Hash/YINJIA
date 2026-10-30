# _transfer-scope-20261030 — 工单调拨弹窗排版修复的取证(一次性探针)

用户 2026-10-30 报障(附截图):「当前排列存在问题修复一下,排列不要将表格挤在一起」——指
**工单排产页 → 调拨弹窗**里「当前工序 / 目标车间 / 目标生产线 / 调拨原因」四行挤在一起。

## 改前为什么挤

旧模板每行都是 `<div class="wb-p">标签<el-select style="width:220px">`:
`wb-p` 是 `inline-flex` + `gap:6px`,**标签宽度随文字走**(目标车间 vs 目标生产线 vs 调拨原因
三个标签宽度不同)⇒ 控件起点参差;行与行之间只有相邻 div 的默认间距 ⇒ 视觉上贴成一团。

## 改后(2026-10-30,commit 见本任务提交)

改成**两列表单**:`.ra-form`(纵向 flex,gap 14px)/ `.ra-row` / `.ra-label` 定宽 84px 右对齐 /
`.ra-ctl` 控件 `flex:1` 同一左缘;提示行单独占一行且与控件左缘对齐;底部说明用虚线分隔。
弹窗宽 470 → **520px**,控件不再写死 220px。

## 文件

| 文件 | 用途 |
|---|---|
| `_shot-dialog.cjs` | headless Edge + CDP:登录 → 开工单排产页 → 选线/勾行/点调拨 → **量弹窗内每行标签与控件的 left/width**(验证对齐)→ 截弹窗图。`YJ_FE` 环境变量可换成 `http://127.0.0.1:8090`(验证 jar 内前端) |
| `_shot-transfer-dialog.png` | 改后(5173 源码)实拍 |
| `_shot-transfer-dialog-8090.png` | 改后(8090 打包 jar 内前端)实拍,与上图一致 |

跑法:

```powershell
node tools\archive\_transfer-scope-20261030\_shot-dialog.cjs
$env:YJ_FE='http://127.0.0.1:8090'; node tools\archive\_transfer-scope-20261030\_shot-dialog.cjs out.png
```

## 实测(DOM 量出来的,不靠肉眼)

```
dialog 520×326
四行 rowH 20/32/32/32(当前工序行是纯文本)
label left=558 width=84 (四行一致,右对齐)
ctl   left=654 width=388 (四行一致 ⇒ 控件左缘同一列)  ctlLeftAligned: true
values: 成型 / 请选择目标生产线
```

截图见 `_shot-transfer-dialog.png`(5173)与 `_shot-transfer-dialog-8090.png`(8090)。
⚠ 两张 png **未入库**:`.gitignore:134` 全局 `*.png`(仓库口径,截图只作本机取证);需要
随提交归档时按既有先例用 `git add -f` 单独确认。
