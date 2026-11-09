# 生产工序进度看板（2026-11-08）

用户口径（原始）：
> 「生产工单进度需要做一个看板，方便直观查看工单各工序进度，如图所示。当前系统已经存在类似实现，
> 为当前的生产工单处的追溯实现，可以复用相关的实现。新增当前的这个看板视图查看，增加这个看板
> 可以点击其中订单行转跳到这个工单。」

后续补充（视觉口径修正，已按此落地）：
> 「图片仅作为参考样式，实际设计风格按照当前的系统实现创建。」
⇒ 参考图只借**信息结构**（一行=一张工单行、每道工序一个进度可视化、点行进工单），
视觉按本系统现有浅色 Element Plus 风格（工单排产 / 快速排产 / 我的桌面 同一套设计语言）。

## 一、功能

- 入口：**生产计划 → 生产工序进度看板**（`/prod/plan/workOrderProgress`，菜单紧跟「生产工单」）。
- 两种视图（同一份数据，一键切换）：
  - **看板**（默认）：浅色表格式行；列 = 工单号(含工单行号/状态/生产线) / 客户 / 产品名称(产品编码·规格) /
    计划数量 / 完工信息（该行按**工艺路线**的每道工序一个环形进度：环上工序名、环内百分比、环下 完工量/计划量）；
    已完成绿 / 进行中蓝 / 未开始灰，当前工序浅蓝底+蓝描边；整行可点击。
  - **列表**：沿用现有 el-table 风格；列 = 工单编号 / 工单状态 / 生产进度（小圆点链+箭头+工序名）/
    产品编号 / 产品名称 / 产品规格 / 计划数；圆点 tooltip 显示「工序 · 完工量/计划量」；整行可点击。
- 工具条：标题、当前时钟、数据时间、看板/列表切换、状态（未完工/已完工/全部）、生产线下拉、关键字搜索、
  刷新、自动刷新开关（60 秒；切走/卸载即清定时器）。
- **点击行 → 跳转「生产工单」页并定位该工单行**：`/prod/plan/workOrderList?keyword=<工单号>&focus=<行id>`。
  生产工单页会：按工单号收敛列表、把该行设为当前行（高亮 + 滚动到可视区）、**自动打开该行的「工单详情·追溯」**；
  query 用完即摘。切出生产工单页时会收起该追溯弹窗（避免 keep-alive + append-to-body 弹窗浮在别的页上挡点击）。
- 只读页：不写任何业务数据；loading / 空 / 请求失败都有可读提示。

## 二、口径复用（本任务核心约束）

工序步骤**不是**看板自己算的一套：`ProcessTaskService.detail()` 里原先内联的「按工艺路线生成工序步骤」
逻辑已抽成 **`ProcessTaskService.stepsSummary(...)`**（唯一实现），「工单详情·追溯」与看板
（`WorkOrderProgressService`）都调它 ⇒ 两处不可能出现两套数：

- 工序计划量（该道）= 本行排产数量 × **该工序自己的换算率**，❌ 不逐道累乘；
- 四态：已完工 / 超产 / 进行中 / 未开始；另给 `已完成` 布尔（超产=完成只在后端判一次）；
- 待审量（草稿报工）只影响“是否已开始”的着色，不计入产出/转序/结案；
- 当前工序 = 最后一道**有已审产出**的工序；产出 = 最后一道有完工量工序的完工量（允许超产）。
- 报工行级锚定与追溯完全一致：①`scjl.gd_id → plang_pc.plang_id`；②未锚定且 `工单行号 = plang.pl_xc`；
  ③再兜底 `批次号` 相等。同工单号不同行/批次不会串行。

看板行另外保留生产工单列表的「当前工序」口径（预排台账最后一道已落实，缺台账回落本行 `p.当前工序`）。

## 三、接口

`POST /api/px/workOrderProgress/list`（只读，权限 = 页面级虚拟面板 `WORK_ORDER_PROGRESS` 的 view）

