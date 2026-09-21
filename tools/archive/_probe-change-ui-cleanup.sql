/* 探针清理:产品变更申请单 界面验收(_probe-change-ui.cjs) */
USE HSDZ_MES; SET NOCOUNT ON;
DELETE FROM yj_message WHERE 单据编号 = N'CHG-2026-09-0018';
DELETE FROM yj_form_approval WHERE panel_code = N'RD_CHANGE' AND form_no = N'CHG-2026-09-0018';
DELETE FROM yj_doc_status WHERE panel_code = N'RD_CHANGE' AND doc_no = N'CHG-2026-09-0018';
DELETE FROM rd_change_detail WHERE 单据编号 = N'CHG-2026-09-0018';
DELETE FROM rd_change_head   WHERE 单据编号 = N'CHG-2026-09-0018';
SELECT N'界面探针残留' AS 检查, CAST(COUNT(*) AS nvarchar) AS n FROM rd_change_head WHERE 单据编号 = N'CHG-2026-09-0018';
