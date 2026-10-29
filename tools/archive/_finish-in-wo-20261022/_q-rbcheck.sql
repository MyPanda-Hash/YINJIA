SET NOCOUNT ON;
SELECT COUNT(*) AS 头, SUM(CASE WHEN ISNULL(加工单号,N'')<>N'' THEN 1 ELSE 0 END) AS 有加工单号,
       SUM(CASE WHEN ISNULL(加工单号,N'')=N'' THEN 1 ELSE 0 END) AS 空加工单号 FROM dbo.bd_finish_in;
SELECT TOP 3 action_name FROM dbo.yj_usage_log WHERE panel_name=N'产成品入库单' ORDER BY id DESC;
SELECT COUNT(*) AS 未标记留痕 FROM dbo.yj_usage_log WHERE panel_name=N'产成品入库单' AND action_name LIKE N'数据修复·补齐加工单号(%' AND action_name NOT LIKE N'%（已回滚）%';
