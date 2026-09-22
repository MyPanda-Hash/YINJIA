-- migrate-qc-insp-rec.sql — 来料品质「检验数据记录」面板(QC_INSP_REC,纸张式检验报告)
-- 来源:《参考(不上传仓库)\参考文档(不上传仓库)\品质资料 2026.09.19.xlsx》「检验数据记录模版」页签,
--       整张检验报告一比一落库:
--         抬头   : 物料名称 / 物料编码 / 物料批次 / 检验日期 ｜ 来料日期 / 来料数量 / 文件编码(YJ-QR-96) / 检验依据(YJ-Q-30)
--         表体   : 检验项(数据库选择) | 检测标准 | 检测结果 | 单项判定
--         表尾   : 检验结论 / 处理意见 ｜ 检验人(账号登录人自动生成) / 审核人(固定:冯敏)
-- 方式:与「项目进度查询」同族的纸张式面板——前端 QcInspRecSheet.vue 照原表版式渲染(不是通用单据表单),
--       挂 PanelxList 的 isApprovalDoc 分支(纸张 + 右侧竖排操作栏:新增/保存/删除/打印/导出)。
-- 与检验目录的关系:检验目录(QC_CATALOG)行上的「批次号 📄」按物料批次查阅本面板的检验报告,
--       即原表脚注「输入批次号后点击批次号可查阅详细或者新增检验」。
-- 「检验项」采用系统既有的**标准库**机制(data_type=标准库 + yj_std_lib,界面上可增删维护),
--       起始词条取自参考文档 7 张物料检验要求表(折叠棉/垫片/无纺布/网套/PP管/端盖/PP棉)的非标识列名,可维护。
-- 幂等:IF NOT EXISTS / 空表才播种,可反复执行。
SET NOCOUNT ON;