请求（全部可空）：
```json
{ "状态": "未完工|已完工|全部", "keyword": "工单号/产品/客户/订单号", "生产线": "切炭2(自动)", "limit": 300 }
```
响应 `data`：
```json
{
  "数据时间": "2026-11-08 16:28:04",
  "汇总": { "行数": 14, "未完工行数": 14, "已完工行数": 0, "平均进度": 16.07 },
  "行": [{
    "工单号": "GD-2026-11-0008", "工单行号": 1, "行id": 2180, "批次号": "",
    "客户": "深圳鼎泰福…", "客户代码": "C-58", "产品编码": "C-58-15", "产品名称": "X烧结炭棒/滤芯44#",
    "规格型号": "34*12*162", "订单号": "ZL-20261019-02", "订单行号": 1,
    "生产线": "切炭2(自动)", "计划数量": 5000, "需求数量": 5000, "入库数量": 0,
    "生产状态": "未排产|未完工|在产|完工|已结案", "结案": "N", "完工状态": "在制",
    "工艺路线": "GY-CB-STD", "当前工序": "切炭",
    "计划开工日期": "2026-11-03", "计划完工日期": "2026-11-19",
    "工序步骤": [{ "序":1,"工序":"成型","换算率":1,"完工量":5000,"待审量":0,
                  "计划量":5000,"报工单数":3,"当前":true,"状态":"已完工","已完成":true }],
    "已完成步骤数": 1, "产出": 5000, "进度": 100, "未完成合计": 0
  }]
}
```

实现要点（`WorkOrderProgressService`）：1 次 plang 查询（TOP limit，状态先 SQL 粗筛再内存用
`PlangStatus` 精确五态）+ 1 次 scjl 按 (工单号, plang 行id, 工单行号, 批次号, 工序) 聚合 +
1 次 `wo_process_line` 批量取当前工序 + 按路线缓存的 `bs_route`，避免逐行 N+1。

## 四、改动文件

后端（Java）：
- `backend/.../service/ProcessTaskService.java`：抽 `routeLines()` / `stepsSummary()`（两个重载）；
  `detail()` 改为调用同一实现，返回键/语义不变。
- `backend/.../service/WorkOrderProgressService.java`（新）：看板批量取数。
- `backend/.../controller/WorkOrderProgressController.java`（新）：`POST /api/px/workOrderProgress/list`，
  只做参数转发，权限 `perm.requirePanelView(WORK_ORDER_PROGRESS)`。
- `backend/.../service/PagePanelRegistry.java`：新增 `WORK_ORDER_PROGRESS` 常量、动作集 `{view, query}`、
  `ALL` 里登记 `生产工序进度看板 / 生产计划`。

权限/数据库：
- `tools/migrate-work-order-progress-panel-20261108.sql`（新，幂等）：
  ①等价补授——凡已授 `WORK_ORDER_LIST` 可见的角色 + 管理员，补授 `WORK_ORDER_PROGRESS view,query`；
  ②`yj_translation` scope='panel' 登记面板名 en 译名；③授权数/应补授未补授自检。
- `tools/db-migrations.txt`：登记上述脚本（两账套均已执行并记录，`DbSync sync` = 执行 0 / 失败 0）。

前端（Vue）：
- `frontend/src/views/modules/plan/WorkOrderProgressBoard.vue`（新，839 行）
- `frontend/src/views/modules/plan/WoProgressRing.vue`（新，看板视图环形进度）
- `frontend/src/views/modules/plan/WoProgressChain.vue`（新，列表视图圆点链）
- `frontend/src/router/index.js`：新增 `/prod/plan/workOrderProgress` 路由（meta.panelCode 供 URL 守卫）
- `frontend/src/business/menus.js`：生产计划组新增菜单项；`frontend/src/business/menus.test.js` 同步断言
- `frontend/src/views/modules/plan/WorkOrderList.vue`：支持 `?keyword=&focus=<行id>`（加载后定位、高亮、
  滚动、自动开追溯；keep-alive 下 onActivated 同样生效；onDeactivated 收起追溯弹窗）
- `frontend/src/i18n/locales/*.js`：本页全部文案译名（zh-TW/en/ja/ko/es/fr/de/ru/vi/th 共 9 个语言包；
  zh-CN 为源语言无需 biz 块），含工序名 混料/成型/切炭/组装/装箱 的译名。
- `backend/src/main/resources/static/**`：前端构建产物镜像同步（部署包前端来源，按仓库既有做法在
  8090 打包前同步；静态产物变更量大属正常）。

## 五、验证（证据在本目录）

- 前端构建：`cd frontend && npm run build` ✅（built in 28~33s；产物含 `WorkOrderProgressBoard-*.js/css`）
- 单测：`node --test src/business/menus.test.js src/core/auth/panelAccess.test.js` → 40/40 pass
- 后端构建：`mvn clean package -DskipTests` ✅；jar 内含新 class + 新前端 chunk
- 迁移：`DbSync run` 两账套（HSDZ_MES / HSDZ_MES_TEST）均 `[OK] 5 batches`；
  授权角色 = 正式库 5 个 / 测试库 5 个（含管理员），面板名 en 译名已登记
