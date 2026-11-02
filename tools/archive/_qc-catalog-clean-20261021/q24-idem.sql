SET NOCOUNT ON;
SELECT (SELECT COUNT(*) FROM qc_catalog_detail WHERE ISNULL(asp_cancel,'N')<>'Y') cat,
       (SELECT COUNT(*) FROM qc_insp_rec WHERE ISNULL(asp_cancel,'N')<>'Y') rec;
