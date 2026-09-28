-- migrate-so-line-whname.sql — bl_so_order 补建「仓库名称」行级列
-- 背景:四单据仓库关联改造把 SO_ORDER 行级扩展映射新增 仓库名称(金蝶stock_name) 字段,
--       但未建 bl_so_order 物理列,销售订单同步 50/50 失败 Invalid column name '仓库名称'。
-- 幂等:列/字段已存在自动跳过,可重跑。
SET NOCOUNT ON;
GO
IF COL_LENGTH('dbo.bl_so_order', N'仓库名称') IS NULL ALTER TABLE dbo.bl_so_order ADD [仓库名称] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'仓库名称')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'仓库名称', N'仓库名称', N'文本', N'detail', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库名称' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库名称', 'en', N'Warehouse Name', 'manual');
GO
-- 列级中文注明(幂等:有则更新无则新增)
DECLARE @t sysname = N'bl_so_order';
DECLARE @cols TABLE (col sysname, descr nvarchar(400));
INSERT INTO @cols VALUES
  (N'仓库名称', N'仓库名称(金蝶stock_name,销售订单行同步扩展列)');

DECLARE @c sysname, @d nvarchar(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, descr FROM @cols;
OPEN cur; FETCH NEXT FROM cur INTO @c, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH(@t, @c) IS NOT NULL
  BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(@t) AND ep.minor_id = COLUMNPROPERTY(ep.major_id, @c, 'ColumnId')
                 AND ep.name = 'MS_Description')
      EXEC sp_updateextendedproperty N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
    ELSE
      EXEC sp_addextendedproperty    N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
  END
  FETCH NEXT FROM cur INTO @c, @d;
END
CLOSE cur; DEALLOCATE cur;
GO
PRINT N'migrate-so-line-whname 完成';
GO
