SET NOCOUNT ON;
SELECT COUNT(*) AS 有产线且排产数量大于0 FROM dbo.plang
 WHERE ISNULL(asp_cancel,N'N') <> N'Y' AND ISNULL(scx,N'') <> N'' AND ISNULL(pl_sl,0) > 0;
SELECT COUNT(*) AS 有产线 FROM dbo.plang WHERE ISNULL(asp_cancel,N'N') <> N'Y' AND ISNULL(scx,N'') <> N'';
SELECT COUNT(*) AS 排产数量大于0 FROM dbo.plang WHERE ISNULL(asp_cancel,N'N') <> N'Y' AND ISNULL(pl_sl,0) > 0;
SELECT TOP 3 pl_no, pl_xc, pl_sl, scx FROM dbo.plang
 WHERE ISNULL(asp_cancel,N'N') <> N'Y' AND ISNULL(scx,N'') <> N'' AND ISNULL(pl_sl,0) > 0 ORDER BY pl_no DESC;
