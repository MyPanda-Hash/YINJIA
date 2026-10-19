SET NOCOUNT ON;

PRINT N'== 1. kucun(库存台账真源) 总量与正负分布 ==';
SELECT COUNT(*) AS 行数,
       SUM(CASE WHEN ISNULL(yl,0) < -0.0001 THEN 1 ELSE 0 END) AS 负结存行,
       SUM(CASE WHEN ISNULL(yl,0) > 0.0001 THEN 1 ELSE 0 END) AS 正结存行,
       SUM(CASE WHEN ABS(ISNULL(yl,0)) <= 0.0001 THEN 1 ELSE 0 END) AS 零结存行,
       CAST(SUM(ISNULL(yl,0)) AS decimal(18,4)) AS 余量合计,
       CAST(MIN(yl) AS decimal(18,4)) AS 最小余量,
       CAST(MAX(yl) AS decimal(18,4)) AS 最大余量
FROM dbo.kucun;

PRINT N'== 2. 负结存行按 仓库 汇总 ==';
SELECT TOP 20 ISNULL(ckdm,N'(空)') AS 仓库编码, COUNT(*) AS 负行数, CAST(SUM(yl) AS decimal(18,4)) AS 负余量
FROM dbo.kucun WHERE ISNULL(yl,0) < -0.0001
GROUP BY ckdm ORDER BY SUM(yl);

PRINT N'== 3. 负结存行按 批号 分类(PC0000 / 空 / 真实批号) ==';
SELECT CASE WHEN ISNULL(lot_no,N'')=N'' THEN N'(空批号)'
            WHEN lot_no=N'PC0000' THEN N'PC0000'
            ELSE N'真实批号' END AS 批号类别,
       COUNT(*) AS 行数,
       SUM(CASE WHEN ISNULL(yl,0)<-0.0001 THEN 1 ELSE 0 END) AS 负行数,
       CAST(SUM(ISNULL(yl,0)) AS decimal(18,4)) AS 余量合计
FROM dbo.kucun GROUP BY CASE WHEN ISNULL(lot_no,N'')=N'' THEN N'(空批号)' WHEN lot_no=N'PC0000' THEN N'PC0000' ELSE N'真实批号' END;

PRINT N'== 4. kucun 台账自洽: yl 与 rkl-ckl 差异行 ==';
SELECT COUNT(*) AS 不一致行数,
       CAST(SUM(ABS(ISNULL(yl,0)-(ISNULL(rkl,0)-ISNULL(ckl,0)))) AS decimal(18,4)) AS 差异绝对值和
FROM dbo.kucun WHERE ABS(ISNULL(yl,0)-(ISNULL(rkl,0)-ISNULL(ckl,0))) > 0.0001;

PRINT N'== 5. 负结存行按 存货 汇总 TOP 15 ==';
SELECT TOP 15 wzdm AS 存货编码, COUNT(*) AS 负行数, CAST(SUM(yl) AS decimal(18,4)) AS 负余量
FROM dbo.kucun WHERE ISNULL(yl,0) < -0.0001
GROUP BY wzdm ORDER BY SUM(yl);