- 接口：
  - `api-logs/api-list-and-trace-parity.txt`：看板接口（未完工 14 行；已完工/全部/关键字/生产线过滤）
    + **与 `/px/processTask/detail` 首行工序步骤逐字段一致 = true**
  - `api-logs/api-trace-regress.txt`：追溯 detail 回归（行级/整单/换算率×3 路线/已结案行；匿名调用被拦）
  - `api-logs/api-perm-matrix.txt`：登录 `pagePerms.WORK_ORDER_PROGRESS='*'`；权限矩阵含新面板
    `{view,query}`；virtual 面板计数 20
  - `logs/q-board-perm.sql`：两账套 yj_role_panel / yj_translation 只读核对
- ego 浏览器实测（工具：ego lite v2.2.0，task space `wo-progress-board-lead-final-20261108`）：
  - `screenshots/round-04-board-default.png`：5173 看板视图（14 行 / 44 环 / 汇总 14·14·0·16.1%）
  - `screenshots/round-04-list-fixed.png`：列表视图（14 行 / 圆点链；表格列宽合计=容器宽，无横向滚动条）
  - `screenshots/round-04-filter-done-board.png`：筛选「已完工」(300 行全绿)
  - `screenshots/round-04-search.png`：关键字 `GD-2026-11-0008` → 1 行
  - `screenshots/round-03-en.png`：英文界面（工具条/表头/统计/环名全英文，仅业务事实数据保留原文）
  - `screenshots/round-01-jump-trace.png`：点行 → `#/prod/plan/workOrderList`，列表收敛 1 行、
    当前行高亮、关键词已填、追溯弹窗自动打开
  - `screenshots/round-01-after-leave.png`：切页后弹窗已收起（visibleOverlayCount=0，不挡新页面）
  - `screenshots/round-05-8090-board.png` / `round-05-8090-jump.png`：**8090 打包版**同样通过
    （镜像同步 static + 重打 jar 后重启）
  - 复跑：`ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/wo-progress-board-lead-final-20261108/round-0N.mjs')"`
    （ego 脚本原样存档在 `ego-scripts/`；脚本里的截图输出路径指向 ego 工作目录，可按需改）
- 回归闸门：
  - `FourDocAudit` 两账套 `[PASS]`（采购链四单字段与基线一致）
  - `DbNormAudit` 两账套基线债：FAIL 项（rd_sample_int_detail 缺注明 / 存量缺 en 译名 216 条 /
    17 个未登记历史脚本）**均为既有存量问题**；本任务产物不在任何 FAIL 名单
    （日志：`logs/dbnormaudit-pre-existing-fails.log`）

## 六、部署/回滚

- 本任务未提交 git（用户未要求）；建议提交拆分：
  1) `feat: 生产工序进度看板(复用追溯工序步骤口径 + 点行跳工单定位 + 双视图)`
     —— Java/Vue/路由/菜单/测试/i18n/迁移清单
  2) `chore: 前端静态产物同步(生产工序进度看板)`
     —— `backend/src/main/resources/static/**`
- 回滚：删除 3 个新 Vue + 2 个 Java 新类，撤销 PagePanelRegistry/ProcessTaskService/menus/router/WorkOrderList
  改动；库侧可删 `yj_role_panel.panel_code='WORK_ORDER_PROGRESS'` 行与对应 yj_translation 行（不影响其它数据）。
- 已执行的服务：本地 Docker mssql2019（1433）、后端 8090（新 jar）、前端 vite 5173 均保持运行中。

---

## 七、属性扩充（第二次迭代，2026-11-08）

用户追加口径：
> 「为当前的看板内容进行增加，产品编码，产品规格，就是把当前生产工单主要属性添加进去，评估一下当前需要增加什么」。

### 7.1 评估：生产工单主要属性 → 看板取舍

