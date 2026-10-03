-- migrate-whloc.sql — 库位档案面板(WHLOC/bs_wh_loc,2026-09-28)
-- 需求:基础数据新增「库位」档案,关联仓库(一仓多库位、一库位一仓);支持与商品档案同款
--       「二维码标签」勾选即打(75×100mm 标识卡,前端 printLocationCards),
--       二维码内容=仓库@库位地址@库位编码(扫码即定位仓库与库位,标识卡不含商品字段)。
-- 内容:bs_wh_loc 建表(含中文注明/审计四件套/备用列池)+ yj_panel/yj_field 注册
--       (仓库=参照 WH.仓库名称,存仓库名称;全系统 21 处仓库参照同口径)
--       + yj_translation 面板/字段九语言译名 + yj_role_panel 全角色默认可查。
-- 配套代码:PanelConfigService(WHLOC 注入 二维码标签 按钮组与 qrLabel 元数据)、
--           前端 print-formats.printLocationCards / PanelxList 库位标签分支 / menus.js 菜单。
-- 幂等:表/面板/字段/译名/授权均 IF NOT EXISTS,可重跑。
SET NOCOUNT ON;
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

-- ══════════ 1. 库位表(1 行=1 个库位;仓库列存仓库名称,参照 bs_wh.仓库名称) ══════════
IF OBJECT_ID('dbo.bs_wh_loc') IS NULL CREATE TABLE dbo.bs_wh_loc (
  id          bigint        IDENTITY(1,1) NOT NULL,
  [仓库]      nvarchar(200) NOT NULL,           -- 所属仓库(存仓库名称,参照 bs_wh.仓库名称;一仓多库位、一库位一仓)
  [库位编码]  nvarchar(100) NOT NULL,           -- 库位编码(库位业务标识,二维码第三段)
  [库位地址]  nvarchar(200) NOT NULL,           -- 库位地址(库内位置描述,如 A区3排2层;二维码第二段)
  [停用]      bit           NULL,               -- 停用标志(是/否)
  [备注]      nvarchar(500) NULL,
  asp_user1   nvarchar(50)  NULL,               -- 创建人
  asp_time1   datetime2     NULL,               -- 创建时间
  asp_user2   nvarchar(50)  NULL,               -- 最后修改人
  asp_time2   datetime2     NULL,               -- 最后修改时间
  asp_cancel  nvarchar(1)   NULL DEFAULT 'N',   -- 软删标志('Y'=已删,审计列默认值合法:数据库规范 §2.3)
  CONSTRAINT pk_bs_wh_loc PRIMARY KEY CLUSTERED (id)
);
-- 备用列池(动态字段承载,与 migrate-spare-columns.sql 同规格 nvarchar(500))
IF OBJECT_ID('dbo.bs_wh_loc') IS NOT NULL AND COL_LENGTH('dbo.bs_wh_loc', N'备用1') IS NULL
BEGIN
  DECLARE @i int = 1, @sp nvarchar(10), @spareAdd nvarchar(400);
  WHILE @i <= 20
  BEGIN
    SET @sp = N'备用' + CAST(@i AS nvarchar(10));
    SET @spareAdd = N'ALTER TABLE dbo.bs_wh_loc ADD ' + QUOTENAME(@sp) + N' nvarchar(500) NULL';
    EXEC sp_executesql @spareAdd;
    SET @i += 1;
  END
END
GO

-- ══════════ 2. 中文注明(MS_Description;已有不覆盖——绑定动态字段后的业务注明不受影响) ══════════
IF OBJECT_ID('dbo.bs_wh_loc') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties
  WHERE major_id = OBJECT_ID('dbo.bs_wh_loc') AND minor_id = 0 AND name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
    N'库位档案(仓库内货位主数据:仓库/库位编码/库位地址;一仓多库位、一库位一仓;仓库列存仓库名称参照 bs_wh;库位二维码标签内容=仓库@库位地址@库位编码)',
    N'SCHEMA', N'dbo', N'TABLE', N'bs_wh_loc';
-- 英文/系统列注明(规范 §1.2:中文列名语义自明可豁免,英名列必须注明)
IF COL_LENGTH('dbo.bs_wh_loc', 'id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
  JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
  WHERE ep.major_id = OBJECT_ID('dbo.bs_wh_loc') AND ep.name = 'MS_Description' AND c.name = 'id')
  EXEC sp_addextendedproperty N'MS_Description', N'自增主键', N'SCHEMA', N'dbo', N'TABLE', N'bs_wh_loc', N'COLUMN', N'id';
