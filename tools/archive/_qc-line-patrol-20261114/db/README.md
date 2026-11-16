# 成型车间巡线记录表（QC_LINE_PATROL）· DB / 元数据落库证据

| 属性 | 内容 |
|---|---|
| 任务 | 共享任务板 `task-3`（DB/面板/字段/译名/授权 + 两账套迁移 + 台账登记） |
| 日期 | 2026-11-14 |
| 唯一契约 | `docs/design/成型车间巡线记录表-首版.md`（§二 库表 / §三 元数据 / §五 验收） |
| 迁移脚本 | `tools/migrate-qc-line-patrol-20261114.sql`（幂等；已登记 `tools/db-migrations.txt` 末尾） |
| 证据目录 | `tools/archive/_qc-line-patrol-20261114/db/`（本 README + 下列探针与日志） |
| 账套 | 正式 `HSDZ_MES` 先、测试 `HSDZ_MES_TEST` 后；两账套均执行 |

> 本轮只做 DB/元数据；纸面渲染、菜单、保存链路由前端队友（patrol-sheet）在同批实现，
> 两边的对齐口径 = 上面的契约文档 + 落库实测（本 README §5 的字段清单可直接对照）。

---

## 1. 口径（逐条对应契约）

1. **两张表头行成对**：`qc_line_patrol_head`（12 列）/ `qc_line_patrol_detail`（32 列），
   均带 `bigint IDENTITY` 主键 + 审计四件套 `asp_user1/2`、`asp_time1/2` + `asp_cancel nvarchar(1) DEFAULT 'N'`。
2. **一行 = 纸面一个「记录块」**（不是子行）：块内 4 子行 = 产品①/② 的 `编号/型号` + `长度/内径/重量` 的
   标准值与实测值（①②各 8 列）；块级列（巡线时间/车间/两液密度/表面状态/跌落强度/抗压强度/结果判定/巡线人员）
   在纸面上 `rowspan=4`，在库里就是这 8 列。前端按 4 子行渲染同一行记录。
3. **列名全中文、无括号/空格**（数据库规范 §1.2 列名安全），文本一律 `nvarchar`、日期 `datetime2`、
   状态列 `nvarchar(1)`；**不给「单据状态」写业务固定默认值**（规范 §2.3 双真源红线）。
4. **索引**：`ix_qc_line_patrol_head_no` / `ix_qc_line_patrol_detail_no`（`单据编号`），命名按规范 §1.3。
5. **中文注明**：表级 + 逐列 `MS_Description`（头 1+7、明细 1+27，`id`/`asp_*` 按规范 §1.2 豁免列级注明），
   同脚本内写入、幂等（`IF NOT EXISTS` + `class = 1` 防「索引号撞列号」的静默漏写）。
6. **面板**：`QC_LINE_PATROL / 成型车间巡线记录表 / category 品质管理 / mode doc / line=qc_line_patrol_detail /
   head=qc_line_patrol_head / group_col 单据编号 / pk_col id / code_col 单据编号 / prefix XJ / date_col 单据日期 /
   page_size 20 / detail_key items / module_group 品质管理`。
7. **字段 30 行**：头 5（`place='query,header'`，seq 10/20/190/200/210）+ 明细 25（`place='detail'`，seq 10..240 + `行号` 260 hidden=1）。
8. **授权**：`yj_role_panel` 照抄 `QC_OQC_REPORT` 逐角色 `can_approve`/`perms`，并对 `yj_role` 全角色兜底 ——
   漏这段的实测症状是「菜单能显示、点进去被路由守卫踢回登录页」（v3.77 记录）。
9. **译名**：面板 en + 21 个新标签 en；已有全局 en 的标签（单据编号/单据日期/单据状态/审核人/审核时间/车间/行号）不重复插。

---

## 2. 两账套执行（`tools/` 下，JDK 23/25：`"$JAVA_HOME/bin/java"`）

