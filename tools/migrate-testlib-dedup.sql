-- migrate-testlib-dedup.sql — 检验项目标准库去重(互通实验残留清理)+ 种子行恢复启用
-- 适用:本地/生产通用。幂等,可重复执行(UTF-8 无 BOM,-f 65001 / SqlRunner)。
-- 规则(保守,只删"完全重复",不碰业务上同名不同内容的行):
--   ① 库内完全重复 = 同 lib + 同 item_code + 同 name + 同 quality + 同 req → 保留最小 id,删其余
--      (互通期的写路径会把同一内容写进两库/重复行;业务上"同控制项目多行"因 quality 不同不会被误删)
--   ② 种子行(asp_user1='seed')全部恢复启用(实验期间被停用的复原)
-- 运行后输出各库剩余行数,供与 48(spec.test)/13(insp.plan) 种子基线比对。
USE HSDZ_MES;
SET NOCOUNT ON;
GO
;WITH d AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY lib_code, item_code,
      ISNULL(JSON_VALUE(content, '$.name'), N''),
      ISNULL(JSON_VALUE(content, '$.quality'), N''),
      ISNULL(JSON_VALUE(content, '$.req'), N'')
    ORDER BY id) AS rn
  FROM yj_std_lib WHERE lib_code IN (N'spec.test', N'insp.plan')
)
DELETE FROM d WHERE rn > 1;
GO
UPDATE yj_std_lib SET enabled = 1, asp_user2 = N'seed-restore', asp_time2 = SYSDATETIME()
WHERE lib_code IN (N'spec.test', N'insp.plan') AND asp_user1 = N'seed' AND enabled = 0;
GO
SELECT lib_code, COUNT(*) AS total, SUM(CASE WHEN enabled = 0 THEN 1 ELSE 0 END) AS disabled
FROM yj_std_lib WHERE lib_code IN (N'spec.test', N'insp.plan') GROUP BY lib_code;
GO
PRINT N'检验项目标准库去重完成';
GO
