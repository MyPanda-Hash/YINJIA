-- migrate-share-file.sql — 研发管理·共享文件模块(2026-09-17)
-- 全公司共享资料库:标准/测试报告/认证报告等,分类树可自行增减;
-- 上传/修改/删除限指定人(yj_role_panel 权限词 add/edit/delete),其余角色仅查阅(view),不走审批流。
-- 文件本体复用 yj_attachment(锚点 panel_code='RD_SHARE_FILE' + doc_no=文件编号 + field_key='文件'),
-- 上传后 AttachmentService.syncHeadField 把原文件名串回写 yj_share_file.文件 列(WYSIWYG)。
-- 幂等:表不存在才建、逐列补列;种子分类只在空表时落;面板/字段/翻译/角色授权 NOT EXISTS。
-- 运行(UTF-8 无 BOM,需 -f 65001):
--   docker cp tools/migrate-share-file.sql mssql2019:/tmp/
--   docker exec mssql2019 bash -c "/opt/mssql-tools18/bin/sqlcmd -S localhost -U yinjia -P *** -d HSDZ_MES -C -f 65001 -i /tmp/migrate-share-file.sql"
SET NOCOUNT ON;

-- ══════════ 1. 分类表(树:parent_id 空=一级;分类可增减,有文件或子分类时禁删) ══════════
IF OBJECT_ID('yj_share_file_cat') IS NULL CREATE TABLE yj_share_file_cat (
  id        int IDENTITY(1,1) PRIMARY KEY,
  parent_id int NULL,                 -- 父分类id(NULL=一级分类)
  cat_name  nvarchar(100) NOT NULL,   -- 分类名称
  seq       int NOT NULL DEFAULT 0,   -- 同级排序(小在前)
  asp_user1 nvarchar(50)  NULL,       -- 创建人
  asp_time1 datetime2      NULL,      -- 创建时间
  asp_user2 nvarchar(50)  NULL,       -- 最后修改人
  asp_time2 datetime2      NULL       -- 最后修改时间
);
IF OBJECT_ID('yj_share_file_cat') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_sfc_parent')
  CREATE INDEX ix_sfc_parent ON yj_share_file_cat (parent_id, seq, id);
GO

-- ══════════ 2. 文件表(1 行=1 份共享文件;业务键中文,对齐面板引擎数据键约定) ══════════
IF OBJECT_ID('yj_share_file') IS NULL CREATE TABLE yj_share_file (
  id          int IDENTITY(1,1) PRIMARY KEY,
  [文件编号]  nvarchar(20)  NOT NULL,  -- SF00001 形式(插入后按 id 回填,沟通引用用)
  [分类]      int           NOT NULL,  -- 分类id(yj_share_file_cat.id)
  [文件名称]  nvarchar(200) NOT NULL,  -- 展示名(默认=原文件名去扩展)
  [版本号]    nvarchar(50)  NULL,      -- 如 2024版 / V2.1
  [生效日期]  nvarchar(20)  NULL,
  [失效日期]  nvarchar(20)  NULL,
  [关键词]    nvarchar(200) NULL,      -- 检索用(空格分隔多词)
  [备注]      nvarchar(500) NULL,
  [文件]      nvarchar(500) NULL,      -- 原文件名串(附件服务回写,WYSIWYG)
  [上传人]    nvarchar(50)  NULL,
  [上传时间]  datetime2     NULL,
  asp_user1   nvarchar(50)  NULL,
  asp_time1   datetime2     NULL,
  asp_user2   nvarchar(50)  NULL,
  asp_time2   datetime2     NULL,
  asp_cancel  char(1)       NULL DEFAULT 'N',
);
IF OBJECT_ID('yj_share_file') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_sf_cat')
  CREATE INDEX ix_sf_cat ON yj_share_file ([分类], id DESC);
IF OBJECT_ID('yj_share_file') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ux_sf_no')
  CREATE UNIQUE INDEX ux_sf_no ON yj_share_file ([文件编号]);
GO

-- ══════════ 3. 中文注明(MS_Description;已有不覆盖) ══════════
IF OBJECT_ID('yj_share_file_cat') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties
  WHERE major_id=OBJECT_ID('yj_share_file_cat') AND minor_id=0 AND name='MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'共享文件分类表(树形 parent_id,研发管理·共享文件模块;分类可增减,有文件或子分类时禁删)', N'SCHEMA',N'dbo',N'TABLE',N'yj_share_file_cat';
IF OBJECT_ID('yj_share_file') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.extended_properties
  WHERE major_id=OBJECT_ID('yj_share_file') AND minor_id=0 AND name='MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'共享文件表(研发管理·全公司共享资料:标准/测试报告/认证报告;1行=1份文件,文件本体存yj_attachment,权限=指定人上传改删、其余仅查阅)', N'SCHEMA',N'dbo',N'TABLE',N'yj_share_file';
GO

