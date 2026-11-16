# 生产工单四项需求（2026-11-13）：排单计划订单数量 / 新增生产工单（常规+临时）/ 临时BOM / 列设置

> 用户原始需求（一条消息四项 + 一个提问）：
> 1. 为当前所有生产工单中的排单计划中增加当前的订单数量的列；
> 2. 让当前的生产工单可以新建生产工单；
> 3. 在当前新建生产工单中增加一个页签按钮，为增加临时工单，临时工单需要实现上方为主物料下方为所需的物料根据这个处理实现完成。
>    并提问：「这个页面能否同时作为新建生产工单的实现呢？作为生产工单的实现的话会不会导致只填写主物料，而没写子物料导致的当前 bom 没法被查询到？」
> 4. 为当前的生产工单处增加列设置实现，参考订单结转中的实现方式。

## 结论（哪个做到哪）

| # | 需求 | 实现 | 验收 |
|---|---|---|---|
| 1 | 排单计划加「订单数量」列 | `frontend/src/business/print-formats.js` 的 `PLAN_SHEET_BASE_COLS` 在「未完成总数」后插入「订单数量」；取值 `订单数量 ?? 需求数量` | 纸表实渲染截图 `ego/r10-plan-sheet.png`（切炭车间排单计划：未完成总数 5 → **订单数量 200** → 生产计划数量 5）；`print-formats.test.js` 27/27 |
| 2 | 生产工单可新建 | 生产工单页工具栏「新增」→ `WorkOrderCreateDialog.vue`；后端 `POST /px/workOrderList/create`（`WorkOrderCreateService`）落 `plang` + 按路线建工序台账 | 界面实点新建 `GD-2026-11-0011`（常规）/ `GD-2026-11-0012`（临时）成功；接口探针 16/16 PASS |
| 3 | 新建里加「临时工单」页签（上方主物料、下方所需物料） | 弹窗两页签：常规工单 / 临时工单；临时页签 = 主物料 + 本工单子件表（「从标准BOM带出」/「添加行」）；落新表 `wo_bom`（按工单定制，不污染产品标准 BOM） | 临时页签实测带出 7 行后保存 → 列表 `工单类型=临时`；「物料清单」弹窗来源=临时工单、7 行；接口/领料/报工三处同源 |
| 4 | 生产工单页加「列设置」 | `WorkOrderList.vue` 复用 `useReportColumns` + `ColumnSettingsDialog`（panelCode=WORK_ORDER_LIST）；锁定列 selection/expand/工单号/生产状态/结案；37 个可配置列（含新列「工单类型」）；「日排产日期列」整组显隐伪列 | 弹窗 38 项全列、保存后刷新仍保留；隐藏日期列 → 表格日期列消失 → 勾回恢复（截图 `ego/r02-colset.png`、`r03-*.png`） |

### 对用户提问的答复（BOM 会不会因为只填主物料而查不到）

**不会。** 本系统 BOM 取数从来不是"看工单上有没有子件"，而是分两层（本次收口到 `WorkOrderBomService`）：

- **常规工单**：只填主物料（产品编码）。领料/报工取 BOM 时按**产品编码**去查产品标准《组装物料清单》`bs_asm_bom`
  （工序=组装；默认BOM='是' → 版本号 DESC → 单据编号 DESC，三个入口同一口径）。只要该产品维护过标准 BOM，
  工单上没有子件也查得到（本次实测：常规工单 GD-2026-11-0011，「物料清单」弹窗来源=标准BOM、7 行）；
- **临时工单**：产品没有标准 BOM、或用料与标准不同。建单时**必须**录入子件（后端校验 ≥1 行），
  存到 `wo_bom`（按工单行定制）；取 BOM 时**本工单用料优先**，没有再回落标准 BOM。
  ⇒ 所以「这个页面同时作为新建生产工单的实现」是成立的：常规页签不填子件不会影响 BOM 查询；
  临时页签强制填子件，保证临时工单的 BOM 一定可查。

## 改了什么（文件清单）

### 数据库（两账套已执行，幂等）
- 新表 `wo_bom`（工单物料清单/临时工单用料，19 列）：`tools/migrate-wo-bom-20261113.sql`；
  表级 + 18 列 `MS_Description`、PK、`UX_wo_bom_row_line(工单行id,行序) WHERE asp_cancel='N'`、`IX_wo_bom_wo_no`；
  两账套 `DbSync run` 均 `[OK] 8 batches`（复跑幂等）。
- 生产工单页面动作词 `create`（「新增」）授予已有 view 的角色（正式库 5 行）；
  `PagePanelRegistry.WORK_ORDER_LIST_ACTIONS` + `PanelPermissionService` 覆盖映射同批改。
- 台账：`tools/db-inuse-tables.txt` 登记 `wo_bom`；`tools/db-migrations.txt` 登记脚本；
  `docs/development/数据库表清单.md` §六 27→28 张 + v3.90 维护记录。

### 后端
- 新增 `WorkOrderCreateService`：校验（产品存在/数量>0/路线已审核/临时工单≥1 行）→ `plang` 插入（GD 号池取号）→
  临时工单写 `wo_bom`（名称/规格/单位以存货档案为准）→ `ProcessTaskService.ensureLedgerForWorkOrder` 建工序台账。
- 新增 `WorkOrderBomService`：BOM 取数唯一口径（临时工单用料 → 标准组装 BOM 兜底）。
- `WorkOrderListController`：新增 `options / productInfo / stdBom / create / bom` 五个端点；
  列表下发 `工单类型`（常规/临时）与 `临时物料项数`（一次分组聚合，非逐行子查询）。
- `MobilePickController`（手机扫码领料展开用料）与 `WorkReportController`（工序报工·组装物料展示）改用
  `WorkOrderBomService`：临时工单按临时 BOM 展开、备注写「临时工单用料」；标准 BOM 行为不变。