IF COL_LENGTH('dbo.bs_wh_loc', 'asp_user1') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
  JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
  WHERE ep.major_id = OBJECT_ID('dbo.bs_wh_loc') AND ep.name = 'MS_Description' AND c.name = 'asp_user1')
  EXEC sp_addextendedproperty N'MS_Description', N'创建人', N'SCHEMA', N'dbo', N'TABLE', N'bs_wh_loc', N'COLUMN', N'asp_user1';
IF COL_LENGTH('dbo.bs_wh_loc', 'asp_time1') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
  JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
  WHERE ep.major_id = OBJECT_ID('dbo.bs_wh_loc') AND ep.name = 'MS_Description' AND c.name = 'asp_time1')
  EXEC sp_addextendedproperty N'MS_Description', N'创建时间', N'SCHEMA', N'dbo', N'TABLE', N'bs_wh_loc', N'COLUMN', N'asp_time1';
IF COL_LENGTH('dbo.bs_wh_loc', 'asp_user2') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
  JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
  WHERE ep.major_id = OBJECT_ID('dbo.bs_wh_loc') AND ep.name = 'MS_Description' AND c.name = 'asp_user2')
  EXEC sp_addextendedproperty N'MS_Description', N'最后修改人', N'SCHEMA', N'dbo', N'TABLE', N'bs_wh_loc', N'COLUMN', N'asp_user2';
IF COL_LENGTH('dbo.bs_wh_loc', 'asp_time2') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
  JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
  WHERE ep.major_id = OBJECT_ID('dbo.bs_wh_loc') AND ep.name = 'MS_Description' AND c.name = 'asp_time2')
  EXEC sp_addextendedproperty N'MS_Description', N'最后修改时间', N'SCHEMA', N'dbo', N'TABLE', N'bs_wh_loc', N'COLUMN', N'asp_time2';
IF COL_LENGTH('dbo.bs_wh_loc', 'asp_cancel') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
  JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
  WHERE ep.major_id = OBJECT_ID('dbo.bs_wh_loc') AND ep.name = 'MS_Description' AND c.name = 'asp_cancel')
  EXEC sp_addextendedproperty N'MS_Description', N'软删标志(Y=已删除,与旧 ASPMIS 约定一致)', N'SCHEMA', N'dbo', N'TABLE', N'bs_wh_loc', N'COLUMN', N'asp_cancel';
-- 备用列池注明(与 migrate-spare-columns.sql 同文案)
IF OBJECT_ID('dbo.bs_wh_loc') IS NOT NULL
BEGIN
  DECLARE @spi int = 1, @spn sysname, @spd nvarchar(100);
  WHILE @spi <= 20
  BEGIN
    SET @spn = N'备用' + CAST(@spi AS nvarchar(10));
    IF COL_LENGTH('dbo.bs_wh_loc', @spn) IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
      JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
      WHERE ep.major_id = OBJECT_ID('dbo.bs_wh_loc') AND ep.name = 'MS_Description' AND c.name = @spn)
      EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bs_wh_loc', N'COLUMN', @spn;
    SET @spi += 1;
  END
END
GO

-- ══════════ 3. 面板注册(archive 单单据结构,对齐 WH/bs_wh 口径) ══════════
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'WHLOC')
  INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
  VALUES ('WHLOC', N'库位', N'基础档案', 'archive', 'bs_wh_loc', NULL, NULL, 'id', NULL, NULL, NULL, 100, 'locations', N'基础设置', N'Storage Location');
ELSE
  UPDATE yj_panel SET panel_name = N'库位', panel_name_en = N'Storage Location', category = N'基础档案', mode = 'archive',
    line_table = 'bs_wh_loc', head_table = NULL, pk_col = 'id', detail_key = 'locations', module_group = N'基础设置'
  WHERE panel_code = 'WHLOC';
GO

-- ══════════ 4. 字段注册(仓库=参照 WH,存仓库名称;编码/地址必填=二维码三段完整) ══════════
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'WHLOC' AND col_name = N'仓库')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('WHLOC', N'仓库', N'仓库', N'参照', NULL, 'WH', N'仓库名称', N'仓库名称', N'query,detail', 10, 140, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'WHLOC' AND col_name = N'库位编码')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('WHLOC', N'库位编码', N'库位编码', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 20, 140, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'WHLOC' AND col_name = N'库位地址')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('WHLOC', N'库位地址', N'库位地址', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 30, 200, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'WHLOC' AND col_name = N'停用')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('WHLOC', N'停用', N'停用', N'是否', NULL, NULL, NULL, NULL, N'query,detail', 40, 90, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'WHLOC' AND col_name = N'备注')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('WHLOC', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 220, 1, 0, 0, 1);
GO

