/* 探针清理:产品变更申请单 界面验收(_probe-change-ui.cjs) */
USE HSDZ_MES; SET NOCOUNT ON;
DECLARE @made TABLE (no nvarchar(200) PRIMARY KEY);
INSERT INTO @made (no) SELECT 单据编号 FROM rd_mold_proc_head WHERE 变更来源单号 = N'CHG-2026-09-0020';
INSERT INTO @made (no) SELECT 单据编号 FROM rd_asm_proc_head  WHERE 变更来源单号 = N'CHG-2026-09-0020';
INSERT INTO @made (no) SELECT 单据编号 FROM rd_insp_plan_head WHERE 变更来源单号 = N'CHG-2026-09-0020';
INSERT INTO @made (no) SELECT 单据编号 FROM rd_spec_doc_head  WHERE 变更来源单号 = N'CHG-2026-09-0020';
DELETE FROM yj_message WHERE 单据编号 = N'CHG-2026-09-0020' OR 单据编号 IN (SELECT no FROM @made);
DELETE FROM yj_form_approval WHERE form_no = N'CHG-2026-09-0020' OR form_no IN (SELECT no FROM @made);
DELETE FROM yj_doc_status WHERE doc_no = N'CHG-2026-09-0020' OR doc_no IN (SELECT no FROM @made);
DELETE FROM rd_change_detail WHERE 单据编号 = N'CHG-2026-09-0020';
DELETE FROM rd_change_head   WHERE 单据编号 = N'CHG-2026-09-0020';
DELETE FROM rd_mold_proc_detail WHERE 单据编号 IN (SELECT no FROM @made);
DELETE FROM rd_asm_proc_detail  WHERE 单据编号 IN (SELECT no FROM @made);
DELETE FROM rd_insp_plan_detail WHERE 单据编号 IN (SELECT no FROM @made);
DELETE FROM rd_spec_doc_detail  WHERE 单据编号 IN (SELECT no FROM @made);
DELETE FROM rd_mold_proc_head WHERE 单据编号 IN (SELECT no FROM @made);
DELETE FROM rd_asm_proc_head  WHERE 单据编号 IN (SELECT no FROM @made);
DELETE FROM rd_insp_plan_head WHERE 单据编号 IN (SELECT no FROM @made);
DELETE FROM rd_spec_doc_head  WHERE 单据编号 IN (SELECT no FROM @made);
SELECT N'界面探针残留' AS 检查, CAST(COUNT(*) AS nvarchar) AS n FROM rd_change_head WHERE 单据编号 = N'CHG-2026-09-0020'
UNION ALL SELECT N'生成物残留', CAST(COUNT(*) AS nvarchar) FROM @made;
