SET NOCOUNT ON;
BEGIN TRY
  INSERT INTO kucun (comm, wzdm, ckdm, lot_no, rkl, yl) VALUES (N'', 'TEST', 'CK00006', 'LOT1', 1, 1);
  SELECT '带comm OK' AS result;
  DELETE FROM kucun WHERE wzdm='TEST';
END TRY BEGIN CATCH SELECT '带comm: ' + ERROR_MESSAGE() AS result; END CATCH;
-- 检查是否有 NOT NULL 但无默认值的列导致隐式转换问题
-- 尝试最简 INSERT
BEGIN TRY
  INSERT INTO kucun (comm, wzdm, rkl, yl) VALUES (N'', 'T', 1, 1);
  SELECT '最简 OK' AS result;
  DELETE FROM kucun WHERE wzdm='T';
END TRY BEGIN CATCH SELECT '最简: ' + ERROR_MESSAGE() AS result; END CATCH;
