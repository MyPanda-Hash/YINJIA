-- migrate-qc-3docs.sql — 品检分流三单(送料暂收单/来料检验单/暂收退回单)doc 面板
-- 设计: tools/_flow-v12/品检分流三单设计草案-v0.1.md(已定稿:简单式粒度+一键生成下游单)
-- 范式: 同 migrate-rd-*.sql(中文列 + yj_panel/yj_field/yj_translation + 幂等)
SET NOCOUNT ON;

-- ══ 1. 送料暂收单(qc_recv,前缀 ZS) ══
IF OBJECT_ID('qc_recv') IS NULL CREATE TABLE qc_recv (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [采购订单号] nvarchar(60) NULL,
  [供应商] nvarchar(200) NULL,
  [供应商编码] nvarchar(100) NULL,
  [到货日期] nvarchar(20) NULL,
  [经手人] nvarchar(50) NULL,
  [备注] nvarchar(500) NULL,
  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿',
  [审核人] nvarchar(50) NULL,
  [审核时间] nvarchar(30) NULL,
  [审批人] nvarchar(50) NULL,
  [审批时间] nvarchar(30) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
IF OBJECT_ID('qc_recv_detail') IS NULL CREATE TABLE qc_recv_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [物料编码] nvarchar(100) NULL,
  [物料名称] nvarchar(200) NULL,
  [规格型号] nvarchar(200) NULL,
  [单位] nvarchar(50) NULL,
  [采购数量] decimal(18,4) NULL,
  [暂收数量] decimal(18,4) NULL,
  [批号] nvarchar(30) NULL,
  [仓库] nvarchar(100) NULL,
  [备注] nvarchar(200) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO
-- ══ 2. 来料检验单(qc_insp,前缀 IJ) ══
IF OBJECT_ID('qc_insp') IS NULL CREATE TABLE qc_insp (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [暂收单号] nvarchar(60) NULL,
  [供应商] nvarchar(200) NULL,
  [检验员] nvarchar(50) NULL,
  [检验日期] nvarchar(20) NULL,
  [检验方案] nvarchar(100) NULL,
  [总结论] nvarchar(20) NULL,
  [备注] nvarchar(500) NULL,
  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿',
  [审核人] nvarchar(50) NULL,
  [审核时间] nvarchar(30) NULL,
  [审批人] nvarchar(50) NULL,
  [审批时间] nvarchar(30) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
IF OBJECT_ID('qc_insp_detail') IS NULL CREATE TABLE qc_insp_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [物料编码] nvarchar(100) NULL,
  [物料名称] nvarchar(200) NULL,
  [规格型号] nvarchar(200) NULL,
  [单位] nvarchar(50) NULL,
  [送检数量] decimal(18,4) NULL,
  [合格数量] decimal(18,4) NULL,
  [不合格数量] decimal(18,4) NULL,
  [处置方式] nvarchar(20) NULL,
  [批号] nvarchar(30) NULL,
  [备注] nvarchar(200) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO
-- ══ 3. 暂收退回单(qc_return,前缀 TH) ══
IF OBJECT_ID('qc_return') IS NULL CREATE TABLE qc_return (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [检验单号] nvarchar(60) NULL,
  [供应商] nvarchar(200) NULL,
  [退货原因] nvarchar(500) NULL,
  [经手人] nvarchar(50) NULL,
  [备注] nvarchar(500) NULL,
  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿',
  [审核人] nvarchar(50) NULL,
  [审核时间] nvarchar(30) NULL,
  [审批人] nvarchar(50) NULL,
  [审批时间] nvarchar(30) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
IF OBJECT_ID('qc_return_detail') IS NULL CREATE TABLE qc_return_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [物料编码] nvarchar(100) NULL,
  [物料名称] nvarchar(200) NULL,
  [规格型号] nvarchar(200) NULL,
  [单位] nvarchar(50) NULL,
  [退货数量] decimal(18,4) NULL,
  [批号] nvarchar(30) NULL,
  [备注] nvarchar(200) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

-- ══ 4. 面板注册(doc 模式,采购管理分类,同 PU_ORDER 归组) ══
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'QC_RECV') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('QC_RECV', N'送料暂收单', N'采购管理', 'doc', 'qc_recv_detail', 'qc_recv', N'单据编号', N'id', N'单据编号', N'ZS', N'单据日期', 20, 'items', N'智能供应链');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'QC_INSP') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('QC_INSP', N'来料检验单', N'采购管理', 'doc', 'qc_insp_detail', 'qc_insp', N'单据编号', N'id', N'单据编号', N'IJ', N'单据日期', 20, 'items', N'智能供应链');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'QC_RETURN') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('QC_RETURN', N'暂收退回单', N'采购管理', 'doc', 'qc_return_detail', 'qc_return', N'单据编号', N'id', N'单据编号', N'TH', N'单据日期', 20, 'items', N'智能供应链');
GO

