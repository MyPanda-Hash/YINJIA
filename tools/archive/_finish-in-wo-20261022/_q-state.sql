SET NOCOUNT ON;
SELECT DB_NAME() AS db,
       (SELECT COUNT(*) FROM dbo.bd_finish_in) AS 头,
       (SELECT COUNT(*) FROM dbo.bl_finish_in) AS 行,
       (SELECT COUNT(*) FROM dbo.bd_finish_in WHERE ISNULL(加工单号,N'')=N'') AS 空加工单号,
       (SELECT COUNT(*) FROM dbo.plang) AS 工单行,
       (SELECT COUNT(*) FROM dbo.yj_usage_log WHERE panel_name=N'产成品入库单' AND action_name LIKE N'数据修复%') AS 已有修复留痕;
