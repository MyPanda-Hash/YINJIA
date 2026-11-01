# 制程 / 首件检验单「空壳草稿」清理（2026-10-21）

用户口径：

> 「当前制程检验单和首件检验单存在许多无用的草稿状态单据，这些单据除去自动产生的单号之类的数据无其他任何数量数据，帮我清除掉这些单据。」

## 一、口径（逐条都是"这张单什么业务数据都没有"）

| # | 条件 | 说明 |
|---|---|---|
| ① | **单据状态 = 草稿** | 按 `QueryService.docStatus` 的同一套判据：`yj_doc_status` 里 `shr` 空、`pending≠Y`、`canceled≠Y`、`stopped≠Y`、`deleting≠Y`、`archived≠Y`、`modify_state≠Y`、`effective≠Y`；**没有状态行也算草稿** |
| ② | 表头关键业务列**全空** | 工单号 / 产品编码 / 检验员 / 批次号（首件另加 生产日期） |
| ③ | **报工数量 = 0** | |
| ④ | 明细**一格都没填** | 没有 `实测数值 / 结果判断 / 不良数量` 的行 —— 自动预铺的空标准行不算数据 |
| ⑤ | 未作废 | `asp_cancel≠Y` |

⚠ **状态不在单头表里**：`qc_proc_insp_head.单据状态` / `qc_first_insp_head.单据状态` 实测**全是 NULL**
（447/488 行），真实状态由 `yj_doc_status` 派生 —— 直接查单头表会把 447 张全当"草稿"。这是本次取证踩的第一个坑。

## 二、命中与执行

| 账套 | 制程 | 首件 | 合计 | 结果 |
|---|---|---|---|---|
| `HSDZ_MES`（正式） | **15** | **63** | **78** | 已删除，残留 0；制程 448→433、首件 488→425 |
| `HSDZ_MES_TEST`（测试） | **9** | **25** | **34** | 已删除，残留 0；制程 49→40、首件 54→29 |

- 脚本：`_purge-qc-insp-empty-drafts-20261021.sql`（幂等守卫：目标数必须等于「正式 78 / 测试 34」，否则 `RAISERROR` 中止）
- 执行器：`_run.mjs`（按 `GO` 分批；脚本内单事务 `SET XACT_ABORT ON`，失败整体回滚）
- **回滚快照**：`_bak_qcdraft_proc_head_20261021` / `_proc_detail_` / `_proc_status_` /
  `_fst_head_` / `_fst_detail_` / `_fst_status_` / `_approval_20261021`（整行原样列，验收后再 DROP）
- 连带清理（只针对命中单）：`qc_*_insp_detail`、`yj_doc_status`、`yj_form_approval`、
  `form_flow_link`、`yj_doc_batch`、`yj_attachment`、`yj_doc_annotation`
  —— 实测正式库明细/状态/审批/占用链**全为 0 行**，测试库有 34 行状态 + 3 行审批。

## 三、刻意**不清**的（有业务内容，不是空壳）

| 类型 | 张数（正式） | 为什么不删 |
|---|---|---|
| 有**报工数量**、明细没填 | 制程 6 / 首件 6 | 手机端报工吸收自动出的**待检单**（如 `ZC-2026-10-0130` 报工 6960、`SJ-2026-10-0166` 报工 6960）—— 数量在，只是检验还没做 ⇒ 正常待办，不是垃圾 |
| 明细**填过**实测数值/判定 | 制程 2 / 首件 1 | 检验数据已录（如 `ZC-2026-10-0001` 填了 7 格、`SJ-2026-10-0167` 填了 1 格） |
| 已审核 / 已作废 / 审批中 | — | 不在"草稿"范围 |

## 四、验收

| 项 | 结果 |
|---|---|
| 清理后空壳残留 | 两账套均 **0** |
| 孤儿行（明细/状态/审批/占用链指向已删单） | 正式库**全 0**；测试库 `yj_doc_status` 有 118 行 `QC_FIRST_INSP` 孤儿 —— **清理前就存在**（历史下架/重建遗留），与本次无关，未动 |
| 面板接口 | `QC_PROC_INSP` 正式 432 / 测试 22；`QC_FIRST_INSP` 正式 424 / 测试 24；`QC_ASM_INSP` 未受影响（386 / 10） |
| 快照表 | 正式 15+63 张单头原样落表，可回滚 |

## 五、目录里的脚本

| 文件 | 用途 |
|---|---|
| `_purge-qc-insp-empty-drafts-20261021.sql` | **清理脚本**（快照 + 守卫 + 单事务 + 收尾自检） |
| `_run.mjs` | 脚本执行器（`node _run.mjs <db> <sql> [--dry]`，打印 PRINT 消息与结果集） |
| `_q.mjs` | 只读/任意语句查询器（`node _q.mjs <db> <sql>`），本次全部取证都靠它 |
| `_q1.sql`~`_q17.sql` | 逐轮取证：状态分布 → 空壳分档 → 候选清单 → 依赖面统计 |
| `_verify.sql` | 清理后复核（剩余量 + 快照行数） |

## 六、回滚（⚠ 2026-10-21 起快照已按用户口径删除，本段仅作留档）

> 用户 2026-10-21 确认「这些表是之前危险删除操作的备份文件」并同意删除，7 张 `_bak_qcdraft_*` 快照已由 `tools/migrate-drop-bak-snapshots-20261021.sql` DROP（两账套）。
> ⇒ 下面这段 INSERT 回滚**已不可用**；确实要恢复只能从数据库 `.bak` 还原。删除前已核实「快照里的 78 张单在业务表命中 0」（即清理确实已生效）。

```sql
-- 未 DROP 备份表时，整表灌回（列序与源表一致，SELECT * INTO 保留原样）
INSERT INTO qc_proc_insp_head   SELECT * FROM _bak_qcdraft_proc_head_20261021;
INSERT INTO yj_doc_status       SELECT * FROM _bak_qcdraft_proc_status_20261021;
INSERT INTO qc_first_insp_head  SELECT * FROM _bak_qcdraft_fst_head_20261021;
INSERT INTO yj_doc_status       SELECT * FROM _bak_qcdraft_fst_status_20261021;
INSERT INTO yj_form_approval    SELECT * FROM _bak_qcdraft_approval_20261021;
```
（明细快照本次为空 —— 命中单都没有明细行。）
