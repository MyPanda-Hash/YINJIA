SET NOCOUNT ON;
SELECT ISNULL(w.仓库类型,N'(无类型)') AS wh_type, COUNT(*) AS stock_rows, SUM(ISNULL(k.yl,0)) AS qty FROM dbo.kucun k JOIN dbo.bs_wh w ON w.仓库编码=k.ckdm
WHERE ISNULL(k.asp_cancel,'N')<>'Y' GROUP BY w.仓库类型 ORDER BY wh_type;
SELECT COUNT(*) AS sale_out_cnt FROM dbo.bd_sale_out WHERE ISNULL(asp_cancel,'N')<>'Y';
SELECT COUNT(*) AS finish_in_cnt FROM dbo.bd_finish_in WHERE ISNULL(asp_cancel,'N')<>'Y';
