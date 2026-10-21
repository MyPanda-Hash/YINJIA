SET NOCOUNT ON;
SELECT '=== 入库明细的产品名称是否有值 ===' AS s;
SELECT COUNT(*) AS 行, SUM(CASE WHEN ISNULL(l.产品名称, N'') <> N'' THEN 1 ELSE 0 END) AS 有名称
  FROM dbo.bl_finish_in l WHERE l.单据编号 IN (SELECT 单据编号 FROM dbo.bd_finish_in WHERE ISNULL(加工单号, N'') = N'');
GO
SELECT '=== 未匹配产品能否靠"名称"或"商品档案"接到工单 ===' AS s;
IF OBJECT_ID('tempdb..#un') IS NOT NULL DROP TABLE #un;
SELECT DISTINCT RTRIM(LTRIM(l.产品编码)) AS 产品编码
  INTO #un
  FROM dbo.bl_finish_in l
 WHERE l.单据编号 IN (SELECT 单据编号 FROM dbo.bd_finish_in WHERE ISNULL(加工单号, N'') = N'')
   AND NOT EXISTS (SELECT 1 FROM dbo.plang p WHERE RTRIM(LTRIM(p.dm)) = RTRIM(LTRIM(l.产品编码)));

SELECT COUNT(*) AS 未匹配产品数,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM dbo.bs_inv i WHERE i.存货编码 = u.产品编码) THEN 1 ELSE 0 END) AS 商品档案有,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM dbo.plang p JOIN dbo.bs_inv i ON i.存货名称 = p.mc
                              WHERE i.存货编码 = u.产品编码) THEN 1 ELSE 0 END) AS 按名称能接到工单,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM dbo.plang p
                              WHERE p.dm LIKE RTRIM(LTRIM(u.产品编码)) + N'%'
                                 OR RTRIM(LTRIM(u.产品编码)) LIKE p.dm + N'%') THEN 1 ELSE 0 END) AS 前缀能对上工单
  FROM #un u;
GO
SELECT '=== 未匹配产品清单（前 30，带商品名称） ===' AS s;
SELECT TOP 30 u.产品编码, (SELECT TOP 1 i.存货名称 FROM dbo.bs_inv i WHERE i.存货编码 = u.产品编码) AS 存货名称,
       (SELECT COUNT(*) FROM dbo.bl_finish_in l WHERE RTRIM(LTRIM(l.产品编码)) = u.产品编码) AS 出现行数
  FROM #un u ORDER BY 出现行数 DESC;
