# 生产工序进度看板 · 工序可点 + 检验单跳转（2026-11-13）

> 本文件是本次任务的**唯一契约**。前端/后端各自按本文件实现，不要另立口径。
> 页面：`/prod/plan/workOrderProgress`（`frontend/src/views/modules/plan/WorkOrderProgressBoard.vue`）。
>
> **2026-11-14 变更注记（本契约唯一被推翻的一处）**：用户口径「删除掉这个工序流转明细，这个作用不明显还很丑，
> 除非有其他方法」⇒ 工单排产页的「工序流转明细」**展开区整列删除**（生产工单页同一块一并删除），
> 下文 §3.1③ 里的「自动展开 + 把该工序标出来」不再实现；深链定位仍保留
> **行高亮 + 「已定位：工单号#行号 · 工序」提示**，定位的那道工序改在「当前工序」格的悬停提示里打 ★
> （`frontend/src/business/woFlowChain.js`）。检验单跳转（§3.2/§4）不受影响。

## 0. 用户原话与追问确认

1. 「让现在的生产工单看板点击所点击的工序可以跳转到那个工序，如果这个工序没有进入排产提示『该工单还未到达当前工序』这种提示语，提示语要求简洁明了。」
   追问答复：**跳转到当前工单排产的对应工序页面**；两种情况 —— ①没有进行排产 → 提示「该工单未进行排产」；
   ②工序进度为 0 → 提示「该工序未到达」（文案"之类即可"，要求简洁明了）。
2. 「让当前的生产工单点击下方的待检验可以转到对应的检验单中。」

## 1. 现状（已摸清，勿重复调研）

- 看板一行 = 一张工单行；`行.工序步骤[]` 由后端 `WorkOrderProgressService` 复用
  `ProcessTaskService.stepsSummary` 口径下发：`{序,工序,换算率,完工量,待审量,计划量,报工单数,当前,状态,已完成,检验}`。
- `行.工序步骤[].检验` = `{应检,类型[],状态,提示,单据数,已审核数,单据[{检验单号,检验类型,单据状态,结论,检验数量,不合格数量,检验员,单据日期}]}`
  （来源 `WorkOrderInspectionService.attach`）。
- 看板**整行点击**已经是「跳生产工单并定位 + 打开追溯」（`openRow()`），本次不要改这条。
- 环形组件 `WoProgressRing.vue`：环上工序名 / 环内百分比 / 环下完工量·计划量 / 最下面检验徽标；
  列表视图圆点链 `WoProgressChain.vue`（圆点 + 右上角检验小点）。
- 工单排产页 `/prod/plan/workOrderBoard`（`WorkOrderBoard.vue`）：左侧产线骨架（按 车间·产线分组），
  选中线后右侧明细一行 = 一张工单行在该线做**当前工序**，行内有可展开的「工序流转明细」
  （`row.工序流转明细[] = {工序,计划量,已做,可加工,待报,待流入,当前,...}`）。
- 深链既有机制：`PanelxList.vue` 的 `applyDocNoQuery()` 支持 `?docNo=<单据编号>` 定位到指定单据
  （另有 `?focus=`）。**检验单跳转就用它**，不要另写一套。

## 2. 数据契约（后端 → 前端）

`WorkOrderProgressService.board()` 返回的 `行[].工序步骤[]` 每项**新增 3 个字段**
（`ProcessTaskService.stepsSummary` 是追溯页共用实现，**不要改它**，在 `WorkOrderProgressService` 内补）：

| 字段 | 类型 | 含义 |
|---|---|---|
| `生产线` | String | 该工序在预排台账 `wo_process_line` 上的产线：`实际生产线` 非空取它，否则 `计划生产线`；无台账 = `''` |
| `台账状态` | String | `计划` / `已落实` / `已完工`；无台账 = `''` |
| `已排产` | boolean | 该工单行此工序在 `wo_process_line` 有未作废行（任何状态）= true |

行归属口径（与 `currentProcessOf` 一致，不得另立）：
`工单行id = 行.行id` 优先；台账 `工单行id IS NULL`（工单级）作为该工单所有行的兜底；
现有 `currentProcessOf()` 取「工序序 DESC 的第一条 已落实」的既有查询**保持不动**。

## 3. 路由契约

### 3.1 工序点击 → 工单排产的对应工序

```
/prod/plan/workOrderBoard?line=<生产线>&wo=<工单号>&rowid=<行id>&op=<工序>
```

- `line` 取 `step.生产线`，为空回退 `行.生产线`。
- 工单排产页消费：`loadSummary()` 后按 `line` 选中该线 → `loadScheduled()` → 定位行
  （`行id` 精确匹配优先，其次 `加工单号 + 工单行号`）→ **高亮该行 + 滚动到可视区 + 自动展开「工序流转明细」并把 op 那道高亮**
  → `router.replace` 摘掉这几个 query（用完即摘，避免 keep-alive 回来复写）。
- 找不到：`ElMessage.warning(tt('未在工单排产中找到该工单行'))` 并摘 query，不要卡死页面。

### 3.2 检验徽标/待检验提示 → 对应检验单

