/* 探针清理:产品变更申请单按部门门禁验收(_probe-change-gate.cjs) */
USE HSDZ_MES; SET NOCOUNT ON;
DELETE FROM yj_message      WHERE 单据编号 = N'CHG-2026-09-0021';
DELETE FROM yj_doc_status   WHERE panel_code = N'RD_CHANGE' AND doc_no = N'CHG-2026-09-0021';
DELETE FROM rd_change_detail WHERE 单据编号 = N'CHG-2026-09-0021';
DELETE FROM rd_change_head   WHERE 单据编号 = N'CHG-2026-09-0021';
DELETE FROM yj_user WHERE username = N'probe-nodept';
SELECT N'变更单残留' AS 检查, CAST(COUNT(*) AS nvarchar) AS n FROM rd_change_head WHERE 单据编号 = N'CHG-2026-09-0021';
