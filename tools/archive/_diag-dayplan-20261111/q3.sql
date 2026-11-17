SELECT COUNT(*) AS 格数,
       SUM(CASE WHEN 计划日期>='2026-11-20' THEN 1 ELSE 0 END) AS 晚于1119,
       SUM(CASE WHEN 计划日期>='2027-01-01' THEN 1 ELSE 0 END) AS 在2027,
       CONVERT(varchar(10),MAX(计划日期),120) AS 最晚
FROM wo_day_plan WHERE asp_cancel='N';
SELECT TOP 40 工单行id, 工序, CONVERT(varchar(10),计划日期,120) AS 日期, 计划数量
FROM wo_day_plan WHERE asp_cancel='N' AND 计划日期>='2026-11-20' ORDER BY 计划日期 DESC;
