-- q-09-yjfield-time.sql — yj_field 有没有时间戳列(定位四单 seq 被改写的时刻)
SET NOCOUNT ON;
SELECT c.name, t.name AS 类型 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('yj_field') ORDER BY c.column_id;
GO