```
/panelx/list/<面板码>?docNo=<检验单号>
```

检验类型（显示名）→ 面板码（**唯一映射，写在一处**）：

| 检验类型（后端下发的显示名） | 面板码 |
|---|---|
| 首件检验 | `QC_FIRST_INSP` |
| 制程检验 | `QC_PROC_INSP` |
| 出货检验表观（2026-11-11 前叫「组装成品检验」） | `QC_ASM_INSP` |

选哪张单：`step.检验.单据` 里**优先 `单据状态` ∈ {草稿,审批中}**（待处理那张），没有则取**最后一张**（`检验单号` 最大）。
`单据` 为空（该工序还没出单）→ `ElMessage.warning(tt('该工序暂无检验单'))`，不跳。

## 4. 前端判定口径（写死，别自行发挥）

点工序（看板环 / 列表圆点）：

1. `行.生产状态 === '未排产'` 或 `行.生产线` 为空 ⇒ `ElMessage.warning(tt('该工单未进行排产'))`，不跳。
2. `Number(step.完工量||0) <= 0 && Number(step.待审量||0) <= 0` ⇒ `ElMessage.warning(tt('该工序未到达'))`，不跳。
   （= 环上进度 0% 且没有草稿报工；有草稿报工算「已到达」）
3. 否则跳 3.1。

点检验徽标（环下「待检验/待审核/需检/✓合格/✗不合格」/ 列表圆点右上角检验小点）：

- 有单按 3.2 跳；无单 `该工序暂无检验单`。

行级「待品质检验: 成型 / 组装」提示条（`.wpb-qc-hint`）也可点：打开**第一条「状态 ∈ {待检验,待审核} 且 有单据」**的工序的检验单；
一条都没有 ⇒ `该工序暂无检验单`。整行点击行为不变。

所有子元素点击必须 `@click.stop`（别把行点击事件带起来跳生产工单）。

## 5. i18n 词条（显示层一律 `tt()`，全部语言补词条）

`frontend/src/i18n/locales/{de,en,es,fr,ja,ko,ru,th,vi,zh-TW}.js`（另有 zh-CN.js 按既有惯例判断是否需要）：

| 中文 | en |
|---|---|
| 该工单未进行排产 | This work order has not been scheduled |
| 该工序未到达 | This process has not been reached |
| 该工序暂无检验单 | No inspection sheet for this process |
| 未在工单排产中找到该工单行 | Work order row not found in work order scheduling |
| 点击工序跳转到该工序排产 | Click a process to open it in work order scheduling |
| 点击查看检验单 | Click to view the inspection sheet |
| 已定位 | Located |
| 点击行可跳转到生产工单并定位该工单；点击工序跳转到该工序排产，点击检验标记打开检验单 | Click a row to open the work order; click a process to open its scheduling; click the inspection badge to open the inspection sheet |

其余复用已有词条（`工序`/`工单排产`/`待检验`/`待审核`/`需检`/`合格`/`不合格`/`工序流转明细` 等）。
**只加缺的**：先 grep 每个 key 是否已在对应 locale 里，避免重复键（重复键会静默覆盖）。

## 6. 文件归属（写域，互不重叠）

| 谁 | 文件 |
|---|---|
| backend-dev | `backend/src/main/java/com/yinjia/mes/service/WorkOrderProgressService.java` |
| board-dev | `frontend/src/views/modules/plan/WoProgressRing.vue`、`WoProgressChain.vue`、`WorkOrderProgressBoard.vue` |
| wb-dev | `frontend/src/views/modules/plan/WorkOrderBoard.vue` |
| i18n-dev | `frontend/src/i18n/locales/*.js` |
| Lead | 构建 `build-appjar.ps1` + `tools/scripts/rebuild-prod.ps1`、ego 验收、`tools/archive/_wo-progress-click-20261113/`、git 提交 |

**不要动**：`ProcessTaskService.py`…（不涉及）、`WorkOrderInspectionService`、`PanelxList/PanelxForm`、
`menus.js`/router（本次不加页面/菜单/面板，**零数据库变更、零迁移脚本、零 yj_panel/yj_field 变更**）。

## 7. 验收（Lead 统一跑，自测要求）

- 后端：`cd backend; $env:JAVA_HOME='C:\Users\vigna\.jdks\ms-25.0.4'; mvn -o -q -DskipTests compile` 通过。
  **不要**跑 `mvn package` / `npm run build`（会动 8090 正在用的 jar 与 static，由 Lead 统一做）。
- 前端：静态自查（`grep`/`read`）+ 5173（vite 源码即时生效，Lead/verifier 跑 ego 浏览器验收）。
- 提交前 `git status` 只能出现自己写域内的文件。

## 8. 现场环境

- 5173 = vite（源码即时生效，看效果优先用）；8090 = `backend\target\yinjia-mes-backend-0.1.0.jar`（改完需 Lead 重建）。
- 登录工厂：`YJ` = 正式库 `HSDZ_MES`；`YJ_TEST` = 测试库。
- DB（只读探针可用）：`jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES`，`yinjia` / `Yinjia@2026`；
  驱动 `tools/lib/mssql-jdbc.jar`。
