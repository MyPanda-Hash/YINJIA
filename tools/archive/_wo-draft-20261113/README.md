# 生产工单「保存草稿 + 整页编制 + 草稿箱」（方案 A，2026-11-13 第二轮）

> 用户口径：「新建的生产工单如何实现保存草稿的情况呢？是否当前不能使用弹窗形式而是使用页面形式会更好呢？」→ 拍板 **A 实现**。

## 结论（做到了什么）

| # | 需求 | 实现 | 验收 |
|---|---|---|---|
| 1 | 新建改**整页编制**（替代弹窗） | 路由 `/prod/plan/workOrderCreate` → `WorkOrderCreatePage.vue`（原 `WorkOrderCreateDialog.vue` 整份迁移后删除）；顶部返回/草稿号/更新时间，底部固定操作条：保存草稿 / 提交生成工单 / 返回列表 | 界面实点：标题/两页签/12 字段/底部三按钮全对（`ego/r01-create-page.png`）；51/51 前端单测 |
| 2 | **保存草稿** | 草稿独立存 `wo_draft_head`/`wo_draft_line`（**不写 plang**）；草稿号 `GDD-yyyy-MM-nnnn`，正式 GD 号只在提交时取；保存后地址栏带 `?draftId=`，刷新/继续编辑不丢上下文 | 实点「保存草稿」→ toast「草稿已保存 GDD-2026-11-0009」+ 头部显示草稿号/更新时间（`r02-draft-saved.png`）；接口探针 20/20 |
| 3 | **草稿箱** | 生产工单页工具栏「草稿箱」+ 数量角标；弹窗列表（草稿号/类型/产品/数量/客户/创建人/更新时间/操作）：**继续编辑 / 提交生成工单 / 删除** | 实点：草稿箱 1 行、角标=1、继续编辑回填、提交后角标清零（`r03-draftbox.png`、`r05-draftbox-temp.png`、`r06-*`） |
| 4 | 提交才生成正式工单 | `draft/submit` 读草稿 → 组装成与「新增」**完全相同**的 body → 复用 `WorkOrderCreateService.create`（同一份全量校验）→ 成功才把草稿置「已提交」+ 回填正式工单号 | 常规/临时各提交一张：列表出现正式工单（工单类型=常规/临时），临时单「物料清单」来源=临时工单 7 行（`r04-submitted.png`、`r06-temp-bom.png`） |

### 为什么草稿不写 `plang`（关键设计，也是本次方案的核心）
`plang` 是外部单据表，任何一行都会**立刻**进入现役口径：
- 快速排产「待排产池」= `plang` 里 生产线为空 + 未结案 + 未完工 的行（`ScheduleBoardService.pending`）；
- 生产工单列表、排产/领料/报工的「扫工单号」解析（`resolveWoLine`）都直接查 `plang`。

⇒ 草稿若写 `plang`，就会出现在待排产池、能被排产/领料/报工 = **假草稿**。要直接写 `plang`
就得加"工单状态"列并改上面所有查询（改动面大，且 `plang` 另有外部程序直写），故草稿独立存表，
**提交时**才落正式工单 —— 与「新增」共用 `WorkOrderCreateService.create`，不另写一套规则。

### 弹窗 vs 页面（为什么选整页）
| 维度 | 弹窗（上轮） | 整页（本轮） |
|---|---|---|
| 关掉不丢 | ❌ | ✅ 保存草稿 + 地址栏 `?draftId=` 可恢复 |
| 草稿身份/续编 | ❌ 无草稿号、无草稿箱 | ✅ GDD 草稿号 + 草稿箱列表 + 继续编辑 |
| 临时 BOM / 后续附件·多行 | 拥挤 | 有空间 |
| 刷新/返回/书签 | ❌ | ✅ 路由页 |
| 离开守卫 | 弱 | ✅ 未保存修改确认 |

## 改了什么（文件清单）

