SET NOCOUNT ON;
SELECT TOP 3 pl_no, pl_xc, pl_sl, scx, dm, mc FROM dbo.plang
 WHERE ISNULL(asp_cancel,N'N') <> N'Y' AND (ISNULL(pl_sl,0) = 0 OR ISNULL(scx,N'') = N'') ORDER BY pl_no DESC;
