SET NOCOUNT ON;
-- 最近 20 张工单行 + 它们 rid 上已经占着的材料出库流水
SELECT TOP 20 p.id AS 工单行id, p.pl_no, p.pl_xc, p.mc, p.pl_sl,
       (SELECT COUNT(*) FROM dbo.outh o WHERE o.src = 6 AND o.rid = p.id) AS 占用行数,
       (SELECT TOP 1 o.单据编号 FROM dbo.outh o WHERE o.src = 6 AND o.rid = p.id ORDER BY o.id) AS 占用单据,
       (SELECT TOP 1 o.物料编码 FROM dbo.outh o WHERE o.src = 6 AND o.rid = p.id ORDER BY o.id) AS 占用物料,
       (SELECT TOP 1 o.批号 FROM dbo.outh o WHERE o.src = 6 AND o.rid = p.id ORDER BY o.id) AS 占用批号
  FROM dbo.plang p ORDER BY p.id DESC;
