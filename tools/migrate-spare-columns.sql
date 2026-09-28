-- migrate-spare-columns.sql — 备用列池(动态字段承载;docs/design/动态字段扩展-备用列池-V1.0.md)
-- 范围:前缀 bs_/bd_/bl_/rd_/qc_/wo_ 且被 yj_panel(line_table/head_table)引用的物理表(约139张)
-- 幂等:列存在跳过;已有 MS_Description 不覆盖(绑定后的业务注明不受影响)
SET NOCOUNT ON;
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

DECLARE @tb sysname, @spare sysname, @sql nvarchar(500), @added int = 0, @noted int = 0;
DECLARE c CURSOR LOCAL FAST_FORWARD FOR
  SELECT t.name FROM sys.tables t
  WHERE (t.name LIKE 'bs[_]%' OR t.name LIKE 'bd[_]%' OR t.name LIKE 'bl[_]%'
      OR t.name LIKE 'rd[_]%' OR t.name LIKE 'qc[_]%' OR t.name LIKE 'wo[_]%')
    AND t.name NOT LIKE '%[_]bak[_]%' AND t.name NOT LIKE 'RENAME[_]%' AND t.name NOT LIKE 'tmp[_]%'
    AND t.object_id IN (SELECT OBJECT_ID(line_table) FROM yj_panel
                        UNION SELECT OBJECT_ID(head_table) FROM yj_panel WHERE head_table IS NOT NULL)
  ORDER BY t.name;
OPEN c; FETCH NEXT FROM c INTO @tb;
WHILE @@FETCH_STATUS = 0
BEGIN
  DECLARE @i int = 1;
  WHILE @i <= 20
  BEGIN
    SET @spare = N'备用' + CAST(@i AS nvarchar(10));
    IF COL_LENGTH(@tb, @spare) IS NULL
    BEGIN
      SET @sql = N'ALTER TABLE ' + QUOTENAME(@tb) + N' ADD ' + QUOTENAME(@spare) + N' nvarchar(500) NULL';
      EXEC sp_executesql @sql;
      SET @added += 1;
    END
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                   JOIN sys.columns col ON col.object_id = ep.major_id AND col.column_id = ep.minor_id
                   WHERE ep.major_id = OBJECT_ID(@tb) AND ep.name = N'MS_Description' AND col.name = @spare)
    BEGIN
      EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', @tb, N'COLUMN', @spare;
      SET @noted += 1;
    END
    SET @i += 1;
  END
  FETCH NEXT FROM c INTO @tb;
END
CLOSE c; DEALLOCATE c;
PRINT N'备用列池:新增列 ' + CAST(@added AS nvarchar(10)) + N' ,补注明 ' + CAST(@noted AS nvarchar(10));
-- 核对:范围内表是否都有 20 个备用列
DECLARE @bad int = (SELECT COUNT(DISTINCT t.name) FROM sys.tables t
  WHERE (t.name LIKE 'bs[_]%' OR t.name LIKE 'bd[_]%' OR t.name LIKE 'bl[_]%' OR t.name LIKE 'rd[_]%' OR t.name LIKE 'qc[_]%' OR t.name LIKE 'wo[_]%')
    AND t.name NOT LIKE '%[_]bak[_]%' AND t.name NOT LIKE 'RENAME[_]%' AND t.name NOT LIKE 'tmp[_]%'
    AND t.object_id IN (SELECT OBJECT_ID(line_table) FROM yj_panel UNION SELECT OBJECT_ID(head_table) FROM yj_panel WHERE head_table IS NOT NULL)
    AND (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = t.object_id AND c.name LIKE N'备用[0-9]%') < 20);
PRINT N'备用列不足20列的表: ' + CAST(@bad AS nvarchar(10));
GO
