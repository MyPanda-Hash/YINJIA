# inh/outh 追溯列正名 `工单项次`(int)—— 影响面取证与文档收敛

> **日期**：2026-10-17
> **起因**：用户口径 —— 「inh/outh 的方向查实了:本地 `工单项次` int 是 2026-10-15 明确要求的有意偏离,不能回退。
> 看下修改这个出入库的情况对当前系统实现的影响是什么?需要把当前的 `工单ID` 改成 `工单项次`」
> **结论一句话**：**`inh`/`outh` 的工单追溯列改名 + 改类型,对当前 MES 实现的读/写/面板/报表影响 = 0**（该列在 MES 侧
> 无任何消费者，两个账套里 100% 为 NULL）；两侧**列名其实已经一致**（服务器也已是 `工单项次`），
> 剩下的差异只有 **类型（int vs float(53)）** 与 **默认值（无 vs `DEFAULT ((0))`）** 两处，均属有意偏离。
> 需要动的只剩**文档/清单里的旧名 `工单ID`**（本目录同批已收敛）。

---

## 1. 现状实测（本目录探针逐条跑出，非推断）

| 维度 | 实测结果 | 判据（探针） |
|---|---|---|
| 物理列 | 正式库 `inh.工单项次` **int(4)** 列序 55 / `outh.工单项次` **int(4)** 列序 56，均 NULL 可空、**无默认值**；两账套一致 | `_q-cols-fields-refs.sql` ① |
| `工单ID` 残留 | **全库 0 列**（`HSDZ_MES` / `HSDZ_MES_TEST` / 服务器快照 `HSDZ_MES_SRV1015` 三库均为 0） | `_q-cols-fields-refs.sql` ① |
| 面板绑定 | **0 行**：没有任何 `yj_panel.head_table/line_table` 是 `inh`/`outh`；`yj_field` 里也没有 `工单ID`/`工单项次` 登记行 | `_q-panel-report-bind.sql` ① |
| 字段/译名 | `yj_field` 命中 0 ⇒ 无需 `yj_translation` 词条（多语言红线不触发） | `_q-cols-fields-refs.sql` ③⑤ |
| 视图/过程/函数/触发器 | `sys.sql_modules` 里 `LIKE '%工单ID%' OR '%工单项次%'` ⇒ **0 个对象**；4 个库存视图（`v_stock_movement` 23 / `v_stock_ledger` 33 / `v_stock_summary` 23 / `v_stock_balance` 11 列）**全部显式列名、无 `SELECT *`** | `_q-cols-fields-refs.sql` ②、`_q-view-report-impact.sql` ①② |
| 报表模板 | `yj_report_template` 正文里 `inh`/`outh`/追溯列 ⇒ **0 行**；`yj_panel.config` 也 0 行 | `_q-panel-report-bind.sql` ③④ |
| 后端代码 | **读**：`DashboardStatsService` / `StockMonthCloseService` / `InvCostService` / `FormNoService` 全写死列名；**写**：唯一写方 `StockFlowService.flowCols()`（INSERT 与弃审复活 UPDATE 共用）**不含任何追溯列** | 代码 grep + `StockFlowService.java:165-192` |
| 数据 | 正式库 `inh.工单项次` 165 行 **全 NULL**、`outh` 128 行 **全 NULL**；测试库 `inh` 45 行全 NULL、`outh` 0 行 ⇒ **无存量可回填、改名不搬数据** | `_q-cols-fields-refs.sql` ⑥ |
| 经典 HSDZ 元数据 | `s_sys` 5646 行里确有 13 行的中文字段名（CHS）是「工单项次」（客户出库明细/销货出库单明细/生产领料明细…），但 `control`（表.列绑定）全为 NULL，且 MES 运行期不读 `s_sys` ⇒ **不构成消费者**；这批老面板绑的 `out…pl_xc` 在 2026-09-30 重建后已不存在 | `_q-legacy-ssys-bind*.sql` |

