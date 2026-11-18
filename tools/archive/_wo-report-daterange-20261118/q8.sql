SET NOCOUNT ON;
SELECT COUNT(*) AS all_rows FROM scjl;
SELECT COUNT(*) AS oct FROM scjl WHERE sc_date >= '2026-10-01' AND sc_date < '2026-11-01';
SELECT COUNT(*) AS oct20 FROM scjl WHERE sc_date >= '2026-10-01' AND sc_date < '2026-10-21';
SELECT TOP 3 sc_date FROM scjl WHERE sc_date >= '2026-10-21' AND sc_date < '2026-11-01' ORDER BY sc_date;
SELECT COUNT(*) AS oct21_31 FROM scjl WHERE sc_date >= '2026-10-21' AND sc_date < '2026-11-01';
SELECT COUNT(*) AS nov18 FROM scjl WHERE sc_date >= '2026-11-01' AND sc_date < '2026-11-19';
GO
