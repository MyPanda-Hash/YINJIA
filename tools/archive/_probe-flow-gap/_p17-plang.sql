SET NOCOUNT ON;
SELECT id, pl_no, pl_xc, scx, dm, mc, pl_sl, xq_sl, rk_sl, [工艺路线], [批次号], ja, od_no FROM plang ORDER BY id;
GO
SELECT DISTINCT [工艺路线] FROM plang;
GO
