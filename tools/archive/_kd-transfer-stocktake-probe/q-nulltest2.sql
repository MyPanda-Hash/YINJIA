SET NOCOUNT ON;
DECLARE @w nvarchar(50)=N'YJ-AJ-016-1', @c nvarchar(50)=N'CK00006', @l nvarchar(50)=N'';
SELECT COUNT(*) AS 命中_空串, SUM(yl) AS 合计 FROM kucun WHERE wzdm=@w AND ckdm=@c AND ISNULL(RTRIM(lot_no), N'') = @l;
SELECT COUNT(*) AS 命中_NULL FROM kucun WHERE wzdm=@w AND ckdm=@c AND ISNULL(RTRIM(lot_no), N'') = NULL;
SELECT DATALENGTH(lot_no) AS 字节, CASE WHEN lot_no IS NULL THEN 1 ELSE 0 END AS 是NULL FROM kucun WHERE wzdm=@w AND ckdm=@c;
