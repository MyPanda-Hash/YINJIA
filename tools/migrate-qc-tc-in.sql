-- migrate-qc-tc-in.sql — 来料品质「特采单」面板(独立面板 + 独立表)
-- 背景:依据《品质资料 2026.09.19.xlsx》「特采单」页签(内嵌扫描图 = YJ-QR-60 特采申请单),
--       在 品质管理 > 来料品质 下新增特采单面板。与已有 QC_TC「特采申请单」独立并存:
--       两套表单分开存放、各自编号(来料特采 TC 流程 与 现有特采申请互不影响)。
-- 版式:文书式 doc 单据,复用前端 DocSheet 引擎(channel: docSheetConfigs.js 的 qcSheetCfgs.QC_TC_IN)。
-- 与 QC_TC 的两处口径差异(按现行规范修正,不照抄旧值):
--       ① 供应商 参照 GFDA(供应商档案);QC_TC 用的 PARTNER(往来单位)面板已于 2026-09-17 下线,
--          同为来料品质的 QC_INSP 用的正是 GFDA。
--       ② 最终处理结果 字典三值(正常使用/管控使用/挑选使用);Excel 原图是三个勾选框,QC_TC 只有两值。
-- 幂等:IF NOT EXISTS / COL_LENGTH 判断,可反复执行。
SET NOCOUNT ON;

-- ═════════════ 1. 头表 ═════════════
IF OBJECT_ID('qc_tc_in') IS NULL CREATE TABLE qc_tc_in (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [文档编号] nvarchar(30) NOT NULL CONSTRAINT DF_qc_tc_in_docno DEFAULT N'YJ-QR-60',
  [供应商] nvarchar(200) NULL,
  [采购单号] nvarchar(60) NULL,
  [产品名称] nvarchar(200) NULL,
  [总数量] decimal(18,4) NULL,
  [不合格品数量] decimal(18,4) NULL,
  [不合格品比例] nvarchar(20) NULL,
  [不良说明] nvarchar(1000) NULL,
  [严重程度] nvarchar(20) NULL,
  [特采理由] nvarchar(1000) NULL,
  [产品开发部性能意见] nvarchar(500) NULL,
  [产品开发部工艺意见] nvarchar(500) NULL,
  [品质部意见] nvarchar(500) NULL,
  [销售部意见] nvarchar(500) NULL,
  [研发意见] nvarchar(500) NULL,
  [最终处理结果] nvarchar(20) NULL,
  [编制人] nvarchar(50) NULL,
  [备注] nvarchar(500) NULL,
  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿',
  [审核人] nvarchar(50) NULL,
  [审核时间] nvarchar(30) NULL,
  [审批人] nvarchar(50) NULL,
  [审批时间] nvarchar(30) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO
-- 恒空明细表(doc 模式要求 line_table;特采单无明细行,查询取空集)。
-- 注意:必须用物理空表而非视图——doc 保存会执行缺席软删 UPDATE(asp_cancel),视图含派生/常量域不可更新(报 4406)。
IF OBJECT_ID('qc_tc_in_detail') IS NULL CREATE TABLE qc_tc_in_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NULL,
  asp_cancel char(1) NULL DEFAULT 'N',
  asp_user1 nvarchar(50) NULL, asp_user2 nvarchar(50) NULL,
  asp_time1 datetime2 NULL, asp_time2 datetime2 NULL
);
GO

-- ═════════════ 2. 表/列中文注明(AGENTS.md 2026-09-14 起强制) ═════════════
DECLARE @t sysname = N'qc_tc_in';
IF EXISTS (SELECT 1 FROM sys.extended_properties ep
           WHERE ep.major_id = OBJECT_ID(@t) AND ep.minor_id = 0 AND ep.name = 'MS_Description')
  EXEC sp_updateextendedproperty N'MS_Description',
       N'来料品质特采单头表(YJ-QR-60 特采申请单;表头一行一单,无明细行;单据号前缀 TCI)',
       N'SCHEMA', N'dbo', N'TABLE', @t;
