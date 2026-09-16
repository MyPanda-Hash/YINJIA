SET NOCOUNT ON;
BEGIN TRY
  INSERT INTO kucun (wzdm, ckdm, lot_no, in_date, rkl, yl, price, asp_user1, asp_time1, asp_cancel)
  VALUES ('YJ-XWR-003', 'CK00006', 'PC0000', GETDATE(), 10000, 10000, 0.39, 'test', GETDATE(), 'N');
  SELECT '成功' AS result;
END TRY
BEGIN CATCH
  SELECT '错误: ' + ERROR_MESSAGE() AS result;
END CATCH;
