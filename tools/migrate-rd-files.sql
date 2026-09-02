/* 产品文件 7 个面板:建表 + 注册 + 字段 */
USE HSDZ_MES;
SET NOCOUNT ON;
GO

-- ============ 1. 产品信息表 ============
IF OBJECT_ID('rd_product_info') IS NULL CREATE TABLE rd_product_info (
    id int IDENTITY(1,1) PRIMARY KEY,
    product_code nvarchar(60) NULL, product_name nvarchar(200) NULL,
    category nvarchar(60) NULL, model_spec nvarchar(200) NULL,
    material nvarchar(200) NULL, unit nvarchar(20) NULL,
    status nvarchar(20) NULL, description nvarchar(500) NULL,
    remark nvarchar(500) NULL, comm nvarchar(10) NOT NULL DEFAULT '0',
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL,
    asp_user2 nvarchar(40) NULL, asp_time2 datetime NULL,
    asp_cancel nvarchar(2) NULL, asp_print int DEFAULT 0);
GO
-- ============ 2. 成型工艺清单 ============
IF OBJECT_ID('rd_mold_proc') IS NULL CREATE TABLE rd_mold_proc (
    id int IDENTITY(1,1) PRIMARY KEY,
    process_no nvarchar(60) NULL, product_code nvarchar(60) NULL,
    process_name nvarchar(200) NULL, sequence int NULL,
    equipment nvarchar(100) NULL, mold_no nvarchar(60) NULL,
    temperature float NULL, pressure float NULL, cycle_time float NULL,
    material_type nvarchar(100) NULL,
    remark nvarchar(500) NULL, comm nvarchar(10) NOT NULL DEFAULT '0',
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL,
    asp_user2 nvarchar(40) NULL, asp_time2 datetime NULL,
    asp_cancel nvarchar(2) NULL, asp_print int DEFAULT 0);
GO
-- ============ 3. 成型配方 ============
IF OBJECT_ID('rd_mold_formula') IS NULL CREATE TABLE rd_mold_formula (
    id int IDENTITY(1,1) PRIMARY KEY,
    formula_no nvarchar(60) NULL, product_code nvarchar(60) NULL,
    material_name nvarchar(200) NULL, material_code nvarchar(60) NULL,
    ratio float NULL, weight float NULL, unit nvarchar(20) NULL,
    remark nvarchar(500) NULL, comm nvarchar(10) NOT NULL DEFAULT '0',
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL,
    asp_user2 nvarchar(40) NULL, asp_time2 datetime NULL,
    asp_cancel nvarchar(2) NULL, asp_print int DEFAULT 0);
GO
-- ============ 4. 规格书(文件上传管理) ============
IF OBJECT_ID('rd_spec_doc') IS NULL CREATE TABLE rd_spec_doc (
    id int IDENTITY(1,1) PRIMARY KEY,
    product_code nvarchar(60) NULL, doc_name nvarchar(200) NULL,
    version nvarchar(20) NULL, file_name nvarchar(300) NULL,
    file_path nvarchar(500) NULL, file_size float NULL,
    upload_by nvarchar(40) NULL, upload_date date NULL,
    status nvarchar(20) NULL DEFAULT N'当前',
    remark nvarchar(500) NULL, comm nvarchar(10) NOT NULL DEFAULT '0',
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL,
    asp_user2 nvarchar(40) NULL, asp_time2 datetime NULL,
    asp_cancel nvarchar(2) NULL, asp_print int DEFAULT 0);
GO
-- ============ 5. 组装BOM表 ============
IF OBJECT_ID('rd_asm_bom') IS NULL CREATE TABLE rd_asm_bom (
    id int IDENTITY(1,1) PRIMARY KEY,
    bom_no nvarchar(60) NULL, product_code nvarchar(60) NULL,
    parent_part nvarchar(60) NULL, parent_name nvarchar(200) NULL,
    child_part nvarchar(60) NULL, child_name nvarchar(200) NULL,
    quantity float NULL, unit nvarchar(20) NULL, position nvarchar(60) NULL,
    remark nvarchar(500) NULL, comm nvarchar(10) NOT NULL DEFAULT '0',
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL,
    asp_user2 nvarchar(40) NULL, asp_time2 datetime NULL,
    asp_cancel nvarchar(2) NULL, asp_print int DEFAULT 0);
