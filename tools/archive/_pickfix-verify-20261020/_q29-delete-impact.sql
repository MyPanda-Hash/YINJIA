SET NOCOUNT ON;
PRINT '';
-- ① 只删这一行:它牵动什么
SELECT o.id, o.src, o.rid, o.单据编号, o.物料编码, o.仓库编码, o.批号, o.数量, o.成本金额
  FROM dbo.outh o WHERE o.src = 6 AND o.rid = 1168;
GO
SELECT COUNT(*) AS 该行在成本台账里的行数, SUM(结存数量) AS 成本台账结存数量
  FROM dbo.inv_cost_ledger WHERE src = 6 AND rid = 1168;
GO
-- ② 若按「rid > 200 的行全清掉」会波及多少
SELECT COUNT(*) AS 待删行数, SUM(数量) AS 待删数量合计, SUM(ISNULL(成本金额,0)) AS 待删成本金额合计,
       COUNT(DISTINCT 单据编号) AS 涉及单据张数, COUNT(DISTINCT 仓库编码 + '|' + 物料编码) AS 涉及现存量键数
  FROM dbo.outh WHERE rid > 200;
GO
SELECT COUNT(*) AS 流水总行数, COUNT(*) - SUM(CASE WHEN rid > 200 THEN 1 ELSE 0 END) AS 保留下来的行数
  FROM dbo.outh;
GO
-- ③ rid<=200 的分布(看"200"这条线切在哪)
SELECT COUNT(*) AS rid小于等于200的行数, MIN(rid) AS 最小, MAX(rid) AS 最大 FROM dbo.outh WHERE rid <= 200;
