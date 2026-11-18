SET NOCOUNT ON;
SELECT COUNT(*) AS n, SUM(TRY_CAST(sl AS decimal(38,6))) AS q
FROM scjl WHERE ISNULL(asp_cancel,'N')<>'Y' AND sc_date >= '2026-10-01' AND sc_date < '2026-11-01';
SELECT COUNT(*) AS n, SUM(TRY_CAST(sl AS decimal(38,6))) AS q
FROM scjl WHERE ISNULL(asp_cancel,'N')<>'Y';
GO
