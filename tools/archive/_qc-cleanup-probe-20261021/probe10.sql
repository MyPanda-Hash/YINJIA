SET NOCOUNT ON;
SELECT '=== std lib cols ===' AS x;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('yj_std_lib') ORDER BY c.column_id;
GO
SELECT TOP 50 * FROM yj_std_lib WHERE lib_code='qc.insp_item' ORDER BY seq,id;
GO
SELECT '=== max seqs ===' AS x;
SELECT 'IJ allno' p, MAX(CAST(RIGHT(dh,4) AS int)) m FROM s_allno WHERE lb='IJ' AND dh LIKE 'IJ-2026-10-%'
UNION ALL SELECT 'IJ docs', MAX(CAST(RIGHT(RTRIM(单据编号),4) AS int)) FROM qc_insp WHERE 单据编号 LIKE 'IJ-2026-10-%'
UNION ALL SELECT 'JYML allno', MAX(CAST(RIGHT(dh,4) AS int)) FROM s_allno WHERE lb='JYML' AND dh LIKE 'JYML-2026-10-%'
UNION ALL SELECT 'JYSJ allno', MAX(CAST(RIGHT(dh,4) AS int)) FROM s_allno WHERE lb='JYSJ' AND dh LIKE 'JYSJ-2026-10-%'
UNION ALL SELECT 'JYSJ docs', MAX(CAST(RIGHT(RTRIM(单据编号),4) AS int)) FROM qc_insp_rec WHERE 单据编号 LIKE 'JYSJ-2026-10-%'
UNION ALL SELECT 'TH allno', MAX(CAST(RIGHT(dh,4) AS int)) FROM s_allno WHERE lb='TH' AND dh LIKE 'TH-2026-10-%'
UNION ALL SELECT 'TH docs', MAX(CAST(RIGHT(RTRIM(单据编号),4) AS int)) FROM qc_return WHERE 单据编号 LIKE 'TH-2026-10-%';
GO
SELECT '=== rec status examples ===' AS x;
SELECT * FROM yj_doc_status WHERE panel_code='QC_INSP_REC' ORDER BY doc_no;
GO
