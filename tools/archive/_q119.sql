SET NOCOUNT ON;
ALTER TABLE dbo.kucun ALTER COLUMN ckdm nvarchar(20) NULL;
BEGIN TRY
  INSERT INTO kucun (comm, wzdm, ckdm, lot_no, rkl, yl, price) VALUES (N'', 'TEST-CK', 'CK00006', 'PC0000', 10000, 10000, 0.39);
  SELECT '修复后 INSERT OK' AS result;
  DELETE FROM kucun WHERE wzdm='TEST-CK';
END TRY BEGIN CATCH SELECT '仍失败: ' + ERROR_MESSAGE() AS result; END CATCH;
