-- migrate-phase23-production.sql — Phase 2+3:五工序模型表 + 品检分流逻辑基础 + 工序面板注册
SET NOCOUNT ON;
GO
-- ═══ Phase 3: 五道工序模型 ═══

-- 工序报工表(五道工序共用,stage 区分)
IF OBJECT_ID('wo_stage_report') IS NULL
CREATE TABLE wo_stage_report (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    manu_order_no NVARCHAR(50) NOT NULL,
    stage NVARCHAR(20) NOT NULL,
    report_date DATE NOT NULL,
    shift NVARCHAR(10),
    worker NVARCHAR(50),
    plan_qty DECIMAL(18,4) DEFAULT 0,
    actual_qty DECIMAL(18,4) DEFAULT 0,
    defect_qty DECIMAL(18,4) DEFAULT 0,
    dual_out_qty DECIMAL(18,4),
    batch_no NVARCHAR(50),
    qr_code NVARCHAR(100),
    device_no NVARCHAR(50),
    notes NVARCHAR(500),
    asp_user1 NVARCHAR(50),
    asp_time1 DATETIME2 DEFAULT GETDATE(),
    asp_user2 NVARCHAR(50),
    asp_time2 DATETIME2,
    asp_cancel CHAR(1) DEFAULT 'N'
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_stage_order')
    CREATE INDEX ix_stage_order ON wo_stage_report (manu_order_no, stage, asp_cancel);
GO

-- 工序领料表
IF OBJECT_ID('wo_material_pick') IS NULL
CREATE TABLE wo_material_pick (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    manu_order_no NVARCHAR(50) NOT NULL,
    stage NVARCHAR(20) NOT NULL,
    item_code NVARCHAR(50) NOT NULL,
    item_name NVARCHAR(100),
    batch_no NVARCHAR(50),
    qty DECIMAL(18,4) NOT NULL,
    picker NVARCHAR(50),
    pick_time DATETIME2 DEFAULT GETDATE(),
    qr_code NVARCHAR(100),
    asp_user1 NVARCHAR(50),
    asp_time1 DATETIME2 DEFAULT GETDATE(),
    asp_cancel CHAR(1) DEFAULT 'N'
);
GO

-- 线边库存
IF OBJECT_ID('wo_line_stock') IS NULL
CREATE TABLE wo_line_stock (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    manu_order_no NVARCHAR(50) NOT NULL,
    stage NVARCHAR(20) NOT NULL,
    item_code NVARCHAR(50),
    batch_no NVARCHAR(50),
    qty DECIMAL(18,4) NOT NULL,
    warehouse NVARCHAR(20) DEFAULT 'LINE',
    asp_user1 NVARCHAR(50),
    asp_time1 DATETIME2 DEFAULT GETDATE(),
    asp_cancel CHAR(1) DEFAULT 'N'
);
GO

-- ═══ 面板注册 ═══
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='WO_STAGE')
INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, group_col, pk_col, prefix, date_col, page_size, detail_key, module_group)
VALUES ('WO_STAGE', N'工序报工', N'档案', 'flat', 'wo_stage_report', 'id', 'id', 'WOS', NULL, 20, 'items', N'生产制造');
GO
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='WO_PICK')
INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, group_col, pk_col, prefix, date_col, page_size, detail_key, module_group)
VALUES ('WO_PICK', N'工序领料', N'档案', 'flat', 'wo_material_pick', 'id', 'id', 'WOP', NULL, 20, 'items', N'生产制造');
GO
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='WO_LINE')
INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, group_col, pk_col, prefix, date_col, page_size, detail_key, module_group)
VALUES ('WO_LINE', N'线边库存', N'报表', 'flat', 'wo_line_stock', 'id', 'id', 'WOL', NULL, 50, 'items', N'生产制造');
GO

