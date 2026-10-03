-- migrate-wh-location.sql — 仓库档案(WH/bs_wh)新增「库位」字段
-- 需求(2026-09-28):仓库档案加一个库位,按可编辑编号(文本)处理,不做仓位管理体系。
-- 内容:bs_wh 物理列 + yj_field 面板注册(detail/可编辑)+ yj_translation 九语言译名 + 列中文注明。
-- 幂等:列/字段/译名/注明已存在自动跳过,可重跑。
SET NOCOUNT ON;
GO
-- 1) 物理列(bs_wh.库位)
IF COL_LENGTH('dbo.bs_wh', N'库位') IS NULL ALTER TABLE dbo.bs_wh ADD [库位] nvarchar(200) NULL;
GO
-- 2) 面板字段注册(WH 明细,排在 仓库地址(30) 与 负责人(40) 之间)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WH' AND col_name=N'库位')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('WH', N'库位', N'库位', N'文本', N'detail', 35, 120, 1, 0, 0, 1);
GO
-- 3) 字段译名(九语言,与 仓库编码 等兄弟字段同套)
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库位' AND locale='en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库位', 'en', N'Storage Location', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库位' AND locale='ja')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库位', 'ja', N'ロケーション', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库位' AND locale='ko')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库位', 'ko', N'저장 위치', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库位' AND locale='es')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库位', 'es', N'Ubicación de almacenamiento', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库位' AND locale='fr')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库位', 'fr', N'Emplacement de stockage', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库位' AND locale='de')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库位', 'de', N'Lagerplatz', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库位' AND locale='ru')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库位', 'ru', N'Место хранения', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库位' AND locale='vi')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库位', 'vi', N'Vị trí lưu trữ', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库位' AND locale='th')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库位', 'th', N'ตำแหน่งจัดเก็บ', 'manual');
GO
-- 4) 列级中文注明(幂等:有则更新无则新增)
DECLARE @t sysname = N'bs_wh';
DECLARE @c sysname = N'库位';
DECLARE @d nvarchar(400) = N'库位(仓库内货位编号,手工录入文本;2026-09-28 仓库档案新增)';
IF COL_LENGTH(@t, @c) IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.extended_properties ep
             WHERE ep.major_id = OBJECT_ID(@t) AND ep.minor_id = COLUMNPROPERTY(ep.major_id, @c, 'ColumnId')
               AND ep.name = 'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
  ELSE
    EXEC sp_addextendedproperty    N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @c;
END
GO
PRINT N'migrate-wh-location 完成';
GO
