SET NOCOUNT ON;
-- G) 「2号车间」等 wo_process_line 线名是否在 bs_prod_line 档案
SELECT DISTINCT wl.线名, CASE WHEN bl.生产线 IS NULL THEN N'不在档案' ELSE N'在档案' END AS 判定
FROM (SELECT COALESCE(NULLIF(实际生产线,N''), 计划生产线) AS 线名 FROM dbo.wo_process_line WHERE ISNULL(asp_cancel,'N')<>'Y') wl
LEFT JOIN dbo.bs_prod_line bl ON bl.生产线 = wl.线名 AND ISNULL(bl.asp_cancel,'N')<>'Y'
WHERE wl.线名 <> N'';
