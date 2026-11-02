SET NOCOUNT ON;
SELECT id, pl_no, pl_xc, ISNULL(od_no,N'') 订单号, ISNULL(od_xc,0) 订单行, ISNULL(dm,N'') 产品,
       CONVERT(varchar(10),pl_date,120) 单据日期, ISNULL(ja,N'') ja, ISNULL(asp_cancel,'N') cancel
FROM dbo.plang WHERE pl_no=N'GD-2026-09-0011' ORDER BY pl_xc, id;
GO
