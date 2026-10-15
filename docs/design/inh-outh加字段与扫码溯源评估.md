# inh / outh 加字段 与「扫码溯源」评估留档

> **日期**：2026-10-15
> **状态**：⏸ **用户决定「先不管了」—— 本评估结论留档备查，未实施任何改动**
> **依据**：两份独立只读评估（`inh`/`outh` 加字段影响评估、`scjl`+完工明细串联评估）+ 库/代码实测
> **术语**：与 `CONTEXT.md` 对齐

## 0. 起因（用户原始需求）

> 「微信小程序要使用，`inh` `outh` 这两个表，需增加 订单号、订单ID、采购单号、采购ID、工单号、工单ID、委外单号、委外ID、`asp_time3`（**用户原话如此，实为审核人**）、审核时间、审核标记，**这些加上影响原本的系统运行吗**？」
> 「完工明细，要做处理，后台用 `scjl` 这个表，微信小程序的工序报工是写进去 `scjl` 的」
> 用途确认：**「扫码溯源」**

## 1. 结论：只加列不影响现有运行 ✅

| 判据 | 实测结果 |
|---|---|
| 面板绑定 | `inh`/`outh` 在 `yj_panel` / `yj_field` **命中 0 行** —— 没有任何面板直挂 |
| 读侧 | **全仓无 `SELECT * FROM inh/outh`**；4 个库存视图（`v_stock_movement`/`ledger`/`summary`/`balance`）**全是显式列名**；`v_stock_movement` 还带 **23 列名+顺序硬契约自检** |
| 写侧 | 唯一写方 `StockFlowService.insert` 的 INSERT 由**硬编码列清单 `flowCols()`** 生成，不是 `INSERT ... SELECT *` |
| 其它读方 | `InvCostService:185`、`DashboardStatsService:287`、`FormNoService:58` 均写死列名；**金蝶推送只碰 `bl_*` 单表，不碰 `inh`/`outh`** |
| 存量数据 | 正式库 `inh` **31 行（全是 `src=0` 期初结存**，`rid IS NULL`、单据号 `INIT-20261003`、`asp_user1='migration'`）、`outh` **0 行** ⇒ **存量无需回填，也无填充率可验** |

**⚠️ 唯一硬约束**：两表有过滤唯一索引 `UX_(src,rid)` ⇒ **`ALTER TABLE` 必须在 `SET QUOTED_IDENTIFIER ON` 会话下**（sqlcmd 加 `-I`），否则 **error 1934**（先例：`tools/migrate-stock-flow-tax-cols-2026-09-30.sql` 头部）。

**✅ 意外收获**：弃审/重审走 `revive()`（`StockLedgerService:129-140`）会**整体刷全列** ⇒ **将来新增的列自动跟随**，不需另写回填。

## 2. 现状事实（两账套结构与行数一致）

- **列数**：`inh` **47** / `outh` **48**（`outh` 多 `单据金额`/`成本单价`/`成本金额`）
- **审计列**：`asp_user1/asp_time1`（过账人/时间）、`asp_user2/asp_time2`（最后修改）、`asp_cancel`（`'Y'`=弃审软删）、`asp_user4/asp_time4`（弃审人/时间）
  ⇒ **3 号位恰好空着**，正好补"审核"
- **索引**：`PK_id` + `UX_(src,rid)` 唯一 + `IX_` 三键 + `IX_单据编号` —— 加列不触碰
- 表级+列级中文注释齐全；`备用1..20` 全 NULL、未绑定
- ⚠️ **`VIEW_inh`/`VIEW_outh` 早已失效**（实测报 `对象名 'dbo.dm_wz' 无效`）—— 属 2026-09-30 重建后的**既有遗留**（表清单 §九 记 36 个纺织视图待清理），**与本次无关**
- ⚠️ 台账陈旧：`tools/db-inuse-tables.txt:219,224` 中文名仍是「进货单/出货单」，应为**入库流水/出库流水**

## 3. 命名建议（用户原话有一处说反了）

> 用户说「**`asp_time3` 是审核人**」—— **说反了**。本项目 `asp_userN` 存人、`asp_timeN` 存时间（`inh`/`outh` 实测 `asp_time1/2/4` 全是时间；`scjl` 的注释就是 `asp_user3=审核人`/`asp_time3=审核时间`）。

