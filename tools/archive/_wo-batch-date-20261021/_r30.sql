SET NOCOUNT ON;
SELECT id, pl_no, pl_xc, CONVERT(varchar(19),pl_date,120) 单据日期, CONVERT(varchar(19),asp_time1,120) 创建,
       ISNULL(asp_user1,N'') 创建人, ISNULL(asp_user2,N'') 修改人, CONVERT(varchar(19),asp_time2,120) 修改时间,
       ISNULL(od_no,N'') 订单号, ISNULL(dm,N'') 产品, ISNULL(mc,N'') 品名, ISNULL([批次号],N'') 批次号,
       ISNULL([完工状态],N'') 完工状态, ISNULL(ja,N'') ja, pl_sl, rk_sl, ISNULL(asp_cancel,'N') cancel,
       ISNULL(源工单号,N'') 源工单号, ISNULL(根工单号,N'') 根工单号
FROM dbo.plang WHERE id=1132 OR (pl_no=N'GD-2026-09-0011' AND pl_xc=2);
GO
SELECT COUNT(*) AS 该号行数 FROM dbo.plang WHERE pl_no=N'GD-2026-09-0011';
GO