-- ═════════════ 1. 头表(检验报告抬头 + 表尾) ═════════════
IF OBJECT_ID('qc_insp_rec') IS NULL CREATE TABLE qc_insp_rec (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [物料名称] nvarchar(200) NULL,
  [物料编码] nvarchar(100) NULL,
  [物料批次] nvarchar(100) NULL,
  [检验日期] nvarchar(20) NULL,
  [来料日期] nvarchar(20) NULL,
  [来料数量] nvarchar(50) NULL,
  [文件编码] nvarchar(30) NULL DEFAULT N'YJ-QR-96',
  [检验依据] nvarchar(30) NULL DEFAULT N'YJ-Q-30',
  [检验结论] nvarchar(500) NULL,
  [处理意见] nvarchar(1000) NULL,
  [检验人] nvarchar(50) NULL,        -- 账号登录人自动生成(前端 applyDocDefaults 锁定字段)
  [表单审核人] nvarchar(50) NULL,    -- 原表「审核人 固定:冯敏」的表单签名行。
                                     -- ⚠ 不能直接叫「审核人」:ButtonService 保存时显式 body.remove("审核人")/
                                     --   remove("审核时间")(那是 yj_doc_status.shr 审核留痕的虚拟字段),
                                     --   列名/标签叫「审核人」的值会被静默丢弃(2026-09-22 实测);
                                     --   故用专属列名,纸面上仍按原表印作「审核人」。
  [备注] nvarchar(500) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO
-- ═════════════ 2. 行表(检验结果表体) ═════════════
IF OBJECT_ID('qc_insp_rec_detail') IS NULL CREATE TABLE qc_insp_rec_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [检验项] nvarchar(200) NULL,       -- 原表「检验项（检验项为数据库选择）」→ 标准库 qc.insp_item
  [检测标准] nvarchar(500) NULL,
  [检测结果] nvarchar(500) NULL,
  [单项判定] nvarchar(20) NULL,      -- 下拉:合格/不合格
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO
-- 旧库补列/纠名(本表 2026-09-22 首建;兼容首版曾用「审核人」列名的库)
IF OBJECT_ID('qc_insp_rec') IS NOT NULL AND COL_LENGTH('qc_insp_rec', '表单审核人') IS NULL
  ALTER TABLE qc_insp_rec ADD [表单审核人] nvarchar(50) NULL;
IF OBJECT_ID('qc_insp_rec') IS NOT NULL AND COL_LENGTH('qc_insp_rec', '审核人') IS NOT NULL
  ALTER TABLE qc_insp_rec DROP COLUMN [审核人];
GO

-- ═════════════ 3. 表/列中文注明(AGENTS.md 2026-09-14 起强制) ═════════════
DECLARE @t sysname = N'qc_insp_rec';
IF EXISTS (SELECT 1 FROM sys.extended_properties ep
           WHERE ep.major_id = OBJECT_ID(@t) AND ep.minor_id = 0 AND ep.name = 'MS_Description')
  EXEC sp_updateextendedproperty N'MS_Description',
       N'来料品质检验数据记录头表(检验报告 YJ-QR-96:抬头/结论/处理意见/签名;一张报告一单,单据号前缀 JYSJ)',
       N'SCHEMA', N'dbo', N'TABLE', @t;
ELSE
  EXEC sp_addextendedproperty N'MS_Description',
       N'来料品质检验数据记录头表(检验报告 YJ-QR-96:抬头/结论/处理意见/签名;一张报告一单,单据号前缀 JYSJ)',
       N'SCHEMA', N'dbo', N'TABLE', @t;

DECLARE @cols TABLE (col sysname, descr nvarchar(400));
INSERT INTO @cols VALUES
  (N'单据编号', N'单据编号(流水号,前缀 JYSJ-年月-4位流水;由 FormNoService 生成)'),
  (N'单据日期', N'单据日期(空白草稿自动填当天)'),
  (N'物料名称', N'物料名称(报告抬头;原表模版按物料固定,如 HP-2040)'),
  (N'物料编码', N'物料编码(报告抬头)'),
  (N'物料批次', N'物料批次(与检验目录的批次号同值;点检验目录批次号可查阅本报告)'),
  (N'检验日期', N'检验日期'),
  (N'来料日期', N'来料日期'),
  (N'来料数量', N'来料数量(文本,保留 51Kg 这类带单位写法)'),
  (N'文件编码', N'文件编码(原表固定 YJ-QR-96)'),
  (N'检验依据', N'检验依据(原表固定 YJ-Q-30)'),
  (N'检验结论', N'检验结论(整宽一行)'),
  (N'处理意见', N'处理意见(整宽一行)'),
  (N'检验人', N'检验人(原表“账号登录人自动生成”:前端按登录用户锁定填入,不可改)'),
  (N'表单审核人', N'表单审核人(纸面按原表印作「审核人」,原表“固定:冯敏”;改用专属列名以避开 ButtonService 对「审核人」的显式丢弃,见建表注释)'),
  (N'备注', N'备注');

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

DECLARE @t2 sysname = N'qc_insp_rec_detail';
IF EXISTS (SELECT 1 FROM sys.extended_properties ep
           WHERE ep.major_id = OBJECT_ID(@t2) AND ep.minor_id = 0 AND ep.name = 'MS_Description')
  EXEC sp_updateextendedproperty N'MS_Description',
       N'来料品质检验数据记录行表(检验结果表体:检验项=标准库 qc.insp_item 选择 | 检测标准 | 检测结果 | 单项判定)',
       N'SCHEMA', N'dbo', N'TABLE', @t2;
ELSE
  EXEC sp_addextendedproperty N'MS_Description',
       N'来料品质检验数据记录行表(检验结果表体:检验项=标准库 qc.insp_item 选择 | 检测标准 | 检测结果 | 单项判定)',
       N'SCHEMA', N'dbo', N'TABLE', @t2;

DECLARE @cols2 TABLE (col sysname, descr nvarchar(400));
INSERT INTO @cols2 VALUES
  (N'单据编号', N'所属检验报告编号(关联 qc_insp_rec.单据编号)'),
  (N'检验项',   N'检验项(标准库 qc.insp_item,原表“检验项为数据库选择”)'),
  (N'检测标准', N'检测标准'),
  (N'检测结果', N'检测结果'),
  (N'单项判定', N'单项判定(下拉:合格/不合格)');

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

-- ═════════════ 4. 面板注册(doc 模式;一张检验报告一单,不设 singleDoc) ═════════════
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'QC_INSP_REC')
INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
SELECT 'QC_INSP_REC', N'检验数据记录', (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'检验数据记录' AND locale='en'),
       N'单据', 'doc', 'qc_insp_rec_detail', 'qc_insp_rec', N'单据编号', N'id', N'单据编号', N'JYSJ', N'单据日期', 20, 'items', N'品质管理'
WHERE NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'QC_INSP_REC');
GO

