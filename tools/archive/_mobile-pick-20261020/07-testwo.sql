SET NOCOUNT ON;
SELECT COUNT(*) AS test_plang行 FROM dbo.plang;
SELECT TOP 3 pl_no, pl_xc, pl_sl, scx FROM dbo.plang ORDER BY pl_no DESC;
