SET NOCOUNT ON;
SELECT TOP 5 p.pl_no AS 工单号, p.pl_xc AS 工单行号, p.pl_sl AS 排产数量, p.scx AS 生产线, p.mc AS 产品
  FROM dbo.plang p WHERE ISNULL(p.asp_cancel,N'N') <> N'Y' AND ISNULL(p.pl_sl,0) > 0
   AND ISNULL(p.ja,N'N') <> N'Y' ORDER BY p.pl_no DESC;
SELECT TOP 5 存货编码, 仓库编码, 批号, 现存量 FROM dbo.v_stock_pick ORDER BY 存货编码;
SELECT TOP 3 仓库, 仓库编码, 仓位编码, 是否默认, 停用 FROM dbo.bs_wh_loc WHERE 停用 = 0 ORDER BY 是否默认 DESC;