| 用户原话 | 建议列名 | 类型 | 中文注释 |
|---|---|---|---|
| 订单号 | `订单号` | nvarchar(60) NULL | 来源单据的销售订单号 |
| 订单ID | `订单ID` | int NULL | `bd_so_order.id`，由订单号反查 |
| 采购单号 | `采购单号` | nvarchar(60) NULL | `bd_purchase_in.采购订单号`，仅采购入库段有值 |
| 采购ID | `采购ID` | int NULL | `bd_pu_order.id`，由采购单号反查 |
| 工单号 | `工单号` | nvarchar(60) NULL | `bd_finish_in`/`bd_material_out.加工单号` |
| 工单ID | `工单ID` | int NULL | `plang.id`，**经 工单号+工单行号 反查** |
| 委外单号 / 委外ID | 同名 | nvarchar(60) / int NULL | ⚠️ **当前无来源**（见 §4） |
| **「`asp_time3` 是审核人」** | **`asp_user3`** | nvarchar(80) NULL | 审核人 |
| 审核时间 | **`asp_time3`** | datetime2 NULL | 审核时间 |
| 审核标记 | **建议不加** | — | 流水**只在审核时产生行** ⇒ 该列恒为"已审核"；而 `asp_cancel` 已表示作废，**加了会撞义** |

## 4. 逐字段数据来源（四张单据在正式库均 0 行 ⇒ 按表结构+代码路径判断）

| 字段 | 采购入库 | 产成品入库 | 材料出库 | 销售出库 |
|---|---|---|---|---|
| `订单号` | ✅ 能带（`bd_purchase_in.销售订单号`） | ⚠️ 头表有列但**自动生单不写**；可靠源是 `加工单号 → plang.od_no` | ⚠️ 同左 | ✅ 能带 |
| `采购单号` | ✅ 能带 | — | — | — |
| `工单号` | ❌ 头表无此列 | ✅ 能带（`加工单号`） | ✅ 能带 | ❌ 头表无此列 |
| 各 **ID** | ❌ 都要按单号反查主表 PK；且 `bd_pu_order` **当前 0 行** | ⚠️ **必须连「工单行号」一起带**（工单唯一键=工单号+行号） | ⚠️ 同左 | ❌ |
| **`委外单号`/`委外ID`** | ❌ **完全没有来源** —— 委外入库(src=4)/委外发料(src=8) 的面板与表**已于 2026-10-08 下架**（`migrate-drop-extra-docs-pu-req-20261008.sql`），`bd_outsource_order` **0 行** | | | |

**⚠️ 语义坑（重要）**：`plang.od_no` 实测是 **`IC-2026-08-0001`** 形态（25 行 100% 填充），而 MES 销售订单是 **`SO-2026-08-xxxx`**（`bd_so_order` 18 行）—— **两者不是同一编码体系**。现在能带出来的"订单号"是遗留 IC 编码。

## 5. `scjl`（工序报工）现状 —— 好消息

- 实测 **99 列**，正式 7 行 / 测试 10 行；`WO_REPORT`(doc) 与 `WO_REPORT_LIST`(flat) **都以 `scjl` 为 line_table**（录入载体与事实账合一）
- **数量列**：`sl`(数量)、`bf_qty`(报废)、`bl_qty`(不良)、`loss`(损耗)、`直销数量`、`pl_sl`(排产数量)
  ⇒ **没有"完工数量/合格数"专列**；**「完工」用 `wgzt='Y'` + `wgsj` 标记，数量由 `sl` 承载**（用户说的「完工明细」很可能指此）
- **⭐ 链路列已经很全**：`gldh`=工单号、`gd_id`=工单ID（**实为排产行 `plang_pc.id`，不是 `plang.id`**）、`工单行号`(= `plang.pl_xc`，10-15 加)、`od_no`=订单号、`od_xc`=订单表身ID、`cgrkdh`=采购入库单号、`lldh`=来料单号、`post_no`=入库单号、`jc_no`=产成品流水号
  ⇒ **缺**：采购订单号 / 采购ID / 委外单号 / 委外ID
- **写方共 4 类**：① 通用面板引擎 `insertRow/updateRow/softDeleteMissing`；② `WoReportService`（`stampRowNo:51`/`complete:305`/弃审 `:123`）；③ `ManuWritebackService:125` 回写 `post_no`；④ `ButtonService:2591` 直销入库回执
- **✅ 已查实：微信小程序代码尚不存在** —— grep `/api/mp`、`/api/wx`、`miniapp`、`MobileWarehouse`、`mobile` 全仓**仅命中一句注释 + 一份设计文档**（`docs/development/小程序对接-口令与账号.md`）

## 6. 「完工明细要做处理」的三种可能

| 解释 | 现状 | 要动什么 |
|---|---|---|
| **(a) 报工完工/合格数自动生成或过账产成品入库** | ✅ **已实现**。链：`woInspGenerate:2665`（报工审核 → 建检验单草稿 + 写 `form_flow_link` 占用链）→ `dualOutFinishIn:2504`（切炭直销 → 建 `FINISH_IN` 并**自动审核** `:2585/2587`）→ `asmInspToStock`（组装合格数 → `FINISH_IN` **草稿**，待人审核）→ 入库单审核 → `StockLedgerService.apply` → `postFlow` 写 `inh` | 要"更自动"**只改这两个钩子**，**零表结构变更**。（注意："弃审报工不自动冲回入库单"是现行口径） |
| **(b) `scjl` 加/改字段** | 可行但**大多已存在**（完工数量=`sl`、报废=`bf_qty`、不良=`bl_qty`、工单号/ID/订单号/工单行号都在） | 若确缺"合格数量"语义则新增一列；需同步 `yj_field` + `yj_translation`（多语言红线）。⚠️ **`scjl` 属冻结登记遗留表**（表清单 §5），新代码引用要留先例说明 |
| **(c) 小程序只读完工明细** | **最可行、零改表** | `WO_REPORT_LIST`(flat, `scjl`) 现成可出接口 |

