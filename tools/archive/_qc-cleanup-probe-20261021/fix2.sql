SET NOCOUNT ON;
UPDATE s SET s.shr=N'冯敏', s.shsj=CONVERT(datetime, RTRIM(h.单据日期)+' 12:00:00'), s.update_at=SYSDATETIME()
FROM yj_doc_status s JOIN qc_catalog h ON h.单据编号=s.doc_no
WHERE s.panel_code='QC_CATALOG' AND h.单据编号='JYML-2026-10-0001';
GO
SELECT panel_code,doc_no,shr,shsj FROM yj_doc_status WHERE panel_code='QC_CATALOG';
GO