-- ═════════════ 5. 字段注册 ═════════════
-- 查询字段
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REC' AND col_name=N'物料名称' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP_REC', N'物料名称', N'物料名称', N'文本', NULL, NULL, NULL, NULL, N'query', 10, 160, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REC' AND col_name=N'物料编码' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP_REC', N'物料编码', N'物料编码', N'文本', NULL, NULL, NULL, NULL, N'query', 20, 140, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REC' AND col_name=N'物料批次' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP_REC', N'物料批次', N'物料批次', N'文本', NULL, NULL, NULL, NULL, N'query', 30, 130, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REC' AND col_name=N'检验日期' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP_REC', N'检验日期', N'检验日期', N'日期', NULL, NULL, NULL, NULL, N'query', 40, 120, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REC' AND col_name=N'检验结论' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP_REC', N'检验结论', N'检验结论', N'文本', NULL, NULL, NULL, NULL, N'query', 50, 160, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REC' AND col_name=N'检验人' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP_REC', N'检验人', N'检验人', N'文本', NULL, NULL, NULL, NULL, N'query', 60, 100, 0, 0, 0, 1);
-- 表头字段(抬头 + 表尾;与纸张格子一一对应)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REC' AND col_name=N'单据编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP_REC', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REC' AND col_name=N'单据日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP_REC', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REC' AND col_name=N'物料名称' AND place=N'header') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP_REC', N'物料名称', N'物料名称', N'文本', NULL, NULL, NULL, NULL, N'header', 30, 180, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REC' AND col_name=N'物料编码' AND place=N'header') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP_REC', N'物料编码', N'物料编码', N'文本', NULL, NULL, NULL, NULL, N'header', 40, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REC' AND col_name=N'物料批次' AND place=N'header') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP_REC', N'物料批次', N'物料批次', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 130, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REC' AND col_name=N'检验日期' AND place=N'header') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP_REC', N'检验日期', N'检验日期', N'日期', NULL, NULL, NULL, NULL, N'header', 60, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REC' AND col_name=N'来料日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP_REC', N'来料日期', N'来料日期', N'日期', NULL, NULL, NULL, NULL, N'header', 70, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REC' AND col_name=N'来料数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP_REC', N'来料数量', N'来料数量', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REC' AND col_name=N'文件编码') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP_REC', N'文件编码', N'文件编码', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REC' AND col_name=N'检验依据') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP_REC', N'检验依据', N'检验依据', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REC' AND col_name=N'检验结论' AND place=N'header') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP_REC', N'检验结论', N'检验结论', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 300, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REC' AND col_name=N'处理意见') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP_REC', N'处理意见', N'处理意见', N'文本', NULL, NULL, NULL, NULL, N'header', 120, 300, 1, 0, 0, 1);
-- 检验人:原表「账号登录人自动生成」→ editable=0(锁定),前端 applyDocDefaults 在新增时按登录用户填入
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REC' AND col_name=N'检验人' AND place=N'header') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP_REC', N'检验人', N'检验人', N'文本', NULL, NULL, NULL, NULL, N'header', 130, 100, 0, 0, 0, 1);
-- 表单审核人:纸面签名行(原表「审核人 固定:冯敏」)。hidden=1 只走纸张,不进通用表单/列表(与 文档编号 同口径)。
-- 名称不用「审核人」的原因见建表注释:通用保存会显式丢弃该标签。
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REC' AND col_name=N'表单审核人' AND place=N'header') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP_REC', N'表单审核人', N'表单审核人', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 100, 1, 0, 1, 1);
-- 首版曾按原表名登记「审核人」字段(保存被丢弃) → 清理该行,避免列表里出现永远为空的列
DELETE FROM yj_field WHERE panel_code='QC_INSP_REC' AND col_name=N'审核人';
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REC' AND col_name=N'备注' AND place=N'header') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP_REC', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 150, 200, 1, 0, 0, 1);
-- 明细字段(检验结果表体)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REC' AND col_name=N'检验项') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP_REC', N'检验项', N'检验项', N'标准库', N'qc.insp_item', NULL, NULL, NULL, N'detail', 10, 180, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REC' AND col_name=N'检测标准') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP_REC', N'检测标准', N'检测标准', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 240, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REC' AND col_name=N'检测结果') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP_REC', N'检测结果', N'检测结果', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 240, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP_REC' AND col_name=N'单项判定') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP_REC', N'单项判定', N'单项判定', N'下拉框', N'SELECT v FROM (VALUES (N''合格''),(N''不合格'')) AS t(v)', NULL, NULL, NULL, N'detail', 40, 110, 1, 0, 0, 1);
GO

