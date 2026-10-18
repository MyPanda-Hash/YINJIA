-- PC0000 归一后的结果核对(只读)
SET NOCOUNT ON;

PRINT N'=== ① 三张表 PC0000 残留(应全 0)===';
SELECT (SELECT COUNT(*) FROM kucun WHERE RTRIM(ISNULL(lot_no,''))=N'PC0000') AS kucun残留,
       (SELECT COUNT(*) FROM inh WHERE RTRIM(ISNULL(批号,''))=N'PC0000') AS inh残留,
       (SELECT COUNT(*) FROM outh WHERE RTRIM(ISNULL(批号,''))=N'PC0000') AS outh残留;
GO

PRINT N'=== ② kucun 现状 ===';
SELECT COUNT(*) AS 行数,
       CAST(ISNULL(SUM(yl),0) AS decimal(18,2)) AS 余量合计,
       SUM(CASE WHEN yl<0 THEN 1 ELSE 0 END) AS 批次负结存行,
       SUM(CASE WHEN lot_no IS NULL OR RTRIM(lot_no)='' THEN 1 ELSE 0 END) AS 无批号行
  FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y';
GO

PRINT N'=== ③ 按(物料,仓库)汇总为负的真缺货 ===';
SELECT COUNT(*) AS 组合数 FROM (
  SELECT wzdm, ckdm, SUM(yl) AS s FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y'
   GROUP BY wzdm, ckdm HAVING SUM(yl) < -0.0001) t;
GO

PRINT N'=== ④ 结存 == Σ流水 校验 ===';
SELECT COUNT(*) AS 不一致键数 FROM (
  SELECT ISNULL(a.k,b.k) AS k, ISNULL(a.net,0) AS net, ISNULL(b.yl,0) AS yl FROM
  (SELECT CONCAT(物料编码,N'|',ISNULL(RTRIM(仓库编码),N''),N'|',ISNULL(RTRIM(批号),N'')) AS k, SUM(数量) AS net
     FROM (SELECT 物料编码,仓库编码,批号,数量 FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,N'')<>N'月结结转'
           UNION ALL SELECT 物料编码,仓库编码,批号,-数量 FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y') s
    GROUP BY CONCAT(物料编码,N'|',ISNULL(RTRIM(仓库编码),N''),N'|',ISNULL(RTRIM(批号),N''))) a
  FULL OUTER JOIN
  (SELECT CONCAT(wzdm,N'|',ISNULL(RTRIM(ckdm),N''),N'|',ISNULL(RTRIM(lot_no),N'')) AS k, SUM(yl) AS yl
     FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y'
    GROUP BY CONCAT(wzdm,N'|',ISNULL(RTRIM(ckdm),N''),N'|',ISNULL(RTRIM(lot_no),N''))) b ON a.k=b.k
  WHERE ABS(ISNULL(a.net,0)-ISNULL(b.yl,0)) > 0.0001) x;
GO

PRINT N'=== ⑤ 三键唯一性 ===';
SELECT COUNT(*) AS 重复组数 FROM (
  SELECT wzdm, ckdm, RTRIM(ISNULL(lot_no,'')) l FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y'
   GROUP BY wzdm, ckdm, RTRIM(ISNULL(lot_no,'')) HAVING COUNT(*)>1) t;
GO

PRINT N'=== ⑥ 样例:YJ-SX-043(原 PC0000 -143620 + 真实批号)===';
SELECT wzdm, ckdm, ISNULL(lot_no,N'(无批号)') AS 批号, CAST(yl AS decimal(18,2)) AS 结存
  FROM kucun WHERE wzdm = N'YJ-SX-043' AND ISNULL(asp_cancel,'N')<>'Y'
 ORDER BY ckdm, yl DESC;
GO
