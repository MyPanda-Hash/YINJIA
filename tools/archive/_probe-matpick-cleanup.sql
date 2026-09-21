/* 探针清理:物料清单引用验收(_probe-matpick.cjs) */
USE HSDZ_MES; SET NOCOUNT ON;
DECLARE @docs TABLE (no nvarchar(120) PRIMARY KEY);
INSERT INTO @docs (no) SELECT 单据编号 FROM rd_spec_doc_head WHERE 单据编号 IN (N'SD-2026-09-0032',N'SD-2026-09-0033',N'SD-2026-09-0034',N'SD-2026-09-0032');
DELETE FROM yj_message         WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM yj_form_approval   WHERE panel_code = N'RD_SPEC_DOC' AND form_no IN (SELECT no FROM @docs);
DELETE FROM yj_doc_modify_log  WHERE panel_code = N'RD_SPEC_DOC' AND doc_no IN (SELECT no FROM @docs);
DELETE FROM yj_doc_status      WHERE panel_code = N'RD_SPEC_DOC' AND doc_no IN (SELECT no FROM @docs);
DELETE FROM rd_spec_doc_detail WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM rd_spec_doc_head   WHERE 单据编号 IN (SELECT no FROM @docs);
SELECT N'规格书残留' AS 检查, CAST(COUNT(*) AS nvarchar) AS n FROM rd_spec_doc_head WHERE 单据编号 IN (N'SD-2026-09-0032',N'SD-2026-09-0033',N'SD-2026-09-0034',N'SD-2026-09-0032');