-- 工序报工字段
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_STAGE' AND col_name='manu_order_no')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden) VALUES
('WO_STAGE','manu_order_no',N'工单号','文本','detail',1,130,1,1,0),
('WO_STAGE','stage',N'工序','下拉框','detail',2,100,1,1,0),
('WO_STAGE','report_date',N'报工日期','日期','detail',3,110,1,1,0),
('WO_STAGE','shift',N'班次','下拉框','detail',4,80,1,0,0),
('WO_STAGE','worker',N'操作工','文本','detail',5,100,1,0,0),
('WO_STAGE','plan_qty',N'计划数量','小数','detail',6,100,1,0,0),
('WO_STAGE','actual_qty',N'完成数量','小数','detail',7,100,1,1,0),
('WO_STAGE','defect_qty',N'不良数量','小数','detail',8,100,1,0,0),
('WO_STAGE','dual_out_qty',N'直销数量','小数','detail',9,100,1,0,0),
('WO_STAGE','batch_no',N'批号','文本','detail',10,120,1,0,0),
('WO_STAGE','device_no',N'设备编号','文本','detail',11,100,1,0,0),
('WO_STAGE','notes',N'备注','文本','detail',12,180,1,0,0),
('WO_STAGE','manu_order_no',N'工单号','文本','query',1,130,0,0,0),
('WO_STAGE','stage',N'工序','下拉框','query',2,100,0,0,0);
GO

-- 工序领料字段
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_PICK' AND col_name='manu_order_no')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden) VALUES
('WO_PICK','manu_order_no',N'工单号','文本','detail',1,130,1,1,0),
('WO_PICK','stage',N'领料工序','下拉框','detail',2,100,1,1,0),
('WO_PICK','item_code',N'物料编码','文本','detail',3,120,1,1,0),
('WO_PICK','item_name',N'物料名称','文本','detail',4,140,1,0,0),
('WO_PICK','batch_no',N'材料批号','文本','detail',5,120,1,0,0),
('WO_PICK','qty',N'领料数量','小数','detail',6,100,1,1,0),
('WO_PICK','picker',N'领料人','文本','detail',7,100,1,0,0),
('WO_PICK','manu_order_no',N'工单号','文本','query',1,130,0,0,0);
GO

-- 线边库存字段
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_LINE' AND col_name='manu_order_no')
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden) VALUES
('WO_LINE','manu_order_no',N'工单号','文本','detail',1,130,0,0,0),
('WO_LINE','stage',N'所在工序','下拉框','detail',2,100,0,0,0),
('WO_LINE','item_code',N'物料/产品编码','文本','detail',3,120,0,0,0),
('WO_LINE','batch_no',N'批号','文本','detail',4,120,0,0,0),
('WO_LINE','qty',N'数量','小数','detail',5,100,0,0,0),
('WO_LINE','manu_order_no',N'工单号','文本','query',1,130,0,0,0);
GO

-- 工序下拉字典
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_STAGE' AND col_name='stage' AND place='detail' AND dict_sql IS NOT NULL)
UPDATE yj_field SET dict_sql = N'SELECT N''混料'' AS val, N''混料'' AS lbl UNION ALL SELECT N''成型'',N''成型'' UNION ALL SELECT N''切炭'',N''切炭'' UNION ALL SELECT N''组装'',N''组装'' UNION ALL SELECT N''装箱'',N''装箱'''
WHERE panel_code='WO_STAGE' AND col_name='stage' AND place='detail';
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_PICK' AND col_name='stage' AND place='detail' AND dict_sql IS NOT NULL)
UPDATE yj_field SET dict_sql = N'SELECT N''混料'' AS val, N''混料'' AS lbl UNION ALL SELECT N''成型'',N''成型'' UNION ALL SELECT N''组装'',N''组装'''
WHERE panel_code='WO_PICK' AND col_name='stage' AND place='detail';
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_LINE' AND col_name='stage' AND place='detail' AND dict_sql IS NOT NULL)
UPDATE yj_field SET dict_sql = N'SELECT N''混料'' AS val, N''混料'' AS lbl UNION ALL SELECT N''成型'',N''成型'' UNION ALL SELECT N''切炭'',N''切炭'' UNION ALL SELECT N''组装'',N''组装'' UNION ALL SELECT N''装箱'',N''装箱'''
WHERE panel_code='WO_LINE' AND col_name='stage' AND place='detail';
GO

-- 菜单入口:生产制造模块加三个面板
PRINT N'Phase 2+3 迁移完成:五工序模型表 + 工序报工/领料/线边库存面板 + 工序字典';
GO