GO
-- ============ 6. 组装工艺清单 ============
IF OBJECT_ID('rd_asm_proc') IS NULL CREATE TABLE rd_asm_proc (
    id int IDENTITY(1,1) PRIMARY KEY,
    process_no nvarchar(60) NULL, product_code nvarchar(60) NULL,
    process_name nvarchar(200) NULL, sequence int NULL,
    workstation nvarchar(100) NULL, tool nvarchar(200) NULL,
    time_standard float NULL,
    remark nvarchar(500) NULL, comm nvarchar(10) NOT NULL DEFAULT '0',
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL,
    asp_user2 nvarchar(40) NULL, asp_time2 datetime NULL,
    asp_cancel nvarchar(2) NULL, asp_print int DEFAULT 0);
GO
-- ============ 7. 出货检验计划表(文件上传管理) ============
IF OBJECT_ID('rd_insp_plan') IS NULL CREATE TABLE rd_insp_plan (
    id int IDENTITY(1,1) PRIMARY KEY,
    product_code nvarchar(60) NULL, doc_name nvarchar(200) NULL,
    version nvarchar(20) NULL, file_name nvarchar(300) NULL,
    file_path nvarchar(500) NULL, file_size float NULL,
    upload_by nvarchar(40) NULL, upload_date date NULL,
    status nvarchar(20) NULL DEFAULT N'当前',
    remark nvarchar(500) NULL, comm nvarchar(10) NOT NULL DEFAULT '0',
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL,
    asp_user2 nvarchar(40) NULL, asp_time2 datetime NULL,
    asp_cancel nvarchar(2) NULL, asp_print int DEFAULT 0);
GO

-- ============ 面板注册 ============
INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES
('RD_PROD_INFO',    N'产品信息表',   N'单据', 'doc', 'rd_product_info', NULL, 'product_code', 'id', NULL, 'PI', NULL, 20, 'items', N'研发管理'),
('RD_MOLD_PROC',    N'成型工艺清单', N'单据', 'doc', 'rd_mold_proc',    NULL, 'process_no',   'id', NULL, 'MP', NULL, 20, 'items', N'研发管理'),
('RD_MOLD_FORMULA', N'成型配方',     N'单据', 'doc', 'rd_mold_formula', NULL, 'formula_no',   'id', NULL, 'MF', NULL, 20, 'items', N'研发管理'),
('RD_SPEC_DOC',     N'规格书',       N'单据', 'doc', 'rd_spec_doc',     NULL, 'product_code', 'id', NULL, 'SD', 'upload_date', 20, 'items', N'研发管理'),
('RD_ASM_BOM',      N'组装BOM表',    N'单据', 'doc', 'rd_asm_bom',      NULL, 'bom_no',       'id', NULL, 'AB', NULL, 20, 'items', N'研发管理'),
('RD_ASM_PROC',     N'组装工艺清单', N'单据', 'doc', 'rd_asm_proc',     NULL, 'process_no',   'id', NULL, 'AP', NULL, 20, 'items', N'研发管理'),
('RD_INSP_PLAN',    N'出货检验计划表', N'单据', 'doc', 'rd_insp_plan',  NULL, 'product_code', 'id', NULL, 'IP', 'upload_date', 20, 'items', N'研发管理');
GO

