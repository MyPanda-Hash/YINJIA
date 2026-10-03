-- _restore-qc-catalog-doc-20260928.sql — 检验目录主单被误作废修复
-- 现象:2026-09-24 12:14:25 JYML-2026-09-0001 被标 canceled='Y'(疑似误点作废;表行 qc_catalog.asp_cancel='N' 一直存活,
--       生单联动照常写入 18-36 行),而 QueryService 列表按 NOT EXISTS(...canceled='Y') 排除废单 ⇒ 界面整目录隐形。
-- 修复:恢复 canceled='N'、saved='Y'(与 QcCatalogService.mergeStatus(saved=true) 口径一致)。幂等可重跑。
UPDATE yj_doc_status
SET canceled = 'N', saved = 'Y', update_at = GETDATE()
WHERE panel_code = 'QC_CATALOG' AND doc_no = N'JYML-2026-09-0001' AND canceled = 'Y'
GO
SELECT panel_code, doc_no, canceled, saved, CONVERT(varchar(19), update_at, 120) AS upd
FROM yj_doc_status WHERE panel_code = 'QC_CATALOG' AND doc_no = N'JYML-2026-09-0001'
GO
