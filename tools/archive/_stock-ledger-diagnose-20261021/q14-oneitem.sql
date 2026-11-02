SET NOCOUNT ON;
DECLARE @w nvarchar(50) = N'YJ-SX-002-2';
SELECT 位置='kucun', 仓库=k.ckdm, 批号=ISNULL(k.lot_no,'<NULL>'), 入=k.rkl, 出=k.ckl, 余=k.yl, 来源=k.asp_user1, 二次=k.asp_user2
FROM kucun k WHERE k.wzdm = @w
ORDER BY 3;
SELECT 方向='入', 批号=ISNULL(批号,'<NULL>'), 行数=COUNT(*), 数量=SUM(数量), 最早=MIN(单据日期), 最晚=MAX(单据日期), 写入者=MIN(asp_user1)
FROM inh WHERE 物料编码=@w AND ISNULL(asp_cancel,'N')<>'Y' GROUP BY ISNULL(批号,'<NULL>')
UNION ALL
SELECT '出', ISNULL(批号,'<NULL>'), COUNT(*), SUM(数量), MIN(单据日期), MAX(单据日期), MIN(asp_user1)
FROM outh WHERE 物料编码=@w AND ISNULL(asp_cancel,'N')<>'Y' GROUP BY ISNULL(批号,'<NULL>')
ORDER BY 1,2;
-- 该物料的出库单样例
SELECT TOP 5 单据编号, 单据类型, 单据日期, 仓库编码, 批号=ISNULL(批号,'<NULL>'), 数量, asp_user1
FROM outh WHERE 物料编码=@w AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY 单据日期 DESC;