```bash
# 正式库
"$JAVA_HOME/bin/java" -cp lib/mssql-jdbc.jar DbSync.java run migrate-qc-line-patrol-20261114.sql
"$JAVA_HOME/bin/java" -cp lib/mssql-jdbc.jar DbSync.java run migrate-qc-line-patrol-20261114.sql   # 幂等复跑
"$JAVA_HOME/bin/java" -cp lib/mssql-jdbc.jar DbSync.java sync                                      # 收口

# 测试库
YINJIA_SQL_DB=HSDZ_MES_TEST "$JAVA_HOME/bin/java" -cp lib/mssql-jdbc.jar DbSync.java run migrate-qc-line-patrol-20261114.sql
YINJIA_SQL_DB=HSDZ_MES_TEST "$JAVA_HOME/bin/java" -cp lib/mssql-jdbc.jar DbSync.java run migrate-qc-line-patrol-20261114.sql
YINJIA_SQL_DB=HSDZ_MES_TEST "$JAVA_HOME/bin/java" -cp lib/mssql-jdbc.jar DbSync.java sync
```

| 账套 | 首跑 | 幂等复跑 | `sync` 收口 | yj_schema_log |
|---|---|---|---|---|
| `HSDZ_MES` | `[OK] 14 batches`（见 `run-01-HSDZ_MES.log`） | `[OK] 14 batches`，面板/授权/译名 insert 全部 0 行（`run-02-HSDZ_MES-idempotent.log`） | **执行 0，跳过 749，失败 0**（`run-03-HSDZ_MES-sync.log`） | 已登记，`content_hash = dc78316ee8df9b4d5be58a4005cbc7579e9ff3ce363d89fd21eadb2a6cc6faae` |
| `HSDZ_MES_TEST` | `[OK] 14 batches`（`run-04-HSDZ_MES_TEST.log`，授权 7 行 = 测试库旧快照的角色数） | `[OK] 14 batches` 幂等（`run-05…`） | **执行 0，跳过 749，失败 0**（`run-06…`） | 已登记，同一 hash |

> **哈希核对（防"改字节被重跑"）**：`sha256sum tools/migrate-qc-line-patrol-20261114.sql` 与两账套
> `yj_schema_log.content_hash` **逐字符相同**（`dc78316e…6faae`）⇒ 脚本自执行后未被改动，后续 `DbSync sync`
> 不会再跑它（迁移链卫生）。

> 复跑「幂等」判据：第二跑的面板(1)/头字段(5)/明细字段(25)/授权(13 或 7)/面板译名(1)/字段译名(21) 插入行数全部为 0 或仅剩临时表变量行数，
> 无重复行、无报错（`probe-04-verify.sql` 第 [15] 项「重复登记行 = 0」实测）。

---

## 3. 落库实测（`probe-04-verify.sql` → `verify-HSDZ_MES.txt` / `verify-HSDZ_MES_TEST.txt`）

| 项 | 正式库 HSDZ_MES | 测试库 HSDZ_MES_TEST |
|---|---|---|
| `qc_line_patrol_head` 列数 | **12** | **12** |
| `qc_line_patrol_detail` 列数 | **32** | **32** |
| 主键/索引/默认约束 | `pk_qc_line_patrol_head`、`pk_qc_line_patrol_detail`、两个 `ix_*_no`、两个 `df_*_cancel` | 同左 |
| 表级/列级 `MS_Description` | 头 1 + 7；明细 1 + 27 | 同左 |
| `yj_panel` 行 | 1（`QC_LINE_PATROL`，前缀 XJ，mode doc） | 1（同） |
| `yj_field` 行 | **30**（头 5 + 明细 25，其中 hidden=1 的 `行号` 1 行） | 同 |
| `yj_role_panel` 行 | **13**（= 正式库 `QC_OQC_REPORT` 的 13 个角色） | **7**（测试库是旧快照，角色只有 1~7） |
| `yj_translation` en | 面板 1 + 字段 21，缺 en = **0** | 同 |
| 占位译名回填 | `跌落强度→Drop Strength`、`抗压强度→Compressive Strength` 各 1 行 | 同 |
| 元数据漂移（字段不在对应物理对象里） | **0** | **0** |
| 完全重复字段登记行 | **0** | **0** |

**字段清单（前端按此对齐，seq 升序）**

