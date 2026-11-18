/* 清理验收夹具(测试账套):删两张草稿的 头/行/状态/审批留痕,并把 T410 开关还原为 0 */
SET NOCOUNT ON;

DELETE FROM dbo.bl_finish_in WHERE 单据编号 IN (N'FI-GATE-QTY-A', N'FI-GATE-QTY-B');
DELETE FROM dbo.yj_form_approval WHERE panel_code = N'FINISH_IN' AND form_no IN (N'FI-GATE-QTY-A', N'FI-GATE-QTY-B');
DELETE FROM dbo.yj_doc_status WHERE panel_code = N'FINISH_IN' AND doc_no IN (N'FI-GATE-QTY-A', N'FI-GATE-QTY-B');
DELETE FROM dbo.bd_finish_in WHERE 单据编号 IN (N'FI-GATE-QTY-A', N'FI-GATE-QTY-B');
UPDATE dbo.bs_inv SET [是否过程检验] = 0 WHERE LTRIM(RTRIM(存货编码)) = N'T410';

SELECT 'left-heads' AS chk, COUNT(*) AS v FROM dbo.bd_finish_in WHERE 单据编号 IN (N'FI-GATE-QTY-A', N'FI-GATE-QTY-B')
UNION ALL SELECT 'left-lines', COUNT(*) FROM dbo.bl_finish_in WHERE 单据编号 IN (N'FI-GATE-QTY-A', N'FI-GATE-QTY-B')
UNION ALL SELECT 'left-status', COUNT(*) FROM dbo.yj_doc_status WHERE panel_code = N'FINISH_IN' AND doc_no IN (N'FI-GATE-QTY-A', N'FI-GATE-QTY-B')
UNION ALL SELECT 'left-trail', COUNT(*) FROM dbo.yj_form_approval WHERE panel_code = N'FINISH_IN' AND form_no IN (N'FI-GATE-QTY-A', N'FI-GATE-QTY-B')
UNION ALL SELECT 't410-flag-restored', CAST(ISNULL(MAX(CAST([是否过程检验] AS int)), 0) AS int) FROM dbo.bs_inv WHERE LTRIM(RTRIM(存货编码)) = N'T410';
