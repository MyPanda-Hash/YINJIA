/* bl_sale_out.仓库 列误删恢复:重建列 + 从 仓库编码 经 bs_wh 还原名称(123/123 有编码,可全量还原) */
SET NOCOUNT ON;
IF COL_LENGTH('dbo.bl_sale_out', N'仓库') IS NULL
    ALTER TABLE bl_sale_out ADD [仓库] nvarchar(1000) NULL;
GO
UPDATE l SET l.[仓库] = w.[仓库名称]
  FROM bl_sale_out l JOIN bs_wh w ON RTRIM(LTRIM(CAST(l.[仓库编码] AS nvarchar(200)))) = RTRIM(LTRIM(CAST(w.[仓库编码] AS nvarchar(200))))
 WHERE ISNULL(l.[仓库], N'') = N'';
SELECT COUNT(*) AS 总行,
       SUM(CASE WHEN [仓库] IS NOT NULL AND [仓库]<>'' THEN 1 ELSE 0 END) AS 还原后有仓库,
       SUM(CASE WHEN [仓库编码] IS NOT NULL AND [仓库编码]<>'' THEN 1 ELSE 0 END) AS 有仓库编码,
       SUM(CASE WHEN [仓库] IS NOT NULL AND [仓库]<>'' AND ([仓库编码] IS NULL OR [仓库编码]='') THEN 1 ELSE 0 END) AS 有名无码
  FROM bl_sale_out;
GO
