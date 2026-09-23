/* fix-db-restore-20260915.sql:登记哈希对齐当前文件字节(脚本效果 09-15 已全部生效;
   字节变化源自远端 b9b4a1c 的 USE 守卫改造,非逻辑变更 —— 重跑反而在演进后的库上撞列名冲突) */
SET NOCOUNT ON;
UPDATE yj_schema_log SET content_hash = '317ea6c4d67ca45438b44539442a6818c0c75588e6366f4b746985acc5b08a6b'
 WHERE script_name = N'fix-db-restore-20260915.sql';
SELECT script_name, LEFT(content_hash, 12) AS hash12, applied_at
  FROM yj_schema_log WHERE script_name = N'fix-db-restore-20260915.sql';
GO
