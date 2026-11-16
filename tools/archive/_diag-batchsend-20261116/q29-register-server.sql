SET NOCOUNT ON;
/* 手工在服务器执行后补登 yj_schema_log(手册 §5 口径:content_hash = MANUAL-<日期>-<方式>)。
   登记 ≠ 不再重跑:DbSync 按**文件内容哈希**比对,下一次增量部署仍会跑一遍本脚本(幂等,0 行),
   跑完会把 content_hash 刷成文件真哈希 —— 这样"服务器已应用"与"迁移链记录"才一致。 */
IF NOT EXISTS (SELECT 1 FROM yj_schema_log WHERE script_name = N'migrate-erp-linekey-repair-20261116.sql')
BEGIN
  INSERT INTO yj_schema_log (script_name, content_hash, applied_at)
  VALUES (N'migrate-erp-linekey-repair-20261116.sql', N'MANUAL-20261116-sqlrunner-1433', SYSDATETIME());
  PRINT '已补登 yj_schema_log: migrate-erp-linekey-repair-20261116.sql';
END
ELSE PRINT 'yj_schema_log 已有该脚本登记,跳过';