### 数据库（两账套已执行，幂等）
- 新表 2 张（`tools/migrate-wo-draft-20261113.sql`）：
  - `wo_draft_head` 23 列：草稿号/状态(草稿·已提交)/工单类型/产品·客户·数量·日期·路线·备注/正式工单号 + 审计五件套；
  - `wo_draft_line` 15 列：单头id/行序/子件编码·名称·规格/计量单位/标准用量/损耗量/行备注 + 审计五件套；
  - PK + `UX_wo_draft_head_no(草稿号) WHERE asp_cancel='N'` + `IX_wo_draft_head_state_time` + `IX_wo_draft_line_head`；
    表级 + 22/14 列 `MS_Description` 中文注明（自检 22/14）。
- 两账套 `DbSync run` 均 `[OK] 9 batches`（复跑幂等）；
  台账：`tools/db-inuse-tables.txt` 登记 2 表；`tools/db-migrations.txt` 登记脚本；`数据库表清单.md` §六 28→30 张 + v3.91 维护记录。

### 后端
- 新增 `WorkOrderDraftService`：save（草稿宽松校验=只强制主物料；覆盖保存时旧行软删）/ list（草稿箱，含物料项数）/ get（续编回填）/ delete（软删）/ submit（复用建单全量校验，成功回填正式工单号）/ count（角标）。
- `WorkOrderListController` 新增 6 个端点：`/workOrderList/draft/{save,list,get,delete,submit,count}`；权限沿用页面动作词 `create`（不新增权限词）。
- `WorkOrderCreateService.options()` 过滤客户编码/名称为空的脏行（测试账套有「全量流验证」空编码客户，下拉会出现无值项）。
- 草稿时间用 **JVM 本地时间** 落库（`localNow()`）而不是 `SYSDATETIME()`：本机 SQL Server 在 Docker 里 TZ=UTC，SYSDATETIME 会比北京时间慢 8 小时，草稿箱「更新时间」会与页面头部差 8 小时（先例：完工明细「完工时间」同样用 `LocalDateTime.now()`）。

### 前端
- 新增 `views/modules/plan/WorkOrderCreatePage.vue`（整页编制：表单/两页签/临时用料表/远程选料/默认路线/校验 + 保存草稿 + 提交 + 离开守卫 + keep-alive 下 `?draftId` 变化重载）；
- 删除 `WorkOrderCreateDialog.vue`（内容已迁移；`WorkOrderList` 同步改为跳转路由）；
- 新增 `views/modules/plan/WorkOrderDraftBoxDialog.vue`（草稿箱：列表/继续编辑/删除/提交/空态/角标来源）；
- `WorkOrderList.vue`：「新增」→ `router.push('/prod/plan/workOrderCreate')`；新增「草稿箱」按钮（角标=草稿数）；提交/编辑后刷新列表与角标；
- `business/workOrderCreate.js`：新增 `draftToState` / `buildDraftPayload` / `formSnapshot`（离开守卫脏检查），单测 21/21；
- `router/index.js`：1 条路由；`en.js`：本任务 15 个新键（Draft Box / Draft No. / Save Draft / Submit & Create / Back to list…）。

## 验收（可复跑）

### 1. 纯逻辑单测
```bash
cd frontend
node --test --experimental-test-isolation=none src/business/workOrderCreate.test.js \
  src/business/print-formats.test.js src/views/modules/plan/workOrderRecipe.test.js
# 期望 tests 51 / pass 51 / fail 0
```

### 2. 接口探针（8091 新 jar，指向测试账套 HSDZ_MES_TEST）
```bash
node tools/archive/_wo-draft-20261113/probe/api-verify.mjs http://127.0.0.1:8091
# 期望 20/20 PASS：新建草稿/草稿箱列表/详情/覆盖保存/角标/提交(常规+临时)/提交后草稿关闭/
#   正式工单进入列表(类型=常规·临时)/临时单 BOM 来源=临时工单/删除/校验拦截(缺主物料、缺路线)
```

