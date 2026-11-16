SELECT p.pl_no, p.pl_xc, p.工艺路线,
       (SELECT TOP 1 r.工序名称 FROM dbo.bs_route r WHERE r.工艺路线编码=p.工艺路线 AND ISNULL(r.asp_cancel,'N')<>'Y'
          ORDER BY ISNULL(r.加工顺序,999) DESC) AS 回退最后一道
FROM dbo.plang p WHERE p.pl_no = N'GD-2026-10-0221';
SELECT 工艺路线编码, 工序名称, 加工顺序 FROM dbo.bs_route WHERE 工艺路线编码 IN
 (SELECT DISTINCT 工艺路线 FROM dbo.plang WHERE pl_no=N'GD-2026-10-0221') AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY 加工顺序;
