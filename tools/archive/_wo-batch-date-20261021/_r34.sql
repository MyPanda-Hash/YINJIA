SET NOCOUNT ON;
SELECT DB_NAME() db, LEFT(content_hash,12) hash FROM dbo.yj_schema_log WHERE script_name=N'migrate-plang-no-month-closed-20261021.sql';
GO
SELECT (SELECT COUNT(DISTINCT pl_no) FROM dbo.plang WHERE pl_no LIKE N'GD-2026-09-%') 九月工单号,
       (SELECT COUNT(*) FROM dbo.plang WHERE pl_no LIKE N'GD-2026-09-%') 九月号行,
       (SELECT COUNT(*) FROM dbo.plang WHERE pl_no LIKE N'GD-2026-10-%' AND CAST(pl_date AS date)>='2026-10-01' AND ISNULL([完工状态],N'')=N'生产完工' AND ISNULL(asp_cancel,'N')<>'Y') 十月已结案行;
GO
