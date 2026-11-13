# 2026-11-13 第五轮：物料模糊搜索排序 + 排产剩余自动切单

> 用户两条口径（附截图）：
> 1. 「这个需要进行修改，模糊搜索要做一个范围筛选，符合输入的数字的在前面。」
>    （新增生产工单页「产品编码」输入 `123`：候选乱序，规格型号含 123 的 Y-S-T 排最前，编码/名称含 123 的 SP00013「测试123」被压到后面）
> 2. 「GD-2026-11-0021 查询一下这个工单我发现当前在排产处修改这个排产数量会出现，当前我排产数量未能达到需求数量的话会导致这个工单的剩余数量无法被排产，需要实现当目前排产数量小于这个需求数量时自动将剩余数量切单。」
>    （工序路线排线弹窗：排产数量可改小，但剩余需求没有载体、排不进去）

## 一、物料模糊搜索：范围筛选 + 命中优先级

**根因**：`/px/invOptions` 直接调 `queryFormDataList("INV", keyword, …)`；INV 是档案面板，keyword 走「本面板**全部 113 列** LIKE %kw%」的 OR，排序只有 `ORDER BY t.id DESC` —— 备注/规格型号/图片链接等任意列含 123 都算命中，顺序与"编码/名称命中"无关，候选还会被几十行噪声占满。

**实现**（[InvOptionRank.java](backend/src/main/java/com/yinjia/mes/service/InvOptionRank.java)，纯函数 service；[PxController.invOptions](backend/src/main/java/com/yinjia/mes/controller/PxController.java) 只转发）：
- **范围筛选**：只保留「存货编码 / 存货名称 / 规格型号 / 助记码 / 条形码」任一列包含 keyword 的行（其他列命中的噪声行丢弃）；
- **命中优先级**（小分在前）：`编码==` → `编码前缀` → `编码包含` → `名称前缀` → `名称包含` → `规格型号包含` → `助记码前缀` → `助记码包含` → `条形码包含`；
  同分按 编码长度升序 → 编码字典序（稳定可复跑）；
- 排序后截断 200 行（`totalSize` = 实际返回行数）；**空 keyword 原样返回**（配方计算器「该类别全部」行为不变）。
- 响应形状不变（`detail` 的 key 照抄面板 detail_key），三处消费方（生产工单新增页主/子物料、配方计算器、X烧结计算器）无需改动。

**验收**
- 纯函数单测 [InvOptionRankTest.java](tools/verify/InvOptionRankTest.java) **40/40 PASS**（含用户截图场景：名称含 123 的 SP00013 排在规格 123334 的 Y-S-T 之前）。
- 8091 接口实测 `keyword=123`：候选 **54→14 行**，前 6 行是编码含 123 的（T123/C-123/T123-1/…），SP00013 第 7、Y-S-T 第 8；五列都不命中的行 0。
- ego 界面实测（8091）：新增生产工单页产品编码输入 123，下拉候选顺序与接口一致（`ego/r02-inv-rank.png`）。

## 二、排产数量 < 需求数量 ⇒ 剩余数量自动切单

**根因**：`plang` 一行只有 `xq_sl 需求` / `pl_sl 排产`；排线弹窗允许把排产数量改小（部分排产），但剩余需求没有载体 —— 该行已有产线、不再进「待排产池」，剩余量永远排不进去。

**实现**：
- 新增编排层 [SchedulePreplanService.java](backend/src/main/java/com/yinjia/mes/service/SchedulePreplanService.java)：`/px/scheduleBoard/preplan` 改为先按「剩余 = 需求 − 本次排产」调 **`WorkOrderSplitService.splitRemainderForSchedule`** 切出子工单，再调 `ProcessTaskService.preplanManual` 排产；**两步同一事务**（切单失败整次排产回滚）。
- `splitRemainderForSchedule`（[WorkOrderSplitService.java](backend/src/main/java/com/yinjia/mes/service/WorkOrderSplitService.java)）：
  - 子单 = 父工单号 + `-序号`，`源工单号/源工单行id/拆分序号/根工单号/是否切单=Y` 与常规切单同构；
  - 子单 `xq_sl = pl_sl = 剩余数量`、**`scx` 为空（待排产）**、交期/路线/订单追溯（`od_no/od_xc`）继承父行 ⇒ 进「待排产池」可单独排产；
  - 父行 `xq_sl` 核减为本次排产量（需求守恒：父 + 子 = 原需求），`yl` 按 需求−排产 重算；
  - 订单结转来源的 `form_flow_link` **按行拆账**（父 60 + 子 40，SUM 不变；订单结转剩余可转量不变）；
  - 子单按路线建工序台账（计划数量 = 剩余 × 该道换算率；首道已落实、其余计划，与订单结转待排产行同构）。
