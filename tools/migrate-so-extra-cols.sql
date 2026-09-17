-- migrate-so-extra-cols.sql — bd_so_order 补建 4 个金蝶同步扩展列
-- 背景:9452c01(2026-09-16)给 SO_ORDER 的 EXTRA 映射新增 折前价税合计/业务模式/交货方式id/发票类型
--       4 字段,但未建 bd_so_order 物理列(行表 bl_so_order 列齐),销售订单同步 10/10 失败
--       Invalid column name '发票类型'。本脚本补齐:物理列+yj_field 面板注册+en 译名+中文注明。
-- 幂等:列/字段/译名已存在自动跳过,可重跑。
SET NOCOUNT ON;
GO
IF COL_LENGTH('dbo.bd_so_order', N'折前价税合计') IS NULL ALTER TABLE dbo.bd_so_order ADD [折前价税合计] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'折前价税合计')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'折前价税合计', N'折前价税合计', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'折前价税合计' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'折前价税合计', 'en', N'Bill Dis Before Amount', 'manual');

IF COL_LENGTH('dbo.bd_so_order', N'业务模式') IS NULL ALTER TABLE dbo.bd_so_order ADD [业务模式] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'业务模式')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'业务模式', N'业务模式', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'业务模式' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'业务模式', 'en', N'Business Mode', 'manual');

IF COL_LENGTH('dbo.bd_so_order', N'交货方式id') IS NULL ALTER TABLE dbo.bd_so_order ADD [交货方式id] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'交货方式id')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'交货方式id', N'交货方式id', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'交货方式id' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'交货方式id', 'en', N'Delivery Type Id', 'manual');

IF COL_LENGTH('dbo.bd_so_order', N'发票类型') IS NULL ALTER TABLE dbo.bd_so_order ADD [发票类型] nvarchar(500) NULL;
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SO_ORDER' AND col_name=N'发票类型')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible) VALUES ('SO_ORDER', N'发票类型', N'发票类型', N'文本', N'header', 950, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发票类型' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发票类型', 'en', N'Invoice Type', 'manual');
GO
-- 列级中文注明(幂等:有则更新无则新增)
DECLARE @t sysname = N'bd_so_order';
DECLARE @cols TABLE (col sysname, descr nvarchar(400));
INSERT INTO @cols VALUES
  (N'折前价税合计', N'折前价税合计(金蝶bill_dis_before_amount,销售订单同步扩展列)'),
  (N'业务模式',     N'业务模式(金蝶biz_mode,销售订单同步扩展列)'),
  (N'交货方式id',   N'交货方式ID(金蝶delivery_type_id,销售订单同步扩展列)'),
  (N'发票类型',     N'发票类型(金蝶ivc_type,销售订单同步扩展列)');

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
PRINT N'migrate-so-extra-cols 完成';
GO