### 3. 界面（ego-browser，脚本 `ego/round-01..08.mjs` + 截图）
- 生产工单页：`新增` + `草稿箱`(带角标) 两个入口；
- 整页编制：标题/两页签/12 字段/底部三按钮/默认工艺路线 GY-CB-STD；
- 保存草稿：toast + 草稿号 + URL `?draftId=`；返回列表 → 草稿箱 1 行 + 角标 1；
- 继续编辑：回填产品/数量/草稿号；提交 → 跳回列表并定位新单（工单类型=常规）；
- 临时工单草稿：「从标准BOM带出」7 行 → 保存草稿（更新时间=本地 14:49）→ 草稿箱 1 行（类型=临时）→ 继续编辑 → 提交 → 列表 `工单类型=临时`、`临时物料项数=7`、物料清单弹窗来源=临时工单；
- 英文走查（`mes_locale=en` 后刷新）：`New / Draft Box / Work Order Type`、新增页 `New Production Work Order` + `Standard Work Order / Temporary Work Order`、草稿箱 `Draft Box` + 9 列英文 + `No drafts`（截图 `r08-en-*.png`）；
- 全程零 pageerror。

### 4. 体检（两账套，均为**存量**问题，本次 0 新增）
- 正式库 `RESULT: FAIL-3`（02 存量表注释 / 09 en 存量 / 12 迁移链存量）；
- 测试库 `RESULT: FAIL-7`（测试库快照陈旧存量债）；
- 本次新表 `wo_draft_head/_line` 的 01/02/03/04 全 PASS（表命名/表注释/列注释/主键与审计四件套）。

### 5. 测试数据已清理
验收造的草稿/工单已用 `.tmp/_q/cleanup-wo-draft.sql` 清空并复核：剩余手工工单=0 / 剩余草稿=0 / 剩余草稿行=0 / 剩余临时用料=0 / 剩余台账=0（测试账套）。

## 第二轮（2026-11-13 下午，用户两条新需求 + 一个报障）

> 用户口径：
> ①「工单存在两个数量一个为订单数量和生产数量，当前手工新增工单没有销售订单不应该存在这个订单数量吧……这个工单可以新增不用管这个。」
> ②「当前工单应该可以删除，从订单结转处转来的工单删除应该回到订单结转中，而已经排产的不能删除。其他存在报工的自然也不能删除了。」
> 报障截图：5173 新增页点「提交生成工单」只弹「新增工单失败」（看不到原因）。

### 变更 1：手工新增去掉「订单数量」（只保留「生产数量」）
- 前端页（`WorkOrderCreatePage.vue`）删除「订单数量」表单项与「订单数量→生产数量」自动同步；生产数量成为唯一必填数量。
- 纯逻辑（`workOrderCreate.js`）：`blankForm` 不再有 订单数量；`validateWorkOrder` 只校验生产数量>0；`buildCreatePayload`/`buildDraftPayload` **不再发送 订单数量**；`draftToState` 只取生产数量（旧草稿残留的 订单数量 忽略）。
- 后端（`WorkOrderCreateService`）：生产数量唯一必填；订单数量可空，缺省按生产数量兜底（`plang.xq_sl = pl_sl`，保证列表/排单计划的「需求数量」不为 0；转换来的工单仍写真实订单数量）。
- 草稿箱列「订单数量」→「生产数量」。

### 变更 2：工单删除（`POST /px/workOrderList/delete`，新动作词 `del`）
- 新增 `WorkOrderDeleteService`：软删 `plang` + 同工单行的 `wo_process_line`/`wo_bom`/`wo_day_plan`；
  **订单结转来源**（`od_no` 非空）额外按行释放 `form_flow_link`（新增 `VoucherFlowService.releaseLine`，按 工单号#行号 精确释放，
  不会误放同工单其它行）⇒ 订单行回到「订单结转」、剩余可转量回涨、可重新转单。
