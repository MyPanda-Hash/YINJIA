SET NOCOUNT ON;
DECLARE @cols nvarchar(max);
SELECT @cols = STRING_AGG(QUOTENAME(name), ',') WITHIN GROUP (ORDER BY column_id)
FROM sys.columns WHERE object_id = OBJECT_ID('dbo.kucun') AND is_identity = 0;
BEGIN TRAN;
DELETE FROM kucun;
EXEC('INSERT INTO kucun (' + @cols + ') SELECT ' + @cols + ' FROM kucun_bak_20261018');
COMMIT;
SELECT (SELECT COUNT(*) FROM kucun) AS 恢复行数, (SELECT SUM(yl) FROM kucun) AS 恢复合计;
SELECT CASE WHEN lot_no='PC0000' THEN 'PC0000' WHEN lot_no IS NULL THEN 'NULL' ELSE 'REAL' END cat, COUNT(*) n FROM kucun GROUP BY CASE WHEN lot_no='PC0000' THEN 'PC0000' WHEN lot_no IS NULL THEN 'NULL' ELSE 'REAL' END;
