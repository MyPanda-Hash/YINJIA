SET NOCOUNT ON;
GO
PRINT '=== 正式账套:号池里 MQ 的取号时间 ===';
SELECT comm, dh, lb, ny, asp_user1, CONVERT(varchar(19), asp_time1, 120) AS 取号时间 FROM s_allno WHERE lb = N'MQ' ORDER BY id;
GO
PRINT '=== 测试账套:号池里 MQ 的取号时间 ===';
SELECT comm, dh, lb, ny, asp_user1, CONVERT(varchar(19), asp_time1, 120) AS 取号时间 FROM HSDZ_MES_TEST.dbo.s_allno WHERE lb = N'MQ' ORDER BY id;
GO
PRINT '=== 正式账套:最近 20 条登录/使用日志(看是谁在 16:5x 登的、哪个账套)===';
SELECT TOP 20 * FROM yj_usage_log ORDER BY id DESC;
GO
PRINT '=== 正式账套:该订单是否已按此批次号生过单 ===';
SELECT TOP 5 单据编号, 批次号, ISNULL(asp_cancel,'N') AS asp_cancel, CONVERT(varchar(19), asp_time1, 120) AS 建单时间
FROM sl_recv WHERE 批次号 = N'HDN-20261003' OR 采购订单号 = N'YJ-20260916-03' ORDER BY id DESC;
GO
