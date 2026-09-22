-- migrate-qc-tcin-sign.sql — 特采单(QC_TC_IN)签名/日期可填写化
-- 背景:原表会签区「签名：____ 年 月 日」与特采理由「申请人:__ 年 月 日」此前是纯印刷文本,
--       用户要求可填写。需要各自落库 → 头表加 9 列 + yj_field 注册(hidden=1,仅文书表单用,
--       不进通用表单/列表,与 文档编号 同口径)。
-- 日期口径:nvarchar(10),存 'YYYY-MM-DD';前端按 年/月/日 三段空拆填,允许部分填写(如只填年)。
-- 幂等:COL_LENGTH / IF NOT EXISTS 判断,可反复执行。
SET NOCOUNT ON;

-- ═════════════ 1. 头表加列 ═════════════
DECLARE @t sysname = N'qc_tc_in';
IF COL_LENGTH(@t, N'特采理由日期')   IS NULL ALTER TABLE qc_tc_in ADD [特采理由日期]   nvarchar(10) NULL;
IF COL_LENGTH(@t, N'产品开发部签名') IS NULL ALTER TABLE qc_tc_in ADD [产品开发部签名] nvarchar(50) NULL;
IF COL_LENGTH(@t, N'产品开发部日期') IS NULL ALTER TABLE qc_tc_in ADD [产品开发部日期] nvarchar(10) NULL;
IF COL_LENGTH(@t, N'品质部签名')     IS NULL ALTER TABLE qc_tc_in ADD [品质部签名]     nvarchar(50) NULL;
IF COL_LENGTH(@t, N'品质部日期')     IS NULL ALTER TABLE qc_tc_in ADD [品质部日期]     nvarchar(10) NULL;
IF COL_LENGTH(@t, N'销售部签名')     IS NULL ALTER TABLE qc_tc_in ADD [销售部签名]     nvarchar(50) NULL;
IF COL_LENGTH(@t, N'销售部日期')     IS NULL ALTER TABLE qc_tc_in ADD [销售部日期]     nvarchar(10) NULL;
IF COL_LENGTH(@t, N'研发签名')       IS NULL ALTER TABLE qc_tc_in ADD [研发签名]       nvarchar(50) NULL;
IF COL_LENGTH(@t, N'研发日期')       IS NULL ALTER TABLE qc_tc_in ADD [研发日期]       nvarchar(10) NULL;
GO

-- ═════════════ 2. 列中文注明 ═════════════
DECLARE @t2 sysname = N'qc_tc_in';
DECLARE @cols TABLE (col sysname, descr nvarchar(400));
INSERT INTO @cols VALUES
  (N'特采理由日期',   N'特采理由·申请人签名日期(年/月/日 三段填,存 YYYY-MM-DD)'),
  (N'产品开发部签名', N'产品开发部意见·会签人签名'),
  (N'产品开发部日期', N'产品开发部意见·会签日期(年/月/日 三段填,存 YYYY-MM-DD)'),
  (N'品质部签名',     N'品质部意见·会签人签名'),
  (N'品质部日期',     N'品质部意见·会签日期(年/月/日 三段填,存 YYYY-MM-DD)'),
  (N'销售部签名',     N'销售部意见·会签人签名'),
  (N'销售部日期',     N'销售部意见·会签日期(年/月/日 三段填,存 YYYY-MM-DD)'),
  (N'研发签名',       N'研发意见·会签人签名'),
  (N'研发日期',       N'研发意见·会签日期(年/月/日 三段填,存 YYYY-MM-DD)');
DECLARE @c sysname, @d nvarchar(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, descr FROM @cols;
OPEN cur; FETCH NEXT FROM cur INTO @c, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH(@t2, @c) IS NOT NULL
  BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(@t2) AND ep.minor_id = COLUMNPROPERTY(ep.major_id, @c, 'ColumnId')
                 AND ep.name = 'MS_Description')
      EXEC sp_updateextendedproperty N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @t2, N'COLUMN', @c;
    ELSE
      EXEC sp_addextendedproperty    N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @t2, N'COLUMN', @c;
  END
  FETCH NEXT FROM cur INTO @c, @d;
END
CLOSE cur; DEALLOCATE cur;
GO

-- ═════════════ 3. 字段注册(hidden=1:仅文书表单绑定落库,不进通用表单,与 文档编号 同口径) ═════════════
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'特采理由日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'特采理由日期', N'特采理由日期', N'文本', NULL, NULL, NULL, NULL, N'header', 230, 110, 1, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'产品开发部签名') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'产品开发部签名', N'产品开发部签名', N'文本', NULL, NULL, NULL, NULL, N'header', 231, 100, 1, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'产品开发部日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'产品开发部日期', N'产品开发部日期', N'文本', NULL, NULL, NULL, NULL, N'header', 232, 110, 1, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'品质部签名') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'品质部签名', N'品质部签名', N'文本', NULL, NULL, NULL, NULL, N'header', 233, 100, 1, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'品质部日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'品质部日期', N'品质部日期', N'文本', NULL, NULL, NULL, NULL, N'header', 234, 110, 1, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'销售部签名') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'销售部签名', N'销售部签名', N'文本', NULL, NULL, NULL, NULL, N'header', 235, 100, 1, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'销售部日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'销售部日期', N'销售部日期', N'文本', NULL, NULL, NULL, NULL, N'header', 236, 110, 1, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'研发签名') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'研发签名', N'研发签名', N'文本', NULL, NULL, NULL, NULL, N'header', 237, 100, 1, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'研发日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'研发日期', N'研发日期', N'文本', NULL, NULL, NULL, NULL, N'header', 238, 110, 1, 0, 1, 1);
GO

-- ═════════════ 4. 译名(en;其余语言由机翻补齐) ═════════════
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'特采理由日期' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'特采理由日期', 'en', N'Application Date', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产品开发部签名' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品开发部签名', 'en', N'Product Dev Signer', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'产品开发部日期' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'产品开发部日期', 'en', N'Product Dev Sign Date', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'品质部签名' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'品质部签名', 'en', N'QC Dept. Signer', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'品质部日期' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'品质部日期', 'en', N'QC Dept. Sign Date', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'销售部签名' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'销售部签名', 'en', N'Sales Signer', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'销售部日期' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'销售部日期', 'en', N'Sales Sign Date', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'研发签名' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'研发签名', 'en', N'R&D Signer', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'研发日期' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'研发日期', 'en', N'R&D Sign Date', 'manual');
GO