- 头 `place=query,header`：`单据编号`(10, 只读, 必填) · `单据日期`(20, 可编, 必填, 日期) · `单据状态`(190, 只读) · `审核人`(200, 只读) · `审核时间`(210, 只读)
- 明细 `place=detail`（全部 `editable=1 / required=0 / visible=1`）：
  `巡线时间`10 · `车间`20 · `编号1`30 · `型号1`40 · `长度标准1`50 · `长度实测1`60 · `内径标准1`70 · `内径实测1`80 ·
  `重量标准1`90 · `重量实测1`100 · `编号2`110 · `型号2`120 · `长度标准2`130 · `长度实测2`140 · `内径标准2`150 ·
  `内径实测2`160 · `重量标准2`170 · `重量实测2`180 · `两液密度`190 · `表面状态`200 · `跌落强度`210 · `抗压强度`220 ·
  `结果判定`230 · `巡线人员`240 · **`行号`260（hidden=1, visible=0, editable=0）**
- en 译名：`Patrol Time / Workshop / No. 1 / Model 1 / Length Standard 1 / Length Measured 1 / ID Standard 1 /
  ID Measured 1 / Weight Standard 1 / Weight Measured 1 / …（②同）/ Dual-liquid Density / Surface Condition /
  Drop Strength / Compressive Strength / Result Judgement / Patrol Inspector / Line No.`；
  面板 en = `Forming Workshop Line Patrol Record`。

---

## 4. DbNormAudit 两账套「前后对比」：**0 新增 FAIL**

```bash
# tools/ 下
YINJIA_SQL_PASS='<口令>' java -cp lib/mssql-jdbc.jar verify/DbNormAudit.java HSDZ_MES
YINJIA_SQL_PASS='<口令>' YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib/mssql-jdbc.jar verify/DbNormAudit.java HSDZ_MES_TEST
```

| 账套 | 改动前 | 改动后 | 差异 |
|---|---|---|---|
| `HSDZ_MES` | FAIL **3** / WARN 1（`RESULT: FAIL-3`） | FAIL **3** / WARN 1（`RESULT: FAIL-3`） | **逐字一致**，唯一变更 = 第 12 项「清单 748→749 / 文件 787→788」（即本次登记的那 1 支脚本，处数仍 17 未增） |
| `HSDZ_MES_TEST` | FAIL **7** / WARN 1（`RESULT: FAIL-7`） | FAIL **7** / WARN 1（`RESULT: FAIL-7`） | 同上，**逐字一致** |

- 两账套 FAIL 均为**存量**（01/02/03/05/09/12/13：测试库陈旧表 `_zz_idx_test`、`rd_sample_int_detail` 缺注明、
  测试库 14 个漂移字段、`09 缺 en 译名` 存量债、第 12 项 17 处未登记的历史脚本等），与本次无关。
- 新表**未被任何一项点名**（01 命名合规 / 02 表注明 / 03 列注明 / 04 主键审计列 / 05 漂移 / 06 面板对象 / 07 重复行 /
  08 多标签 / 09 译名 / 11 索引 / 13 面板对象键，全部通过）。
- 对比文件：`audit-before-HSDZ_MES.txt` ↔ `audit-after-HSDZ_MES.txt`、`audit-before-HSDZ_MES_TEST.txt` ↔ `audit-after-HSDZ_MES_TEST.txt`
  （`diff` 结果只有第 12 项那一行）。

---

## 5. 台账登记

| 台账 | 改动 |
|---|---|
| `tools/db-migrations.txt` | 末尾 +2 行（中文说明 + `migrate-qc-line-patrol-20261114.sql`）；`DbSync sync` 已跑「执行 0/失败 0」 |
| `tools/db-inuse-tables.txt` | 末尾新增「2026-11-14 …(面板 QC_LINE_PATROL)」小节 + `table:qc_line_patrol_head` / `table:qc_line_patrol_detail` 两行 |
| `docs/development/数据库表清单.md` | §五 品质管理：组头 `共 30 张 → 共 34 张(32→34)`，并注明实库 `qc_` 共 37 张中 `qc_oqc_*` 3 张尚未逐行登记（存量缺口，本任务不动别的表）；两张表按同组格式各补一行（列数 12 / 32，关联面板 QC_LINE_PATROL）；维护记录追加 `v3.96` 一行 |

> **为什么没跑 `gen-db-catalog.cjs`**：该生成器会整份重写本清单并**覆盖手写维护记录**（v3.1–v3.95 全为手写，
> 文档自身与历次维护记录都注明「生成器会覆盖维护记录」）。故按同组格式手工补行 + 手工追加记录，
> 列数取两账套 `sys.columns` 实测值（12 / 32）。若日后要整份重生成，需先把维护记录段独立出来。

