SET NOCOUNT ON;
SELECT CASE WHEN ISNULL(k.yl,0)<0 THEN N'负数行' WHEN ISNULL(k.yl,0)=0 THEN N'零行' ELSE N'正数行' END AS 结存状态,
 COUNT(*) AS 行数, SUM(ISNULL(k.yl,0)) AS 合计 FROM dbo.kucun k JOIN dbo.bs_wh w ON w.仓库编码=k.ckdm
WHERE ISNULL(k.asp_cancel,'N')<>'Y' AND ISNULL(w.仓库类型,N'')=N'成品仓' GROUP BY CASE WHEN ISNULL(k.yl,0)<0 THEN N'负数行' WHEN ISNULL(k.yl,0)=0 THEN N'零行' ELSE N'正数行' END;
SELECT TOP 5 w.仓库名称, k.wzdm, k.lot_no, k.yl FROM dbo.kucun k JOIN dbo.bs_wh w ON w.仓库编码=k.ckdm
WHERE ISNULL(k.asp_cancel,'N')<>'Y' AND ISNULL(w.仓库类型,N'')=N'成品仓' ORDER BY ISNULL(k.yl,0) ASC;
