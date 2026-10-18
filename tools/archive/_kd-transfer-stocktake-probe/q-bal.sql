SET NOCOUNT ON;
PRINT '=== 模拟 bal() 查询:lot 传 NULL 与 空串 的差异 ===';
SELECT 'lot=NULL' AS 条件, yl FROM kucun WHERE wzdm=N'YJ-AJ-016-1' AND ckdm=N'CK00006' AND ((NULL IS NULL AND lot_no IS NULL) OR lot_no=NULL);
