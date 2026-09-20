-- _seed-prodDocList-test-cleanup.sql — 清理探针数据(与 _seed-prodDocList-test.sql 配对)
-- 只删 ZZTEST-/ZZT- 前缀,不碰任何真实数据。
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
USE HSDZ_MES;

DELETE FROM rd_dev_task       WHERE 产品编号 LIKE 'ZZTEST-%';
DELETE FROM yj_doc_status     WHERE doc_no   LIKE 'ZZT-%';
DELETE FROM rd_mold_proc_head WHERE 单据编号 LIKE 'ZZT-%';
DELETE FROM rd_asm_proc_head  WHERE 单据编号 LIKE 'ZZT-%';
DELETE FROM rd_spec_doc_head  WHERE 单据编号 LIKE 'ZZT-%';
DELETE FROM rd_insp_plan_head WHERE 单据编号 LIKE 'ZZT-%';

PRINT N'探针数据已清理';
SELECT (SELECT COUNT(*) FROM rd_dev_task     WHERE 产品编号 LIKE 'ZZTEST-%') AS dev_task_left,
       (SELECT COUNT(*) FROM yj_doc_status   WHERE doc_no   LIKE 'ZZT-%')    AS doc_status_left,
       (SELECT COUNT(*) FROM rd_mold_proc_head WHERE 单据编号 LIKE 'ZZT-%')  AS mold_left;
