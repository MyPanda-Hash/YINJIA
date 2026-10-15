-- q-14-kucun-joins.sql — KUCUN 与档案/流水的对账(做「库存明细」报表前必须知道的可 join 率)
SET NOCOUNT ON;
SELECT N'仓库档案 bs_wh' AS k, COUNT(*) AS 行数, COUNT(DISTINCT 仓库编码) AS 编码数, COUNT(DISTINCT 仓库名称) AS 名称数 FROM bs_wh;
GO
SELECT N'kucun.ckdm 落在 bs_wh 的比率' AS k,
       COUNT(*) AS kucun行数,
       SUM(CASE WHEN w.仓库编码 IS NOT NULL THEN 1 ELSE 0 END) AS 命中档案,
       SUM(CASE WHEN w.仓库编码 IS NULL THEN 1 ELSE 0 END) AS 未命中
FROM kucun k
OUTER APPLY (SELECT TOP 1 仓库编码, 仓库名称 FROM bs_wh WHERE 仓库编码 = k.ckdm ORDER BY id) w;
GO
SELECT N'kucun.ckdm 取值' AS k, k.ckdm, COUNT(*) AS 行数, MAX(w.仓库名称) AS 档案名
FROM kucun k
OUTER APPLY (SELECT TOP 1 仓库名称 FROM bs_wh WHERE 仓库编码 = k.ckdm ORDER BY id) w
GROUP BY k.ckdm ORDER BY 行数 DESC;
GO
SELECT N'kucun.wzdm 落在 bs_inv 的比率' AS k,
       COUNT(*) AS kucun行数,
       SUM(CASE WHEN i.存货编码 IS NOT NULL THEN 1 ELSE 0 END) AS 命中档案,
       SUM(CASE WHEN i.存货编码 IS NULL THEN 1 ELSE 0 END) AS 未命中
FROM kucun k
OUTER APPLY (SELECT TOP 1 存货编码, 存货名称, 规格型号 FROM bs_inv WHERE 存货编码 = k.wzdm ORDER BY 存货编码) i;
GO
SELECT N'流水合计 vs 结存' AS k,
       (SELECT SUM(数量) FROM inh) AS inh合计,
       (SELECT SUM(数量) FROM inh WHERE src = 0) AS inh期初,
       (SELECT SUM(数量) FROM outh) AS outh合计,
       (SELECT SUM(ISNULL(yl,0)) FROM kucun) AS kucun现存量;
GO
SELECT N'ihn 段号分布' AS k, src, 单据类型, COUNT(*) AS 行数, SUM(数量) AS 数量 FROM inh GROUP BY src, 单据类型 ORDER BY src;
GO
