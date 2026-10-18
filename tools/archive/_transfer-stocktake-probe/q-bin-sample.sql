SET NOCOUNT ON;
PRINT '=== A仓 仓位样例 ===';
SELECT TOP 8 [仓库], [仓位编码], [仓位地址], [停用] FROM bs_wh_loc WHERE [仓库]=N'A仓' AND ISNULL([asp_cancel],'N')<>'Y' ORDER BY [仓位编码];
PRINT '=== 各仓 启用仓位管理 原值 ===';
SELECT [仓库编码],[仓库名称],[启用仓位管理] FROM bs_wh WHERE [仓库编码] IN ('CK-A','CK-C','CK-D');
PRINT '=== 采购入库行是否用过仓位 ===';
SELECT COUNT(*) AS rows_total, SUM(CASE WHEN NULLIF(RTRIM([仓位编码]),'') IS NOT NULL THEN 1 ELSE 0 END) AS rows_with_bin FROM bl_purchase_in;
