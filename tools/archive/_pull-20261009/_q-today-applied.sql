SET NOCOUNT ON;
PRINT N'库 = ' + DB_NAME() + N' —— 今天(2026-10-09)DbSync 执行过的脚本';
SELECT l.script_name AS 脚本, l.applied_at AS 登记时间,
       CASE WHEN l.script_name LIKE N'%inbound-outbound%' OR l.script_name LIKE N'%lot-trace%'
              OR l.script_name LIKE N'%outsource-reports%' THEN N'★含 yj_field 批量 INSERT' ELSE N'' END AS 关注
  FROM yj_schema_log l
 WHERE l.applied_at >= CONVERT(datetime, '2026-10-09 10:00:00', 120)
 ORDER BY l.applied_at;
