SET NOCOUNT ON;
DECLARE @bad int = 0;
IF @bad > 0
  BEGIN
    THROW 50011, N'校验A失败', 1;
  END
PRINT N'A ok';
GO
DECLARE @bad int = 1;
BEGIN TRY
  IF @bad > 0
    BEGIN
      THROW 50012, N'校验B失败', 1;
    END
END TRY
BEGIN CATCH
  PRINT N'caught: ' + ERROR_MESSAGE();
END CATCH
GO
