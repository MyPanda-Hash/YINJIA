/* 清理:立项流程界面探针留下的单据(_probe-rd-flow-ui.cjs,测试账套) */
USE HSDZ_MES_TEST; SET NOCOUNT ON;
DECLARE @docs TABLE (no nvarchar(120) PRIMARY KEY);
INSERT INTO @docs (no) SELECT 单据编号 FROM rd_approval WHERE 单据编号 = N'LXA-2026-10-0005';
DELETE FROM yj_message         WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM yj_form_approval   WHERE panel_code = N'RD_APPROVAL' AND form_no IN (SELECT no FROM @docs);
DELETE FROM yj_doc_modify_log  WHERE panel_code = N'RD_APPROVAL' AND doc_no IN (SELECT no FROM @docs);
DELETE FROM yj_doc_status      WHERE panel_code = N'RD_APPROVAL' AND doc_no IN (SELECT no FROM @docs);
DELETE FROM rd_approval_detail WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM rd_approval        WHERE 单据编号 IN (SELECT no FROM @docs);
SELECT N'残留检查:rd_approval 立项单' AS 项, CAST(COUNT(*) AS nvarchar) AS 值 FROM rd_approval WHERE 单据编号 = N'LXA-2026-10-0005'
UNION ALL SELECT N'残留检查:yj_doc_status', CAST(COUNT(*) AS nvarchar) FROM yj_doc_status WHERE panel_code = N'RD_APPROVAL' AND doc_no = N'LXA-2026-10-0005';
