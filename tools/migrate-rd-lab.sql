/* 实验室使用记录表 4 个面板 */
USE HSDZ_MES;
SET NOCOUNT ON;
GO

-- 1. 加标水配置记录表
IF OBJECT_ID('rd_spike_water') IS NULL CREATE TABLE rd_spike_water (
    id int IDENTITY(1,1) PRIMARY KEY,
    record_no nvarchar(60) NULL, prep_date date NULL,
    spike_name nvarchar(200) NULL, concentration nvarchar(60) NULL,
    solvent nvarchar(100) NULL, volume float NULL, unit nvarchar(20) NULL,
    expiry_date date NULL, preparer nvarchar(40) NULL,
    remark nvarchar(500) NULL, comm nvarchar(10) NOT NULL DEFAULT '0',
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL,
    asp_user2 nvarchar(40) NULL, asp_time2 datetime NULL,
    asp_cancel nvarchar(2) NULL, asp_print int DEFAULT 0);
GO
-- 2. 国内部委托测试申请单
IF OBJECT_ID('rd_dom_test') IS NULL CREATE TABLE rd_dom_test (
    id int IDENTITY(1,1) PRIMARY KEY,
    apply_no nvarchar(60) NULL, apply_date date NULL,
    dept nvarchar(60) NULL, applicant nvarchar(40) NULL,
    sample_name nvarchar(200) NULL, sample_no nvarchar(60) NULL,
    sample_qty float NULL, test_item nvarchar(500) NULL,
    test_method nvarchar(200) NULL, urgency nvarchar(20) NULL,
    expected_date date NULL, receiver nvarchar(40) NULL,
    result_status nvarchar(20) NULL,
    remark nvarchar(500) NULL, comm nvarchar(10) NOT NULL DEFAULT '0',
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL,
    asp_user2 nvarchar(40) NULL, asp_time2 datetime NULL,
    asp_cancel nvarchar(2) NULL, asp_print int DEFAULT 0);
GO
-- 3. 设备使用登记表
IF OBJECT_ID('rd_equip_use') IS NULL CREATE TABLE rd_equip_use (
    id int IDENTITY(1,1) PRIMARY KEY,
    record_no nvarchar(60) NULL, use_date date NULL,
    equip_name nvarchar(200) NULL, equip_no nvarchar(60) NULL,
    user_name nvarchar(40) NULL, start_time nvarchar(20) NULL,
    end_time nvarchar(20) NULL, duration float NULL,
    purpose nvarchar(300) NULL, condition_before nvarchar(200) NULL,
    condition_after nvarchar(200) NULL,
    remark nvarchar(500) NULL, comm nvarchar(10) NOT NULL DEFAULT '0',
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL,
    asp_user2 nvarchar(40) NULL, asp_time2 datetime NULL,
    asp_cancel nvarchar(2) NULL, asp_print int DEFAULT 0);
GO
-- 4. 仪器使用记录表
IF OBJECT_ID('rd_instr_use') IS NULL CREATE TABLE rd_instr_use (
    id int IDENTITY(1,1) PRIMARY KEY,
    record_no nvarchar(60) NULL, use_date date NULL,
    instr_name nvarchar(200) NULL, instr_model nvarchar(100) NULL,
    instr_no nvarchar(60) NULL, user_name nvarchar(40) NULL,
    sample_name nvarchar(200) NULL, test_item nvarchar(200) NULL,
    start_time nvarchar(20) NULL, end_time nvarchar(20) NULL,
    temperature float NULL, humidity float NULL,
    remark nvarchar(500) NULL, comm nvarchar(10) NOT NULL DEFAULT '0',
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL,
    asp_user2 nvarchar(40) NULL, asp_time2 datetime NULL,
    asp_cancel nvarchar(2) NULL, asp_print int DEFAULT 0);
GO

-- 面板注册
INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES
('RD_SPIKE_WATER', N'加标水配置记录表', N'单据', 'doc', 'rd_spike_water', NULL, 'record_no', 'id', NULL, 'SW', 'prep_date', 20, 'items', N'研发管理'),
('RD_DOM_TEST',    N'委托测试申请单',   N'单据', 'doc', 'rd_dom_test',    NULL, 'apply_no',   'id', NULL, 'DT', 'apply_date', 20, 'items', N'研发管理'),
('RD_EQUIP_USE',   N'设备使用登记表',   N'单据', 'doc', 'rd_equip_use',   NULL, 'record_no',  'id', NULL, 'EU', 'use_date',   20, 'items', N'研发管理'),
('RD_INSTR_USE',   N'仪器使用记录表',   N'单据', 'doc', 'rd_instr_use',   NULL, 'record_no',  'id', NULL, 'IU', 'use_date',   20, 'items', N'研发管理');
GO

-- 字段定义
-- 1. 加标水配置记录表
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq) VALUES
('RD_SPIKE_WATER','record_no',N'记录编号','文本','query,header',1),
('RD_SPIKE_WATER','prep_date',N'配制日期','日期','query,header,detail',2),
('RD_SPIKE_WATER','spike_name',N'加标物名称','文本','query,header,detail',3),
('RD_SPIKE_WATER','concentration',N'浓度','文本','header,detail',4),
('RD_SPIKE_WATER','solvent',N'溶剂','文本','detail',5),
('RD_SPIKE_WATER','volume',N'配制体积(mL)','小数','detail',6),
('RD_SPIKE_WATER','unit',N'单位','文本','detail',7),
('RD_SPIKE_WATER','expiry_date',N'有效期至','日期','detail',8),
('RD_SPIKE_WATER','preparer',N'配制人','文本','header,detail',9),
('RD_SPIKE_WATER','remark',N'备注','文本','detail',99);

