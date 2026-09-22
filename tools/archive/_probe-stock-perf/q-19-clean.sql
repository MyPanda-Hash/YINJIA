SET NOCOUNT ON;
SELECT N'探针残留行(应为0)' AS k, COUNT(*) AS n FROM kucun WHERE wzdm=N'__PROBE__';
SELECT N'kucun 行数' AS k, COUNT(*) AS n FROM kucun;
GO
