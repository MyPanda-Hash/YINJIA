SET NOCOUNT ON;
DECLARE @w nvarchar(50)=N'YJ-AJ-016-1', @c nvarchar(50)=N'CK00006', @l nvarchar(50)=N'';
PRINT '=== 逐条验证 ISNULL(RTRIM(lot_no),N'''') = @l ===';
SELECT COUNT(*) AS 命中, SUM(yl) AS 合计 FROM kucun WHERE wzdm=@w AND ckdm=@c AND ISNULL(RTRIM(lot_no), N'') = @l;
PRINT '=== 若 @l 为 NULL 会怎样(参数化 null) ===';
SELECT COUNT(*) AS 命中 FROM kucun WHERE wzdm=@w AND ckdm=@c AND ISNULL(RTRIM(lot_no), N'') = NULL;
PRINT '=== kucun 该行 lot_no 的 DATALENGTH ===';
SELECT DATALENGTH(lot_no) AS 字节, lot_no IS NULL AS 是NULL FROM kucun WHERE wzdm=@w AND ckdm=@c;
