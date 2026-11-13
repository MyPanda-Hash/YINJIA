# 生产工序进度看板 · 工序可点 + 检验单跳转（2026-11-13）

## 一、用户口径（原话）

1. 「让现在的生产工单看板点击所点击的工序可以跳转到那个工序，如果这个工序没有进入排产提示啊该工单还未到达当前工序这种提示语，提示语要求简介明了。」
2. 「让当前的生产工单点击下方的待检验可以转到对应的检验单中。」

追问答复（决定了实现方向，**不要再猜**）：

- 工序点击的落点 = **「跳转到当前工单排产的对应工序页面」**（工单排产 `/prod/plan/workOrderBoard`）。
- 「未进入排产」分**两种情况**：① 工单没排产 → 提示「该工单未进行排产」；② 工序进度为 0 → 提示「该工序未到达」（文案"之类即可"，简洁明了）。

契约全文见 [`CONTRACT.md`](CONTRACT.md)（数据/路由/文案/文件归属/验收口径的唯一真源）。

## 二、交付内容

### 1. 后端（1 个文件，+64 行，只读）

[`WorkOrderProgressService.java`](../../../backend/src/main/java/com/yinjia/mes/service/WorkOrderProgressService.java)：
`行[].工序步骤[]` 每步新增 3 个展示字段（`ProcessTaskService.stepsSummary` 与 `WorkOrderInspectionService` **未动**，追溯页口径不变）：

| 字段 | 值 |
|---|---|
| `生产线` | 预排台账 `wo_process_line`：`实际生产线` 非空取它，否则 `计划生产线`；无台账 = `''` |
| `台账状态` | `计划` / `已落实` / `已完工`；无台账 = `''` |
| `已排产` | 该行该工序有未作废台账行 = `true` |

- 新增一条台账查询（与「当前工序」那条**刻意分开**，后者一行未动）；同一 (工单行id, 工序) 多条台账时取进度最靠后的一条（已完工 > 已落实 > 计划）。
- 行归属：`工单行id = 行.行id` 优先 → 工单级（`工单行id IS NULL`）兜底 → 都没有 = 无台账（不猜）。

### 2. 前端（4 个文件）

| 文件 | 改动 |
|---|---|
| [`WoProgressRing.vue`](../../../frontend/src/views/modules/plan/WoProgressRing.vue) | 整环 `@click.stop` → `emit('step-click')`；环下检验徽标 → `emit('insp-click')`；cursor + 轻量 hover + title 提示 |
| [`WoProgressChain.vue`](../../../frontend/src/views/modules/plan/WoProgressChain.vue) | 列表视图圆点 / 右上角检验小点分别发两个事件（内层 stop，不连带整行） |
| [`WorkOrderProgressBoard.vue`](../../../frontend/src/views/modules/plan/WorkOrderProgressBoard.vue) | 判定与跳转：未排产 → `该工单未进行排产`；进度 0（完工量 0 且无草稿报工）→ `该工序未到达`；否则跳工单排产。检验徽标/行级「待品质检验」提示条 → 按检验类型映射面板码（首件 `QC_FIRST_INSP` / 制程 `QC_PROC_INSP` / 出货检验表观 `QC_ASM_INSP`）跳 `/panelx/list/<码>?docNo=<单号>`（优先草稿/审批中的待处理单） |
| [`WorkOrderBoard.vue`](../../../frontend/src/views/modules/plan/WorkOrderBoard.vue) | 消费深链 `?line&wo&rowid&op`：按 line 选线 → 定位行（行id 优先，回退 工单号）→ 浅蓝底高亮 + `scrollIntoView` 居中 + 自动展开「工序流转明细」并把该工序标 `.is-focus` + 上下文「已定位：单号#行号 · 工序」；参数用完 `router.replace` 摘掉；keep-alive 靠 `watch(route.query)`/`onActivated` 重新定位 |

### 3. 多语言（10 个 locale，各 8 条）

`de/en/es/fr/ja/ko/ru/th/vi/zh-TW` 各 +8 条（zh-CN 是源语言且无 biz 段，不加）。断言脚本 [`_i18n-check.mjs`](_i18n-check.mjs)：10 locale × 8 key 各恰好 1 条 + 语言包可解析 = 90/90 PASS。

新增词条：`该工单未进行排产` / `该工序未到达` / `该工序暂无检验单` / `未在工单排产中找到该工单行` / `点击工序跳转到该工序排产` / `点击查看检验单` / `已定位` / 汇总条长提示。

## 三、验证证据（ego 浏览器，脚本与截图同目录 `ego/`）

环境：5173（vite 源码）+ 8090（`build-appjar.ps1` 重建的 jar：新后端 class + 新 static），登录 `admin` / 正式账套 `YJ`。

| 轮次 | 结论 |
|---|---|
| `round-01` | 看板 31 行。点 GD-2026-11-0021 的「成型 40%」环 → 跳 `#/prod/plan/workOrderBoard`，生产线=3号机，`已定位：GD-2026-11-0021#1 · 成型`，高亮行 1 行、`工序流转明细` 已展开且「成型」高亮，**地址栏 query 已摘空**。点 0% 工序 → toast `该工序未到达` 且不跳。点未排产行（GD-2026-11-0026）→ toast `该工单未进行排产` 且不跳 |
| `round-02` | 点「待审核」检验徽标 → `#/panelx/list/QC_FIRST_INSP`，页内可见 `SJ-2026-11-0006`（1 条数据，定位到该单）；行级「待品质检验: 成型」提示条 → 同一张单；列表视图圆点 → 工单排产（已定位/高亮/展开/工序高亮）；列表检验小点 → 首件检验单；**整行点击回归**：仍跳 `生产工单` 并自动打开追溯弹窗（GD-2026-11-0027） |
| `round-03` | 打包版 8090 重跑：工序环 → 工单排产（已定位/高亮/展开）；检验徽标 → `QC_FIRST_INSP` + 单据可见 |
| `contract-summary` | 接口 200：31 行 / 89 个工序步骤，`生产线` 有值 39、`台账状态` 有值 86、`已排产=true` 86；**26 步的 step.生产线 ≠ 行.生产线**（证明跳转用的是"该工序的线"而不是行的当前线） |

## 四、已知口径与取舍（用户如不认可，改起来都是小改）

1. **进度 0 就提示「该工序未到达」**是按用户口径实现的（含"当前工序但还没产出"的情况）。若希望这种情况允许跳转，只需放宽 `onStepClick` 第二个判定。
2. 判定「未排产」用 `行.生产状态==='未排产'` 或 `行.生产线` 为空 —— 数据里存在「有台账但计划线/实际线都空」的行（如 GD-2026-11-0026），按此口径提示「该工单未进行排产」，与该行生产状态一致。
3. 工单排产页「当前页签找不到该行 → 自动切到既有『全部』页签再找一次」（看板在「已完工」筛选下点工序时不假报"找不到"）；其余情况找不到才 warning。
4. 检验类型不在三张面板映射内（或单据无单号）→ 提示「该工序暂无检验单」，不猜面板。

## 五、回滚

- 代码：`git revert` 两个提交（feat + chore 静态产物）。
- 无数据库变更、无迁移脚本、无面板/字段/菜单改动 ⇒ 回滚不涉及库。
- 8090 回滚：用上一版 `app.jar` 覆盖后 `tools/scripts/start-prod.ps1` 重启。
