/* 探针清理:立项申请项目定级验收(_probe-approval-grade.cjs) */
USE HSDZ_MES; SET NOCOUNT ON;
DECLARE @docs TABLE (no nvarchar(120) PRIMARY KEY);
INSERT INTO @docs (no) SELECT 单据编号 FROM rd_approval WHERE 文档编号 = N'PROBE-GRADE-57617';
DELETE FROM yj_message        WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM yj_form_approval  WHERE panel_code = N'RD_APPROVAL' AND form_no IN (SELECT no FROM @docs);
DELETE FROM yj_doc_modify_log WHERE panel_code = N'RD_APPROVAL' AND doc_no IN (SELECT no FROM @docs);
DELETE FROM yj_doc_status     WHERE panel_code = N'RD_APPROVAL' AND doc_no IN (SELECT no FROM @docs);
DELETE FROM rd_approval_detail WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM rd_approval        WHERE 单据编号 IN (SELECT no FROM @docs);
SELECT N'立项申请残留' AS 检查, CAST(COUNT(*) AS nvarchar) AS n FROM rd_approval WHERE 文档编号 = N'PROBE-GRADE-57617';
