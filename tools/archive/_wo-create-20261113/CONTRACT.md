# 生产工单四项需求 · 实现契约(2026-11-13)

> 本文件是本次任务（Lead + 两个协作 Agent）之间的接口契约。**先读 AGENTS.md**，再按本契约实施。
> 工作区：`D:\workspace\yinjia`；服务：5173(vite 源码)、8090(旧 jar，勿动)、1433(SQL Server, 正式库 HSDZ_MES / 测试库 HSDZ_MES_TEST)。
> 纪律：**不要 git commit / push**（Lead 统一提交）；不要重启 8090；不要乱跑 DB 迁移（Lead 负责执行）。
> 前端不跑 `npm run build`（Lead 统一构建，避免并发写 dist/.esbuild-tmp 互相打架）；纯 JS 单测可跑。

## 需求（用户原话要点）

1. 所有生产工单「排单计划」（工单排产页打印纸表）增加「订单数量」列。
2. 生产工单页可以新建生产工单（现在只有订单结转能生成）。
3. 新建生产工单弹窗里加「临时工单」页签：上方主物料、下方所需物料（临时 BOM）。
4. 生产工单页增加「列设置」，照订单结转页的实现方式（useReportColumns + ColumnSettingsDialog）。

## 数据模型

新表 `wo_bom`（工单物料清单 / 临时工单用料；标准 BOM 仍在 `bs_asm_bom`，本表只存**按工单定制**的临时用料）：

| 列 | 类型 | 说明 |
|---|---|---|
| id | bigint identity PK | |
| 工单号 | nvarchar(50) NOT NULL | plang.pl_no |
| 工单行id | bigint NULL | plang.id |
| 工单行号 | int NULL | plang.pl_xc |
| 产品编码 | nvarchar(100) NULL | 主物料编码 |
| 行序 | int NOT NULL DEFAULT 0 | |
| 子件编码 | nvarchar(100) NOT NULL | |
| 子件名称 / 子件规格 | nvarchar(200) | |
| 计量单位 | nvarchar(20) NULL | |
| 标准用量 | decimal(18,4) NOT NULL DEFAULT 0 | 每 1 个成品的用量 |
| 损耗量 | decimal(18,4) NOT NULL DEFAULT 0 | |
| 行备注 | nvarchar(500) NULL | |
| 来源 | nvarchar(20) NOT NULL DEFAULT N'临时工单' | |
| asp_user1/asp_time1/asp_user2/asp_time2/asp_cancel | 审计五件套（asp_cancel nvarchar(1) 'N'） | |

索引：`UX_wo_bom_row_line (工单行id, 行序) WHERE asp_cancel='N'`、`IX_wo_bom_wo_no (工单号, 工单行号)`。
所有列 + 表级 MS_Description 中文注明（Lead 的迁移脚本负责）。

## 后端接口契约（Lead 实现；前端按此写）

前缀 `/api/px`，全部要 `WORK_ORDER_LIST` 查看权；写接口另要动作词 `create`。

### A. `POST /api/px/workOrderList/options`
→ `{ 客户: [{客户编码, 客户名称, 客户等级}], 默认工艺路线: 'GY-CB-STD' }`

### B. `POST /api/px/workOrderList/productInfo`  body `{存货编码}`
→ `{存货编码, 存货名称, 规格型号, 计量单位, 工艺路线, 所属类别}`；找不到 → 业务错误（400 中文提示）。

### C. `POST /api/px/workOrderList/stdBom`  body `{产品编码}`
→ 标准组装 BOM（取数同领料端：bs_asm_bom 工序=组装，默认BOM=是 → 版本号 DESC → 单据编号 DESC）：
```
{ 来源: '标准BOM'|'', 单据编号: '', 版本号: '', 行: [{行序, 子件编码, 子件名称, 子件规格, 计量单位, 标准用量, 损耗量, 备注}] }
```
查不到 → 来源='' 且 行=[]。

### D. `POST /api/px/workOrderList/create`  body
```json
{ "工单类型": "常规" | "临时",
  "产品编码": "A-48-01", "客户编码": "A-26", "客户名称": "(仅展示，后端按编码取)",
  "订单数量": 100, "生产数量": 100,
  "工单日期": "2026-11-13", "计划开工日期": "", "交期": "2026-11-20",
  "工艺路线": "GY-CB-STD", "备注": "",
  "物料清单": [ {"行序":1,"子件编码":"...","子件名称":"...","子件规格":"...","计量单位":"个","标准用量":2,"损耗量":0,"行备注":""} ] }
```
→ `{ 工单号: "GD-2026-11-000x", 行id: 123, 工单行号: 1, 工单类型: "常规"|"临时", 物料项数: 0|N }`
规则：工单号 `FormNoService.next("GD", user)`；`plang` 插入 comm='0'/pl_xc=1/pl_date=工单日期/khdm/dm/mc/gg/jldw/xq_sl=订单数量/pl_sl=生产数量/yl=0/cp_date=交期/st_date=计划开工日期/工艺路线/ja='N'/asp_*；按路线建 wo_process_line（复用 ProcessTaskService.ensureLedgerForWorkOrder）；临时工单必须 ≥1 行物料清单并写 wo_bom（否则 400）。常规工单不写 wo_bom。

