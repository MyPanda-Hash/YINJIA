SET NOCOUNT ON;
SELECT r.工艺路线编码, r.工序名称, r.加工顺序, r.换算率, ISNULL(r.生产车间,N'') AS shop
FROM dbo.bs_route r WHERE r.工艺路线编码=N'GY-CB-STD' AND ISNULL(r.asp_cancel,'N')<>'Y' ORDER BY r.加工顺序;