-- ══════════ 5. 面板名译名(九语言;仓库名/字段标签已有译名不重复插入) ══════════
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'库位' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'库位', 'en', N'Storage Location', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'库位' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'库位', 'ja', N'ロケーション', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'库位' AND locale='ko') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'库位', 'ko', N'저장 위치', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'库位' AND locale='es') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'库位', 'es', N'Ubicación de almacenamiento', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'库位' AND locale='fr') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'库位', 'fr', N'Emplacement de stockage', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'库位' AND locale='de') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'库位', 'de', N'Lagerplatz', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'库位' AND locale='ru') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'库位', 'ru', N'Место хранения', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'库位' AND locale='vi') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'库位', 'vi', N'Vị trí lưu trữ', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'库位' AND locale='th') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'库位', 'th', N'ตำแหน่งจัดเก็บ', 'manual');
GO

-- ══════════ 6. 字段标签译名(九语言 × 库位编码/库位地址;仓库/停用/备注 已有译名) ══════════
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库位编码' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库位编码', 'en', N'Location Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库位编码' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库位编码', 'ja', N'ロケーションコード', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库位编码' AND locale='ko') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库位编码', 'ko', N'위치 코드', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库位编码' AND locale='es') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库位编码', 'es', N'Código de ubicación', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库位编码' AND locale='fr') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库位编码', 'fr', N'Code d''emplacement', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库位编码' AND locale='de') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库位编码', 'de', N'Lagerortcode', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库位编码' AND locale='ru') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库位编码', 'ru', N'Код места хранения', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库位编码' AND locale='vi') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库位编码', 'vi', N'Mã vị trí', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库位编码' AND locale='th') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库位编码', 'th', N'รหัสตำแหน่ง', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库位地址' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库位地址', 'en', N'Location Address', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库位地址' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库位地址', 'ja', N'ロケーション住所', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库位地址' AND locale='ko') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库位地址', 'ko', N'위치 주소', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库位地址' AND locale='es') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库位地址', 'es', N'Dirección de ubicación', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库位地址' AND locale='fr') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库位地址', 'fr', N'Adresse d''emplacement', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库位地址' AND locale='de') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库位地址', 'de', N'Lagerortadresse', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库位地址' AND locale='ru') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库位地址', 'ru', N'Адрес места хранения', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库位地址' AND locale='vi') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库位地址', 'vi', N'Địa chỉ vị trí', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'库位地址' AND locale='th') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'库位地址', 'th', N'ที่อยู่ตำแหน่ง', 'manual');
GO

-- ══════════ 7. 全角色默认可查(基础数据全员可见;增删改按角色授权,管理员恒全量) ══════════
INSERT INTO yj_role_panel (role_id, panel_code, perms, can_approve)
SELECT r.id, 'WHLOC', 'view,query', 'N'
FROM yj_role r
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel rp WHERE rp.role_id = r.id AND rp.panel_code = 'WHLOC');
GO

-- ══════════ 验证 ══════════
SELECT N'表列数' AS what, CAST(COUNT(*) AS varchar(10)) AS cnt FROM sys.columns WHERE object_id = OBJECT_ID('bs_wh_loc')
UNION ALL SELECT N'表注明', CAST(COUNT(*) AS varchar(10)) FROM sys.extended_properties WHERE major_id = OBJECT_ID('bs_wh_loc') AND minor_id = 0
UNION ALL SELECT N'列注明', CAST(COUNT(*) AS varchar(10)) FROM sys.extended_properties ep JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id WHERE ep.major_id = OBJECT_ID('bs_wh_loc')
UNION ALL SELECT N'面板', CAST(COUNT(*) AS varchar(10)) FROM yj_panel WHERE panel_code = 'WHLOC'
UNION ALL SELECT N'字段', CAST(COUNT(*) AS varchar(10)) FROM yj_field WHERE panel_code = 'WHLOC'
UNION ALL SELECT N'面板译名(库位×9语言)', CAST(COUNT(*) AS varchar(10)) FROM yj_translation WHERE scope='panel' AND ref_key=N'库位'
UNION ALL SELECT N'字段译名(库位编码/库位地址×9语言)', CAST(COUNT(*) AS varchar(10)) FROM yj_translation WHERE scope='field' AND ref_key IN (N'库位编码', N'库位地址')
UNION ALL SELECT N'角色授权', CAST(COUNT(*) AS varchar(10)) FROM yj_role_panel WHERE panel_code = 'WHLOC';
GO
PRINT N'migrate-whloc 完成';
GO