| 生产工单属性 | 看板是否显示 | 说明 |
|---|---|---|
| 工单号 / 工单行号 / 生产状态 / 生产线 | ✅ 已有 | 行标识 |
| 客户 + 客户代码 | ✅ 已有（本次补客户代码小字） | |
| 产品名称 | ✅ 已有 | |
| **产品编码 / 规格型号** | ✅ **本次新增（显式标签）** | 用户点名要加；原来只是并排小字，现为「产品编码: …」「规格型号: …」 |
| **订单号 / 订单行号** | ✅ **本次新增** | 订单追溯（生产工单列表有 od_no/订单行号） |
| **需求数量 / 入库数量 / 余量** | ✅ **本次新增** | 余量 = 本行需求−本行占用，与生产工单列表同口径（`PlangRowOccupancy`） |
| **生产单位** | ✅ **本次新增** | plang.jldw（支/件），附在计划数量后 |
| **当前工序** | ✅ **本次新增** | 与生产工单列表同口径（台账最后一道已落实→本行 p.当前工序） |
| **计划开工日期 / 计划完工日期（交期）** | ✅ **本次新增** | 新建「交期」列：计划完工主显示 + 计划开工小字 |
| **批次号** | ✅ **本次新增（有值才显示）** | 生产批次在首次「生产完工」时才生成，在制阶段多为空（不在界面硬凑） |
| 工艺路线 | 🔶 数据已返回，界面未单列 | 环已经按路线展示工序，单列价值低；需要再上屏是一行改动 |
| 转单/排产数量 | ✅ 即「计划数量」 | 同一事实 |
| 交期紧迫度 / 7·15 天需交付·已排 | ❌ 不做 | 属生产工单列表的排产报表口径，逐行放看板太密；留在列表/排产页 |
| 日排产（每天计划/实报） | ❌ 不做 | 看板是「工序进度」视角，日排产是排产明细；点行可进工单看 |
| 领料单号 / 成型配方 | ❌ 不做 | 物料侧信息，与工序进度弱相关 |
| 打印人 / 打印时间 / 工单日期 / 转单时间 | ❌ 不做 | 操作留痕，不是生产属性 |
| 源工单号 / 拆分序号 / 根工单号 | ❌ 不做 | 切单血缘，低频；需要时进工单详情·追溯看 |
| 公司代码 | ❌ 不做 | 当前单组织 |
| 结案异常 / 重点管控 | ❌ 暂不做 | 品质/运营标记，看板可后加徽标（有需要再说） |

### 7.2 实现

- 后端接口 `POST /px/workOrderProgress/list` 行内**新增 2 个字段**：`生产单位`、`余量`；
  其余主属性原本已返回。余量 SQL 收口到新类
  `backend/.../service/PlangRowOccupancy.java`（`used()` / `yieldOf()`），
  `WorkOrderListController` 与看板共用同一个表达式，实测余量与生产工单列表 **5/5 一致**。