### E. `POST /api/px/workOrderList/bom`  body `{行id}`
→ `{ 来源: '临时工单'|'标准BOM'|'', 单据编号: '', 版本号: '', 行: [同上 D 的行结构] }`
口径：该行有 wo_bom 行 ⇒ 临时工单；否则按 plang.dm 查标准组装 BOM。

### F. 列表接口 `/api/px/workOrderList` 新增两个字段
- `工单类型`: '临时'（该工单行存在未作废 wo_bom 行）否则 '常规'
- `临时物料项数`: int（wo_bom 行数）

### G. BOM 取数优先级（下游联动）
新服务 `WorkOrderBomService`：`bomOf(行id, 产品编码)` → 优先临时 BOM，否则标准组装 BOM。
改 `MobilePickController.generateOne`（手机扫码→生成生产领料单）和 `WorkReportController.asmBomOf`（工序报工·组装物料展示）走它。
`来源='临时工单'` 时，领料明细备注写「临时工单用料」，标准 BOM 维持原文案。

## 前端契约

### 组件 `frontend/src/views/modules/plan/WorkOrderCreateDialog.vue`（create-ui 负责）
- props `{ modelValue: Boolean }`，emits `update:modelValue`、`saved`（payload `{工单号, 工单类型, 行id}`）。
- el-dialog：`tt('新增生产工单')`，宽 1060px，top 4vh，append-to-body，destroy-on-close。
- 页签按钮：el-tabs，两个页签 `tt('常规工单')` / `tt('临时工单')`（值 常规/临时）。
- 公共表单字段（label 全部 tt()）：
  产品编码*（el-select filterable remote，远程搜 `/px/invOptions?panelCode=WORK_ORDER_LIST&keyword=`，选项 label `${存货编码} — ${存货名称}`；选中后调 `productInfo` 回填 产品名称/规格型号/计量单位/工艺路线默认）、产品名称(只读)、规格型号(只读)、计量单位(只读)、客户(el-select，来源 options.客户，label `${客户编码} — ${客户名称}`)、订单数量*(el-input-number, >0；改变时若生产数量尚未手改或等于旧订单数量则同步)、生产数量*(el-input-number, >0)、工单日期(el-date-picker, 默认今天)、计划开工日期(可空)、交期(可空)、工艺路线(el-select；来源 `/px/processTask/routes`，仅「已审核」可选，未审核 disabled 并在 label 后缀标 `（未审核）`；默认优先 产品档案工艺路线（若已审核），否则 options.默认工艺路线）、备注(el-input)。
- 「临时工单」页签额外内容（v-if kind==='临时'）：
  - 提示条 el-alert(info)：`tt('临时工单的用料保存到本工单自己的物料清单（临时BOM），领料/报工优先按它取料；常规工单不用填子件，领料按产品的《组装物料清单》标准BOM取料')`
  - 区块标题 `tt('临时工单用料')` + 按钮 `tt('从标准BOM带出')`（调 stdBom，已有行时先 confirm 覆盖）/`tt('添加行')`
  - 表格（border size=small max-height 320）：行序、子件编码*(远程搜 invOptions)、子件名称(只读)、子件规格(只读)、计量单位(可编辑 input)、标准用量*(input-number >0，默认1)、损耗量(input-number，默认0)、行备注(input)、操作(删除)
  - 子件选中后自动回填 子件名称/子件规格/计量单位（来自 invOptions 行的 存货名称/规格型号/计量单位）。
- 校验：产品编码必填；订单数量>0；生产数量>0；工艺路线必填；临时工单 ≥1 行且每行 子件编码必填、标准用量>0、计量单位非空。提示用 tt() 文案（见 i18n 清单）。
- 保存：POST create；成功 ElMessage success（`tt('已新增生产工单')` + 单号）；emit saved；关闭。失败 `err()` 显示后端 message。
- 纯逻辑抽 `frontend/src/business/workOrderCreate.js`（blankLine / validate / buildPayload / mapStdBom），配单测 `workOrderCreate.test.js`（node:test）。

### 生产工单页 `WorkOrderList.vue`
**columns-ui 负责**：列设置（useReportColumns + ColumnSettingsDialog，panelCode='WORK_ORDER_LIST'）。
- 锁定列（不进列设置）：selection、expand、工单号(fixed left，链接不变)、生产状态(fixed right)、结案(fixed right)。
- 可配置列 = 现有其余基础列 + 新列「工单类型」（`row.工单类型`，值 常规/临时 用 tt() 显示）。列顺序/显隐由列设置决定（v-for orderedColumns），列宽/对齐/自定义渲染与原实现一致（当前工序 tt()、工序进度 num/num、四个按量流转列的表头 tooltip 保留）。
- 日排产日期列（`planCols`）永远排在可配置列之后，**不**进列设置；另在列设置末尾加一项伪列 `{prop:'日排产日期列', label:'日排产日期列'}` 控制整组日期列显隐（默认可见）。
- 工具栏在「导出」附近加 `tt('列设置')` 按钮；打开/保存/取消/恢复默认走既有 composable；页面挂载时 `init()` 应用已保存设置。
- 排单计划纸表（`frontend/src/business/print-formats.js`）：`PLAN_SHEET_BASE_COLS` 在「未完成总数」之后插入 `{ t:'订单数量', w:5, min:4, k:(r)=>fmtNum(r['订单数量'] ?? r['需求数量']), n:true }`；同步 `print-formats.test.js` 断言表头与值。
- en.js 增补本任务全部新键（清单见下）。

**Lead 负责**：生产工单页按钮条加「新增」（perm `create`）→ 打开 WorkOrderCreateDialog；加「物料清单」按钮（单行）→ 调 E 接口弹窗展示；接 saved 后 load()。

### i18n keys（`frontend/src/i18n/locales/en.js` 的 biz 段；columns-ui 统一追加）
| key | en |
|---|---|
| 工单类型 | Work Order Type |
| 日排产日期列 | Daily Schedule Date Columns |
| 新增生产工单 | New Production Work Order |
| 常规工单 | Standard Work Order |
| 临时工单 | Temporary Work Order |
| 主物料 | Main Material |
| 所需物料 | Required Materials |
| 子件规格 | Component Spec |
| 从标准BOM带出 | Load from Standard BOM |
| 添加行 | Add Line |
| 临时工单用料 | Temporary Work Order Materials |
| 临时 | Temporary |
| 常规 | Standard |
| 临时工单的用料保存到本工单自己的物料清单（临时BOM），领料/报工优先按它取料；常规工单不用填子件，领料按产品的《组装物料清单》标准BOM取料 | Temporary work order materials are stored in this work order's own BOM (temporary BOM) and are used first for picking and reporting. A standard work order needs no component lines: picking uses the product's standard Assembly BOM. |
| 临时工单至少要填写一行所需物料（子件） | A temporary work order needs at least one required material line |
| 该产品没有标准组装BOM，请手工添加子件 | No standard assembly BOM for this product; please add component lines manually |
| 已带出 | Loaded |
| 请选择主物料 | Select the main material |
| 订单数量必须大于 0 | Order quantity must be greater than 0 |
| 生产数量必须大于 0 | Production quantity must be greater than 0 |
| 请选择工艺路线 | Select a process route |
| 工艺路线尚未审核，不能用于生产工单 | The process route is not approved and cannot be used |
| 新增工单失败 | Failed to create the work order |
| 已新增生产工单 | Production work order created |
| 物料清单读取失败 | Failed to load the BOM |
| 临时工单 (already covers) | — |
| 请先勾选一张工单（已存在） | — |
| 来源 | existing |
| 行序/子件编码/子件名称/标准用量/损耗量/行备注/计量单位/工艺路线/客户/订单数量/生产数量/工单日期/计划开工日期/交期/备注/产品编码/产品名称/规格型号/保存/取消/删除/新增/物料清单 | already exist |

- 显示层全部走 `tt()`；数据键（工单类型/来源 的存储值）与业务事实不翻译，显示时 tt() 即可。
- `临时` / `常规` 两个值也走 tt()（列/标签显示用）。

## 验收（Lead 会复核）
- 纯逻辑单测通过：`cd frontend && node --test --experimental-test-isolation=none src/business/workOrderCreate.test.js src/business/print-formats.test.js`
- Vue SFC 无明显语法错误（Lead 统一 build）。
- 不回改后端/其他页面/工具目录；不动 8090 服务、不提交 git。
