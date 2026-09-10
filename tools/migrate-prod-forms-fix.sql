-- migrate-prod-forms-fix.sql — 单表式doc面板补恒空明细表(doc模式要求line_table非空,同 rd_approval 先例)
SET NOCOUNT ON;
IF OBJECT_ID('gran_record_detail') IS NULL CREATE TABLE gran_record_detail (id int IDENTITY(1,1) PRIMARY KEY, [单据编号] nvarchar(60) NULL, asp_cancel char(1) NULL DEFAULT 'N', asp_user1 nvarchar(50) NULL, asp_user2 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_time2 datetime2 NULL);
IF OBJECT_ID('wh_record_detail') IS NULL CREATE TABLE wh_record_detail (id int IDENTITY(1,1) PRIMARY KEY, [单据编号] nvarchar(60) NULL, asp_cancel char(1) NULL DEFAULT 'N', asp_user1 nvarchar(50) NULL, asp_user2 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_time2 datetime2 NULL);
IF OBJECT_ID('pack_confirm_detail') IS NULL CREATE TABLE pack_confirm_detail (id int IDENTITY(1,1) PRIMARY KEY, [单据编号] nvarchar(60) NULL, asp_cancel char(1) NULL DEFAULT 'N', asp_user1 nvarchar(50) NULL, asp_user2 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_time2 datetime2 NULL);
IF OBJECT_ID('rod_return_detail') IS NULL CREATE TABLE rod_return_detail (id int IDENTITY(1,1) PRIMARY KEY, [单据编号] nvarchar(60) NULL, asp_cancel char(1) NULL DEFAULT 'N', asp_user1 nvarchar(50) NULL, asp_user2 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_time2 datetime2 NULL);
GO
UPDATE yj_panel SET line_table = 'gran_record_detail' WHERE panel_code = 'GRAN_RECORD' AND line_table = 'gran_record';
UPDATE yj_panel SET line_table = 'wh_record_detail' WHERE panel_code = 'WH_RECORD' AND line_table = 'wh_record';
UPDATE yj_panel SET line_table = 'pack_confirm_detail' WHERE panel_code = 'PACK_CONFIRM' AND line_table = 'pack_confirm';
UPDATE yj_panel SET line_table = 'rod_return_detail' WHERE panel_code = 'ROD_RETURN' AND line_table = 'rod_return';
GO
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='GRAN_RECORD') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('GRAN_RECORD', N'造粒记录', N'生产管理', 'doc', 'gran_record_detail', 'gran_record', N'单据编号', N'id', N'单据编号', N'LZ', N'单据日期', 20, 'items', N'生产制造');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='WH_RECORD') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('WH_RECORD', N'无黑处理登记', N'生产管理', 'doc', 'wh_record_detail', 'wh_record', N'单据编号', N'id', N'单据编号', N'WB', N'单据日期', 20, 'items', N'生产制造');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='PACK_CONFIRM') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('PACK_CONFIRM', N'封箱确认', N'生产管理', 'doc', 'pack_confirm_detail', 'pack_confirm', N'单据编号', N'id', N'单据编号', N'FX', N'装箱日期', 20, 'items', N'生产制造');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='ROD_RETURN') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('ROD_RETURN', N'炭棒不良退货登记', N'生产管理', 'doc', 'rod_return_detail', 'rod_return', N'单据编号', N'id', N'单据编号', N'TL', N'单据日期', 20, 'items', N'生产制造');
GO
-- 补注册此前同批失败可能遗漏的面板(幂等)
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='EQUIP_CHECK') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('EQUIP_CHECK', N'设备点检记录', N'生产管理', 'doc', 'equip_check_detail', 'equip_check', N'单据编号', N'id', N'单据编号', N'DJ', N'年月', 20, 'items', N'生产制造');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='MAINT_PLAN') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('MAINT_PLAN', N'保养计划', N'生产管理', 'doc', 'maint_plan_detail', 'maint_plan', N'单据编号', N'id', N'单据编号', N'BY', NULL, 20, 'items', N'生产制造');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='SAMPLE_REQ') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('SAMPLE_REQ', N'样品申请单', N'生产管理', 'doc', 'sample_req_detail', 'sample_req', N'单据编号', N'id', N'单据编号', N'SP', N'下单日期', 20, 'items', N'生产制造');
GO
PRINT N'migrate-prod-forms-fix 完成';
GO
