SET NOCOUNT ON;
SELECT COUNT(*) AS 排产数量为0或空 FROM dbo.plang WHERE ISNULL(asp_cancel,N'N') <> N'Y' AND ISNULL(pl_sl,0) <= 0;
SELECT TOP 3 pl_no, pl_xc, pl_sl, scx, dm FROM dbo.plang
 WHERE ISNULL(asp_cancel,N'N') <> N'Y' AND ISNULL(pl_sl,0) <= 0 ORDER BY pl_no DESC;
