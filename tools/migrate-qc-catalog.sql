-- migrate-qc-catalog.sql — 来料品质「检验目录」面板(QC_CATALOG,单单据)
-- 来源:《参考(不上传仓库)\参考文档(不上传仓库)\品质资料 2026.09.19.xlsx》「检验目录」页签,
--       表格一比一落库:第1类 检测物料类别 → 第2类 物料名称 → 第3类 检验记录目录(批次号/数量/检验状态/是否合格);
--       检验状态 = 正在检验中/已完成检验;是否合格 = 合格/不合格(两下拉即原表两列的取值说明)。
-- 方式:一比一对照「项目进度查询」(RD_PROGRESS)的实现 —— yj_panel(doc 模式,头行表)+ config {"singleDoc":true}
--       全部检验批次记录进同一张目录单,前端隐藏「新增」入口、保留单据状态机(永远草稿,无归档语义);
--       表头只留单据身份字段,业务数据全部在明细行(与 rd_progress_detail 同构)。
-- 幂等:IF NOT EXISTS / 空表才播种,可反复执行。
SET NOCOUNT ON;

-- ═════════════ 1. 头表(单单据身份) ═════════════
IF OBJECT_ID('qc_catalog') IS NULL CREATE TABLE qc_catalog (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [备注] nvarchar(500) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO
-- ═════════════ 2. 行表(检验记录目录:每行=一个物料批次) ═════════════
IF OBJECT_ID('qc_catalog_detail') IS NULL CREATE TABLE qc_catalog_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [检测物料类别] nvarchar(100) NULL,          -- 原表「第1类 检测物料类别」(如 阻垢料/SMS料)
  [物料名称] nvarchar(200) NULL,              -- 原表「第2类 物料名称」(如 HP-12/HP-08/SSC-Q3)
  [批次号] nvarchar(100) NULL,                -- 原表「第3类 检验记录目录·批次号」(如 260807)
  [数量] nvarchar(50) NULL,                   -- 原表·数量(文本,保留 51Kg 这类带单位写法)
  [检验状态] nvarchar(20) NULL,               -- 下拉:正在检验中/已完成检验
  [是否合格] nvarchar(20) NULL,               -- 下拉:合格/不合格
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

-- ═════════════ 3. 表/列中文注明(AGENTS.md 2026-09-14 起强制) ═════════════
DECLARE @t sysname = N'qc_catalog';
IF EXISTS (SELECT 1 FROM sys.extended_properties ep
           WHERE ep.major_id = OBJECT_ID(@t) AND ep.minor_id = 0 AND ep.name = 'MS_Description')
  EXEC sp_updateextendedproperty N'MS_Description',
       N'来料品质检验目录头表(单单据面板:全部检验批次记录进同一张目录单,单据号前缀 JYML,方式对照项目进度查询 RD_PROGRESS)',
       N'SCHEMA', N'dbo', N'TABLE', @t;
ELSE
  EXEC sp_addextendedproperty N'MS_Description',
       N'来料品质检验目录头表(单单据面板:全部检验批次记录进同一张目录单,单据号前缀 JYML,方式对照项目进度查询 RD_PROGRESS)',
       N'SCHEMA', N'dbo', N'TABLE', @t;

DECLARE @cols TABLE (col sysname, descr nvarchar(400));
INSERT INTO @cols VALUES
  (N'单据编号', N'单据编号(流水号,前缀 JYML-年月-4位流水;单单据面板,正常只有一张)'),
  (N'单据日期', N'单据日期(空白草稿自动填当天)'),
  (N'备注',     N'备注(表头仅单据身份字段,业务数据全部在明细行)');

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

DECLARE @t2 sysname = N'qc_catalog_detail';
IF EXISTS (SELECT 1 FROM sys.extended_properties ep
           WHERE ep.major_id = OBJECT_ID(@t2) AND ep.minor_id = 0 AND ep.name = 'MS_Description')
  EXEC sp_updateextendedproperty N'MS_Description',
       N'来料品质检验目录行表(检验记录目录,每行=一个物料批次;检测物料类别→物料名称→批次号 三级对照《品质资料 2026.09.19.xlsx》检验目录页签)',
       N'SCHEMA', N'dbo', N'TABLE', @t2;
ELSE
  EXEC sp_addextendedproperty N'MS_Description',
       N'来料品质检验目录行表(检验记录目录,每行=一个物料批次;检测物料类别→物料名称→批次号 三级对照《品质资料 2026.09.19.xlsx》检验目录页签)',
       N'SCHEMA', N'dbo', N'TABLE', @t2;

DECLARE @cols2 TABLE (col sysname, descr nvarchar(400));
INSERT INTO @cols2 VALUES
  (N'单据编号',     N'所属目录单编号(关联 qc_catalog.单据编号)'),
  (N'检测物料类别', N'检测物料类别(原表第1类,如 阻垢料/SMS料;口径待品质确认,先文本自由维护)'),
  (N'物料名称',     N'物料名称(原表第2类,如 HP-12/HP-08/SSC-Q3)'),
  (N'批次号',       N'批次号(原表第3类·检验记录目录首列,如 260807)'),
  (N'数量',         N'数量(文本,保留原表 51Kg 这类带单位写法)'),
  (N'检验状态',     N'检验状态(下拉:正在检验中/已完成检验)'),
  (N'是否合格',     N'是否合格(下拉:合格/不合格;正在检验中可留空)');

DECLARE @c2 sysname, @d2 nvarchar(400);
DECLARE cur2 CURSOR LOCAL FAST_FORWARD FOR SELECT col, descr FROM @cols2;
OPEN cur2; FETCH NEXT FROM cur2 INTO @c2, @d2;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF COL_LENGTH(@t2, @c2) IS NOT NULL
  BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(@t2) AND ep.minor_id = COLUMNPROPERTY(ep.major_id, @c2, 'ColumnId')
                 AND ep.name = 'MS_Description')
      EXEC sp_updateextendedproperty N'MS_Description', @d2, N'SCHEMA', N'dbo', N'TABLE', @t2, N'COLUMN', @c2;
    ELSE
      EXEC sp_addextendedproperty    N'MS_Description', @d2, N'SCHEMA', N'dbo', N'TABLE', @t2, N'COLUMN', @c2;
  END
  FETCH NEXT FROM cur2 INTO @c2, @d2;