- 前端 [ProcessRoutePlanDialog.vue](frontend/src/views/modules/plan/ProcessRoutePlanDialog.vue)：弹窗说明补一句「排产数量小于需求数量时，剩余数量会自动切出子工单（子工单进待排产池，可单独排产）」；提交成功后若后端返回 `自动切出子工单`，**追加一条 warning 提示**（子单号 + 剩余数量 + 待排产），避免排产员以为剩余量丢了。
- 排产数量 = 需求数量时**不触发**切单（全排）。

**验收**
- 接口探针 [auto-split-verify.mjs](tools/archive/_wo-split-20261113/probe/auto-split-verify.mjs) **9/9 PASS**（测试账套夹具）：
  需求 100 → 排产 60 ⇒ 自动切出 `GD-VERIFY-SPLIT-01-1` 剩余 40；父行 需求=排产=60+成型1线，子行 需求=排产=40+生产线空+源工单=父单；子单出现在待排产池；全排（50=需求）不切单。
- DB 复核：`form_flow_link` 父 60 / 子 40（合计 100，ACTIVE）；父行台账 成型 180=60×3、子单 成型 120=40×3；父/子需求 60+40=100。
- ego 界面实测（8091）：快速排产 → 工序路线排线，弹窗提示存在；排产数量 60 提交后 toast：
  `已排产「成型1线」 排产数量 60；预排3道…` + `排产数量 60 小于需求数量 100:剩余 40 已自动切出子工单 GD-VERIFY-SPLIT-03-1(待排产,可在待排产池单独排产)`；
  随后待排产池出现子单（40/40、无生产线），生产工单列表父子两行 需求 60/40、父已排产、子未排产（`ego/r01~r03`）。
- 测试账套夹具与造数已全部清理（工单/占用/台账/切单日志 = 0）。

## 三、涉及文件

| 层 | 文件 |
|---|---|
| 后端 | `service/InvOptionRank.java`（新）、`controller/PxController.java`（/invOptions）、`service/SchedulePreplanService.java`（新）、`controller/ScheduleBoardController.java`（/preplan）、`service/WorkOrderSplitService.java`（splitRemainderForSchedule） |
| 前端 | `views/modules/plan/ProcessRoutePlanDialog.vue`、`i18n/locales/en.js`（6 个新键） |
| 测试/证据 | `tools/verify/InvOptionRankTest.java`（40 断言）、`tools/archive/_wo-split-20261113/probe/auto-split-verify.mjs`、`ego/round-01~03.mjs` |

## 四、上线注意
- 本轮**零 DDL / 零迁移**，只换 jar + 前端静态产物；前后端建议同批（前端提示依赖后端新字段，旧后端只是不显示自动切单提示，不影响功能）。
- 自动切单发生在「排产」动作里（`assign` 词），不需要新权限。
- 切出的子工单沿用常规切单的命名（父单号-序号），**不占用 GD 号池**；如需打印/排产按普通待排产工单处理。
- 恢复/清理：验收夹具均在测试账套，清理脚本口径为 `pl_no LIKE 'GD-VERIFY-SPLIT-%'`。

## 五、8090（用户环境 5173）复核
- 8090 已用最新 jar 重打包重启（`tools/scripts/rebuild-prod.ps1 -SkipFrontend`，fat jar 129 条 BOOT-INF/lib）。
- 5173 实机（ego round-04，**只读不写正式库**）：
  - 新增生产工单页产品编码输入 `123`：候选 14 行，顺序 `T123 → C-123 → T123-1 → T123-2 → T123**TB → C-123**TB → SP00013 → Y-S-T → …`
    （编码命中在前，名称命中 SP00013 在规格命中 Y-S-T 之前；与 8091/接口口径一致）。
  - 快速排产 → 工序路线排线弹窗：说明区已出现「排产数量小于需求数量时，剩余数量会自动切出子工单（子工单进待排产池，可单独排产）」；
    读数为「排产数量 100 / 需求数量 100」。全程零 pageerror；随后取消，不产生正式库业务数据。
- 8091（测试账套）保留运行，可复验自动切单完整链路：http://127.0.0.1:8091/#/prod/plan/scheduleBoard 。
