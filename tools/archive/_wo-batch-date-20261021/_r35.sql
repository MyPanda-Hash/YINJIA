SET NOCOUNT ON;
SELECT TOP 12 pl_no 工单号, pl_xc 行, CONVERT(varchar(10),pl_date,120) 单据日期,
       CONVERT(varchar(16),asp_time1,120) 转单时间, ISNULL([批次号],N'') 批次号, ISNULL(ja,N'') ja
FROM dbo.plang
WHERE pl_no LIKE N'GD-2026-09-%' AND ISNULL(asp_cancel,'N')<>'Y'
ORDER BY pl_date, pl_no, pl_xc;
GO
