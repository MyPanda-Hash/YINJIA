/* 研发管理-数据记录表 8 个面板:建表 + 注册 + 字段 */
USE HSDZ_MES;
SET NOCOUNT ON;
GO

IF OBJECT_ID('rd_filter_eff') IS NULL CREATE TABLE rd_filter_eff (
    id int IDENTITY(1,1) PRIMARY KEY, record_no nvarchar(60) NULL, test_date date NULL,
    sample_name nvarchar(100) NULL, sample_no nvarchar(60) NULL, tester nvarchar(40) NULL,
    turbidity_in float NULL, turbidity_out float NULL, efficiency float NULL,
    flow_rate float NULL, pressure float NULL, test_media nvarchar(100) NULL,
    remark nvarchar(500) NULL, comm nvarchar(10) NOT NULL DEFAULT '0',
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL, asp_user2 nvarchar(40) NULL,
    asp_time2 datetime NULL, asp_cancel nvarchar(2) NULL, asp_print int DEFAULT 0);
GO
IF OBJECT_ID('rd_alkaline') IS NULL CREATE TABLE rd_alkaline (
    id int IDENTITY(1,1) PRIMARY KEY, record_no nvarchar(60) NULL, test_date date NULL,
    sample_name nvarchar(100) NULL, sample_no nvarchar(60) NULL, tester nvarchar(40) NULL,
    ph_initial float NULL, ph_final float NULL, alkalinity float NULL,
    water_temp float NULL, duration float NULL,
    remark nvarchar(500) NULL, comm nvarchar(10) NOT NULL DEFAULT '0',
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL, asp_user2 nvarchar(40) NULL,
    asp_time2 datetime NULL, asp_cancel nvarchar(2) NULL, asp_print int DEFAULT 0);
GO
IF OBJECT_ID('rd_mineral') IS NULL CREATE TABLE rd_mineral (
    id int IDENTITY(1,1) PRIMARY KEY, record_no nvarchar(60) NULL, test_date date NULL,
    sample_name nvarchar(100) NULL, sample_no nvarchar(60) NULL, tester nvarchar(40) NULL,
    ca_content float NULL, mg_content float NULL, k_content float NULL,
    sr_content float NULL, metasilicic_acid float NULL,
    remark nvarchar(500) NULL, comm nvarchar(10) NOT NULL DEFAULT '0',
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL, asp_user2 nvarchar(40) NULL,
    asp_time2 datetime NULL, asp_cancel nvarchar(2) NULL, asp_print int DEFAULT 0);
GO
IF OBJECT_ID('rd_antibact') IS NULL CREATE TABLE rd_antibact (
    id int IDENTITY(1,1) PRIMARY KEY, record_no nvarchar(60) NULL, test_date date NULL,
    sample_name nvarchar(100) NULL, sample_no nvarchar(60) NULL, tester nvarchar(40) NULL,
    bacteria_initial float NULL, bacteria_final float NULL, inhibition_rate float NULL,
    bacteria_type nvarchar(100) NULL, culture_hours float NULL,
    remark nvarchar(500) NULL, comm nvarchar(10) NOT NULL DEFAULT '0',
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL, asp_user2 nvarchar(40) NULL,
    asp_time2 datetime NULL, asp_cancel nvarchar(2) NULL, asp_print int DEFAULT 0);
GO
IF OBJECT_ID('rd_scale') IS NULL CREATE TABLE rd_scale (
    id int IDENTITY(1,1) PRIMARY KEY, record_no nvarchar(60) NULL, test_date date NULL,
    sample_name nvarchar(100) NULL, sample_no nvarchar(60) NULL, tester nvarchar(40) NULL,
    scale_rate float NULL, ca_hardness float NULL, total_alkalinity float NULL,
    water_temp float NULL, test_duration float NULL,
    remark nvarchar(500) NULL, comm nvarchar(10) NOT NULL DEFAULT '0',
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL, asp_user2 nvarchar(40) NULL,
    asp_time2 datetime NULL, asp_cancel nvarchar(2) NULL, asp_print int DEFAULT 0);
GO
IF OBJECT_ID('rd_ro_protect') IS NULL CREATE TABLE rd_ro_protect (
    id int IDENTITY(1,1) PRIMARY KEY, record_no nvarchar(60) NULL, test_date date NULL,
    sample_name nvarchar(100) NULL, sample_no nvarchar(60) NULL, tester nvarchar(40) NULL,
    ro_pressure_diff float NULL, salt_rejection float NULL,
    water_production float NULL, recovery_rate float NULL,
    remark nvarchar(500) NULL, comm nvarchar(10) NOT NULL DEFAULT '0',
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL, asp_user2 nvarchar(40) NULL,
    asp_time2 datetime NULL, asp_cancel nvarchar(2) NULL, asp_print int DEFAULT 0);
