# 检验目录 / 检验数据记录脏数据清理（2026-10-21）

用户口径：

> 「根据当前的来料检验单的数据对这个当前检验目录和检验数据记录的脏数据进行处理。」

确认后的清理口径 = **A. 全量对齐现存检验单**：以「未作废的来料检验单 + 未作废的明细行」为唯一真源，
目录/记录只保留能对上的行，删孤儿/空白/重号/无来源行，并给缺失的真实现存检验单补行。

## 一、脏数据从哪来

2026-10-20 的 `_qc-insp-reset-20261020/_reset-qc-insp-demo-20261020.sql` 删掉了
**99 张**演示/无来源来料检验单，当时只连带清理了 `qc_insp` / `qc_insp_detail` /
`yj_doc_status` / `yj_form_approval` / `form_flow_link`，
**检验目录（`qc_catalog_detail`）与检验数据记录（`qc_insp_rec`）没有跟着清** ⇒ 留下一批
指向已删检验单（`IJ-2026-09-0002`~`0016`）的悬空行。

清理前实测（正式库 `HSDZ_MES`）：

| 表 | 总数 | 脏行 | 具体 |
|---|---|---|---|
| `qc_catalog_detail` | 52 | **46** | 44 行指向已删检验单；2 行无任何关联（`HP-12` 手工行） |
| `qc_insp_rec` | 38 | **32** | 25 行无来源单、6 行指向已删/已作废检验单、1 条空白记录、1 个重号（`JYSJ-2026-10-0001` 两行） |
| `yj_doc_status(QC_INSP_REC)` | 68 | 62 | 记录已不存在，状态行还在 |
| `yj_form_approval(QC_INSP_REC)` | 7 | 5 | 同上 |
| `qc_tc_in.检验数据记录单号` | 12 | 10 | 指向已不存在的记录（断链） |

## 二、判定规则

保留集 = `qc_insp`（`asp_cancel≠Y`）⋈ `qc_insp_detail`（`asp_cancel≠Y`），按 `(单据编号, 物料编码)`。

- **目录行**：`检验单号` 必须命中上述保留集，否则删除（含无关联的手工行）。
- **记录**：`来料检验单号 + 物料编码` 必须命中保留集；同一记录单号若有多行，只在**有效行**里保留
  `id` 最小的一条（去重不把有效行拖下水，见脚本内注释）。
- 删除记录的连带清理：`qc_insp_rec_detail`、`yj_doc_status`、`yj_form_approval`、
  `form_flow_link`、`yj_attachment`、`yj_doc_annotation`；`qc_tc_in.检验数据记录单号`
  指向已删记录的统一置 `NULL`（只断链，不删特采单）。
- 保留行按检验单明细**回正**：`数量/计量单位/批次号/物料名称/检测物料类别`。
- 补齐缺失：`IJ-2026-09-0152`（真实链路单，暂收 `SL-2026-09-0189`）当时没有生成目录/记录 ⇒
  补 1 行目录 + 1 条记录（`JYSJ-2026-10-0089`，单号走号池 `s_allno`）。

## 三、执行与结果

脚本：`_align-qc-catalog-rec-20261021.sql`（整行快照 + 目标数守卫 + 单事务 `XACT_ABORT`；
已对齐后重跑为 0/0，打印 PASS 直接返回，幂等）。

执行（`tools` 目录下，两账套各一次，先正式后测试）：

```powershell
$env:YINJIA_SQL_PASS='Yinjia@2026'
& 'C:\Users\vigna\.jdks\ms-25.0.4\bin\java.exe' '-Dstdout.encoding=UTF-8' -cp lib\mssql-jdbc.jar `
  SqlRunner.java "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=10" `
  yinjia env archive\_qc-catalog-clean-20261021\_align-qc-catalog-rec-20261021.sql
# 测试库把 databaseName 换成 HSDZ_MES_TEST
```

| 账套 | 目录 | 记录 | 明细 | 状态(QC_INSP_REC) | 审批(QC_INSP_REC) | 特采断链 |
|---|---|---|---|---|---|---|
| `HSDZ_MES` | 52 → **7**（删 46、补 1） | 38 → **7**（删 32、补 1） | 29 → 5 | 68 → 7 | 7 → 2 | 12 → 2 |
| `HSDZ_MES_TEST` | 30 → **1**（删 28、补 1） | 28 → **1**（删 28、补 1） | 1 → 0 | 83 → 1 | 7 → 0 | 0 |

正式库最终的 7 行 = 7 条「未作废检验单 + 未作废明细」逐行一一对应（`cat=1 / rec=1`）：

