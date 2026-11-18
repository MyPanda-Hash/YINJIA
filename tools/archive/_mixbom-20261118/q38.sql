SELECT 表区, COUNT(*) rows_all, SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END) canceled_rows FROM rd_asm_proc_detail WHERE 单据编号='AP-2026-10-0006' GROUP BY 表区;
SELECT 序号, 物料编号, 物料名, 用量, asp_cancel, asp_time2 FROM rd_asm_proc_detail WHERE 单据编号='AP-2026-10-0006' AND 表区=N'物料清单' ORDER BY TRY_CAST(序号 AS int), id;
SELECT id, action_name, doc_no, created_at FROM yj_usage_log WHERE panel_name=N'组装工艺清单' AND created_at >= '2026-11-18 07:50' ORDER BY id;
