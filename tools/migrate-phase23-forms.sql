-- migrate-phase23-forms.sql — 首批 5 张工序单据面板(覆盖五道工序)
SET NOCOUNT ON;
GO
-- ═══ 1. 混料:自制物料车间投料确认表 ═══
IF OBJECT_ID('pr_mix_confirm') IS NULL
CREATE TABLE pr_mix_confirm (
    id INT IDENTITY PRIMARY KEY,
    单据编号 NVARCHAR(50) NOT NULL,
    单据日期 DATE,
    物料名称 NVARCHAR(100),
    物料编码 NVARCHAR(50),
    批号 NVARCHAR(50),
    投料量 DECIMAL(18,4),
    混合开始时间 NVARCHAR(20),
    混合结束时间 NVARCHAR(20),
    搅拌机编号 NVARCHAR(50),
    操作人 NVARCHAR(50),
    复核人 NVARCHAR(50),
    备注 NVARCHAR(500),
    asp_user1 NVARCHAR(50), asp_time1 DATETIME2 DEFAULT GETDATE(),
    asp_user2 NVARCHAR(50), asp_time2 DATETIME2,
    asp_cancel CHAR(1) DEFAULT 'N'
);
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='PR_MIX_CONFIRM')
INSERT INTO yj_panel (panel_code,panel_name,category,mode,line_table,head_table,group_col,pk_col,prefix,date_col,page_size,module_group)
VALUES ('PR_MIX_CONFIRM',N'投料确认表',N'单据','doc','pr_mix_confirm','pr_mix_confirm','单据编号','id','PMC','单据日期',20,N'生产制造');
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PR_MIX_CONFIRM' AND col_name='单据编号' AND place='header')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden) VALUES
('PR_MIX_CONFIRM','单据编号',N'单据编号','文本','header',1,140,0,1,0),
('PR_MIX_CONFIRM','单据日期',N'单据日期','日期','header',2,120,1,1,0),
('PR_MIX_CONFIRM','物料名称',N'物料名称','文本','header',3,180,1,0,0),
('PR_MIX_CONFIRM','物料编码',N'物料编码','文本','header',4,120,1,0,0),
('PR_MIX_CONFIRM','批号',N'批号','文本','header',5,120,1,0,0),
('PR_MIX_CONFIRM','投料量',N'投料量(kg)','小数','header',6,110,1,0,0),
('PR_MIX_CONFIRM','混合开始时间',N'混合开始时间','文本','header',7,130,1,0,0),
('PR_MIX_CONFIRM','混合结束时间',N'混合结束时间','文本','header',8,130,1,0,0),
('PR_MIX_CONFIRM','搅拌机编号',N'搅拌机编号','文本','header',9,110,1,0,0),
('PR_MIX_CONFIRM','操作人',N'操作人','文本','header',10,100,1,0,0),
('PR_MIX_CONFIRM','复核人',N'复核人','文本','header',11,100,1,0,0),
('PR_MIX_CONFIRM','备注',N'备注','文本','header',12,200,1,0,0);
GO
-- ═══ 2. 成型:首件记录表 ═══
IF OBJECT_ID('pr_form_first') IS NULL
CREATE TABLE pr_form_first (
    id INT IDENTITY PRIMARY KEY,
    单据编号 NVARCHAR(50) NOT NULL,
    单据日期 DATE,
    工单号 NVARCHAR(50),
    产品名称 NVARCHAR(100),
    模具编号 NVARCHAR(50),
    首件长度 DECIMAL(18,2),
    首件外径 DECIMAL(18,2),
    首件重量 DECIMAL(18,2),
    首件强度 NVARCHAR(20),
    判定结果 NVARCHAR(20),
    检验人 NVARCHAR(50),
    备注 NVARCHAR(500),
    asp_user1 NVARCHAR(50), asp_time1 DATETIME2 DEFAULT GETDATE(),
    asp_user2 NVARCHAR(50), asp_time2 DATETIME2,
    asp_cancel CHAR(1) DEFAULT 'N'
);
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='PR_FORM_FIRST')
INSERT INTO yj_panel (panel_code,panel_name,category,mode,line_table,head_table,group_col,pk_col,prefix,date_col,page_size,module_group)
VALUES ('PR_FORM_FIRST',N'成型首件记录',N'单据','doc','pr_form_first','pr_form_first','单据编号','id','PFF','单据日期',20,N'生产制造');
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PR_FORM_FIRST' AND col_name='单据编号' AND place='header')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden) VALUES
('PR_FORM_FIRST','单据编号',N'单据编号','文本','header',1,140,0,1,0),
('PR_FORM_FIRST','单据日期',N'单据日期','日期','header',2,120,1,1,0),
('PR_FORM_FIRST','工单号',N'工单号','文本','header',3,130,1,0,0),
('PR_FORM_FIRST','产品名称',N'产品名称','文本','header',4,160,1,0,0),
('PR_FORM_FIRST','模具编号',N'模具编号','文本','header',5,110,1,0,0),
('PR_FORM_FIRST','首件长度',N'首件长度(mm)','小数','header',6,120,1,0,0),
('PR_FORM_FIRST','首件外径',N'首件外径(mm)','小数','header',7,120,1,0,0),
('PR_FORM_FIRST','首件重量',N'首件重量(g)','小数','header',8,120,1,0,0),
('PR_FORM_FIRST','首件强度',N'首件强度','文本','header',9,100,1,0,0),
('PR_FORM_FIRST','判定结果',N'判定结果','下拉框','header',10,100,1,0,0),
('PR_FORM_FIRST','检验人',N'检验人','文本','header',11,100,1,0,0),
('PR_FORM_FIRST','备注',N'备注','文本','header',12,200,1,0,0);
UPDATE yj_field SET dict_sql=N'SELECT N''合格'' AS val,N''合格'' AS lbl UNION ALL SELECT N''不合格'',N''不合格''' WHERE panel_code='PR_FORM_FIRST' AND col_name='判定结果' AND place='header';
GO
-- ═══ 3. 切炭:生产日报表 ═══
IF OBJECT_ID('pr_cut_daily') IS NULL
CREATE TABLE pr_cut_daily (
    id INT IDENTITY PRIMARY KEY,
    单据编号 NVARCHAR(50) NOT NULL,
    单据日期 DATE,
    工单号 NVARCHAR(50),
    班次 NVARCHAR(10),
    操作工 NVARCHAR(50),
    计划数量 DECIMAL(18,2),
    切炭数量 DECIMAL(18,2),
    直销数量 DECIMAL(18,2),
    组装数量 DECIMAL(18,2),
    不良数量 DECIMAL(18,2),
    批号 NVARCHAR(50),
    设备编号 NVARCHAR(50),
    备注 NVARCHAR(500),
    asp_user1 NVARCHAR(50), asp_time1 DATETIME2 DEFAULT GETDATE(),
    asp_user2 NVARCHAR(50), asp_time2 DATETIME2,
    asp_cancel CHAR(1) DEFAULT 'N'
);
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='PR_CUT_DAILY')
INSERT INTO yj_panel (panel_code,panel_name,category,mode,line_table,head_table,group_col,pk_col,prefix,date_col,page_size,module_group)
VALUES ('PR_CUT_DAILY',N'切炭日报表',N'单据','doc','pr_cut_daily','pr_cut_daily','单据编号','id','PCD','单据日期',20,N'生产制造');
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PR_CUT_DAILY' AND col_name='单据编号' AND place='header')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden) VALUES
('PR_CUT_DAILY','单据编号',N'单据编号','文本','header',1,140,0,1,0),
('PR_CUT_DAILY','单据日期',N'单据日期','日期','header',2,120,1,1,0),
('PR_CUT_DAILY','工单号',N'工单号','文本','header',3,130,1,0,0),
('PR_CUT_DAILY','班次',N'班次','下拉框','header',4,80,1,0,0),
('PR_CUT_DAILY','操作工',N'操作工','文本','header',5,100,1,0,0),
('PR_CUT_DAILY','计划数量',N'计划数量','小数','header',6,100,1,0,0),
('PR_CUT_DAILY','切炭数量',N'切炭数量','小数','header',7,100,1,1,0),
('PR_CUT_DAILY','直销数量',N'直销数量','小数','header',8,100,1,0,0),
('PR_CUT_DAILY','组装数量',N'组装数量','小数','header',9,100,1,0,0),
('PR_CUT_DAILY','不良数量',N'不良数量','小数','header',10,100,1,0,0),
('PR_CUT_DAILY','批号',N'批号','文本','header',11,120,1,0,0),
('PR_CUT_DAILY','设备编号',N'设备编号','文本','header',12,100,1,0,0),
('PR_CUT_DAILY','备注',N'备注','文本','header',13,200,1,0,0);
UPDATE yj_field SET dict_sql=N'SELECT N''白班'' AS val,N''白班'' AS lbl UNION ALL SELECT N''夜班'',N''夜班''' WHERE panel_code='PR_CUT_DAILY' AND col_name='班次' AND place='header';
GO
-- ═══ 4. 组装:来料检查记录表 ═══
IF OBJECT_ID('pr_asm_incoming') IS NULL
CREATE TABLE pr_asm_incoming (
    id INT IDENTITY PRIMARY KEY,
    单据编号 NVARCHAR(50) NOT NULL,
    单据日期 DATE,
    工单号 NVARCHAR(50),
    炭棒批号 NVARCHAR(50),
    抽检数量 INT,
    长度合格 INT,
    外径合格 INT,
    外观合格 INT,
    不良数量 INT,
    判定结果 NVARCHAR(20),
    检查人 NVARCHAR(50),
    备注 NVARCHAR(500),
    asp_user1 NVARCHAR(50), asp_time1 DATETIME2 DEFAULT GETDATE(),
    asp_user2 NVARCHAR(50), asp_time2 DATETIME2,
    asp_cancel CHAR(1) DEFAULT 'N'
);
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='PR_ASM_INCOMING')
INSERT INTO yj_panel (panel_code,panel_name,category,mode,line_table,head_table,group_col,pk_col,prefix,date_col,page_size,module_group)
VALUES ('PR_ASM_INCOMING',N'组装来料检查',N'单据','doc','pr_asm_incoming','pr_asm_incoming','单据编号','id','PAI','单据日期',20,N'生产制造');
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PR_ASM_INCOMING' AND col_name='单据编号' AND place='header')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden) VALUES
('PR_ASM_INCOMING','单据编号',N'单据编号','文本','header',1,140,0,1,0),
('PR_ASM_INCOMING','单据日期',N'单据日期','日期','header',2,120,1,1,0),
('PR_ASM_INCOMING','工单号',N'工单号','文本','header',3,130,1,0,0),
('PR_ASM_INCOMING','炭棒批号',N'炭棒批号','文本','header',4,120,1,0,0),
('PR_ASM_INCOMING','抽检数量',N'抽检数量','整数','header',5,100,1,0,0),
('PR_ASM_INCOMING','长度合格',N'长度合格','整数','header',6,100,1,0,0),
('PR_ASM_INCOMING','外径合格',N'外径合格','整数','header',7,100,1,0,0),
('PR_ASM_INCOMING','外观合格',N'外观合格','整数','header',8,100,1,0,0),
('PR_ASM_INCOMING','不良数量',N'不良数量','整数','header',9,100,1,0,0),
('PR_ASM_INCOMING','判定结果',N'判定结果','下拉框','header',10,100,1,0,0),
('PR_ASM_INCOMING','检查人',N'检查人','文本','header',11,100,1,0,0),
('PR_ASM_INCOMING','备注',N'备注','文本','header',12,200,1,0,0);
UPDATE yj_field SET dict_sql=N'SELECT N''合格'' AS val,N''合格'' AS lbl UNION ALL SELECT N''不合格'',N''不合格'' UNION ALL SELECT N''让步接收'',N''让步接收''' WHERE panel_code='PR_ASM_INCOMING' AND col_name='判定结果' AND place='header';
GO
-- ═══ 5. 装箱:封箱前数量确认表 ═══
IF OBJECT_ID('pr_pack_confirm') IS NULL
CREATE TABLE pr_pack_confirm (
    id INT IDENTITY PRIMARY KEY,
    单据编号 NVARCHAR(50) NOT NULL,
    单据日期 DATE,
    工单号 NVARCHAR(50),
    产品名称 NVARCHAR(100),
    订单数量 INT,
    实装数量 INT,
    每盒数量 INT,
    盒数 INT,
    确认人 NVARCHAR(50),
    复核人 NVARCHAR(50),
    备注 NVARCHAR(500),
    asp_user1 NVARCHAR(50), asp_time1 DATETIME2 DEFAULT GETDATE(),
    asp_user2 NVARCHAR(50), asp_time2 DATETIME2,
    asp_cancel CHAR(1) DEFAULT 'N'
);
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='PR_PACK_CONFIRM')
INSERT INTO yj_panel (panel_code,panel_name,category,mode,line_table,head_table,group_col,pk_col,prefix,date_col,page_size,module_group)
VALUES ('PR_PACK_CONFIRM',N'封箱数量确认',N'单据','doc','pr_pack_confirm','pr_pack_confirm','单据编号','id','PPC','单据日期',20,N'生产制造');
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PR_PACK_CONFIRM' AND col_name='单据编号' AND place='header')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden) VALUES
('PR_PACK_CONFIRM','单据编号',N'单据编号','文本','header',1,140,0,1,0),
('PR_PACK_CONFIRM','单据日期',N'单据日期','日期','header',2,120,1,1,0),
('PR_PACK_CONFIRM','工单号',N'工单号','文本','header',3,130,1,0,0),
('PR_PACK_CONFIRM','产品名称',N'产品名称','文本','header',4,160,1,0,0),
('PR_PACK_CONFIRM','订单数量',N'订单数量','整数','header',5,100,1,0,0),
('PR_PACK_CONFIRM','实装数量',N'实装数量','整数','header',6,100,1,1,0),
('PR_PACK_CONFIRM','每盒数量',N'每盒数量','整数','header',7,100,1,0,0),
('PR_PACK_CONFIRM','盒数',N'盒数','整数','header',8,80,1,0,0),
('PR_PACK_CONFIRM','确认人',N'确认人','文本','header',9,100,1,0,0),
('PR_PACK_CONFIRM','复核人',N'复核人','文本','header',10,100,1,0,0),
('PR_PACK_CONFIRM','备注',N'备注','文本','header',11,200,1,0,0);
GO
PRINT N'首批 5 张工序单据面板迁移完成';
GO