-- ============ 字段定义 ============
-- 1. 产品信息表
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq) VALUES
('RD_PROD_INFO','product_code',N'产品编码','文本','query,header',1),
('RD_PROD_INFO','product_name',N'产品名称','文本','query,header,detail',2),
('RD_PROD_INFO','category',N'产品类别','文本','query,header,detail',3),
('RD_PROD_INFO','model_spec',N'型号规格','文本','header,detail',4),
('RD_PROD_INFO','material',N'材质','文本','header,detail',5),
('RD_PROD_INFO','unit',N'计量单位','文本','header,detail',6),
('RD_PROD_INFO','status',N'状态','下拉框','query,header,detail',7),
('RD_PROD_INFO','description',N'描述','文本','header,detail',8),
('RD_PROD_INFO','remark',N'备注','文本','detail',99);
-- 状态选项
UPDATE yj_field SET dict_sql = N'SELECT mc FROM dm_gx WHERE lb=''CPZT'' AND ISNULL(asp_cancel,''N'')<>''Y''' WHERE panel_code='RD_PROD_INFO' AND col_name='status';

-- 2. 成型工艺清单
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq) VALUES
('RD_MOLD_PROC','process_no',N'工艺编号','文本','query,header',1),
('RD_MOLD_PROC','product_code',N'产品编码','文本','query,header,detail',2),
('RD_MOLD_PROC','process_name',N'工序名称','文本','query,header,detail',3),
('RD_MOLD_PROC','sequence',N'工序顺序','整数','detail',4),
('RD_MOLD_PROC','equipment',N'设备','文本','detail',5),
('RD_MOLD_PROC','mold_no',N'模具编号','文本','detail',6),
('RD_MOLD_PROC','temperature',N'温度(℃)','小数','detail',7),
('RD_MOLD_PROC','pressure',N'压力(MPa)','小数','detail',8),
('RD_MOLD_PROC','cycle_time',N'周期时间(s)','小数','detail',9),
('RD_MOLD_PROC','material_type',N'材料类型','文本','detail',10),
('RD_MOLD_PROC','remark',N'备注','文本','detail',99);

-- 3. 成型配方
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq) VALUES
('RD_MOLD_FORMULA','formula_no',N'配方编号','文本','query,header',1),
('RD_MOLD_FORMULA','product_code',N'产品编码','文本','query,header,detail',2),
('RD_MOLD_FORMULA','material_name',N'材料名称','文本','query,header,detail',3),
('RD_MOLD_FORMULA','material_code',N'材料编码','文本','detail',4),
('RD_MOLD_FORMULA','ratio',N'配比(%)','小数','detail',5),
('RD_MOLD_FORMULA','weight',N'重量(g)','小数','detail',6),
('RD_MOLD_FORMULA','unit',N'单位','文本','detail',7),
('RD_MOLD_FORMULA','remark',N'备注','文本','detail',99);

-- 4. 规格书(文件上传)
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq) VALUES
('RD_SPEC_DOC','product_code',N'产品编码','文本','query,header,detail',1),
('RD_SPEC_DOC','doc_name',N'文档名称','文本','query,header,detail',2),
('RD_SPEC_DOC','version',N'版本号','文本','header,detail',3),
('RD_SPEC_DOC','file_name',N'文件名','文本','detail',4),
('RD_SPEC_DOC','file_size',N'文件大小(KB)','小数','detail',5),
('RD_SPEC_DOC','upload_by',N'上传人','文本','header,detail',6),
('RD_SPEC_DOC','upload_date',N'上传日期','日期','query,header,detail',7),
('RD_SPEC_DOC','status',N'状态','下拉框','query,header,detail',8),
('RD_SPEC_DOC','remark',N'备注','文本','detail',99);
UPDATE yj_field SET dict_sql = N'SELECT mc FROM dm_gx WHERE lb=''WDZT'' AND ISNULL(asp_cancel,''N'')<>''Y''' WHERE panel_code='RD_SPEC_DOC' AND col_name='status';

