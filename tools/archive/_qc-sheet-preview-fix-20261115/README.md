# 首件检验单 / 巡线记录表「打印预览被裁 + 打出滚动条」修复（2026-11-15）

> 用户口径：「这个报表的打出预览会打印出滚动条无法查看到全部内容」——附截图（本目录 `user-report.png`）：
> 首件检验单的打印预览只到「挤压强度」，右侧「浊度NTU / 压降kPa」被裁掉，表格下方还印着横向滚动条。

## 一、根因

这两张纸（`QcFirstInspSheet.vue` 的 `.fi-sheet`、`QcLinePatrolSheet.vue` 的 `.lp-sheet`）在屏上是
**内层横向滚动容器 + 表格 min-width** 的宽表：

- `frontend/src/core/qc/QcFirstInspSheet.vue`：`.fi-grid-scroll { overflow: auto }` + `.fi-grid { min-width: 1336px }`
- `frontend/src/core/qc/QcLinePatrolSheet.vue`：`.lp-grid-scroll { overflow-x: auto }` + `.lp-grid { min-width: 1194px }`

而「打印预览 / 导出 PDF」走的是 `PanelxList.snapSheetPage()` 的**离屏克隆 + 截图**（modern-screenshot），
不是 `window.print()`，`@media print` **不生效**：

| 表现 | 原因 |
|---|---|
| 右侧列被裁（只到挤压强度） | 截图宽取根元素 `scrollWidth`（≈978，被外层容器限住），内层表格 1336px 溢出部分量不到 |
| 纸上出现横向滚动条 | 克隆体里 `.fi-grid-scroll` 仍是 `overflow:auto`，滚动条被一起截进图 |
| 顺带带上编辑控件 | 列名输入框/分组下拉/行高拖动下标/标准行 textarea 滚动条（屏上是编辑态） |

## 二、修法（`frontend/src/core/views/PanelxList.vue`）

1. `snapSheetPage()` 新增判据 `isQcSheet`（`.fi-sheet / .lp-sheet`）：**不压 A4 重排**，按屏幕版式截全宽；
2. 新增 `prepareQcSheetSnapshot(clone)`（只动克隆体，不动线上 DOM、不改屏幕版式）：
   - 摘掉编辑控件（`.fi-colname / .fi-colgroup / .fi-coldel / .fi-addcol / .fi-rowgrip / .col-op / .no-print`），
     把只读文字版列头 `.fi-colhead-text` 显形；
   - 隐藏「请选择」占位词与下拉箭头（一次性样式 `#qc-sheet-snap-style`，类名 `qc-sheet-snap` 只挂在克隆体上）；
   - **内层滚动容器从深到浅撑到内容宽 + `overflow:visible`**；textarea/input 一律 `overflow:hidden`；
   - 撑开后按实测整表宽（`clone.scrollWidth`）把克隆体/holder 放宽，再量高 → 右侧列全部进图；
3. `buildSheetPdfBlob()`：这两类纸的 PDF 页面改 **A4 横向（297×210mm）**（10/12 列横排才排得下，
   竖向缩到 194mm 字会小到看不清）；其它面板/多页签文书仍走 A4 竖向，行为不变；
4. 后端 class 零改动；`sheetSnapZoom.test.js` / `nativePrintScale.test.js` 9/9 通过。

## 三、验收（ego-browser 真机；脚本见本目录 round-01/04/05）

| 项 | 改前（用户截图） | 改后实测 |
|---|---|---|
| 页面 | — | **1 页 / 297×210mm（A4 横向）**；PDF 300KB（5173）/ 300KB（8090） |
| 列 | 只到「挤压强度」 | **10 列全在**（表观/脱粉/外径/内径/长度/重量/跌落/挤压强度/浊度NTU/压降kPa） |
| 滚动条 | 表格下方有横向滚动条 | **无**（overflow 已撑开） |
| 编辑控件 | 「请选择」占位词 / 分组下拉 / 改列名输入框 / 行高拖动下标 | **全无**（占位词透明、控件已摘） |
| 黄格矩阵 | — | 逐块量色：1#/2# 各 2 格、3#/4# 各 4 格、5#/6# **跌落+挤压强度** 各 2 格、7#/8# **浊度+压降** 各 2 格 = **20 格**（与第十一轮口径一致） |
| 两端一致 | — | 5173 源码版 与 8090（`apply-frontend-only` 换 static 后，入口 chunk `index-cvD9l3wP.js`）渲染一致 |

证据文件：
- `user-report.png`：用户报障截图（改前）
- `preview-5173-fixed.pdf` / `preview-5173-page.png`：5173 导出报表→打印预览 产物与页图
- `preview-8090-fixed.pdf` / `preview-8090-page.png`：8090（打包版）同口径产物与页图
- `round-01.mjs`（5173）/ `round-04.mjs`（8090）/ `round-05.mjs`（巡线测试库尝试，登录工厂没切成功，未取证）

复跑：`ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/sheet-preview-fix-20261115/round-01.mjs')"`
（原脚本在 `C:/Users/vigna/ego/sheet-preview-fix-20261115/`，本目录是拷回仓的同一份）。

## 四、边界（本次没动）

- **侧栏「打印」（window.print）**：本来就走 `@media print`（表格收回纸宽），不受本次影响；
- **其它纸张**（DocSheet / 出厂检验报告 .oqc-sheet / 检验数据记录 .qr-sheet 等）：判据只认 `.fi-sheet / .lp-sheet`，
  行为一个字节没变；它们若也有"内层滚动容器"型宽表，可同法再扩判据（未在本轮范围）；
- 巡线记录表用同一套截图管线（`.lp-sheet` 分支），本修复同样生效（其 12 列预览此前同样被裁）。