GO
IF OBJECT_ID('rd_soak') IS NULL CREATE TABLE rd_soak (
    id int IDENTITY(1,1) PRIMARY KEY, record_no nvarchar(60) NULL, test_date date NULL,
    sample_name nvarchar(100) NULL, sample_no nvarchar(60) NULL, tester nvarchar(40) NULL,
    soak_hours float NULL, turbidity float NULL, cod float NULL,
    heavy_metal nvarchar(200) NULL, chromaticity float NULL,
    remark nvarchar(500) NULL, comm nvarchar(10) NOT NULL DEFAULT '0',
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL, asp_user2 nvarchar(40) NULL,
    asp_time2 datetime NULL, asp_cancel nvarchar(2) NULL, asp_print int DEFAULT 0);
GO
IF OBJECT_ID('rd_drop_prec') IS NULL CREATE TABLE rd_drop_prec (
    id int IDENTITY(1,1) PRIMARY KEY, record_no nvarchar(60) NULL, test_date date NULL,
    sample_name nvarchar(100) NULL, sample_no nvarchar(60) NULL, tester nvarchar(40) NULL,
    pressure_drop float NULL, precision_um float NULL,
    flow_rate float NULL, bubble_point float NULL,
    remark nvarchar(500) NULL, comm nvarchar(10) NOT NULL DEFAULT '0',
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL, asp_user2 nvarchar(40) NULL,
    asp_time2 datetime NULL, asp_cancel nvarchar(2) NULL, asp_print int DEFAULT 0);
GO

-- ============ 面板注册 ============
INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES
('RD_FILTER_EFF', N'功能性滤效', N'单据', 'doc', 'rd_filter_eff',  NULL, 'record_no', 'id', NULL, 'FE', 'test_date', 20, 'items', N'研发管理'),
('RD_ALKALINE',   N'碱性',       N'单据', 'doc', 'rd_alkaline',    NULL, 'record_no', 'id', NULL, 'PH', 'test_date', 20, 'items', N'研发管理'),
('RD_MINERAL',    N'矿化',       N'单据', 'doc', 'rd_mineral',     NULL, 'record_no', 'id', NULL, 'MI', 'test_date', 20, 'items', N'研发管理'),
('RD_ANTIBACT',   N'抑菌',       N'单据', 'doc', 'rd_antibact',    NULL, 'record_no', 'id', NULL, 'AB', 'test_date', 20, 'items', N'研发管理'),
('RD_SCALE',      N'阻垢性能',   N'单据', 'doc', 'rd_scale',       NULL, 'record_no', 'id', NULL, 'SC', 'test_date', 20, 'items', N'研发管理'),
('RD_RO_PROTECT', N'RO保护',     N'单据', 'doc', 'rd_ro_protect',  NULL, 'record_no', 'id', NULL, 'RO', 'test_date', 20, 'items', N'研发管理'),
('RD_SOAK',       N'浸泡安全',   N'单据', 'doc', 'rd_soak',        NULL, 'record_no', 'id', NULL, 'SK', 'test_date', 20, 'items', N'研发管理'),
('RD_DROP_PREC',  N'压降精度',   N'单据', 'doc', 'rd_drop_prec',   NULL, 'record_no', 'id', NULL, 'DP', 'test_date', 20, 'items', N'研发管理');
GO

-- ============ 通用字段 ============
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq)
SELECT p.panel_code, 'record_no', N'记录编号', '文本', 'query,header', 1 FROM yj_panel p WHERE p.module_group = N'研发管理' AND p.mode = 'doc'
UNION ALL SELECT p.panel_code, 'test_date', N'测试日期', '日期', 'query,header', 2 FROM yj_panel p WHERE p.module_group = N'研发管理' AND p.mode = 'doc'
UNION ALL SELECT p.panel_code, 'sample_name', N'样品名称', '文本', 'query,header,detail', 3 FROM yj_panel p WHERE p.module_group = N'研发管理' AND p.mode = 'doc'
UNION ALL SELECT p.panel_code, 'sample_no', N'样品编号', '文本', 'header,detail', 4 FROM yj_panel p WHERE p.module_group = N'研发管理' AND p.mode = 'doc'
UNION ALL SELECT p.panel_code, 'tester', N'测试人员', '文本', 'header,detail', 5 FROM yj_panel p WHERE p.module_group = N'研发管理' AND p.mode = 'doc';
GO