- **拒绝条件（后端逐条点名，前端原样弹出）**：已结案 / 已排产（`scx` 非空或 `plang_pc` 存在）/ 已有报工（`scjl` 行锚，含批次兜底）/
  已入库（`rk_sl>0`）/ 已生成领料单（`ll_no2` 非空）/ 切单子单（`源工单号` 非空，请用撤回切单）/ 已有下游单据（`form_flow_link` 源=PLANG 且 ACTIVE）。
- 权限：`PagePanelRegistry.WORK_ORDER_LIST_ACTIONS` 增 `{del,删除}` + `PanelPermissionService` 覆盖映射；
  迁移 `migrate-wo-list-del-perm-20261113.sql` 给**已有 create** 的角色补 `del`（只给能建单的岗位，不给只读角色）。
- 前端生产工单页工具栏「删除工单」（`canDo('del')`，单行、二次确认）。

### 报障「新增工单失败看不到原因」
- 前端 catch 改为 `后端 message → e.message → 兜底文案`，并 `console.warn` 打状态码与响应体；
  实测打开不存在的 `?draftId=` 会原样显示后端「该草稿不存在或已删除」。
- 同时把 8090 现役实例重打包为**最新 jar**（含草稿/删除/无订单数量），5173 点击即为最新链路。

### 验证（第二轮）
- 接口探针 `probe/delete-verify.mjs` **11/11 PASS**：手工单（只传生产数量）新建→需求=生产=33→删除；
  重复删除被拒；订单结转来源工单（测试账套 id=84，GD-2026-10-0016#3）删除 → 订单行 `ZXL-20261016-03#8765` 回到订单结转且剩余=211；
  已排产/有报工工单被拒（409 点名「已排产」）；权限矩阵 `del` 已下发并授权。
- 前端单测 21/21（workOrderCreate）；ego round-09~11：新增页 11 个标签**无订单数量**、生产数量必填、
  新建 GD-2026-11-0026（需求=排产=7）→「删除工单」确认框文案正确 → 删除后列表清空；已排产单删除时**原样弹出后端原因**。
- 体检两账套结果与上一轮一致（存量 FAIL 不变，本次零新增）。
- 测试账套已恢复：探针删除的 id=84 及其占用链/台账已还原；本轮造的手工单已物理清理。

### 部署/上线注意（第二轮补充）
- 本轮新增迁移 `migrate-wo-list-del-perm-20261113.sql`（仅授权，零 DDL），需与 jar 同批上线。
- **前端与后端必须同批上线**：前端不再发送「订单数量」，旧后端会报「订单数量必须大于 0」。

## 部署注意
- **必须先在目标库执行 `migrate-wo-draft-20261113.sql` 再换 jar**（新代码会查 `wo_draft_head/_line`）。
- 8090 现役 jar 未由本任务重建（宿主/并行会话在跑）；5173 源码即时生效；8091 = 本任务新 jar（测试账套）可预览。
- 前端静态产物已同步进 `backend/src/main/resources/static`（另起 chore 提交）；服务器部署走 `deploy-production.bat`（先 CHECK 再 GO），本任务未做服务器部署。

## 已知边界（未做，需要可再加）
- 草稿**不走审批流**：草稿=编制态，提交即生成正式工单；若以后要"工单编制审批"，只需把 `draft/submit` 改为"提交审批、审核通过再生成"（页面与草稿箱不用改）。
- 草稿箱**无关键字搜索框**（后端 `draft/list` 已支持 keyword，前端未放输入框）；草稿可见范围=有 `create` 权限的人都能看到（含创建人列），未做"仅本人"。
- 草稿箱未做分页（草稿量小；后端已按更新时间倒序）。
- 关闭浏览器页签时的未保存提醒走 `onBeforeRouteLeave`（站内路由），未接 `stores/unsaved` 的关页签提示。