## 7. 最小桥接方案（若将来要做）

**前提结论**：`scjl` 已有工单号(`gldh`)+工单ID(`gd_id`)+工单行号 ⇒ **不需要从 `scjl` 补列，也不需要为小程序报工改 `scjl`**。

1. **小程序报工**：只写 `scjl` 现有列（`gldh`/`报工单号`/`sl`/`gxdm`/`scx`/`批次号`），行键沿用 `gd_id` + `工单行号`
2. **`inh`/`outh` 新增「工单号 + 工单ID」**：在 `StockLedgerService.loadRows` 的 **FINISH_IN / MATERIAL_OUT 两个 case** 带出 `加工单号`，并 join `plang` 反查 `plang.id`；同步改 `StockFlowService.flowCols` 一处
3. **「订单号/订单ID/采购单号/采购ID/委外\*」分期** —— 且**订单号语义（IC- vs SO-）要先拍板**

> **若只要"看到工单号"，连第 2 步都可省**：小程序用 `inh.单据编号 → bd_finish_in.加工单号`，或经 `scjl.post_no` 反查，**零改动**。

## 8. 待用户拍板（当时未决，搁置前未答）

1. **「订单号」语义**：遗留 `IC-` 编码 还是 MES `SO-` 单号？（影响 §4 与 §7）
2. **各 ID 口径**：本地表主键 还是 金蝶单据 id？（`KingdeePushService` 有"按单号向金蝶解析 `src_inter_id`/`src_entry_id`"的机制，两套数字不同；**决定列类型 `int` 还是 `nvarchar`**）
3. **`委外单号`/`委外ID`**：现在无来源 —— 留空，还是先恢复委外单据链？
4. **`审核标记`** 要不要加？（建议不加，理由见 §3）
5. **采购入库/销售出库两段的「工单号」为 NULL** 能否接受？（头表确实无此列）

## 9. 迁移脚本要点（将来实施时照此办）

1. **幂等加列**：逐列 `IF COL_LENGTH('dbo.inh', N'列名') IS NULL ALTER TABLE dbo.inh ADD [列名] nvarchar(60) NULL;`
2. **列注释**：`sp_addextendedproperty`，查存在时 **必须带 `ep.class = 1`** —— ⚠️ 规范 §133 铁律：**否则索引 `index_id` 撞上备用列 `column_id` 会静默漏写**（`kucun.备用1` 中过招）
3. **全部 NULL、不设 NOT NULL、不设默认值、不动索引**（确有检索需求再单独评估 `IX_inh_工单号`，命名照 `IX_` 惯例）
4. **存量不回填**（`inh` 31 行全是期初，无单据可带）
5. 脚本放 `tools/`；**两账套都执行**（先 `HSDZ_MES` 后 `HSDZ_MES_TEST`），`DbSync` 到「**执行 0、失败 0**」
6. 登记 `docs/development/数据库表清单.md`（`inh` 47→N / `outh` 48→N；**顺带核对 `scjl` 列数**：实测 **99** 而文档 v3.10 记 **100**，差异未查明）；修 `tools/db-inuse-tables.txt` 的中文名
7. 跑 `tools/verify/DbNormAudit.java` 13 项，**两账套**
8. 新列若要进面板/小程序展示：同步 `yj_field` + `yj_translation`（**2026-08-30 起不可豁免的多语言红线**）
9. 中文列名脚本走 `sqlcmd -f 65001`；⚠️ **不要用 PowerShell 拼中文 body / 写文件**（本项目反复踩过）

## 10. 未查实 / 遗留

- **⭐ 批号（lot）在溯源链上的连续性 —— 溯源能否成立的真正命门**（`kucun` 粒度=物料+仓库+批号，批号是唯一现成溯源键；若成品批号与原料批号无关联，则"从成品反查原料"缺一条边）。**本次另派评估在查，结论未回**。
- 「完工明细」具体指哪个界面/字段（用户无原文）
- 四张单据表正式库**全 0 行** ⇒ §4 的能/不能是按**表结构+代码路径**判断，**无填充率证据**
- `scjl` 列数实测 99 vs 表清单记 100，**差异原因未查明**
- `inh`/`outh` 重建前是否曾有 `asp_user3`、`备用1..20` 是否已绑定动态字段，**未逐一核实**
