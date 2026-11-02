SET NOCOUNT ON;
UPDATE s
SET shsj = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'China Standard Time' AS datetime2),
    update_at = GETDATE()
FROM yj_doc_status s
WHERE s.panel_code = N'QC_INSP'
  AND s.doc_no IN (N'IJ-2026-09-0152', N'IJ-2026-10-0001', N'IJ-2026-10-0200');
SELECT doc_no, shr, shsj, saved FROM yj_doc_status WHERE panel_code='QC_INSP' AND doc_no IN (N'IJ-2026-09-0152',N'IJ-2026-10-0001',N'IJ-2026-10-0200') ORDER BY doc_no;