-- 2. 国内部委托测试申请单
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq) VALUES
('RD_DOM_TEST','apply_no',N'申请单号','文本','query,header',1),
('RD_DOM_TEST','apply_date',N'申请日期','日期','query,header,detail',2),
('RD_DOM_TEST','dept',N'委托部门','文本','query,header,detail',3),
('RD_DOM_TEST','applicant',N'申请人','文本','header,detail',4),
('RD_DOM_TEST','sample_name',N'样品名称','文本','query,header,detail',5),
('RD_DOM_TEST','sample_no',N'样品编号','文本','detail',6),
('RD_DOM_TEST','sample_qty',N'样品数量','小数','detail',7),
('RD_DOM_TEST','test_item',N'测试项目','文本','header,detail',8),
('RD_DOM_TEST','test_method',N'测试方法','文本','detail',9),
('RD_DOM_TEST','urgency',N'紧急程度','下拉框','header,detail',10),
('RD_DOM_TEST','expected_date',N'期望完成日期','日期','detail',11),
('RD_DOM_TEST','receiver',N'接收人','文本','detail',12),
('RD_DOM_TEST','result_status',N'结果状态','下拉框','query,header,detail',13),
('RD_DOM_TEST','remark',N'备注','文本','detail',99);
UPDATE yj_field SET dict_sql = N'SELECT mc FROM dm_gx WHERE lb=''JJCD'' AND ISNULL(asp_cancel,''N'')<>''Y''' WHERE panel_code='RD_DOM_TEST' AND col_name='urgency';
UPDATE yj_field SET dict_sql = N'SELECT mc FROM dm_gx WHERE lb=''JGZT'' AND ISNULL(asp_cancel,''N'')<>''Y''' WHERE panel_code='RD_DOM_TEST' AND col_name='result_status';

-- 3. 设备使用登记表
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq) VALUES
('RD_EQUIP_USE','record_no',N'登记编号','文本','query,header',1),
('RD_EQUIP_USE','use_date',N'使用日期','日期','query,header,detail',2),
('RD_EQUIP_USE','equip_name',N'设备名称','文本','query,header,detail',3),
('RD_EQUIP_USE','equip_no',N'设备编号','文本','detail',4),
('RD_EQUIP_USE','user_name',N'使用人','文本','query,header,detail',5),
('RD_EQUIP_USE','start_time',N'开始时间','文本','detail',6),
('RD_EQUIP_USE','end_time',N'结束时间','文本','detail',7),
('RD_EQUIP_USE','duration',N'使用时长(h)','小数','detail',8),
('RD_EQUIP_USE','purpose',N'使用目的','文本','header,detail',9),
('RD_EQUIP_USE','condition_before',N'使用前状态','文本','detail',10),
('RD_EQUIP_USE','condition_after',N'使用后状态','文本','detail',11),
('RD_EQUIP_USE','remark',N'备注','文本','detail',99);

-- 4. 仪器使用记录表
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq) VALUES
('RD_INSTR_USE','record_no',N'记录编号','文本','query,header',1),
('RD_INSTR_USE','use_date',N'使用日期','日期','query,header,detail',2),
('RD_INSTR_USE','instr_name',N'仪器名称','文本','query,header,detail',3),
('RD_INSTR_USE','instr_model',N'仪器型号','文本','detail',4),
('RD_INSTR_USE','instr_no',N'仪器编号','文本','detail',5),
('RD_INSTR_USE','user_name',N'使用人','文本','query,header,detail',6),
('RD_INSTR_USE','sample_name',N'样品名称','文本','detail',7),
('RD_INSTR_USE','test_item',N'测试项目','文本','detail',8),
('RD_INSTR_USE','start_time',N'开始时间','文本','detail',9),
('RD_INSTR_USE','end_time',N'结束时间','文本','detail',10),
('RD_INSTR_USE','temperature',N'温度(℃)','小数','detail',11),
('RD_INSTR_USE','humidity',N'湿度(%RH)','小数','detail',12),
('RD_INSTR_USE','remark',N'备注','文本','detail',99);
GO

GRANT SELECT, INSERT, UPDATE, DELETE ON rd_spike_water TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_dom_test TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_equip_use TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_instr_use TO yinjia;
GO

-- 补充字典
IF NOT EXISTS (SELECT 1 FROM dm_gx WHERE lb = 'JJCD' AND dm = 'JJCD01')
INSERT INTO dm_gx (comm, dm, mc, lb, asp_cancel) VALUES
('0','JJCD01',N'普通','JJCD','N'),
('0','JJCD02',N'紧急','JJCD','N'),
('0','JJCD03',N'特急','JJCD','N');
IF NOT EXISTS (SELECT 1 FROM dm_gx WHERE lb = 'JGZT' AND dm = 'JGZT01')
INSERT INTO dm_gx (comm, dm, mc, lb, asp_cancel) VALUES
('0','JGZT01',N'待测试','JGZT','N'),
('0','JGZT02',N'测试中','JGZT','N'),
('0','JGZT03',N'已完成','JGZT','N'),
('0','JGZT04',N'已取消','JGZT','N');
GO

DECLARE @c int = (SELECT COUNT(*) FROM yj_field WHERE panel_code IN ('RD_SPIKE_WATER','RD_DOM_TEST','RD_EQUIP_USE','RD_INSTR_USE'));
PRINT N'实验室面板字段注册完成: ' + CAST(@c AS nvarchar(10)) + N' 个字段';
GO