ELSE
  EXEC sp_addextendedproperty N'MS_Description',
       N'来料品质特采单头表(YJ-QR-60 特采申请单;表头一行一单,无明细行;单据号前缀 TCI)',
       N'SCHEMA', N'dbo', N'TABLE', @t;

DECLARE @cols TABLE (col sysname, descr nvarchar(400));
INSERT INTO @cols VALUES
  (N'单据编号',           N'单据编号(流水号,前缀 TCI-年月-4位流水;由 FormNoService 生成)'),
  (N'单据日期',           N'单据日期(空白草稿自动填当天)'),
  (N'文档编号',           N'文档编号(文控号,默认 YJ-QR-60;文书表头右上角)'),
  (N'供应商',             N'供应商(参照供应商档案 GFDA.mc)'),
  (N'采购单号',           N'采购单号(参照采购订单 PU_ORDER.单据编号)'),
  (N'产品名称',           N'产品名称'),
  (N'总数量',             N'总数量'),
  (N'不合格品数量',       N'不合格品数量'),
  (N'不合格品比例',       N'不合格品比例(文本,按原表手填)'),
  (N'不良说明',           N'不良说明(整宽行,对应原表独立一行)'),
  (N'严重程度',           N'严重程度(勾选:严重/一般/轻微)'),
  (N'特采理由',           N'特采理由(申请单位填写区)'),
  (N'产品开发部性能意见', N'产品开发部意见·性能(会签区)'),
  (N'产品开发部工艺意见', N'产品开发部意见·工艺(会签区)'),
  (N'品质部意见',         N'品质部意见(会签区)'),
  (N'销售部意见',         N'销售部意见(会签区)'),
  (N'研发意见',           N'研发意见(会签区)'),
  (N'最终处理结果',       N'最终处理结果(勾选:正常使用/管控使用/挑选使用)'),
  (N'编制人',             N'编制人(底部落款,与审批留痕分开)'),
  (N'备注',               N'备注'),
  (N'单据状态',           N'单据状态(默认草稿;运行时由 yj_doc_status 推导)'),
  (N'审核人',             N'审核人'),
  (N'审核时间',           N'审核时间'),
  (N'审批人',             N'审批人'),
  (N'审批时间',           N'审批时间');

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
IF EXISTS (SELECT 1 FROM sys.extended_properties ep
           WHERE ep.major_id = OBJECT_ID('qc_tc_in_detail') AND ep.minor_id = 0 AND ep.name = 'MS_Description')
  EXEC sp_updateextendedproperty N'MS_Description',
       N'来料品质特采单明细表(恒空占位:doc 模式要求 line_table,特采单无明细行)',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_tc_in_detail';
ELSE
  EXEC sp_addextendedproperty N'MS_Description',
       N'来料品质特采单明细表(恒空占位:doc 模式要求 line_table,特采单无明细行)',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_tc_in_detail';
GO

-- ═════════════ 3. 面板注册 ═════════════
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'QC_TC_IN')
INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
SELECT 'QC_TC_IN', N'特采单', (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'特采单' AND locale='en'),
       N'单据', 'doc', 'qc_tc_in_detail', 'qc_tc_in', N'单据编号', N'id', N'单据编号', N'TCI', N'单据日期', 20, 'items', N'品质管理'
WHERE NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'QC_TC_IN');
GO