-- ══════════ 4. 种子分类(只在空表时落,后续用户自行增减;源自需求草图,ROSH→RoHS 正名) ══════════
IF (SELECT COUNT(*) FROM yj_share_file_cat) = 0
BEGIN
  DECLARE @p int, @c int;
  INSERT INTO yj_share_file_cat (parent_id, cat_name, seq, asp_user1, asp_time1) VALUES (NULL, N'标准', 10, N'system', SYSDATETIME());
  SET @p = SCOPE_IDENTITY();
  INSERT INTO yj_share_file_cat (parent_id, cat_name, seq, asp_user1, asp_time1) VALUES (@p, N'企标', 10, N'system', SYSDATETIME());
  INSERT INTO yj_share_file_cat (parent_id, cat_name, seq, asp_user1, asp_time1) VALUES (@p, N'国标/行标', 20, N'system', SYSDATETIME());
  INSERT INTO yj_share_file_cat (parent_id, cat_name, seq, asp_user1, asp_time1) VALUES (@p, N'NSF标准', 30, N'system', SYSDATETIME());

  INSERT INTO yj_share_file_cat (parent_id, cat_name, seq, asp_user1, asp_time1) VALUES (NULL, N'测试报告', 20, N'system', SYSDATETIME());
  SET @p = SCOPE_IDENTITY();
  INSERT INTO yj_share_file_cat (parent_id, cat_name, seq, asp_user1, asp_time1) VALUES (@p, N'出口所需报告', 10, N'system', SYSDATETIME());
  SET @c = SCOPE_IDENTITY();
  INSERT INTO yj_share_file_cat (parent_id, cat_name, seq, asp_user1, asp_time1) VALUES (@c, N'空运/海运/自热报告', 10, N'system', SYSDATETIME());
  INSERT INTO yj_share_file_cat (parent_id, cat_name, seq, asp_user1, asp_time1) VALUES (@p, N'有害物质', 20, N'system', SYSDATETIME());
  SET @c = SCOPE_IDENTITY();
  INSERT INTO yj_share_file_cat (parent_id, cat_name, seq, asp_user1, asp_time1) VALUES (@c, N'RoHS', 10, N'system', SYSDATETIME());
  INSERT INTO yj_share_file_cat (parent_id, cat_name, seq, asp_user1, asp_time1) VALUES (@c, N'REACH', 20, N'system', SYSDATETIME());

  INSERT INTO yj_share_file_cat (parent_id, cat_name, seq, asp_user1, asp_time1) VALUES (NULL, N'产品认证', 30, N'system', SYSDATETIME());
  SET @p = SCOPE_IDENTITY();
  INSERT INTO yj_share_file_cat (parent_id, cat_name, seq, asp_user1, asp_time1) VALUES (@p, N'涉水批件', 10, N'system', SYSDATETIME());
  INSERT INTO yj_share_file_cat (parent_id, cat_name, seq, asp_user1, asp_time1) VALUES (@p, N'认证', 20, N'system', SYSDATETIME());
END
GO

-- ══════════ 5. 面板注册(mode=archive 不触发审批;head_table/group_col 供附件头列同步;菜单走专用路由不进面板引擎) ══════════
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_SHARE_FILE')
  INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
  VALUES ('RD_SHARE_FILE', N'共享文件库', N'研发管理', 'archive', NULL, 'yj_share_file', N'文件编号', N'id', N'文件编号', NULL, N'上传时间', 20, 'items', N'研发管理', N'Shared Files');
ELSE
  UPDATE yj_panel SET panel_name=N'共享文件库', panel_name_en=N'Shared Files', head_table='yj_share_file', group_col=N'文件编号', module_group=N'研发管理' WHERE panel_code='RD_SHARE_FILE';
GO

-- ══════════ 6. 字段注册(仅 文件 附件列:附件服务头列同步的注册前提) ══════════
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_SHARE_FILE' AND col_name=N'文件')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
  VALUES ('RD_SHARE_FILE', N'文件', N'文件', N'附件', NULL, NULL, NULL, NULL, N'header', 10, 260, 1, 0, 0, 1);
GO

-- ══════════ 7. 面板名翻译(9 语言,人工) ══════════
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'共享文件库' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'共享文件库', 'en', N'Shared Files', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'共享文件库' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'共享文件库', 'ja', N'共有ファイル', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'共享文件库' AND locale='ko') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'共享文件库', 'ko', N'공유 파일', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'共享文件库' AND locale='es') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'共享文件库', 'es', N'Archivos compartidos', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'共享文件库' AND locale='fr') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'共享文件库', 'fr', N'Fichiers partagés', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'共享文件库' AND locale='de') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'共享文件库', 'de', N'Freigegebene Dateien', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'共享文件库' AND locale='ru') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'共享文件库', 'ru', N'Общие файлы', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'共享文件库' AND locale='vi') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'共享文件库', 'vi', N'Tệp chia sẻ', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'共享文件库' AND locale='th') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'共享文件库', 'th', N'ไฟล์แชร์', 'manual');
GO

-- ══════════ 8. 全角色默认 view,query(全公司可查阅;上传权=组织架构里按角色勾 add/edit/delete,管理员恒全量) ══════════
INSERT INTO yj_role_panel (role_id, panel_code, perms, can_approve)
SELECT r.id, 'RD_SHARE_FILE', 'view,query', 'N'
FROM yj_role r
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel rp WHERE rp.role_id=r.id AND rp.panel_code='RD_SHARE_FILE');
GO

-- ══════════ 验证 ══════════
SELECT 'cat' AS what, COUNT(*) AS cnt FROM yj_share_file_cat
UNION ALL SELECT 'file', COUNT(*) FROM yj_share_file
UNION ALL SELECT 'panel', COUNT(*) FROM yj_panel WHERE panel_code='RD_SHARE_FILE'
UNION ALL SELECT 'field', COUNT(*) FROM yj_field WHERE panel_code='RD_SHARE_FILE'
UNION ALL SELECT 'tr', COUNT(*) FROM yj_translation WHERE scope='panel' AND ref_key=N'共享文件库'
UNION ALL SELECT 'role_perm', COUNT(*) FROM yj_role_panel WHERE panel_code='RD_SHARE_FILE';
GO