- 前端看板视图改 **6 列**：生产工单(号/状态/行号/当前工序/生产线/订单号#行号) / 客户(名称+代码) /
  产品(名称+产品编码+规格型号) / 数量(计划+单位 / 需求 / 入库 / 余量) / 交期(计划完工+计划开工+批次号) /
  完工信息(环形进度)；列表视图补 7 列（客户/订单号/当前工序/需求数量/入库数量/余量/计划完工日期，共 14 列，
  横向滚动）。
- 环形组件尺寸随窗口自适应（≥1600 用 72px，窄屏 60px），1392 CSS 宽下 4 道工序环仍单排不换行。
- i18n 新增 9 键 × 9 语言包（80 条）：产品 / 交期 / 需求数量 / 余量 / 订单号 / 订单行号 /
  计划完工日期 / 计划开工日期 / 生产线。

### 7.3 验证（证据见本目录 `screenshots/attrs-*`、`api-logs/api-board-attrs.txt`）

- `attrs-round-07-board-1392.png`：看板 6 列（1392 CSS 视口；`docScrollW=clientW=1392`，
  看板 body `client=scroll=1141`，字段零截断；表头 生产工单/客户/产品/数量/交期/完工信息）。
- `attrs-round-07-list.png`：列表 14 列（新增客户/订单号/当前工序/需求数量/入库数量/余量/计划完工日期）。
- `attrs-round-07-board-1920.png`：1920 CSS 视口无溢出。
- `attrs-round-08-8090-board.png` / `attrs-round-08-8090-en.png`：**8090 打包版**通过；
  英文界面表头/标签全英文（Product code / Specification / Demand Qty / Received / Balance / Planned Start），
  仅业务事实数据（客户名/产品名/产线名/单位「支」）保留原文（ADR-0001）。
- `api-logs/api-board-attrs.txt`：接口逐字段取证 + 余量口径与生产工单列表 5/5 一致。
- 点行 → 生产工单定位 + 追溯弹窗仍正常（`attrs-round-07-jump.png`）。
- 构建：前端 `npm run build` ✅（chunk `WorkOrderProgressBoard-BZWndIQj.js` 19.5 kB）；
  后端 `mvn clean package` ✅，static 已重新镜像同步、8090 已重启。

---

## 八、工序检验提示 + 完成合格/不合格 + 检验审核流程（第三次迭代，2026-11-08 深夜 → 11-09 凌晨）

用户口径：
> 「1，生产进度条工单，进行到哪一步，那个环节会提示品质进行检验。订单完成状态合格绿色不合格红色
>  2 审核流程，所有检验单据都需要审核和反审核（当前应该已经存在确认即可就是提交审批和弃审），完成之后生产进度条可看结果」

### 8.1 口径（与追溯/出单规则同源）
- **应检工序** = 成型（首件 `QC_FIRST_INSP` + 制程 `QC_PROC_INSP`）、组装（组装成品 `QC_ASM_INSP`）；
  切炭/混料/装箱不出工序检验单（同 `QcInspAutoService.OP_PANELS`）。
- **只认已审核检验单的结果**：草稿/审批中只算「待检/待审核」；**弃审后看板结论自动回退**（用户口径「完成之后可看结果」）。
- 单步状态四态：`未开始`（该工序还没产出，不提示）/ `待检验`（有产出但没单/没检）/ `待审核`（有单未审完）/
  `合格` / `不合格`（已审核且不合格数量>0 或总结论=不合格）。
- **品质提示**：`提示=待品质检验` 仅在该工序**已有产出（完工量>0）且检验未完成**时给出；未开工只显示灰色「需检」标记，避免误催品质。
- **行级质检状态**：`合格`（应检工序全部已审核合格）/ `不合格`（任一已审核不合格）/ `检验中`（有单待审）/ `待检验` / `无需检验`。
- 行归属与追溯一致：①检验单头「工单行号」②无行号按报工单号③批次号；都不命中且该工单仅一行才归行（不猜）。

### 8.2 接口新增（`POST /api/px/workOrderProgress/list`）
- 本行应检工序的 `工序步骤[].检验 = {应检,类型[],状态,提示,单据数,已审核数,单据[]}`（单据含单号/类型/单据状态/结论/检验数量/不合格数量/检验员/日期）。
- 行级 `质检状态`、`待检验工序[]`、`质检汇总{应检/已检/缺检工序,检验单数,已审核数,检验数量合计,合格数量合计,不合格数量合计,结论}`。
- 顶层 `汇总.待检验行数`。
- 实现：新增 `backend/.../service/WorkOrderInspectionService.java`（批量三表取数 + 判定，只读）；`WorkOrderProgressService` 接入。
  与「工单详情·追溯」质检段同一套 SQL 口径（明细不合格列名逐表登记：首件/组装成品=不合格数量、制程=不良数量）。

### 8.3 前端
- 看板环形进度下加**检验徽标**：待检验/待审核=橙、合格=绿「✓ 合格」、不合格=红「✗ 不合格」、未开工=灰「需检」；
  悬停列出每张检验单（单号/类型/状态/结论）。
- 行级：生产状态 tag 旁加**质检徽标**；已完工/已结案行的生产状态 tag 按质检结果着色（**合格绿 / 不合格红 / 待检验橙**）。
- 行内**待品质检验提示**：`待品质检验: 成型 / 组装`（当前工序命中时高亮）；顶部汇总条 `待品质检验 N 行`。
- 列表视图新增「质检状态」列；圆点链的应检工序加检验标记（同套状态色，tooltip 带检验状态与首张单号）。
- i18n 新增 12 键 × 10 语言包（114 条）：检验状态/待检验/待审核/需检/待品质检验/质检状态/无需检验/检验中/首件检验/制程检验/不合格/暂无检验单。

### 8.4 审核与反审核（5 张检验单据，测试账套实测）
- **结论：PASS 173 / FAIL 0**（证据 `tools/archive/_wo-insp-audit-20261108/`，测试账套 YJ_TEST→HSDZ_MES_TEST，测后整行还原、无脏数据）：
  - `QC_FIRST_INSP` 首件 / `QC_PROC_INSP` 制程 / `QC_OQC_REPORT` 出厂检验报告：**两级审批**
    提交审批 → 一级审批通过（待二级）→ 超级管理员批准（已审核）→ **弃审** → 草稿；
  - `QC_ASM_INSP` 组装成品 / `QC_INSP` 来料检验：**单节点审批** 提交审批 → 审批通过（已审核）→ **弃审** → 草稿
    （审核自动生成的 FINISH_IN / PURCHASE_IN 草稿由弃审联动作废，已清）；
  - 每步断言 `yj_doc_status`（pending/approve_node/shr）+ `yj_form_approval` 留痕（SUBMIT→APPROVE_L1@1→APPROVE@2 或 APPROVE@1→UNAUDIT）。
  - **未发现断链，无需改生产代码**；UI 入口均在（两级单=侧栏审批组；数据页布局的组装成品/来料=顶部「审批 ▼」）。
- 看板侧:因只认已审核单据，检验单**审核完成后才显示合格/不合格**、**弃审后自动退回待审核/待检验**（接口实测）。

### 8.5 验证（证据：`screenshots/qc-*`、`api-logs/api-board-inspection.txt`、`logs/qc-fixture-*.sql`）
- 正式库(HSDZ_MES)未完工看板：15 行，`待品质检验 4 行`；`GD-2026-11-0008` 成型环下「待审核」橙标(2 张草稿单)、
  行内「待品质检验: 成型」、行级「检验中」；已完工 384 行**全部「合格」**（绿色 tag + ✓ 合格环标）。
- 测试库造数验证红色路径（无真实不合格样本）：`round-04-green.png`（合格绿：生产状态 tag/质检 tag/#67c23a、环标 ✓ 合格）、
  `round-05-red.png`（不合格红：tag/#f56c6c、环标 ✗ 不合格）；造数脚本与**恢复脚本**同在 `logs/`，已恢复原状。
- 5173 与 8090(打包版, chunk `WorkOrderProgressBoard-CyMhe0Qi.js`) 均实测；1392/1920 宽度无横向溢出（960 窄屏的 9px 横向滚动来自系统顶栏，不是本页）。
- 前端 build ✅；后端 `mvn clean package` ✅（jar 含 `WorkOrderInspectionService`）；static 已重新镜像同步、8090 已重启。

### 8.6 事故与恢复披露（共享浏览器登录态串库，2026-11-09 00:08）
- **事故**：ego 浏览器与多个 agent 共用同一 `localhost:5173` origin 的 `localStorage` 登录态。
  00:07:59 Lead 的标签页重新登录「YINJIA-MES（正式库 YJ）」覆盖了 `mes_token`，另一验证代理 00:08:21
  在界面点「弃审」时落到**正式库**，误将 HSDZ_MES 的 `QC_PROC_INSP / ZC-2026-10-0126`
  （原状态=已审核，审核人=柴善银）弃审为草稿，并写了一条 `UNAUDIT` 留痕；无其它表写入。
- **恢复**：验证代理用 2026-11-06 21:22 正式库备份还原临时库，精确回填该单单行
  （`yj_doc_status.shr/shsj/archived/update_at` + 头表 `asp_user2/asp_time2`）并删除误写留痕；
  恢复库 vs 正式库 `ROW_DIFFS=[]`、审批留痕一致、`docStatusOf` 口径回到「已审核」。
- **Lead 独立复核**（`logs/incident-verify-production-20261109.sql`）：
  `shr=柴善银 / shsj=2026-10-15 08:30:00 / pending=N / saved=Y`；头表`检验员=柴善银、总结论=合格`；
  该单审批留痕无 UNAUDIT；**正式库 23:00 之后审批留痕数 = 0**。未发现其它残留写入。
- **教训（后续必须照做）**：共享 ego profile 下，任何标签页重新登录都会改整个浏览器 profile 的账套；
  界面操作前必须显式把 token 切到目标账套并校验 `claims.factory`，两个 agent 不要交叉使用同一浏览器窗口。
  取证脚本与披露见 `tools/archive/_wo-insp-audit-20261108/_incident-recover.mjs`。

### 8.7 审核流程验证证据清单与观察项（be-insp，2026-11-09）
- 完整验证报告：`tools/archive/_wo-insp-audit-20261108/README.md`（结论表 / 每步断言口径 / 复跑命令 / 事故披露 / 踩坑）。
- API 证据：`tools/archive/_wo-insp-audit-20261108/evidence/run-20261109-000016/`（summary.json + 5 面板逐步 JSON + run.log；**PASS 173 / FAIL 0**）。
- UI 证据：同目录 `evidence/ui/shots/round-17-*.png`（ego 浏览器；QC_PROC_INSP 真实点完 提交审批→审批通过→批准通过→弃审，FLOW_RESULT=PASS，状态胶囊 草稿→审批中→待二级审批→已审核→草稿）。
- 清场：**RESULT=PASS**；测试库 5 单回草稿、审批留痕 0、下游测试单 0；正式库检验类审批留痕 0 行。
- 观察项（未改，属既有实现）：
  1) 单节点面板审批通过后 `yj_doc_status.approve_node` 残留 1（弃审不清）；状态推导只看 pending/shr，显示与流转无影响。
  2) QC_INSP 历史「已归档」老单按现行口径弃审需先「申请修改→审批(修改中)」，属既有设计（本次新流程审核后=已审核，弃审正常）。

