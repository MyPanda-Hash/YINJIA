-- migrate-spare-desc-fix.sql — 备用列「列级中文注明」补漏(2026-09-29,代码审查发现)
--
-- 根因:前两个备用列脚本的「已有注明」守卫写成
--     EXISTS (SELECT 1 FROM sys.extended_properties ep
--             WHERE ep.major_id = OBJECT_ID(@tb) AND ep.minor_id = <column_id> AND ep.name = N'MS_Description')
--   漏了 `ep.class = 1`(列级)。sys.extended_properties 是**一张表按 class 混装**:
--   class=1 列级 / class=7 索引级,两者的 major_id 都是 object_id、minor_id 分别放 column_id / index_id。
--   于是「索引的 index_id == 备用N 的 column_id」时守卫误判「已有注明」而跳过写入。
-- 实例(实测):kucun 的 UX_kucun_id 索引 index_id=34,与新加的 备用1 的 column_id=34 相同
--   ⇒ kucun.备用1 的列级 MS_Description 缺失(其余 899 列正常);全库扫描仅此 1 列。
-- 为什么另开脚本而不回改历史:本仓库迁移链是**只追加**的(DbSync 按内容哈希判断重跑,
--   回改已执行脚本会让它下次被"重跑");新库场景本脚本排在备用列脚本之后,一样收敛到正确状态。
-- 顺带提醒:今后凡查列级扩展属性,谓词一律写 `ep.class = 1`(见 docs/development/数据库规范.md §3.1)。
-- 幂等:只补「缺列级注明」的备用列,已有注明(含动态字段绑定后的业务注明)一律不覆盖,可重跑。

SET NOCOUNT ON;
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

DECLARE @tb sysname, @col sysname, @sql nvarchar(500), @fixed int = 0, @scanned int = 0;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT t.name, c.name
  FROM sys.tables t
  JOIN sys.columns c ON c.object_id = t.object_id AND c.name LIKE N'备用[0-9]%'
  WHERE NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                    WHERE ep.class = 1                       -- ← 关键:只认列级,排除索引级(class=7)撞号
                      AND ep.major_id = c.object_id AND ep.minor_id = c.column_id
                      AND ep.name = N'MS_Description')
  ORDER BY t.name, c.column_id;
OPEN cur; FETCH NEXT FROM cur INTO @tb, @col;
WHILE @@FETCH_STATUS = 0
BEGIN
  EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', @tb, N'COLUMN', @col;
  SET @fixed += 1;
  FETCH NEXT FROM cur INTO @tb, @col;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'备用列注明补漏: 补写 ' + CAST(@fixed AS nvarchar(10)) + N' 列';
GO

-- 核对:全库 备用N 列里,仍缺列级中文注明的应为 0
SELECT N'备用列缺列级注明(预期 0)' AS 检查项, CAST(COUNT(*) AS nvarchar(20)) AS 值
FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id AND c.name LIKE N'备用[0-9]%'
WHERE NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                  WHERE ep.class = 1 AND ep.major_id = c.object_id AND ep.minor_id = c.column_id
                    AND ep.name = N'MS_Description');
GO