-- ══ 5. 字段(q=query,h=header,d=detail;格式: panel,col,label,type,dict/ref,place,seq,w,edit,req) ══
-- 送料暂收单
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'单据编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RECV', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 10, 140, 0, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'单据日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RECV', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 20, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'采购订单号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RECV', N'采购订单号', N'采购订单号', N'参照', NULL, N'PU_ORDER', N'单据编号', N'单据编号', N'query,header', 30, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'供应商') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RECV', N'供应商', N'供应商', N'文本', NULL, NULL, NULL, NULL, N'query,header', 40, 180, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'供应商编码') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RECV', N'供应商编码', N'供应商编码', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'到货日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RECV', N'到货日期', N'到货日期', N'日期', NULL, NULL, NULL, NULL, N'header', 60, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'经手人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RECV', N'经手人', N'经手人', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'备注') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RECV', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header,detail', 80, 220, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'单据状态') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RECV', N'单据状态', N'单据状态', N'文本', NULL, NULL, NULL, NULL, N'query,header', 90, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'审核人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RECV', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'审核时间') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RECV', N'审核时间', N'审核时间', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 140, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'物料编码') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RECV', N'物料编码', N'物料编码', N'参照', NULL, N'INV', N'存货编码', N'存货编码', N'query,detail', 200, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'物料名称') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RECV', N'物料名称', N'物料名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 210, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'规格型号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RECV', N'规格型号', N'规格型号', N'文本', NULL, NULL, NULL, NULL, N'detail', 220, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'单位') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RECV', N'单位', N'单位', N'文本', NULL, NULL, NULL, NULL, N'detail', 230, 70, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'采购数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RECV', N'采购数量', N'采购数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 240, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'暂收数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RECV', N'暂收数量', N'暂收数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 250, 100, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'批号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RECV', N'批号', N'批号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 260, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'仓库') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RECV', N'仓库', N'仓库', N'参照', NULL, N'WH', N'仓库名称', N'仓库名称', N'detail', 270, 110, 1, 0, 0, 1);
GO
-- 来料检验单
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'单据编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 10, 140, 0, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'单据日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 20, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'暂收单号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP', N'暂收单号', N'暂收单号', N'参照', NULL, N'QC_RECV', N'单据编号', N'单据编号', N'query,header', 30, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'供应商') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP', N'供应商', N'供应商', N'文本', NULL, NULL, NULL, NULL, N'query,header', 40, 180, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'检验员') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP', N'检验员', N'检验员', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'检验日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP', N'检验日期', N'检验日期', N'日期', NULL, NULL, NULL, NULL, N'header', 60, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'检验方案') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP', N'检验方案', N'检验方案', N'参照', NULL, N'QC_PLAN', N'方案名称', N'方案名称', N'header', 70, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'总结论') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP', N'总结论', N'总结论', N'下拉框', N'SELECT v FROM (VALUES (N''合格''),(N''不合格''),(N''让步接收'')) AS t(v)', NULL, NULL, NULL, N'query,header', 80, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'备注') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header,detail', 90, 220, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'单据状态') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP', N'单据状态', N'单据状态', N'文本', NULL, NULL, NULL, NULL, N'query,header', 100, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'审核人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'审核时间') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP', N'审核时间', N'审核时间', N'文本', NULL, NULL, NULL, NULL, N'header', 120, 140, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'物料编码') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP', N'物料编码', N'物料编码', N'参照', NULL, N'INV', N'存货编码', N'存货编码', N'query,detail', 200, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'物料名称') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP', N'物料名称', N'物料名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 210, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'规格型号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP', N'规格型号', N'规格型号', N'文本', NULL, NULL, NULL, NULL, N'detail', 220, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'单位') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP', N'单位', N'单位', N'文本', NULL, NULL, NULL, NULL, N'detail', 230, 70, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'送检数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP', N'送检数量', N'送检数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 240, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'合格数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP', N'合格数量', N'合格数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 250, 100, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'不合格数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP', N'不合格数量', N'不合格数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 260, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'处置方式') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP', N'处置方式', N'处置方式', N'下拉框', N'SELECT v FROM (VALUES (N''入库''),(N''退货''),(N''让步入库'')) AS t(v)', NULL, NULL, NULL, N'detail', 270, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_INSP' AND col_name=N'批号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_INSP', N'批号', N'批号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 280, 120, 1, 0, 0, 1);
GO
-- 暂收退回单
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'单据编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RETURN', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 10, 140, 0, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'单据日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RETURN', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 20, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'检验单号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RETURN', N'检验单号', N'检验单号', N'参照', NULL, N'QC_INSP', N'单据编号', N'单据编号', N'query,header', 30, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'供应商') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RETURN', N'供应商', N'供应商', N'文本', NULL, NULL, NULL, NULL, N'query,header', 40, 180, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'退货原因') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RETURN', N'退货原因', N'退货原因', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 260, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'经手人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RETURN', N'经手人', N'经手人', N'文本', NULL, NULL, NULL, NULL, N'header', 60, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'备注') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RETURN', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header,detail', 70, 220, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'单据状态') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RETURN', N'单据状态', N'单据状态', N'文本', NULL, NULL, NULL, NULL, N'query,header', 80, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'审核人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RETURN', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'审核时间') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RETURN', N'审核时间', N'审核时间', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 140, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'物料编码') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RETURN', N'物料编码', N'物料编码', N'参照', NULL, N'INV', N'存货编码', N'存货编码', N'query,detail', 200, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'物料名称') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RETURN', N'物料名称', N'物料名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 210, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'规格型号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RETURN', N'规格型号', N'规格型号', N'文本', NULL, NULL, NULL, NULL, N'detail', 220, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'单位') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RETURN', N'单位', N'单位', N'文本', NULL, NULL, NULL, NULL, N'detail', 230, 70, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'退货数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RETURN', N'退货数量', N'退货数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 240, 100, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'批号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_RETURN', N'批号', N'批号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 250, 120, 1, 0, 0, 1);
GO

