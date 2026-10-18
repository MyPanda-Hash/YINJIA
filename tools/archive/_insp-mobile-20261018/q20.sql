SET NOCOUNT ON;
SELECT 'QC_FIRST_INSP' AS 面板, COUNT(*) AS 行数, SUM(CASE WHEN ISNULL(asp_cancel,'N')<>'Y' THEN 1 ELSE 0 END) AS 存活 FROM dbo.qc_first_insp_head
UNION ALL SELECT 'QC_PROC_INSP', COUNT(*), SUM(CASE WHEN ISNULL(asp_cancel,'N')<>'Y' THEN 1 ELSE 0 END) FROM dbo.qc_proc_insp_head
UNION ALL SELECT 'QC_ASM_INSP', COUNT(*), SUM(CASE WHEN ISNULL(asp_cancel,'N')<>'Y' THEN 1 ELSE 0 END) FROM dbo.qc_asm_insp_head;
GO
SELECT id, gldh, gxdm, sl, [报工单号], [工单行号], gd_id, sc_date
FROM dbo.scjl
WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(delmark,0)=0 AND ISNULL(wgzt,'N')='Y'
  AND (sc_date IS NULL OR sc_date >= DATEADD(day,-3,CAST(GETDATE() AS date)))
ORDER BY id DESC;
GO
