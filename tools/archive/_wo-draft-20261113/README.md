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

## 部署注意
- **必须先在目标库执行 `migrate-wo-draft-20261113.sql` 再换 jar**（新代码会查 `wo_draft_head/_line`）。
- 8090 现役 jar 未由本任务重建（宿主/并行会话在跑）；5173 源码即时生效；8091 = 本任务新 jar（测试账套）可预览。
- 前端静态产物已同步进 `backend/src/main/resources/static`（另起 chore 提交）；服务器部署走 `deploy-production.bat`（先 CHECK 再 GO），本任务未做服务器部署。

## 已知边界（未做，需要可再加）
- 草稿**不走审批流**：草稿=编制态，提交即生成正式工单；若以后要"工单编制审批"，只需把 `draft/submit` 改为"提交审批、审核通过再生成"（页面与草稿箱不用改）。
- 草稿箱**无关键字搜索框**（后端 `draft/list` 已支持 keyword，前端未放输入框）；草稿可见范围=有 `create` 权限的人都能看到（含创建人列），未做"仅本人"。
- 草稿箱未做分页（草稿量小；后端已按更新时间倒序）。
- 关闭浏览器页签时的未保存提醒走 `onBeforeRouteLeave`（站内路由），未接 `stores/unsaved` 的关页签提示。