> **为什么 `数据库表清单.md` 的改动只有 4 行内容**：该文档是混合行尾历史文件，普通编辑器回写会把个别 LF 行
> 规范化成 CRLF、在 diff 里冒出「只差行尾」的假改动。本次用 `rebuild-catalog-doc.pl`（本目录）以
> 「HEAD 原字节 + 4 处新内容」重组，未改动过的行逐字节保留 ⇒ `git diff` 4 insertions / 1 deletion。

---

## 6. 文件清单（本目录）

| 文件 | 用途 |
|---|---|
| `probe-01-preexisting.sql` | 落库前摸底：yj_panel/yj_field/yj_role_panel 结构、既有 qc 面板行、既有 en 译名、既有 qc_ 表列数 |
| `probe-02-oqc-sample.sql` | 取 `QC_OQC_REPORT`（最近新增且已验证可用的品质面板）字段口径做样板 |
| `probe-03-translation-style.sql` | 同源标签既有 en 译名（统一风格：Model / Sample No. / Result Judgement…） |
| `probe-04-verify.sql` | **落库后主取证**（15 段：列数/列清单/索引/注明/面板/头字段/明细字段/授权/译名/缺译名/占位回填/schema_log/漂移/重复行） |
| `probe-05-qc-tables.sql` | `qc_` 表在册对照（实库 37 张 vs 清单逐行登记，用于台账口径） |
| `run-01…run-06*.log` | 两账套 DbSync `run`/复跑/`sync` 原始输出 |
| `verify-HSDZ_MES.txt`、`verify-HSDZ_MES_TEST.txt` | `probe-04` 两账套实测输出 |
| `audit-before-*.txt` / `audit-after-*.txt` | DbNormAudit 两账套前后对比 |
| `qc-tables-HSDZ_MES.txt` | `qc_` 表清单（37 张） |
| `rebuild-catalog-doc.pl` | 按字节重建 `数据库表清单.md`（保混合行尾，见 §5 说明） |

复跑全部取证（`tools/` 下，口令走 `YINJIA_SQL_PASS`）：

```bash
YINJIA_SQL_PASS='<口令>' "$JAVA_HOME/bin/java" -cp lib/mssql-jdbc.jar SqlRunner.java \
  "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" yinjia env \
  archive/_qc-line-patrol-20261114/db/probe-04-verify.sql
```

---

## 7. 本轮踩坑（写进证据，避免下一个人重踩）

1. **库兼容级别 = 100**（SQL Server 2008 兼容级别）：`STRING_AGG` / `WITHIN GROUP` 在这两个库里是**语法错误**。
   取证脚本第一版用它做索引列聚合，整批直接 `Incorrect syntax near '('`（一整批没有 GO，所以一条都没出）。
   迁移脚本本身没用它，故不受影响；后续写探针一律用 `FOR XML PATH` 或逐行输出。
2. **`sed -i` 会毁掉 CRLF 文档**：对 `docs/development/数据库表清单.md` 用过一次 `sed -i '$ s/\r*$/\r/'`，
   整个文件被改成 LF，`git diff` 出现 1245 行「假重写」。已 `git checkout` 还原并用 `rebuild-catalog-doc.pl` 重做。
   **规矩：动这类混合行尾文档不要用 sed -i；用只替换片段的方式，或用本目录的重建脚本。**
3. **编辑工具回写会把个别 LF 行规范化成 CRLF**：同一份文档里 2 行（v3.92 行 + 它前面的空行）原本是 LF 结尾，
   编辑工具回写后变 CRLF ⇒ diff 多 2 行假改动。重建脚本按行保留原行尾即可消除。
4. **测试库角色只有 1~7**：`yj_role_panel` 照抄 `QC_OQC_REPORT` 时，正式库落 13 行、测试库落 7 行（旧快照），
   这是**预期差异**，不是漏授权（测试库登录能进面板即可）。
5. **占位译名的隐蔽坑**：`跌落强度`/`抗压强度` 早就有 `locale='en'` 的行，但 `text` 与中文标签逐字相同
   （历史机翻占位）⇒ 体检 09「缺 en 译名」认为它**已翻译**，而 en 界面实际显示中文。本次只回填
   `text = ref_key` 的占位行（真实译名不覆盖），并保留 `NOT EXISTS` 守卫保证幂等。
