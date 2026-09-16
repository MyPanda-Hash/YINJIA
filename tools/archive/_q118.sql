SET NOCOUNT ON;
BEGIN TRY
  INSERT INTO kucun (comm, wzdm, ckdm, rkl, yl) VALUES (N'', 'T', 'C', 1, 1);
  SELECT '单字符ckdm OK' AS result;
  DELETE FROM kucun WHERE wzdm='T';
END TRY BEGIN CATCH SELECT '单字符: ' + ERROR_MESSAGE() AS result; END CATCH;
BEGIN TRY
  INSERT INTO kucun (comm, wzdm, ckdm, rkl, yl) VALUES (N'', 'T', 'CK1', 1, 1);
  SELECT 'CK1 OK' AS result;
  DELETE FROM kucun WHERE wzdm='T';
END TRY BEGIN CATCH SELECT 'CK1: ' + ERROR_MESSAGE() AS result; END CATCH;
BEGIN TRY
  INSERT INTO kucun (comm, wzdm, ckdm, rkl, yl) VALUES (N'', 'T', 'CK00006', 1, 1);
  SELECT 'CK00006 OK' AS result;
  DELETE FROM kucun WHERE wzdm='T';
END TRY BEGIN CATCH SELECT 'CK00006: ' + ERROR_MESSAGE() AS result; END CATCH;
BEGIN TRY
  INSERT INTO kucun (comm, wzdm, ckdm, lot_no, rkl, yl) VALUES (N'', 'T', 'CK00006', 'L', 1, 1);
  SELECT '加lot_no OK' AS result;
  DELETE FROM kucun WHERE wzdm='T';
END TRY BEGIN CATCH SELECT '加lot_no: ' + ERROR_MESSAGE() AS result; END CATCH;
BEGIN TRY
  INSERT INTO kucun (comm, wzdm, ckdm, lot_no, rkl, yl) VALUES (N'', 'T', 'CK00006', 'PC0000', 1, 1);
  SELECT 'PC0000 OK' AS result;
  DELETE FROM kucun WHERE wzdm='T';
END TRY BEGIN CATCH SELECT 'PC0000: ' + ERROR_MESSAGE() AS result; END CATCH;
