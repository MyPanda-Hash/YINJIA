SET NOCOUNT ON;
SELECT COUNT(*) AS 合计,
       SUM(CASE WHEN CAST([完工时间] AS date)=DATEADD(day,3,CAST(pl_date AS date)) THEN 1 ELSE 0 END) AS 完工等于加3,
       SUM(CASE WHEN [完工时间] IS NULL THEN 1 ELSE 0 END) AS 无完工时间,
       SUM(CASE WHEN CAST([完工时间] AS date)<>DATEADD(day,3,CAST(pl_date AS date)) AND [完工时间] IS NOT NULL THEN 1 ELSE 0 END) AS 不一致
FROM dbo.plang WHERE ISNULL([完工状态],N'')=N'生产完工' AND ISNULL(asp_cancel,'N')<>'Y';
GO
SELECT TOP 10 pl_no,pl_xc,CONVERT(varchar(19),pl_date,120) 单据日期,CONVERT(varchar(19),[完工时间],120) 完工时间,ISNULL([批次号],N'') 批次号
FROM dbo.plang WHERE ISNULL([完工状态],N'')=N'生产完工' AND ISNULL(asp_cancel,'N')<>'Y'
  AND (CAST([完工时间] AS date)<>DATEADD(day,3,CAST(pl_date AS date)) OR [完工时间] IS NULL);
GO
-- 这些工单的 入库单/报工单 是否已记库存流水(按单据编号)
SELECT COUNT(*) AS inh_fi FROM dbo.inh i WHERE i.单据编号 LIKE N'FI-%' AND i.单据类型=N'产成品入库单';
GO
