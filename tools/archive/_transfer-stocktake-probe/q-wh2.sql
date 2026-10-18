SET NOCOUNT ON;
PRINT '=== 仓库:仓位管理开关 + 该仓库存行数/总量 + 仓位档案数 ===';
SELECT w.[仓库编码], w.[仓库名称], w.[启用仓位管理],
       (SELECT COUNT(*) FROM kucun k WHERE k.ckdm=w.[仓库编码] AND ISNULL(k.yl,0)>0) AS 有货行,
       (SELECT ISNULL(SUM(k.yl),0) FROM kucun k WHERE k.ckdm=w.[仓库编码]) AS 总量,
       (SELECT COUNT(*) FROM bs_wh_loc l WHERE l.[仓库]=w.[仓库名称] AND ISNULL(l.[asp_cancel],'N')<>'Y') AS 仓位数
FROM bs_wh w ORDER BY 有货行 DESC;
