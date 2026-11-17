/* probe-05-qc-tables.sql — 只读:qc_ 表在册清单 vs 文档逐行登记对照(台账口径) */
SET NOCOUNT ON;
SELECT name FROM sys.tables WHERE name LIKE N'qc[_]%' ORDER BY name;
GO
