SET NOCOUNT ON;
SELECT TOP 8 单据编号, ISNULL(工单号,N'(kong)') AS wo, ISNULL(工单行号,0) AS xc, ISNULL(工序,N'') AS op,
 ISNULL(报工单号,N'') AS rep, ISNULL(批次号,N'') AS batch, ISNULL(产品编码,N'') AS dm, CONVERT(varchar(10),asp_time1,120) AS created
FROM dbo.qc_first_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