| 检验单 | 物料 | 批次 | 数量 | 记录 |
|---|---|---|---|---|
| IJ-2026-09-0152 | YJ-KBL-021 气泡袋 | YJ-20260915-12-001 | 100个 | JYSJ-2026-10-0089（新补） |
| IJ-2026-10-0001 | YJ-YPS-002 依品晟（250-400） | YPS | 100kg | JYSJ-2026-10-0001 |
| IJ-2026-10-0003 | YJ-SX-025 端盖 | SX-20261019 | 100套 | JYSJ-2026-10-0004 |
| IJ-2026-10-0004 | Y-S-N 氢氧化钠 | WR-20261019 | 100kg | JYSJ-2026-10-0005 |
| IJ-2026-10-0005 | Y-S-Z 八水合氧氯化锆 | WR-20261019 | 100kg | JYSJ-2026-10-0006 |
| IJ-2026-10-0200 | Y-S-N 氢氧化钠 | 20261020 | 100kg | JYSJ-2026-10-0087 |
| IJ-2026-10-0200 | Y-S-Z 八水合氧氯化锆 | 20261020 | 100kg | JYSJ-2026-10-0088 |

收尾自检（两账套）：目录/记录**悬空检验单 = 0**、**悬空记录 = 0**、**重号 = 0**。

另修一处重号遗留状态：`JYSJ-2026-10-0001` 的旧行在 2026-10-04 提交过，与新行共用同一条
`yj_doc_status` ⇒ 清理后新行仍显示「审批中」。判据「`pending_at` 早于记录创建时间 `asp_time1`
且无审批流水」命中 1 行，已清为「草稿」（脚本 `[11b]` 段；两个校验：面板接口复核 7 条记录状态
= 6 草稿 + 1 已审核）。

## 四、测试库为什么只剩 1 行

`HSDZ_MES_TEST` 是更早的快照（来料检验单 101 张、有效明细 249 行），与正式库不同源。
本次对它只做「删孤儿」：原有 28 行目录 + 28 条记录全部指向不存在的检验单，故全删；
`IJ-2026-09-0152` 在测试库也存在，所以同样补了 1 行/1 条。
**没有**按正式库给另外 248 条明细补行——那是测试库陈旧问题，按 `AGENTS.md`
「测试库」节的正解是重建快照（`tools/scripts/make-test-db.ps1`），不在本任务范围。

## 五、回滚

快照表（整行原样列，验收后可 DROP）：

| 表 | 内容 |
|---|---|
| `_bak_qccat_detail_20261021` | 被删的 46 行目录 |
| `_bak_qcrec_20261021` | 被删的 32 条记录 |
| `_bak_qcrec_detail_20261021` | 被删记录的明细行（24 行） |
| `_bak_qcrec_status_20261021` | 清理前全部 `QC_INSP_REC` 状态行（68 行） |
| `_bak_qcrec_approval_20261021` | 清理前全部 `QC_INSP_REC` 审批行（7 行） |
| `_bak_qctcin_ref_20261021` | 特采单原记录号引用（12 行） |

```sql
INSERT INTO qc_catalog_detail  SELECT * FROM _bak_qccat_detail_20261021;
INSERT INTO qc_insp_rec        SELECT * FROM _bak_qcrec_20261021;
INSERT INTO qc_insp_rec_detail SELECT * FROM _bak_qcrec_detail_20261021;
INSERT INTO yj_doc_status      SELECT * FROM _bak_qcrec_status_20261021;
INSERT INTO yj_form_approval   SELECT * FROM _bak_qcrec_approval_20261021;
```

## 六、目录里的文件

| 文件 | 用途 |
|---|---|
| `_align-qc-catalog-rec-20261021.sql` | **清理脚本**（快照 + 守卫 + 单事务 + 回正 + 补缺 + 自检） |
| `q01-cols.sql` ~ `q04-cols2.sql` | 表结构取证 |
| `q05-counts.sql` / `q06-docs.sql` | 清理前全量数据快照（目录/记录/检验单） |
| `q07-dirty.sql` ~ `q11-orphanrec.sql` | 脏行分档与逐行清单 |
| `q12-test.sql` / `q16-testcounts.sql` | 测试库对照与目标数 |
| `q13-refs.sql` ~ `q15-deps.sql` | 状态/审批/附件/特采引用面 |
| `q17-testkeep.sql` / `q18-survivors.sql` | 保留集核对 |
| `q19-target2.sql` ~ `q20-target3.sql` | 修正重号去重后的目标数（32/6） |
| `q21-verify.sql` / `q23-consistency.sql` | 清理后复核与逐行一致性 |
| `q24-idem.sql` / `q25-status0001.sql` / `q26-fixpending.sql` | 幂等复跑、重号遗留状态取证与修复 |
| `q27-final-deps.sql` | 剩余记录明细/特采链接/状态孤儿复核 |
