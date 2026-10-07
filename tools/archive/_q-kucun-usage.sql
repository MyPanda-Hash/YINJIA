SET NOCOUNT ON;
-- ① kucun 的数据形态
SELECT COUNT(*) AS 行数, SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END) AS 已作废行,
       SUM(CASE WHEN ISNULL(asp_cancel,'N')<>'Y' THEN 1 ELSE 0 END) AS 有效行,
       COUNT(DISTINCT wzdm) AS 存货数, COUNT(DISTINCT ckdm) AS 仓库数, COUNT(DISTINCT lot_no) AS 批号数,
       SUM(ISNULL(rkl,0)) AS 累计入库, SUM(ISNULL(ckl,0)) AS 累计出库, SUM(ISNULL(yl,0)) AS 结余合计,
       SUM(CASE WHEN ISNULL([预警数量],0) > 0 THEN 1 ELSE 0 END) AS 设了预警阈值的行
FROM kucun;
GO
SELECT TOP 12 wzdm AS 存货编码, ckdm AS 仓库, lot_no AS 批号, rkl AS 累计入, ckl AS 累计出, yl AS 结余, price AS 单价, [预警数量], in_date AS 入库日期
FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY yl DESC;
GO
