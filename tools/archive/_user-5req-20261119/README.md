# 用户 5 项需求(2026-11-19)

> 用户口径(原文):
> 1. 顺序按照订单数量，生产计划数量，未完成总数，实际完成数量
> 2. 报工记录需要可以选择处所选行导出 excle 就是当前的导出报表需要实现，但是需要增加勾选行。
> 3. 工艺路线中工序控制不需要必填。
> 4. 工单排产中点击修改排单各个日期数量的修改点击触发需要修改，当前只能点击到 / 才能修改。需要修改当前的点击逻辑实现。
> 5. 增加一个未完成数量的查看实现。勾选车间查看当前勾选车间的未完成数量在右下方蓝色边框内。不勾选时右下方时显示当前车间未完成量在右下方。当前存在的应该是在图中存在一个历史未完成量，需要修改为右下方的蓝色框内，当前只实现了单个车间当前查看的情况。

## 改动落点

| # | 改动 | 文件 / 对象 |
|---|---|---|
| 1 | 排单计划纸表固定列顺序改为 **订单数量 → 生产计划数量 → 工序未报工量 → 实际完成数量** | `frontend/src/business/print-formats.js`(`PLAN_SHEET_BASE_COLS`)+ 单测 |
| 2 | 报工记录(WO_REPORT_LIST)加勾选列；「导出报表」改为前端 xlsx：**勾选行 / 全部当前结果** 两个入口，列=当前列设置可见列 | `frontend/src/core/views/PanelxList.vue` + `reportListExport.test.js` |
| 3 | 工艺路线「工序控制」(物理列 `加工方式`)**取消必填**：`yj_field.required → 0` | `tools/migrate-route-process-control-optional-20261119.sql`(已登记迁移链) |
| 4 | 工单排产 / 生产工单日期数量格：整格可点 + 点开自动聚焦输入框(修 `autofocus` 假 prop) | `WorkOrderBoard.vue`、`WorkOrderList.vue` + `workOrderBoardUnfinished.test.js` |
| 5 | 工单排产右下角蓝框「未完成数量」：**勾左侧每条车间(生产线)**=所选车间合计；不勾=当前车间；原顶部「历史未完成」红条并入框内 | `WorkOrderBoard.vue` + 同名单测 |

> 2026-11-20 用户反馈修正第 5 项:
> ①「没有完成勾选对应车间,当前实现的是选择的对应**类型**的车间(成型/切炭/组装)而不是选择车间;
> 但数量需要区分车间这一点没问题。」⇒ 勾选框从框内的成型/切炭/组装 改为**左侧每条生产线
> (用户称车间:1号车间/成型1线/…)**上;默认(不勾)=当前选中线。
> ②「这个显示的最明显的数量应该为**当前工序的未完成的数量**而不是订单未能提交的数量,
> 应该只显示各个工序的未完成数。」⇒ 大数字从 `未交量`(成品/订单口径)改为
> `本线未完工量`(工序口径 = Σ max(本线排产 − 本线已报, 0));勾多个车间时逐条列各车间数。

## 口径说明

- **未完成数量** = **当前工序未完成数量** = `Σ linesSummary.本线未完工量`
  = `Σ max(本线排产数量 − 本线已报完工量, 0)`（工序口径，与左侧该线「已报 · 未完工」同源）。
  **不是** `未交量`（成品口径 = 排产 − 入库，那是订单还欠多少成品）：2026-11-20 实测
  2号车间 `未交量 11000` / `本线未完工量 10700`，框内必须显示 **10700**。
- 勾选车间 = 左侧每条生产线(1号车间/成型1线/…)；勾几条合计几条，并逐条列出各车间数；
  不勾 = 当前选中线；未选线 = 全部。
- 报工记录导出 xlsx：标题 + 公司抬头/查询区间 + 当前可见列(与屏幕列设置同源) + 数据行；
  勾选行只导勾中的行(且必须仍在当前结果里)，勾 0 行会提示「请先勾选要导出的行」。
- 日期格编辑：Element Plus 的 `el-input-number` **没有 `autofocus` prop**(写上去只落在根 div，
  浏览器不会聚焦内部 input)⇒ 此前点格子只冒出输入框、不能直接打字；现点开格后 `nextTick` 手动
  `focus()` + `select()`，并把 `.dp-plan/.dp-out-fill` 撑满单元格(整格点击热区)。

## 迁移执行(两账套)

```text
[新增] migrate-route-process-control-optional-20261119.sql
  [print] [待改] HSDZ_MES:ROUTE/工序控制 required=1 共 1 行
  [print] [OK] HSDZ_MES:工序控制已改为非必填
  [print] [CHECK-OK] HSDZ_MES:ROUTE/工序控制 非必填(required=0)
  === 同步完成: 执行 1, 跳过 839, 失败 0 ===

[新增] migrate-route-process-control-optional-20261119.sql
  [print] [待改] HSDZ_MES_TEST:ROUTE/工序控制 required=1 共 1 行
  [print] [OK] HSDZ_MES_TEST:工序控制已改为非必填
  [print] [CHECK-OK] HSDZ_MES_TEST:ROUTE/工序控制 非必填(required=0)
  === 同步完成: 执行 1, 跳过 839, 失败 0 ===
```

