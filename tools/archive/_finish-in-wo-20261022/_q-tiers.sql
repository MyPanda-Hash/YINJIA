SET NOCOUNT ON;
SELECT '=== 工单号/行结构 ===' AS s;
SELECT COUNT(*) AS 工单行, COUNT(DISTINCT pl_no) AS 工单号数,
       MAX(c) AS 单工单最多行数
  FROM (SELECT pl_no, COUNT(*) AS c FROM dbo.plang GROUP BY pl_no) t;
GO
SELECT '=== 同一工单号下多行样例 ===' AS s;
SELECT TOP 12 p.pl_no, p.pl_xc, p.dm, p.mc, p.pl_sl, p.pl_date, p.cp_date
  FROM dbo.plang p
 WHERE p.pl_no IN (SELECT pl_no FROM dbo.plang GROUP BY pl_no HAVING COUNT(*) > 1)
 ORDER BY p.pl_no DESC, p.pl_xc;
GO
SELECT '=== 入库单日期 vs 工单日期（同日是否普遍） ===' AS s;
WITH r AS (SELECT h.id, h.单据编号, h.单据日期 FROM dbo.bd_finish_in h WHERE ISNULL(h.加工单号, N'') = N'')
SELECT COUNT(*) AS 待补单数,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM dbo.plang p WHERE CAST(p.pl_date AS date) = r.单据日期) THEN 1 ELSE 0 END) AS 当天有工单,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM dbo.plang p WHERE CAST(p.pl_date AS date) BETWEEN DATEADD(day,-1,r.单据日期) AND r.单据日期) THEN 1 ELSE 0 END) AS 当天或前一天有工单
  FROM r;
GO
SELECT '=== 分层可行性：每张待补单的候选工单数（同物料, pl_date<=入库日, 120天窗口） ===' AS s;
WITH r AS (
  SELECT h.单据编号, h.单据日期,
         COUNT(DISTINCT l.产品编码) AS 产品数,
         (SELECT TOP 1 l2.产品编码 FROM dbo.bl_finish_in l2 WHERE l2.单据编号 = h.单据编号
           GROUP BY l2.产品编码 ORDER BY SUM(l2.实收数量) DESC, l2.产品编码) AS 主产品
    FROM dbo.bd_finish_in h JOIN dbo.bl_finish_in l ON l.单据编号 = h.单据编号
   WHERE ISNULL(h.加工单号, N'') = N''
   GROUP BY h.单据编号, h.单据日期
), c AS (
  SELECT r.*,
    (SELECT COUNT(DISTINCT p.pl_no) FROM dbo.plang p
      WHERE p.dm = r.主产品 AND p.pl_date <= r.单据日期
        AND p.pl_date >= DATEADD(day, -120, r.单据日期)) AS 主产品候选工单数
  FROM r
)
SELECT CASE WHEN 产品数 = 1 THEN N'单产品' ELSE N'多产品' END AS 类别,
       COUNT(*) AS 单数,
       SUM(CASE WHEN 主产品候选工单数 = 0 THEN 1 ELSE 0 END) AS 无候选,
       SUM(CASE WHEN 主产品候选工单数 = 1 THEN 1 ELSE 0 END) AS 唯一候选,
       SUM(CASE WHEN 主产品候选工单数 > 1 THEN 1 ELSE 0 END) AS 多候选
  FROM c GROUP BY CASE WHEN 产品数 = 1 THEN N'单产品' ELSE N'多产品' END;