-- ═════════════ 6. 检验项标准库(原表:检验项为数据库选择) ═════════════
-- 起始词条 = 参考文档 7 张物料检验要求表(折叠棉/垫片/无纺布/网套/PP管/端盖/PP棉)的非标识列名并集,
-- 统一进标准库后可在界面「标准库维护」里增删改(见 StdLibManager / /api/stdlib/*)。
DECLARE @items TABLE (content nvarchar(120), seq int);
INSERT INTO @items VALUES
  (N'外观', 10), (N'尺寸', 20), (N'长', 30), (N'宽', 40), (N'高度', 50), (N'厚度', 60),
  (N'外径', 70), (N'外径（+密封圈）', 80), (N'内径', 90), (N'克数', 100), (N'克重', 110),
  (N'材质', 120), (N'颜色（白/黑）', 130), (N'折数', 140), (N'折高', 150), (N'叠高', 160),
  (N'实配炭棒', 170), (N'实配炭棒后外径', 180), (N'实配端盖', 190), (N'接口牢固度', 200),
  (N'切面（平整、无歪斜）', 210), (N'脏污、头发丝', 220), (N'破损、切斜', 230), (N'变形、破损', 240),
  (N'出水口堵孔、批锋', 250);
INSERT INTO yj_std_lib (lib_code, item_code, content, seq, enabled)
SELECT N'qc.insp_item', N'默认', i.content, i.seq, 1
  FROM @items i
 WHERE NOT EXISTS (SELECT 1 FROM yj_std_lib s WHERE s.lib_code = N'qc.insp_item' AND s.content = i.content);
GO

-- ═════════════ 7. 译名(en 手工;其余语言由机翻补齐;已有全局译名的字段不重复插) ═════════════
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'检验数据记录' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'检验数据记录', 'en', N'Inspection Data Record', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验项' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验项', 'en', N'Inspection Item', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检测标准' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检测标准', 'en', N'Test Standard', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检测结果' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检测结果', 'en', N'Test Result', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单项判定' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单项判定', 'en', N'Item Judgement', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'物料批次' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'物料批次', 'en', N'Material Batch', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'来料日期' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'来料日期', 'en', N'Arrival Date', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'来料数量' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'来料数量', 'en', N'Arrival Qty', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验人' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验人', 'en', N'Inspector', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'处理意见' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'处理意见', 'en', N'Disposition', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'表单审核人' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'表单审核人', 'en', N'Form Reviewer', 'manual');
GO
-- 面板行 panel_name_en 回填(上方 INSERT 的子查询先于本段译名插入执行)
UPDATE yj_panel SET panel_name_en = (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'检验数据记录' AND locale='en')
WHERE panel_code = 'QC_INSP_REC'
  AND ISNULL(panel_name_en, N'') <> (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'检验数据记录' AND locale='en');
GO

-- ═════════════ 9. 物料批次不参与录入校验(2026-09-22 用户口径) ═════════════
-- 报告的物料批次号由采购入库单审核取号后按挂靠关系自动回填(见 tools/migrate-qc-catalog-auto.sql
-- 与 QcCatalogService.refreshBatchNosFromInsp),**建单与审批时留空**、不需要人填 ——
-- 故放开必填校验,否则保存/审批会被「物料批次不能为空」拦死。
UPDATE yj_field SET required = 0 WHERE panel_code = 'QC_INSP_REC' AND col_name = N'物料批次';
GO

-- ═════════════ 10. 自检 ═════════════
SELECT N'物料批次必填' AS k, required AS v FROM yj_field WHERE panel_code = N'QC_INSP_REC' AND col_name = N'物料批次';
GO

SELECT N'面板' AS k, panel_code, panel_name, mode, head_table, line_table, prefix FROM yj_panel WHERE panel_code = N'QC_INSP_REC';
SELECT N'字段' AS k, col_name, place, seq, data_type, dict_sql FROM yj_field WHERE panel_code = N'QC_INSP_REC' ORDER BY CASE place WHEN N'query' THEN 0 WHEN N'header' THEN 1 ELSE 2 END, seq;
SELECT N'检验项库' AS k, lib_code, COUNT(*) AS n FROM yj_std_lib WHERE lib_code = N'qc.insp_item' GROUP BY lib_code;
SELECT N'译名' AS k, scope, ref_key, text FROM yj_translation WHERE ref_key IN (N'检验数据记录', N'检验项', N'检测标准', N'检测结果', N'单项判定') AND locale = N'en';
PRINT N'来料品质检验数据记录面板(QC_INSP_REC)迁移完成';
GO
