SET NOCOUNT ON;
SELECT 'HSDZ_MES' AS db, TABLE_NAME, DATA_TYPE, NUMERIC_PRECISION, NUMERIC_SCALE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME IN ('bl_pu_order','bl_so_order') AND COLUMN_NAME = N'行号';
GO
SELECT TOP 5 id, N'[' + CAST(行号 AS nvarchar(50)) + N']' AS 值 FROM bl_pu_order ORDER BY id DESC;
GO
SELECT TOP 5 id, N'[' + CAST(行号 AS nvarchar(50)) + N']' AS 值 FROM bl_so_order ORDER BY id DESC;
GO
SELECT TOP 5 id, N'[' + CAST(采购订单行号 AS nvarchar(50)) + N']' AS 采购订单行号值 FROM sl_recv_detail ORDER BY id DESC;
GO
SELECT TOP 5 id, N'[' + CAST(行号 AS nvarchar(50)) + N']' AS 值 FROM bl_purchase_in ORDER BY id DESC;