END
CLOSE cur2; DEALLOCATE cur2;
GO

-- ═════════════ 4. 面板注册(doc 模式 + 单单据) ═════════════
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'QC_CATALOG')
INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
SELECT 'QC_CATALOG', N'检验目录', (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'检验目录' AND locale='en'),
       N'单据', 'doc', 'qc_catalog_detail', 'qc_catalog', N'单据编号', N'id', N'单据编号', N'JYML', N'单据日期', 20, 'items', N'品质管理'
WHERE NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'QC_CATALOG');
-- 单单据标记(与 RD_PROGRESS 同一机制:前端隐藏「新增」入口,保留单据状态机)
UPDATE yj_panel
   SET config = N'{"singleDoc":true}'
 WHERE panel_code = 'QC_CATALOG'
   AND (config IS NULL OR CONVERT(nvarchar(max), config) NOT LIKE N'%singleDoc%');
GO

-- ═════════════ 5. 字段注册(表头=单据身份;明细=检验记录目录六列;查询位走明细 EXISTS) ═════════════
-- 表头字段
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_CATALOG' AND col_name=N'单据编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_CATALOG', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_CATALOG' AND col_name=N'单据日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_CATALOG', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_CATALOG' AND col_name=N'备注' AND place=N'header') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_CATALOG', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 30, 200, 1, 0, 0, 1);
-- 查询字段(条件落明细行,后端 QueryService 头行式过滤自动走 EXISTS 行表)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_CATALOG' AND col_name=N'检测物料类别' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_CATALOG', N'检测物料类别', N'检测物料类别', N'文本', NULL, NULL, NULL, NULL, N'query', 10, 140, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_CATALOG' AND col_name=N'物料名称' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_CATALOG', N'物料名称', N'物料名称', N'文本', NULL, NULL, NULL, NULL, N'query', 20, 160, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_CATALOG' AND col_name=N'批次号' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_CATALOG', N'批次号', N'批次号', N'文本', NULL, NULL, NULL, NULL, N'query', 30, 130, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_CATALOG' AND col_name=N'检验状态' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_CATALOG', N'检验状态', N'检验状态', N'下拉框', N'SELECT v FROM (VALUES (N''正在检验中''),(N''已完成检验'')) AS t(v)', NULL, NULL, NULL, N'query', 40, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_CATALOG' AND col_name=N'是否合格' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_CATALOG', N'是否合格', N'是否合格', N'下拉框', N'SELECT v FROM (VALUES (N''合格''),(N''不合格'')) AS t(v)', NULL, NULL, NULL, N'query', 50, 90, 0, 0, 0, 1);
-- 明细字段(检验记录目录:批次号/数量/检验状态/是否合格 + 两个分组列,对照原表一比一)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_CATALOG' AND col_name=N'检测物料类别' AND place=N'detail') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_CATALOG', N'检测物料类别', N'检测物料类别', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 140, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_CATALOG' AND col_name=N'物料名称' AND place=N'detail') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_CATALOG', N'物料名称', N'物料名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 180, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_CATALOG' AND col_name=N'批次号' AND place=N'detail') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_CATALOG', N'批次号', N'批次号', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 130, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_CATALOG' AND col_name=N'数量' AND place=N'detail') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_CATALOG', N'数量', N'数量', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_CATALOG' AND col_name=N'检验状态' AND place=N'detail') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_CATALOG', N'检验状态', N'检验状态', N'下拉框', N'SELECT v FROM (VALUES (N''正在检验中''),(N''已完成检验'')) AS t(v)', NULL, NULL, NULL, N'detail', 50, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_CATALOG' AND col_name=N'是否合格' AND place=N'detail') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_CATALOG', N'是否合格', N'是否合格', N'下拉框', N'SELECT v FROM (VALUES (N''合格''),(N''不合格'')) AS t(v)', NULL, NULL, NULL, N'detail', 60, 90, 1, 0, 0, 1);
GO

