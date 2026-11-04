# 排单计划日期列 = 勾选行「最前日期 → 最后日期」（2026-11-04）

## 1. 用户口径

> 「当前想法是打印的就按这些勾选的表中最前面的日期到最后的一个日期就行」

即：出纸的日期列不再固定「打印当天起 5 天」，而是取**本次勾选要打印的那些行**里
`日计划` 出现过的最早日期 → 最晚日期（中间没计划的日子保留空列）。这样历史/跨月计划
（例：GD-2026-10-0227 的 10-29~10-31）也能原样打出来。

这是《2026-11-04-排单计划打印日期-四方案》里方案 C 的收敛版：**C2 语义（只按勾选行算日期）
+ 纯前端实现**（后端 `/planSheet` 本来就返回含历史日期的 `日期[]` 与每行 `日计划`，本轮零后端改动）。

## 2. 改动（纯前端，3 个文件）

| 文件 | 改动 |
|---|---|
| `frontend/src/business/print-formats.js` | 新增 `planSheetDatesFromRows(rows, today, days)`（勾选行最前→最后，连续补空列；无计划回退今天起 5 天；跨度上限 `MAX_SHEET_DAYS=31` 截最近 31 天）、`planSheetWindow`、`ymdAddDays`；`schedPlanSheetHtml` 支持 `opts.dates`（逐字用窗口）并按列数自适应版式 |
| `frontend/src/views/modules/plan/WorkOrderBoard.vue` | `printPlanSheet()`：`pickPlanSheetRows` 之后用 `planSheetDatesFromRows` 算日期列，随 `printSchedPlanSheet(..., { dates })` 出纸 |
| `frontend/src/business/print-formats.test.js` | 新增 4 条单测（最前→最后/回退/上限截断/连续窗口、紧凑表头） |

### 版式自适应（列多时）

- 列数 ≤7：沿用原版（`M月D日` 表头 9px / 正文 9.5px、固定列 73%、二维码 5%）；
- 列数 >7：`compact` 模式 —— 表头改 **`M/D`**（7px）、正文 8px、固定列按 `1-(n-7)*0.035` 收紧
  （下限 0.52）、二维码 4%，日期列均分剩余宽度。
- 实测：10 列 ⇒ 3.07%/列 ≈ 8.7mm；16 列 ⇒ 2.87%/列 ≈ 8.2mm，A4 横向仍可读（见下方截图）。

## 3. 边界

1. 勾选行一个非零日计划都没有 ⇒ 退回「今天起 5 天」（不打出没有日期列的空表）；
2. 跨度过大（脏数据/超长交期，>31 天）⇒ 截成**最近 31 天**（保留最新进度）；
3. 已完工行：仍按页面页签/勾选口径，可打；其历史计划日期会正常出列；
4. 二维码、单据编号、纸表固定列都不变；页头仍只有标题（2026-10-21 口径，不印打印日期/制单人）。

## 4. 取证

- **单测**：`cd frontend && node src/business/print-formats.test.js` ⇒ **17/17 PASS**
  （原 12 条 + 11-03 勾选打印 2 条 + 本轮 4 条；`node --test` 在沙箱里会 spawn EPERM，直接跑文件即可）。
- **页面链路（CDP，对着 5173 源码实例 + 8090 现役后端）**：`node verify-range-print.mjs http://localhost:5173` ⇒ **9/9 PASS**
  - 勾 2号车间全部 4 行 → 日期列 = `10/29 … 11/7` 共 **10 列**、0227 行历史三格 = **2000/2000/2000**（旧实现这三格全空）、`window.print` 只调 1 次、行数 4、标题不变；
  - 只勾 0227 一行 → 日期列收窄成 `10月29日/10月30日/10月31日` 3 列（非 compact 写法）。
- **出纸版式截图**（打印媒体 `Emulation.setEmulatedMedia({media:'print'})`，A4 横向）：
  `node shot-print-preview.mjs http://localhost:5173`
  - `shot-print-2hao-4rows.png`（4 行 → 10 列）
  - `shot-print-2hao-1row.png`（单行 → 3 列）
  - `shot-print-1hao-16cols.png`（1号机 2 行 → 16 列，验列挤压版式）
  - 说明：打印层在屏幕上被 `@media screen{left:-10000px;opacity:0}` 藏着，普通截图看不到，必须切打印媒体。
- **构建**：`cd frontend && npm run build` ⇒ 通过（18.2s）。

## 5. 部署状态（2026-11-04）

- 已同步 `frontend/dist → backend/src/main/resources/static`（chore 提交）；
- **服务器尚未部署**：要生效需重打 jar/前端静态 + 增量部署（`deploy/部署说明.md`），并按 `deploy/部署台账.md` 记账；
- 本地 5173（vite 源码）已可看效果；本地 8090 仍跑旧 jar（有个重启循环看着它），
  要本地 8090 也换新需 `tools\scripts\rebuild-prod.ps1`。
