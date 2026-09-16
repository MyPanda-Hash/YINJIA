SET NOCOUNT ON;
-- 逐字段测试:先只插基本字段
BEGIN TRY
  INSERT INTO kucun (wzdm, ckdm, lot_no, rkl, yl) VALUES ('TEST', 'CK00006', 'LOT1', 1, 1);
  SELECT '基本字段 OK' AS result;
  DELETE FROM kucun WHERE wzdm='TEST';
END TRY BEGIN CATCH SELECT '基本字段: ' + ERROR_MESSAGE() AS result; END CATCH;
-- 加 price
BEGIN TRY
  INSERT INTO kucun (wzdm, ckdm, lot_no, rkl, yl, price) VALUES ('TEST', 'CK00006', 'LOT1', 1, 1, 0.39);
  SELECT 'price OK' AS result;
  DELETE FROM kucun WHERE wzdm='TEST';
END TRY BEGIN CATCH SELECT 'price: ' + ERROR_MESSAGE() AS result; END CATCH;
-- 加 asp_user1
BEGIN TRY
  INSERT INTO kucun (wzdm, ckdm, lot_no, rkl, yl, asp_user1) VALUES ('TEST', 'CK00006', 'LOT1', 1, 1, 'stock:admin');
  SELECT 'asp_user1 OK' AS result;
  DELETE FROM kucun WHERE wzdm='TEST';
END TRY BEGIN CATCH SELECT 'asp_user1: ' + ERROR_MESSAGE() AS result; END CATCH;
-- 加完整原始值
BEGIN TRY
  INSERT INTO kucun (wzdm, ckdm, lot_no, in_date, rkl, yl, price, asp_user1, asp_time1, asp_cancel)
  VALUES ('YJ-XWR-003', 'CK00006', 'PC0000', GETDATE(), 10000, 10000, 0.39, 'stock:admin', GETDATE(), 'N');
  SELECT '完整 OK' AS result;
  DELETE FROM kucun WHERE wzdm='YJ-XWR-003';
END TRY BEGIN CATCH SELECT '完整: ' + ERROR_MESSAGE() AS result; END CATCH;
