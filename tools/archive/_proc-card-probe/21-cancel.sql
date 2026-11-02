SET NOCOUNT ON;
SELECT ISNULL([asp_cancel], N'(null)') AS asp_cancel_val, COUNT(*) AS n
FROM dbo.scjl GROUP BY [asp_cancel];

SELECT N'--- GD-2026-10-0018 的 asp_cancel ---' AS x;
SELECT ISNULL([asp_cancel], N'(null)') AS v, COUNT(*) AS n FROM dbo.scjl WHERE gldh = N'GD-2026-10-0018' GROUP BY [asp_cancel];
