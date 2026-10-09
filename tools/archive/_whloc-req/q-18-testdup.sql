SET NOCOUNT ON;
PRINT N'=== 测试库 bs_wh_loc 重复的 仓位编码 ===';
SELECT 仓位编码, COUNT(*) AS 组内行数, MIN(仓库) AS 仓库, MIN(asp_user1) AS 来源
FROM dbo.bs_wh_loc GROUP BY 仓位编码 HAVING COUNT(*) > 1;
GO
PRINT N'=== 测试库 bs_wh_loc 非 CK-A 的旧行 ===';
SELECT id, 仓库, 仓库编码, 仓位编码, 仓位地址, ISNULL(asp_user1,N'(null)') AS 创建人, ISNULL(asp_cancel,N'(null)') AS 作废
FROM dbo.bs_wh_loc WHERE ISNULL(仓库编码,N'') <> N'CK-A' ORDER BY id;
GO
PRINT N'=== 测试库 bs_wh_loc 总行 / CK-A 行 ===';
SELECT COUNT(*) AS 总行, SUM(CASE WHEN 仓库编码=N'CK-A' THEN 1 ELSE 0 END) AS CK_A行 FROM dbo.bs_wh_loc;
GO