界面复核：`工艺路线 → 更多 → 表格调整` 中「工序控制」已无「必填」角标
(见 `工艺路线-工序控制非必填.png`；工序编码/工序序列仍必填)。

## 验证证据(ego browser，源码版 5173)

| 证据 | 说明 |
|---|---|
| `排单计划-列顺序.png` | 用 `schedPlanSheetHtml` 生成的纸表：`…成型车间 / 订单数量 / 生产计划数量 / 工序未报工量 / 实际完成数量 / 成型交期…` |
| `工单排产-未完成数量框.png` | 选中 `2号车间` ⇒ 框内 `10700 件`(本线未完工量，不是未交量 11000)；勾 `1号车间`+`3号车间` ⇒ 合计 `3100 件`，逐条 `1号车间 2400 · 3号车间 700` |
| `报工记录-勾选行导出.png` | 报工记录勾选 2 行 → 导出报表弹窗显示「只导出当前勾选的 2 行」 |
| `工艺路线-工序控制非必填.png` | 表格调整里工序控制无必填标记 |
| `ego/round-36-click-focus.mjs` | 工单排产真实鼠标点击日期格 → 输入框聚焦 → 键盘输入替换原值 → Esc 取消 |
| `ego/round-37-plan-sheet.mjs` / `gen-plan-sheet.mjs` | 生成并截图排单计划 HTML |
| `ego/round-38-report-export.mjs` | 报工记录勾选行 + 导出弹窗 |
| `ego/round-39-unfinished-box.mjs` | 旧版(按类型勾选)取证；2026-11-20 修正后以 `ego/round-51-line-checkboxes.mjs` 为准 |
| `ego/round-51-line-checkboxes.mjs` | 勾选不切换右侧明细；勾 1号+3号 ⇒ 逐条显示各车间数 |
| `ego/round-52-line-checkboxes-8090.mjs` | 打包版 8090 复核(30 个车间勾选框，默认当前车间) |
| `ego/round-53-process-unfinished.mjs` | 口径复核：选中 2号车间 ⇒ `10700`(不是未交量 11000)；勾 1号+3号 ⇒ `3100`(2400+700) |
| `ego/round-56-process-unfinished-8090.mjs` | 打包版 8090 复核同一口径(2号车间 10700；勾 1号+3号 ⇒ 3100/2400+700) |
| `ego/round-58-process-line2-8090.mjs` | 清空勾选后选 2号车间：蓝框 `10700` = 左侧「未完工 10700」/顶部「未完工量 10700」 |
| `ego/round-62-styled-export-8090.mjs` | 打包版 8090 勾 2 行导出样式版 xlsx(字节捕获) |
| `ego/round-41-route-dialog.mjs` | 打开工艺路线表格调整并截图 |

导出内容另做了字节级复核：勾 2 行导出的 xlsx 解析后 = 标题 + 公司抬头 + 表头 13 列 + **2 行数据**；
勾 N 行只出现 N 行。

## 2026-11-20 导出 Excel 表格样式(用户追加口径)

> 「报工记录导出的 Excel 表头列需要做出区分，不同行之间应该存在斑马条做出区分，
> 当前单文字按表格排列过于简陋，或许是框线没有整体的表格框线的原因。」

- 依赖 `xlsx-js-style@1.2.0`(SheetJS 社区版忽略 `cell.s`，写不出表头底色/框线/斑马纹);
- 标题/公司抬头跨列合并居中;表头行深蓝底 `1E6FB8` + 白字加粗 + 细框;
- 数据行整表细框线 + 隔行斑马纹 `FFFFFF` / `F2F7FF`;数字列右对齐 + `#,##0.####`;
- 列宽按内容自适应(中文 2 字宽)、行高、表头自动筛选;
- `reportLeaf` 的数值判据补 `data_type=数值`(报工数量)，屏幕列也改为右对齐。

证据：`报工记录-导出样式示例.xlsx`(可直接用 Excel 打开) + `报工记录-导出样式.png`
(Excel 转 PDF 后渲染，1 页横向适配)；`ego/round-62-styled-export-8090.mjs` 为打包版导出脚本。
openpyxl 复核：合并 `A1:M1`/`A2:M2`、表头 `FF1E6FB8`/白字/加粗/thin 框、数据行
`FFFFFFFF`/`FFF2F7FF` 交替 + 四边 thin、筛选 `A4:M6`、列宽/行高均已写入。

## 测试

```text
cd frontend
node --test src/core/views/reportListExport.test.js \
            src/views/modules/plan/workOrderBoardUnfinished.test.js \
            src/business/print-formats.test.js
# 50 tests / 50 pass

npm test   # 仅 6 条活库直查因本机未装 sqlcmd 失败(与本次改动无关)
```

`npm run build` 通过。
