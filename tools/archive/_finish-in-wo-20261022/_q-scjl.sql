SET NOCOUNT ON;
SELECT '=== scjl 概况 ===' AS s;
SELECT COUNT(*) AS 行, MIN(sc_date) AS 最早, MAX(sc_date) AS 最晚,
       SUM(CASE WHEN ISNULL(gldh, N'') <> N'' THEN 1 ELSE 0 END) AS 有工单号码,
       COUNT(DISTINCT gldh) AS 工单数, COUNT(DISTINCT wzdm) AS 物料数
  FROM dbo.scjl;
GO
SELECT '=== scjl.gldh 形态(前 8) ===' AS s;
SELECT TOP 8 id, sc_no, gldh, gd_id, wzdm, mc, sc_date, lot_no, gxdm, sl
  FROM dbo.scjl ORDER BY sc_date DESC, id DESC;
GO
SELECT '=== 待补入库单的产品+日期 能否在 scjl 里找到同物料同日/近日报工 ===' AS s;
WITH r AS (
  SELECT h.单据编号, h.单据日期, l.产品编码
    FROM dbo.bd_finish_in h JOIN dbo.bl_finish_in l ON l.单据编号 = h.单据编号
   WHERE ISNULL(h.加工单号, N'') = N''
), m AS (
  SELECT r.*,
    (SELECT COUNT(DISTINCT s.gldh) FROM dbo.scjl s
      WHERE s.wzdm = r.产品编码 AND ISNULL(s.gldh, N'') <> N''
        AND CAST(s.sc_date AS date) = r.单据日期) AS 同日工单数,
    (SELECT COUNT(DISTINCT s.gldh) FROM dbo.scjl s
      WHERE s.wzdm = r.产品编码 AND ISNULL(s.gldh, N'') <> N''
        AND CAST(s.sc_date AS date) BETWEEN DATEADD(day, -30, r.单据日期) AND r.单据日期) AS 近30天工单数
  FROM r
)
SELECT COUNT(*) AS 明细行, SUM(CASE WHEN 同日工单数 > 0 THEN 1 ELSE 0 END) AS 同日命中,
       SUM(CASE WHEN 近30天工单数 > 0 THEN 1 ELSE 0 END) AS 近30天命中
  FROM m;
GO
SELECT '=== 每张待补入库单的产品数分布 ===' AS s;
SELECT 产品数, COUNT(*) AS 单数 FROM (
  SELECT h.单据编号, COUNT(DISTINCT l.产品编码) AS 产品数
    FROM dbo.bd_finish_in h JOIN dbo.bl_finish_in l ON l.单据编号 = h.单据编号
   WHERE ISNULL(h.加工单号, N'') = N''
   GROUP BY h.单据编号) t
 GROUP BY 产品数 ORDER BY 产品数;