- `QuickScheduleService.requireRouteAudited` 由 private 提升为 public（新建工单复用同一道路线审核闸门，不另写判据）。

### 前端
- 新组件 `views/modules/plan/WorkOrderCreateDialog.vue`（「新增生产工单」弹窗：两页签 + 临时BOM 子件表）；
- 新纯逻辑 `business/workOrderCreate.js` + 单测 `workOrderCreate.test.js`（16/16）；
- `WorkOrderList.vue`：工具栏「新增」「物料清单」「列设置」；列设置（37 可配置列 + 日期列伪列）；
  物料清单只读弹窗；保存成功刷新列表；
- `print-formats.js` 排单计划加「订单数量」列（+ 测试 27/27）；
- `en.js` 补 26 个 en 键（本任务 24 + 物料清单弹窗 2 + 页面两条历史 tooltip 补译）。

## 验收（可复跑）

### 1. 纯逻辑单测
```bash
cd frontend
node --test --experimental-test-isolation=none src/business/workOrderCreate.test.js \
  src/business/print-formats.test.js src/views/modules/plan/workOrderRecipe.test.js
# 期望 tests 46 / pass 46 / fail 0
```

### 2. 接口探针（8091 新 jar，指向测试账套 HSDZ_MES_TEST）
```bash
node tools/archive/_wo-create-20261113/probe/api-verify.mjs http://127.0.0.1:8091
# 期望 16/16 PASS（options/productInfo/stdBom/create 常规+临时/列表字段/BOM 弹窗取数/
#   手机扫码领料按临时BOM展开/工序报工 context 组装物料=临时工单）
```
> 探针会新建 2 张工单（常规+临时），跑完可用同目录说明清理：测试账套一次性数据，
> 本次实跑后已用 `.tmp/_q/cleanup-test-wo-create.sql` 清空该批工单且复核 剩余工单=0 / 剩余临时用料=0。

### 3. 界面（ego-browser，脚本在 `ego/round-01..13.mjs`，截图同名 .png）
- 生产工单页：`新增`/`物料清单`/`列设置` 三个按钮齐、零 pageerror；
- 列设置：38 项（含工单类型、日排产日期列）、隐藏日期列 → 表格日期列消失 → 恢复；刷新后设置仍在；
- 新增常规工单：产品远程搜 → 名称/规格/单位回填、订单数量→生产数量同步、默认工艺路线 `GY-CB-STD`、保存成功；
- 新增临时工单：临时页签说明条/9 列表格、从标准BOM带出 7 行、保存成功（toast = 已新增生产工单 GD-2026-11-0012）；
- 列表「工单类型」列：常规/临时 实显（GD-2026-11-0012 = 临时）；
- 物料清单弹窗：来源=临时工单、7 行（用量/单位齐全）；
- 排单计划纸表：`ego/r10-plan-sheet.png` 实渲染（切炭车间排单计划 → 订单数量 200 列）；
- **英文走查**（round-11~13，切 `mes_locale=en`）：按钮 `New / Material List / Columns`、列头 `Work Order Type / Daily Schedule Date Columns`、
  弹窗 `New Production Work Order` + 页签 `Standard Work Order` / `Temporary Work Order`、临时页签整段说明英文、
  列设置 `Columns` 38 项全英文（截图 `r12-en-list.png`、`r12-en-temp.png`、`r13-en-colset.png`）；
- **权限矩阵**：`node tools/archive/_wo-create-20261113/probe/perm-matrix.mjs`
  → `矩阵含 create 动作=true 角色已授权 create=true perms=…,create`。

### 5. 8091 预览实例（本任务新 jar + 测试账套；验收后保留运行）
```powershell
$env:JAVA_HOME='C:\Users\vigna\.jdks\ms-25.0.4'
cd D:\workspace\yinjia\.tmp\backend-build-v4
& "$env:JAVA_HOME\bin\java.exe" -Dstdout.encoding=UTF-8 -jar target\yinjia-mes-backend-0.1.0.jar `
  --server.port=8091 `
  "--spring.datasource.url=jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false;trustServerCertificate=true" `
  "--yinjia.test-datasource.url=jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false;trustServerCertificate=true"
# 打开 http://127.0.0.1:8091/#/prod/plan/workOrderList （admin/123456）
```
> ⚠ 该实例连的是**测试账套**，且 `.tmp` 不随 git 提交；要长期用得按上面命令重打（或部署到 8090/服务器）。

### 4. 体检（两账套，均为**存量**问题，本次 0 新增）
```
cd tools && YINJIA_SQL_PASS=... java -cp lib/mssql-jdbc.jar verify/DbNormAudit.java
正式库 RESULT: FAIL-3  = 02 rd_sample_int_detail 缺表注释（存量）/ 09 en 覆盖存量 / 12 迁移链存量未登记 17 个
测试库 RESULT: FAIL-7  = 测试库快照陈旧存量债（01/02/03/05/09/12/13）
```
本次新增对象 `wo_bom` 的 01/02/03/04/05/06/13 全 PASS（表命名/表注释/列注释/主键与审计四件套/元数据/面板对象）。

## 部署注意
- 本次改了 `plang` 列表查询（新增 wo_bom 关联）⇒ **必须先执行迁移再换 jar**，否则生产工单列表会报 `Invalid object name 'wo_bom'`。
- 8090 现役 jar 未替换（宿主会话占用；按纪律不重启）。5173 源码即时生效；8091 = 本任务新 jar（测试账套）可预览。
- 前端静态产物已同步进 `backend/src/main/resources/static`（另起 chore 提交）；服务器增量部署走 `deploy-production.bat`（先 CHECK 再 GO），本任务未做服务器部署。
