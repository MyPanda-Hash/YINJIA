SET NOCOUNT ON;
SELECT ISNULL(工序名称,N'(kong)') AS op, COUNT(*) AS routes FROM dbo.bs_route WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 工序名称 ORDER BY 工序名称;
SELECT ISNULL(gxdm,N'(kong)') AS report_op, COUNT(*) AS rows_cnt FROM dbo.scjl WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY gxdm ORDER BY gxdm;