-- ══ 6. en 译名(共享标签幂等跳过) ══
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'送料暂收单' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'送料暂收单', 'en', N'Material Temporary Receipt', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'来料检验单' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'来料检验单', 'en', N'Incoming Inspection', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'暂收退回单' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'暂收退回单', 'en', N'Temporary Receipt Return', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'采购订单号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'采购订单号', 'en', N'PO No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'供应商编码' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'供应商编码', 'en', N'Supplier Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'到货日期' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'到货日期', 'en', N'Arrival Date', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'经手人' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'经手人', 'en', N'Handler', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'暂收数量' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'暂收数量', 'en', N'Temp. Receipt Qty', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'暂收单号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'暂收单号', 'en', N'Temp. Receipt No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验员' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验员', 'en', N'Inspector', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验日期' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验日期', 'en', N'Inspection Date', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验方案' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验方案', 'en', N'Inspection Plan', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'总结论' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'总结论', 'en', N'Overall Result', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'送检数量' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'送检数量', 'en', N'Submitted Qty', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'合格数量' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'合格数量', 'en', N'Qualified Qty', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'不合格数量' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'不合格数量', 'en', N'Rejected Qty', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'处置方式' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'处置方式', 'en', N'Disposal', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验单号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验单号', 'en', N'Inspection No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'退货原因' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'退货原因', 'en', N'Return Reason', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'退货数量' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'退货数量', 'en', N'Return Qty', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'物料编码' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'物料编码', 'en', N'Material Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'采购数量' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'采购数量', 'en', N'PO Qty', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'让步接收' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'让步接收', 'en', N'Concession Accept', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'让步入库' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'让步入库', 'en', N'Concession Stock-in', 'manual');
GO

PRINT N'migrate-qc-3docs 完成:三单六表+三面板+字段+en 译名';
GO