-- ═════════════ 6. 播种唯一目录单 + 原表示例行(一比一复刻「检验目录」页签可见内容) ═════════════
IF NOT EXISTS (SELECT 1 FROM qc_catalog)
  INSERT INTO qc_catalog (单据编号, 单据日期, 备注) VALUES (N'JYML-2026-09-0001', N'2026-09-22', N'来料品质检验目录(品质资料 2026.09.19 检验目录页签)');
IF NOT EXISTS (SELECT 1 FROM qc_catalog_detail)
BEGIN
  INSERT INTO qc_catalog_detail (单据编号, 检测物料类别, 物料名称, 批次号, 数量, 检验状态, 是否合格)
  VALUES (N'JYML-2026-09-0001', N'阻垢料', N'HP-12', N'260807', N'51Kg', NULL, NULL);
  INSERT INTO qc_catalog_detail (单据编号, 检测物料类别, 物料名称, 批次号, 数量, 检验状态, 是否合格)
  VALUES (N'JYML-2026-09-0001', N'阻垢料', N'HP-12', N'260907', NULL, NULL, NULL);
END
-- 目录单状态行(草稿;与 migrate-progress-single-doc.sql 同口径)
MERGE yj_doc_status AS t USING (VALUES ('QC_CATALOG', N'JYML-2026-09-0001')) AS s(panel_code, doc_no)
   ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no
WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, canceled, saved, update_at)
                      VALUES ('QC_CATALOG', N'JYML-2026-09-0001', 'N', 'N', GETDATE());
GO

-- ═════════════ 7. 译名(en 手工;其余语言由机翻补齐;已有全局译名的字段不重复插) ═════════════
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'检验目录' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'检验目录', 'en', N'Inspection Catalog', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检测物料类别' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检测物料类别', 'en', N'Material Category', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验状态' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验状态', 'en', N'Inspection Status', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'是否合格' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'是否合格', 'en', N'Qualified', 'manual');
GO
-- 面板行 panel_name_en 回填(上方 INSERT 的子查询先于本段译名插入执行,故补一次)
UPDATE yj_panel SET panel_name_en = (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'检验目录' AND locale='en')
WHERE panel_code = 'QC_CATALOG'
  AND ISNULL(panel_name_en, N'') <> (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'检验目录' AND locale='en');
GO

-- ═════════════ 8. 自检 ═════════════
SELECT N'面板' AS k, panel_code, panel_name, CONVERT(nvarchar(60), config) AS v FROM yj_panel WHERE panel_code = N'QC_CATALOG';
SELECT N'字段' AS k, col_name, place, seq, data_type FROM yj_field WHERE panel_code = N'QC_CATALOG' ORDER BY CASE place WHEN N'query' THEN 0 WHEN N'header' THEN 1 ELSE 2 END, seq;
SELECT N'目录单' AS k, 单据编号, 单据日期 FROM qc_catalog;
SELECT N'目录行' AS k, 检测物料类别, 物料名称, 批次号, 数量, 检验状态, 是否合格 FROM qc_catalog_detail;
SELECT N'译名' AS k, scope, ref_key, text FROM yj_translation WHERE ref_key IN (N'检验目录', N'检测物料类别', N'检验状态', N'是否合格') AND locale = N'en';
PRINT N'来料品质检验目录面板(QC_CATALOG)迁移完成';
GO
