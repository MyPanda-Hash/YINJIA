-- @@ F1 rk_sl 与「已审核产成品入库明细实收合计」是否一致(未交量=排产−rk_sl 的前提)
SELECT TOP 25 p.pl_no, p.pl_xc, p.pl_sl AS 排产, p.rk_sl AS rk_sl,
       ISNULL(x.实收合计,0) AS 入库明细合计, ISNULL(x.单数,0) AS 单据数,
       CASE WHEN ISNULL(p.rk_sl,0) <> ISNULL(x.实收合计,0) THEN N'不一致' ELSE N'一致' END AS 判定
FROM dbo.plang p
OUTER APPLY (
  SELECT SUM(ISNULL(d.[实收数量],0)) AS 实收合计, COUNT(DISTINCT f.[单据编号]) AS 单数
  FROM dbo.bd_finish_in f
  JOIN dbo.bl_finish_in d ON d.[单据编号]=f.[单据编号] AND ISNULL(d.asp_cancel,'N')<>'Y'
  JOIN dbo.yj_doc_status s ON s.panel_code=N'FINISH_IN' AND s.doc_no=f.[单据编号]
  WHERE ISNULL(f.asp_cancel,'N')<>'Y' AND f.[加工单号]=p.pl_no
    AND (f.[工单行号]=p.pl_xc OR (f.[工单行号] IS NULL AND ISNULL(f.[批次号],N'')=ISNULL(p.[批次号],N'')))
    AND s.shr IS NOT NULL
) x
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.pl_sl,0) > 0
  AND ISNULL(x.实收合计,0) > 0
ORDER BY CASE WHEN ISNULL(p.rk_sl,0) <> ISNULL(x.实收合计,0) THEN 0 ELSE 1 END, p.pl_no DESC;

-- @@ F2 统计:有已审入库明细的行里,rk_sl 不一致的有多少
SELECT COUNT(*) AS 有已审入库明细的行,
       SUM(CASE WHEN ISNULL(p.rk_sl,0) <> ISNULL(x.实收合计,0) THEN 1 ELSE 0 END) AS rk_sl不一致行
FROM dbo.plang p
OUTER APPLY (
  SELECT SUM(ISNULL(d.[实收数量],0)) AS 实收合计
  FROM dbo.bd_finish_in f
  JOIN dbo.bl_finish_in d ON d.[单据编号]=f.[单据编号] AND ISNULL(d.asp_cancel,'N')<>'Y'
  JOIN dbo.yj_doc_status s ON s.panel_code=N'FINISH_IN' AND s.doc_no=f.[单据编号]
  WHERE ISNULL(f.asp_cancel,'N')<>'Y' AND f.[加工单号]=p.pl_no
    AND (f.[工单行号]=p.pl_xc OR (f.[工单行号] IS NULL AND ISNULL(f.[批次号],N'')=ISNULL(p.[批次号],N'')))
    AND s.shr IS NOT NULL
) x
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(x.实收合计,0) > 0;