-- 5. 组装BOM表
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq) VALUES
('RD_ASM_BOM','bom_no',N'BOM编号','文本','query,header',1),
('RD_ASM_BOM','product_code',N'产品编码','文本','query,header,detail',2),
('RD_ASM_BOM','parent_part',N'父件编码','文本','detail',3),
('RD_ASM_BOM','parent_name',N'父件名称','文本','detail',4),
('RD_ASM_BOM','child_part',N'子件编码','文本','query,detail',5),
('RD_ASM_BOM','child_name',N'子件名称','文本','detail',6),
('RD_ASM_BOM','quantity',N'数量','小数','detail',7),
('RD_ASM_BOM','unit',N'单位','文本','detail',8),
('RD_ASM_BOM','position',N'位置','文本','detail',9),
('RD_ASM_BOM','remark',N'备注','文本','detail',99);

-- 6. 组装工艺清单
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq) VALUES
('RD_ASM_PROC','process_no',N'工艺编号','文本','query,header',1),
('RD_ASM_PROC','product_code',N'产品编码','文本','query,header,detail',2),
('RD_ASM_PROC','process_name',N'工序名称','文本','query,header,detail',3),
('RD_ASM_PROC','sequence',N'工序顺序','整数','detail',4),
('RD_ASM_PROC','workstation',N'工位','文本','detail',5),
('RD_ASM_PROC','tool',N'工具/治具','文本','detail',6),
('RD_ASM_PROC','time_standard',N'标准时间(s)','小数','detail',7),
('RD_ASM_PROC','remark',N'备注','文本','detail',99);

-- 7. 出货检验计划表(文件上传)
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq) VALUES
('RD_INSP_PLAN','product_code',N'产品编码','文本','query,header,detail',1),
('RD_INSP_PLAN','doc_name',N'文档名称','文本','query,header,detail',2),
('RD_INSP_PLAN','version',N'版本号','文本','header,detail',3),
('RD_INSP_PLAN','file_name',N'文件名','文本','detail',4),
('RD_INSP_PLAN','file_size',N'文件大小(KB)','小数','detail',5),
('RD_INSP_PLAN','upload_by',N'上传人','文本','header,detail',6),
('RD_INSP_PLAN','upload_date',N'上传日期','日期','query,header,detail',7),
('RD_INSP_PLAN','status',N'状态','下拉框','query,header,detail',8),
('RD_INSP_PLAN','remark',N'备注','文本','detail',99);
UPDATE yj_field SET dict_sql = N'SELECT mc FROM dm_gx WHERE lb=''WDZT'' AND ISNULL(asp_cancel,''N'')<>''Y''' WHERE panel_code='RD_INSP_PLAN' AND col_name='status';
GO

GRANT SELECT, INSERT, UPDATE, DELETE ON rd_product_info TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_mold_proc TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_mold_formula TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_spec_doc TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_asm_bom TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_asm_proc TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON rd_insp_plan TO yinjia;
GO

-- 补充字典:产品状态/文档状态
IF NOT EXISTS (SELECT 1 FROM dm_gx WHERE lb = 'CPZT' AND dm = 'CPZT01')
INSERT INTO dm_gx (comm, dm, mc, lb, asp_cancel) VALUES
('0','CPZT01',N'开发中','CPZT','N'),
('0','CPZT02',N'量产','CPZT','N'),
('0','CPZT03',N'停产','CPZT','N');
IF NOT EXISTS (SELECT 1 FROM dm_gx WHERE lb = 'WDZT' AND dm = 'WDZT01')
INSERT INTO dm_gx (comm, dm, mc, lb, asp_cancel) VALUES
('0','WDZT01',N'当前','WDZT','N'),
('0','WDZT02',N'已下架','WDZT','N');
GO

DECLARE @c int = (SELECT COUNT(*) FROM yj_field WHERE panel_code IN ('RD_PROD_INFO','RD_MOLD_PROC','RD_MOLD_FORMULA','RD_SPEC_DOC','RD_ASM_BOM','RD_ASM_PROC','RD_INSP_PLAN'));
PRINT N'产品文件面板字段注册完成: ' + CAST(@c AS nvarchar(10)) + N' 个字段';
GO
