SET NOCOUNT ON;
SELECT TOP 3 pl_no, pl_xc, pl_sl, scx, mc FROM dbo.plang WHERE ISNULL(pl_sl,0) > 0 AND ISNULL(asp_cancel,N'N') <> N'Y' ORDER BY pl_no DESC;
