SET NOCOUNT ON;
PRINT '--- YJ-XWR-003 / CP001:kucun 行 ---';
SELECT id, wzdm, ckdm, lot_no, rkl, ckl, yl, price, CONVERT(varchar(19),update_date,120) AS upd, asp_cancel FROM kucun WHERE wzdm IN (N'YJ-XWR-003',N'CP001') ORDER BY wzdm, id;
PRINT '--- 同物料:视图流水 ---';
SELECT 单据类型, 单据编号, 仓库, 批号, 收入数量, 发出数量, CONVERT(varchar(10),单据日期,120) AS 日期 FROM v_stock_movement WHERE 存货编码 IN (N'YJ-XWR-003',N'CP001') ORDER BY 存货编码, 单据日期;
PRINT '--- 视图负现存量行(前 8) ---';
SELECT TOP 8 仓库, 存货编码, 现存量 FROM v_stock_balance WHERE 现存量 < 0 ORDER BY 现存量;
PRINT '--- kucun 是否有负余量 ---';
SELECT COUNT(*) AS 负余量行 FROM kucun WHERE ISNULL(yl,0) < 0 AND ISNULL(asp_cancel,'N')<>'Y';
