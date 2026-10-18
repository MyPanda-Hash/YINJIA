SET NOCOUNT ON;
PRINT '=== 精确复现 checkOutbound 的查询 ===';
DECLARE @w nvarchar(50)=N'YJ-AJ-016-1', @c nvarchar(50)=N'CK00006', @l nvarchar(50)=N'';
SELECT ISNULL(yl,0) AS yl, ISNULL(预警数量,0) AS warn FROM kucun WHERE wzdm=@w AND ckdm=@c AND ISNULL(RTRIM(lot_no), N'') = @l;
PRINT '=== 该键所有行 ===';
SELECT ISNULL(lot_no,'<NULL>') lot, LEN(lot_no) len, yl, ISNULL(RTRIM(lot_no),N'') normed FROM kucun WHERE wzdm=@w AND ckdm=@c;
