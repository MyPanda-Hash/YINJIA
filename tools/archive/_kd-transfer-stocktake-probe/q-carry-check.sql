SET NOCOUNT ON;
PRINT '=== 结转行 vs kucun 逐键比对 ===';
WITH C AS (SELECT 物料编码 w, 仓库编码 c, ISNULL(RTRIM(批号),N'') l, SUM(数量) q FROM inh WHERE 单据编号=N'JZ-202609' GROUP BY 物料编码,仓库编码,ISNULL(RTRIM(批号),N'')),
K AS (SELECT wzdm w, ISNULL(RTRIM(ckdm),N'') c, ISNULL(RTRIM(lot_no),N'') l, SUM(yl) yl FROM kucun GROUP BY wzdm,ISNULL(RTRIM(ckdm),N''),ISNULL(RTRIM(lot_no),N''))
SELECT COUNT(*) 差异键, SUM(ISNULL(C.q,0)) 结转侧, SUM(ISNULL(K.yl,0)) 库存侧
FROM C FULL OUTER JOIN K ON K.w=C.w AND K.c=C.c AND K.l=C.l
WHERE ABS(ISNULL(C.q,0)-ISNULL(K.yl,0)) > 0.01;
PRINT '=== 结转是"截至9月末"还是"含10月" ===';
SELECT SUM(CASE WHEN 单据日期 < '2026-10-01' THEN 数量 ELSE 0 END) AS 截至9月末,
       SUM(CASE WHEN 单据日期 >= '2026-10-01' THEN 数量 ELSE 0 END) AS 10月部分 FROM inh WHERE 单据编号=N'JZ-202609';