---

## 九、审批层级调整：首件/制程检验单改为「一级审批」（2026-11-09）

用户口径：
> 「首件 QC_FIRST_INSP、制程 QC_PROC_INSP：两级审批 提交审批 → 一级审批通过（待二级）→ 超级管理员批准（已审核）→ 弃审 → 草稿；这两个只需要实现一级审批和当前的来料检验一样的审批形式即可。」

### 9.1 改动
- **后端**（`ButtonService` / `QueryService`）：
  - 首件/制程从 `QC_DOC_PREPARER` 移除 ⇒ 自动退出 `ADMIN_L2_PANELS` / `TWO_LEVEL_PANELS`，
    审批链路变为与来料检验单 `QC_INSP` 同形的单节点：**提交审批 → 审批通过（一次）→ 已审核 → 弃审 → 草稿**。
  - 新增 `SINGLE_LEVEL_INSP_PANELS = {QC_FIRST_INSP, QC_PROC_INSP}` + `SINGLE_LEVEL_PREPARER`（检验员=编制，可手填、空值兜底提交人）。
  - 单节点审批通过时写入纸面「审核人/审核时间」真值列（审批人）；驳回/弃审清空这两格（「批准」不再写，历史两级单的审批人值原样保留）。
  - `QueryService.isTwoLevelSignPanel` 纳入这两张单（表内「审核人」不再被 yj_doc_status 账号名覆盖）。