-- ═════════════ 4. 字段注册(镜像 QC_TC,含上述两处口径修正) ═════════════
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'单据编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 10, 140, 0, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'单据日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 20, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'供应商') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'供应商', N'供应商', N'参照', NULL, N'GFDA', N'mc', N'mc', N'query,header', 30, 180, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'采购单号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'采购单号', N'采购单号', N'参照', NULL, N'PU_ORDER', N'单据编号', N'单据编号', N'query,header', 40, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'产品名称') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'产品名称', N'产品名称', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'总数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'总数量', N'总数量', N'小数', NULL, NULL, NULL, NULL, N'header', 60, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'不合格品数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'不合格品数量', N'不合格品数量', N'小数', NULL, NULL, NULL, NULL, N'header', 70, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'不合格品比例') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'不合格品比例', N'不合格品比例', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'不良说明') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'不良说明', N'不良说明', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 300, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'严重程度') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'严重程度', N'严重程度', N'下拉框', N'SELECT v FROM (VALUES (N''严重''),(N''一般''),(N''轻微'')) AS t(v)', NULL, NULL, NULL, N'query,header', 100, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'特采理由') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'特采理由', N'特采理由', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 400, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'产品开发部性能意见') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'产品开发部性能意见', N'产品开发部性能意见', N'文本', NULL, NULL, NULL, NULL, N'header', 120, 260, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'产品开发部工艺意见') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'产品开发部工艺意见', N'产品开发部工艺意见', N'文本', NULL, NULL, NULL, NULL, N'header', 130, 260, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'品质部意见') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'品质部意见', N'品质部意见', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 240, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'销售部意见') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'销售部意见', N'销售部意见', N'文本', NULL, NULL, NULL, NULL, N'header', 150, 240, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'研发意见') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'研发意见', N'研发意见', N'文本', NULL, NULL, NULL, NULL, N'header', 160, 240, 1, 0, 0, 1);
-- 最终处理结果:Excel 原图三个勾选框,字典三值(QC_TC 旧值只有两值,见文件头说明②)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'最终处理结果') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'最终处理结果', N'最终处理结果', N'下拉框', N'SELECT v FROM (VALUES (N''正常使用''),(N''管控使用''),(N''挑选使用'')) AS t(v)', NULL, NULL, NULL, N'query,header', 170, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'备注') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 180, 220, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'单据状态') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'单据状态', N'单据状态', N'文本', NULL, NULL, NULL, NULL, N'query,header', 190, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'审核人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, NULL, N'header', 200, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'审核时间') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'审核时间', N'审核时间', N'文本', NULL, NULL, NULL, NULL, N'header', 210, 140, 0, 0, 0, 1);
-- 文档编号(YJ-QR-60):文书表头右上角可编辑;hidden=1 不出现在通用表单,仅供文书特例取键
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'文档编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'文档编号', N'文档编号', N'文本', NULL, NULL, NULL, NULL, N'header', 215, 120, 1, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_TC_IN' AND col_name=N'编制人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_TC_IN', N'编制人', N'编制人', N'文本', NULL, NULL, NULL, NULL, N'header', 220, 100, 1, 0, 0, 1);
GO

-- ═════════════ 5. 译名(其余语言由机翻补齐;字段标签全局共享,已有译名的不重复插) ═════════════
-- 特采单:与前端 locales(菜单标题 tt('特采单'))的 en 保持同一串
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'特采单' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'特采单', 'en', N'Incoming Special Procurement', 'manual');
UPDATE yj_translation SET text = N'Incoming Special Procurement', updated_at = sysdatetime()
WHERE scope='panel' AND ref_key=N'特采单' AND locale='en' AND text <> N'Incoming Special Procurement';
-- 管控使用:新增的第三选项,库内无任何译名
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'管控使用' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'管控使用', 'en', N'Controlled Use', 'manual');
-- 文档编号 的 en 现值是中文原文(=未翻译),修正之;该键全局共享,一并改善其余文书面板
UPDATE yj_translation SET text = N'Document No.', updated_at = sysdatetime()
WHERE scope='field' AND ref_key=N'文档编号' AND locale='en' AND text = N'文档编号';
GO
-- 面板行的 panel_name_en 回填(上方 INSERT 的子查询先于本段译名插入执行,故补一次;
-- 带 <> 判断而非 IS NULL,使改译名后重跑能自动跟上)
UPDATE yj_panel SET panel_name_en = (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'特采单' AND locale='en')
WHERE panel_code = 'QC_TC_IN'
  AND ISNULL(panel_name_en, N'') <> (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'特采单' AND locale='en');
GO
PRINT N'来料品质特采单面板(QC_TC_IN)迁移完成';
GO