-- ============ 专有字段 ============
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq) VALUES
('RD_FILTER_EFF','turbidity_in',N'滤前浊度(NTU)','小数','detail',10),
('RD_FILTER_EFF','turbidity_out',N'滤后浊度(NTU)','小数','detail',11),
('RD_FILTER_EFF','efficiency',N'滤效率(%)','小数','detail',12),
('RD_FILTER_EFF','flow_rate',N'流量(L/min)','小数','detail',13),
('RD_FILTER_EFF','pressure',N'压力(MPa)','小数','detail',14),
('RD_FILTER_EFF','test_media',N'测试介质','文本','detail',15),
('RD_FILTER_EFF','remark',N'备注','文本','detail',99),
('RD_ALKALINE','ph_initial',N'初始pH值','小数','detail',10),
('RD_ALKALINE','ph_final',N'终点pH值','小数','detail',11),
('RD_ALKALINE','alkalinity',N'碱度(mg/L)','小数','detail',12),
('RD_ALKALINE','water_temp',N'水温(℃)','小数','detail',13),
('RD_ALKALINE','duration',N'持续时间(h)','小数','detail',14),
('RD_ALKALINE','remark',N'备注','文本','detail',99),
('RD_MINERAL','ca_content',N'钙含量(mg/L)','小数','detail',10),
('RD_MINERAL','mg_content',N'镁含量(mg/L)','小数','detail',11),
('RD_MINERAL','k_content',N'钾含量(mg/L)','小数','detail',12),
('RD_MINERAL','sr_content',N'锶含量(mg/L)','小数','detail',13),
('RD_MINERAL','metasilicic_acid',N'偏硅酸(mg/L)','小数','detail',14),
('RD_MINERAL','remark',N'备注','文本','detail',99),
('RD_ANTIBACT','bacteria_initial',N'初始菌落(CFU)','小数','detail',10),
('RD_ANTIBACT','bacteria_final',N'终点菌落(CFU)','小数','detail',11),
('RD_ANTIBACT','inhibition_rate',N'抑菌率(%)','小数','detail',12),
('RD_ANTIBACT','bacteria_type',N'菌种类型','文本','detail',13),
('RD_ANTIBACT','culture_hours',N'培养时间(h)','小数','detail',14),
('RD_ANTIBACT','remark',N'备注','文本','detail',99),
('RD_SCALE','scale_rate',N'阻垢率(%)','小数','detail',10),
('RD_SCALE','ca_hardness',N'钙硬度(mg/L)','小数','detail',11),
('RD_SCALE','total_alkalinity',N'总碱度(mg/L)','小数','detail',12),
('RD_SCALE','water_temp',N'水温(℃)','小数','detail',13),
('RD_SCALE','test_duration',N'测试时长(h)','小数','detail',14),
('RD_SCALE','remark',N'备注','文本','detail',99),
('RD_RO_PROTECT','ro_pressure_diff',N'RO膜压差(MPa)','小数','detail',10),
('RD_RO_PROTECT','salt_rejection',N'脱盐率(%)','小数','detail',11),
('RD_RO_PROTECT','water_production',N'产水量(L/h)','小数','detail',12),
('RD_RO_PROTECT','recovery_rate',N'回收率(%)','小数','detail',13),
('RD_RO_PROTECT','remark',N'备注','文本','detail',99),
('RD_SOAK','soak_hours',N'浸泡时间(h)','小数','detail',10),
('RD_SOAK','turbidity',N'浊度(NTU)','小数','detail',11),
('RD_SOAK','cod',N'COD(mg/L)','小数','detail',12),
('RD_SOAK','heavy_metal',N'重金属','文本','detail',13),
('RD_SOAK','chromaticity',N'色度(度)','小数','detail',14),
('RD_SOAK','remark',N'备注','文本','detail',99),
('RD_DROP_PREC','pressure_drop',N'压降(MPa)','小数','detail',10),
('RD_DROP_PREC','precision_um',N'过滤精度(μm)','小数','detail',11),
('RD_DROP_PREC','flow_rate',N'流量(L/min)','小数','detail',12),
('RD_DROP_PREC','bubble_point',N'气泡点(MPa)','小数','detail',13),
('RD_DROP_PREC','remark',N'备注','文本','detail',99);
GO

GRANT SELECT, INSERT, UPDATE, DELETE ON rd_filter_eff TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_alkaline TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_mineral TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_antibact TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_scale TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_ro_protect TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_soak TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_drop_prec TO yinjia;
GO

DECLARE @c int = (SELECT COUNT(*) FROM yj_field WHERE panel_code LIKE 'RD_%');
PRINT N'研发数据记录表字段注册完成: ' + CAST(@c AS nvarchar(10)) + N' 个字段';
GO
