SET NOCOUNT ON;
PRINT '=== 成品仓库存 ===';
SELECT w.仓库名称, COUNT(*) AS 库存行, SUM(ISNULL(k.yl,0)) AS 数量 FROM dbo.kucun k JOIN dbo.bs_wh w ON w.仓库编码=k.ckdm
WHERE ISNULL(k.asp_cancel,'N')<>'Y' AND ISNULL(w.仓库类型,N'')=N'成品仓' GROUP BY w.仓库名称;
PRINT '=== 各类型仓库存行 ===';
SELECT ISNULL(w.仓库类型,N'(无类型)') AS 仓库类型, COUNT(*) AS 库存行 FROM dbo.kucun k JOIN dbo.bs_wh w ON w.仓库编码=k.ckdm
WHERE ISNULL(k.asp_cancel,'N')<>'Y' GROUP BY w.仓库类型;
PRINT '=== 入库流水类型 ===';
SELECT ISNULL(bz,N'(空)') AS 入库备注类型, COUNT(*) AS 行数 FROM dbo.inh GROUP BY bz;
PRINT '=== 销货出库链 ===';
SELECT COUNT(*) AS sale_out_cnt FROM dbo.bd_sale_out WHERE ISNULL(asp_cancel,'N')<>'Y';
