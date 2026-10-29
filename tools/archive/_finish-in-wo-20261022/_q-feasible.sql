SET NOCOUNT ON;
SELECT '=== 日期范围 ===' AS s;
SELECT '入库单' AS 对象, MIN(单据日期) AS 最早, MAX(单据日期) AS 最晚, COUNT(*) AS 行
  FROM dbo.bd_finish_in WHERE ISNULL(加工单号, N'') = N''
UNION ALL SELECT '工单(plang.pl_date)', MIN(pl_date), MAX(pl_date), COUNT(*) FROM dbo.plang
UNION ALL SELECT '工单(plang.st_date)', MIN(st_date), MAX(st_date), COUNT(*) FROM dbo.plang
UNION ALL SELECT '工单(plang.cp_date)', MIN(cp_date), MAX(cp_date), COUNT(*) FROM dbo.plang;
GO
SELECT '=== 工单数量列是否可信 ===' AS s;
SELECT COUNT(*) AS 工单行,
       SUM(CASE WHEN ISNULL(pl_sl, 0) > 0 THEN 1 ELSE 0 END) AS 有排产数量,
       SUM(CASE WHEN ISNULL(rk_sl, 0) > 0 THEN 1 ELSE 0 END) AS 有入库数量,
       SUM(CASE WHEN ISNULL(ypl_sl, 0) > 0 THEN 1 ELSE 0 END) AS 有已排产数量,
       SUM(CASE WHEN ISNULL(lot_no, N'') <> N'' THEN 1 ELSE 0 END) AS 有批号
  FROM dbo.plang;
GO
SELECT '=== 待补入库明细：产品能否在 plang 找到、且工单日期 <= 入库日期 ===' AS s;
WITH r AS (
  SELECT h.单据编号, h.单据日期, l.产品编码, l.实收数量
    FROM dbo.bd_finish_in h JOIN dbo.bl_finish_in l ON l.单据编号 = h.单据编号
   WHERE ISNULL(h.加工单号, N'') = N''
), m AS (
  SELECT r.单据编号, r.单据日期, r.产品编码, r.实收数量,
         (SELECT COUNT(*) FROM dbo.plang p WHERE p.dm = r.产品编码) AS 工单数,
         (SELECT COUNT(*) FROM dbo.plang p WHERE p.dm = r.产品编码 AND p.pl_date <= r.单据日期) AS 不晚于入库日工单数,
         (SELECT COUNT(*) FROM dbo.plang p WHERE p.dm = r.产品编码
             AND p.pl_date <= r.单据日期 AND p.pl_date >= DATEADD(day, -120, r.单据日期)) AS 近120天工单数
    FROM r
)
SELECT COUNT(*) AS 明细行,
       SUM(CASE WHEN 工单数 > 0 THEN 1 ELSE 0 END) AS 产品有工单,
       SUM(CASE WHEN 不晚于入库日工单数 > 0 THEN 1 ELSE 0 END) AS 工单不晚于入库日,
       SUM(CASE WHEN 近120天工单数 > 0 THEN 1 ELSE 0 END) AS 近120天有工单
  FROM m;
GO
SELECT '=== 单产品入库单：能唯一锁定工单的比例 ===' AS s;
WITH r AS (
  SELECT h.单据编号, h.单据日期, MIN(l.产品编码) AS 产品编码, COUNT(DISTINCT l.产品编码) AS 产品数,
         SUM(l.实收数量) AS 数量
    FROM dbo.bd_finish_in h JOIN dbo.bl_finish_in l ON l.单据编号 = h.单据编号
   WHERE ISNULL(h.加工单号, N'') = N''
   GROUP BY h.单据编号, h.单据日期
), c AS (
  SELECT r.*,
    (SELECT COUNT(*) FROM dbo.plang p
      WHERE p.dm = r.产品编码 AND p.pl_date <= r.单据日期
        AND p.pl_date >= DATEADD(day, -120, r.单据日期)) AS 候选数
  FROM r WHERE r.产品数 = 1
)
SELECT COUNT(*) AS 单产品单数,
       SUM(CASE WHEN 候选数 = 0 THEN 1 ELSE 0 END) AS 无候选,
       SUM(CASE WHEN 候选数 = 1 THEN 1 ELSE 0 END) AS 唯一候选,
       SUM(CASE WHEN 候选数 > 1 THEN 1 ELSE 0 END) AS 多候选
  FROM c;
