SET NOCOUNT ON;
SELECT '=== plang 里已回写入库单号 rk_no 的量 ===' AS s;
SELECT COUNT(*) AS 工单行总数,
       SUM(CASE WHEN ISNULL(rk_no, N'') <> N'' THEN 1 ELSE 0 END) AS 有入库单号,
       SUM(CASE WHEN ISNULL(pl_no, N'') <> N'' THEN 1 ELSE 0 END) AS 有工单号
  FROM dbo.plang;
GO
SELECT '=== plang.rk_no 命中的入库单(前 15) ===' AS s;
SELECT TOP 15 p.pl_no, p.pl_xc, p.dm, p.lot_no, p.pl_date, p.rk_no, p.rk_sl, p.pl_sl,
       h.单据编号 AS 入库单_编号, h.单据日期 AS 入库单_日期, h.加工单号 AS 入库单_现加工单号
  FROM dbo.plang p
  LEFT JOIN dbo.bd_finish_in h ON h.单据编号 = p.rk_no
 WHERE ISNULL(p.rk_no, N'') <> N''
 ORDER BY p.pl_date DESC, p.id DESC;
GO
SELECT '=== 入库单号(CPRK) 与 plang.rk_no 的匹配率 ===' AS s;
SELECT
  (SELECT COUNT(*) FROM dbo.bd_finish_in WHERE ISNULL(加工单号, N'') = N'') AS 待补单数,
  (SELECT COUNT(*) FROM dbo.bd_finish_in h WHERE ISNULL(h.加工单号, N'') = N''
     AND EXISTS (SELECT 1 FROM dbo.plang p WHERE p.rk_no = h.单据编号)) AS 能按_rk_no_精确命中,
  (SELECT COUNT(*) FROM dbo.bd_finish_in h WHERE ISNULL(h.加工单号, N'') = N''
     AND EXISTS (SELECT 1 FROM dbo.plang p WHERE CHARINDEX(h.单据编号, ISNULL(p.rk_no, N'')) > 0)) AS 能按_包含_命中;
GO
SELECT '=== 每张待补入库单的产品 → 是否有同名产品工单 ===' AS s;
WITH l AS (
  SELECT h.单据编号, h.单据日期, l.产品编码
    FROM dbo.bd_finish_in h JOIN dbo.bl_finish_in l ON l.单据编号 = h.单据编号
   WHERE ISNULL(h.加工单号, N'') = N''
)
SELECT COUNT(*) AS 明细行总数,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM dbo.plang p WHERE p.dm = l.产品编码) THEN 1 ELSE 0 END) AS 产品能在plang找到,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM dbo.plang p WHERE p.dm = l.产品编码 AND p.pl_date <= l.单据日期) THEN 1 ELSE 0 END) AS 产品能在plang找到且工单日期不晚于入库日
  FROM l;
GO
SELECT '=== MO-2026-09-0002 出现在哪些表 ===' AS s;
SELECT N'bd_manu_order.合同号' AS 位置, COUNT(*) AS n FROM dbo.bd_manu_order WHERE 合同号 = N'MO-2026-09-0002'
UNION ALL SELECT N'plang.pl_no', COUNT(*) FROM dbo.plang WHERE pl_no = N'MO-2026-09-0002'
UNION ALL SELECT N's_allno.dh', COUNT(*) FROM dbo.s_allno WHERE dh LIKE N'MO-2026-09-%'
UNION ALL SELECT N'scjl.工单号', COUNT(*) FROM dbo.scjl WHERE 工单号 = N'MO-2026-09-0002';
GO
SELECT '=== s_allno 里 MO 前缀 ===' AS s;
SELECT TOP 10 * FROM dbo.s_allno WHERE lb LIKE N'%MO%' OR dh LIKE N'MO-%' ORDER BY id DESC;