> **附带发现（可解释命名来源）**：经典 HSDZ 里「工单项次」本来就是出货/领料一侧的字段中文名
> （`s_sys` 13 行、旧 `s_sys` 快照里 `control=outh.pl_xc`）—— 用户把新追溯列命名为 `工单项次`
> 是**沿用老系统的叫法**，不是新造词。

---

## 2. 时间线：`工单ID` → `工单项次` 两侧都已改名

| 时点 | 证据 | `inh`/`outh` 工单列 |
|---|---|---|
| 2026-10-15 09:52（服务器备份 `yjmes2.bak` → 本地还原库 `HSDZ_MES_YJ2`） | `msdb.dbo.restorehistory` + `_q-yj2-trace-cols.sql` | **`工单ID` float(8) DEFAULT((0))`**（服务器手工加的那列，就是脚本头注说的形态） |
| 2026-10-15 当晚（本地两账套） | `migrate-stock-flow-trace-cols-20261015.sql` 三段式：`sp_rename` + 纠 `int` | **`工单项次` int**，无默认值 |
| 2026-10-15 23:15（服务器手工完整备份 → 本地还原库 `HSDZ_MES_SRV1015`） | `msdb.dbo.restorehistory` + `_q-cols-fields-refs.sql` ① | **`工单项次` float(8) DEFAULT((0))**，39 行全 0 ⇒ **服务器侧列名也已改成 `工单项次`** |

⇒ 因此「服务器那列叫 `工单ID`」只在 **10-15 09:52 那个时点**成立；**现在的服务器列名与本地同名**。
**唯二仍存在的差异**：① 类型 `int` vs `float(53)`；② 无默认值 vs `DEFAULT ((0))`。两条都是用户 2026-10-15
明确要求的偏离（列注明见 §1；脚本自检把 `工单项次 int` 显式登记为"有意偏离服务器"）。
> 注：`tools/db-migrations.txt` 与《数据库表清单》v3.30 行里「对照库 = yjmes2.bak(09:52) 还原出的
> `…_SRV_1015`」这一处归属写错了 —— 09:52 的备份还原出来的是 `HSDZ_MES_YJ2`；叫 `HSDZ_MES_SRV1015`
> 的是 23:15 那份。本批已在 `db-migrations.txt` 就地更正。

---

## 3. 对当前实现的影响（逐项结论）

1. **界面/面板**：0 影响 —— `inh`/`outh` 不是任何面板的载体表（`yj_panel` 0 行），
   所以「出入库流水」在界面上的呈现走的是**库存三表面板 + `v_stock_movement` 视图**（23 列硬契约，显式列名），
   加列/改名不进视图、不改契约。
2. **后端读写**：0 影响 —— 读侧全写死列名；写侧 `StockFlowService.flowCols()` 是唯一列清单，
   追溯 11 列不在其中（**没有任何代码写这一列**），所以 int/float 都不会有精度或截断问题。
3. **报表/导出**：0 影响 —— `yj_report_template` 与 `yj_panel.config` 里都没有它。
4. **多语言**：0 影响 —— 未登记 `yj_field` ⇒ 不需要 `yj_translation`（红线只在"新增面板/字段/UI 功能"时触发）。
5. **数据**：0 影响 —— 两账套该列 100% NULL；`sp_rename` 本身不搬数据，改类型对 NULL 无风险。
6. **经典 HSDZ 客户端**：无新增破坏 —— 它对 `inh`/`outh` 的老绑定（`…pl_xc` 一族）在 2026-09-30 两表重建为
   MES 流水表时就已失效（`s_sys` 那 13 行只是显示名，`control` 已为空）；本次正名不碰任何老面板绑定。
7. **全量部署（本地覆盖服务器）**：唯一可感知的后果是服务器那列会由 `float(53) DEFAULT 0`
   变成 `int NULL 无默认`（39 行现值全 0，转 int 无损）；因为两侧都无人读它，属**结构差异收口**，不是行为变化。
   ⚠ 若将来真有第三方（老 HSDZ 客户端）往这列写 `plang.id` 这种"主键语义"的值，会与新语义（工单**行号**）撞义
   —— 见 §4。

---

## 4. 给"将来实现追溯写入"的一句话口径（防踩旧文档）

- 该列**语义 = 工单行号**（`plang.pl_xc`，与 `bd_finish_in.工单行号` / `bd_material_out.工单行号` 同源同型 `int`），
  **不是** `plang.id`；
- 写入点若照 `docs/design/inh-outh加字段与扫码溯源评估.md` §7 的老第 2 步做，必须**按 `工单号 + 工单行号` 取值**，
  不能 join 出 `plang.id`（该文档本批已就地改正，并加 §12 追记）；
- 与「工单号」两列合起来才是唯一键（列注明原文）。

---

## 5. 本批实际改了什么 / 没改什么

**改（文档层，无 DDL、无数据、无代码）**
- `docs/design/inh-outh加字段与扫码溯源评估.md`：状态由「未实施」改为「已实施」；§3 命名表 `工单ID` → `工单项次`
  （含语义/类型更正）；§7 第 2 步改写；新增 §12 追记（现状、偏离两条、影响力取证、部署影响）。
- `docs/development/数据库表清单.md`：新增 v3.36 维护行（正名 + 两处偏离 + 影响面结论）。
- `tools/db-migrations.txt`：就地更正「服务器那列叫 `工单ID`」「对照库 = yjmes2.bak 还原出的 `…_SRV_1015`」两处归属，
  补 23:15 快照实测。

**没改（有意）**
- **不动 `tools/migrate-stock-flow-trace-cols-20261015.sql` 的字节** —— 它是历史脚本，字段内容改任何字节都会让
  `DbSync` 下次按内容哈希"重跑"它（AGENTS.md 迁移链卫生）。它的头注是**当时**的事实记录（09:52 快照确实是 `工单ID`），
  真正的现状更正落在 `db-migrations.txt`（清单注释）+ 设计文档追记里，不动脚本本体。
- **不对数据库做任何 rename/ALTER** —— 两个账套的列名已经是 `工单项次`，`工单ID` 残留 0（`_fix-stray-gongdan-id-20261015.sql`
  那次误加列早已清掉）。

---

## 6. 探针清单（本目录，均可重跑）

| 文件 | 用途 | 跑法（在 `tools/` 下） |
|---|---|---|
| `_q-cols-fields-refs.sql` | 列/字段/视图过程/译名/数据五段取证 | `java -cp lib\mssql-jdbc.jar archive\_migration-gap-20261017\_Q.java archive\_woline-id-rename-20261017\_q-cols-fields-refs.sql <库>` |
| `_q-panel-report-bind.sql` | 面板载体表 / 报表模板 / `yj_panel.config` 绑定 |
| `_q-view-report-impact.sql` | 引用 `inh/outh` 的视图是否含 `SELECT *`、库存视图列数 |
| `_q-trace-comments.sql` | 追溯列中文注明（本地 vs 服务器快照） |
| `_q-yj2-trace-cols.sql` | 09:52 快照（`HSDZ_MES_YJ2`）的列形态 —— 判定"服务器叫 `工单ID`"的成立时点 |
| `_q-srv1015-provenance.sql` | `msdb` 还原史：`HSDZ_MES_SRV1015` ← 23:15 备份、`HSDZ_MES_YJ2` ← 09:52 备份 |
| `_q-legacy-ssys-bind.sql` / `_q-legacy-ssys-bind2.sql` | 经典元数据 `s_sys` 里是否还有 `inh/outh` 绑定 |

> ⚠ 探针用 JDK：本机 PATH 上的 `java` 是 **1.8**（跑不了单文件源码模式），统一用
> `& "$env:JAVA_HOME\bin\java.exe" "-Dstdout.encoding=UTF-8"`（`JAVA_HOME` = JDK 23；后端构建仍需 JDK 25）。