- **前端**（`PanelxList.vue`）：`L2_DOC_PANELS` 移除两张单（9 张），侧栏审批组仍显示，但只有「提交审批 / 审批通过 / 审批驳回 / 弃审」，不再出现「一级/批准通过」节点。
- **数据兼容**：两账套实测**无处于「审批中/待二级审批」的存量单**，切换无在途风险；历史已审核单原样保留。

### 9.2 验证（证据 `screenshots/single-level-*`、`ego-scripts/single-level-*`）
- **API（测试账套）**：首件 SJ-2026-10-0153、制程 ZC-2026-10-0126 各走一遍
  `提交审批 → 审批中 → 审批通过（一次）→ 已审核（审核人=系统管理员、审批人空）→ 弃审 → 草稿（审核人清空）`，
  全程无「待二级审批」节点，测后恢复草稿。
- **UI（ego 浏览器，5173，YJ_TEST）**：
  - 草稿：侧栏只有「提交审批」（弃审置灰）；
  - 提交后（审批中）：出现「审批通过 / 审批驳回」，**没有**「一级审批/批准通过」；
  - 点一次「审批通过」→ 已审核（纸面审核人=系统管理员，批准为空）→ 弃审 → 草稿；
  - 制程面板同样（截图 `single-level-round-05-proc-draft.png`）。
- 前端 build ✅；后端 `mvn package` ✅；static 已同步、8090 已重启。
- 注：全量前端单测 1535/1540 通过，5 个失败均为 `recordSheetConfigs.livedb.test.js` 找不到本机 `SQLCMD.EXE` 的**环境依赖失败**（与本次改动无关）。
- **8090 打包版**：草稿态侧栏实拍只有「提交审批」（无「一级/批准通过/待二级」字样，`single-level-round-06-8090-first-insp.png`）；接口与 5173 同源。
- 补充（并行会话）：`2a601be9f feat: 制程检验单改名「出货检验单功能」…` 已在同一工作区提交，本任务的单级审批改动是在其之上（未提交）；两者互不改同一代码点。
