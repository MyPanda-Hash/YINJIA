/* ============================================================
   基础档案补字段 —— A 类(生产相关 5 面板) + B 类(通用一致性 8 面板)
   面板: EQUIP TEAM OP DEPT WH / REGION FIN_EXP REJECT PROJ FIN_TAX ZDGL FIN_ACC UOM
   新字段 41 个;新增字典类别 6 个;同步 en 译名。
   幂等:全部 IF NOT EXISTS / COL_LENGTH 判重,可重复执行。
   依据:docs/frontend/前端面板设计.md(基础档案仅 place=detail;下拉走字典,禁止硬编码)
   生成:2026-09-08
   ============================================================ */
SET NOCOUNT ON;
GO

/* ---------- 1. 字典类别种子(bs_dict,由「数据字典」面板维护) ---------- */
IF NOT EXISTS (SELECT 1 FROM bs_dict WHERE 字典类别='DEPT_TYPE' AND 代码='DEPT_TYPE01')
INSERT INTO bs_dict (字典类别,代码,名称) VALUES
 ('DEPT_TYPE','DEPT_TYPE01',N'职能'),
 ('DEPT_TYPE','DEPT_TYPE02',N'车间'),
 ('DEPT_TYPE','DEPT_TYPE03',N'仓库'),
 ('DEPT_TYPE','DEPT_TYPE04',N'销售');
GO

IF NOT EXISTS (SELECT 1 FROM bs_dict WHERE 字典类别='OP_TYPE' AND 代码='OP_TYPE01')
INSERT INTO bs_dict (字典类别,代码,名称) VALUES
 ('OP_TYPE','OP_TYPE01',N'成型'),
 ('OP_TYPE','OP_TYPE02',N'切炭'),
 ('OP_TYPE','OP_TYPE03',N'组装'),
 ('OP_TYPE','OP_TYPE04',N'检验'),
 ('OP_TYPE','OP_TYPE05',N'包装'),
 ('OP_TYPE','OP_TYPE06',N'其他');
GO

IF NOT EXISTS (SELECT 1 FROM bs_dict WHERE 字典类别='REJECT_CLASS' AND 代码='REJECT_CLASS01')
INSERT INTO bs_dict (字典类别,代码,名称) VALUES
 ('REJECT_CLASS','REJECT_CLASS01',N'外观'),
 ('REJECT_CLASS','REJECT_CLASS02',N'尺寸'),
 ('REJECT_CLASS','REJECT_CLASS03',N'强度'),
 ('REJECT_CLASS','REJECT_CLASS04',N'性能'),
 ('REJECT_CLASS','REJECT_CLASS05',N'其他');
GO

IF NOT EXISTS (SELECT 1 FROM bs_dict WHERE 字典类别='WH_TYPE' AND 代码='WH_TYPE01')
INSERT INTO bs_dict (字典类别,代码,名称) VALUES
 ('WH_TYPE','WH_TYPE01',N'原料仓'),
 ('WH_TYPE','WH_TYPE02',N'辅料仓'),
 ('WH_TYPE','WH_TYPE03',N'半成品仓'),
 ('WH_TYPE','WH_TYPE04',N'成品仓'),
 ('WH_TYPE','WH_TYPE05',N'不良品仓'),
 ('WH_TYPE','WH_TYPE06',N'其他');
GO

IF NOT EXISTS (SELECT 1 FROM bs_dict WHERE 字典类别='BAL_DIR' AND 代码='BAL_DIR01')
INSERT INTO bs_dict (字典类别,代码,名称) VALUES
 ('BAL_DIR','BAL_DIR01',N'借'),
 ('BAL_DIR','BAL_DIR02',N'贷');
GO

IF NOT EXISTS (SELECT 1 FROM bs_dict WHERE 字典类别='EQUIP_STATUS' AND 代码='EQUIP_STATUS01')
INSERT INTO bs_dict (字典类别,代码,名称) VALUES
 ('EQUIP_STATUS','EQUIP_STATUS01',N'在用'),
 ('EQUIP_STATUS','EQUIP_STATUS02',N'维修中'),
 ('EQUIP_STATUS','EQUIP_STATUS03',N'停用'),
 ('EQUIP_STATUS','EQUIP_STATUS04',N'报废');
GO

/* ---------- 2. 物理列(存在即跳过) ---------- */
/* A 类 */
IF COL_LENGTH('bs_equip',N'设备型号')    IS NULL ALTER TABLE bs_equip ADD [设备型号] nvarchar(200) NULL;
IF COL_LENGTH('bs_equip',N'规格')        IS NULL ALTER TABLE bs_equip ADD [规格] nvarchar(200) NULL;
IF COL_LENGTH('bs_equip',N'安装车间')    IS NULL ALTER TABLE bs_equip ADD [安装车间] nvarchar(200) NULL;
IF COL_LENGTH('bs_equip',N'启用日期')    IS NULL ALTER TABLE bs_equip ADD [启用日期] date NULL;
IF COL_LENGTH('bs_equip',N'设备状态')    IS NULL ALTER TABLE bs_equip ADD [设备状态] nvarchar(50) NULL;
IF COL_LENGTH('bs_equip',N'保养周期(天)') IS NULL ALTER TABLE bs_equip ADD [保养周期(天)] int NULL;
IF COL_LENGTH('bs_equip',N'保养责任人')  IS NULL ALTER TABLE bs_equip ADD [保养责任人] nvarchar(100) NULL;
GO
IF COL_LENGTH('bs_team',N'负责人') IS NULL ALTER TABLE bs_team ADD [负责人] nvarchar(100) NULL;
IF COL_LENGTH('bs_team',N'人数')   IS NULL ALTER TABLE bs_team ADD [人数] int NULL;
GO
IF COL_LENGTH('bs_op',N'标准工时(分钟)') IS NULL ALTER TABLE bs_op ADD [标准工时(分钟)] decimal(18,2) NULL;
IF COL_LENGTH('bs_op',N'工序类型')        IS NULL ALTER TABLE bs_op ADD [工序类型] nvarchar(50) NULL;
IF COL_LENGTH('bs_op',N'检验要求')        IS NULL ALTER TABLE bs_op ADD [检验要求] nvarchar(500) NULL;
GO
IF COL_LENGTH('bs_dept',N'上级部门') IS NULL ALTER TABLE bs_dept ADD [上级部门] nvarchar(200) NULL;
IF COL_LENGTH('bs_dept',N'部门类型') IS NULL ALTER TABLE bs_dept ADD [部门类型] nvarchar(50) NULL;
IF COL_LENGTH('bs_dept',N'电话')     IS NULL ALTER TABLE bs_dept ADD [电话] nvarchar(50) NULL;
GO
IF COL_LENGTH('bs_wh',N'仓库类型')   IS NULL ALTER TABLE bs_wh ADD [仓库类型] nvarchar(50) NULL;
IF COL_LENGTH('bs_wh',N'所属车间')   IS NULL ALTER TABLE bs_wh ADD [所属车间] nvarchar(200) NULL;
IF COL_LENGTH('bs_wh',N'联系人')     IS NULL ALTER TABLE bs_wh ADD [联系人] nvarchar(100) NULL;
IF COL_LENGTH('bs_wh',N'联系电话')   IS NULL ALTER TABLE bs_wh ADD [联系电话] nvarchar(50) NULL;
GO
/* B 类 */
IF COL_LENGTH('bs_region',N'上级地区') IS NULL ALTER TABLE bs_region ADD [上级地区] nvarchar(200) NULL;
IF COL_LENGTH('bs_region',N'停用')     IS NULL ALTER TABLE bs_region ADD [停用] bit NULL;
GO
IF COL_LENGTH('bd_expense_type',N'上级类别') IS NULL ALTER TABLE bd_expense_type ADD [上级类别] nvarchar(200) NULL;
IF COL_LENGTH('bd_expense_type',N'停用')     IS NULL ALTER TABLE bd_expense_type ADD [停用] bit NULL;
GO
IF COL_LENGTH('bs_reject',N'原因分类') IS NULL ALTER TABLE bs_reject ADD [原因分类] nvarchar(50) NULL;
IF COL_LENGTH('bs_reject',N'适用工序') IS NULL ALTER TABLE bs_reject ADD [适用工序] nvarchar(200) NULL;
GO
IF COL_LENGTH('bs_proj',N'客户')     IS NULL ALTER TABLE bs_proj ADD [客户] nvarchar(200) NULL;
IF COL_LENGTH('bs_proj',N'负责人')   IS NULL ALTER TABLE bs_proj ADD [负责人] nvarchar(100) NULL;
IF COL_LENGTH('bs_proj',N'开始日期') IS NULL ALTER TABLE bs_proj ADD [开始日期] date NULL;
IF COL_LENGTH('bs_proj',N'结束日期') IS NULL ALTER TABLE bs_proj ADD [结束日期] date NULL;
GO
IF COL_LENGTH('bd_tax_type',N'停用') IS NULL ALTER TABLE bd_tax_type ADD [停用] bit NULL;
GO
IF COL_LENGTH('bs_dict',N'排序') IS NULL ALTER TABLE bs_dict ADD [排序] int NULL;
IF COL_LENGTH('bs_dict',N'停用') IS NULL ALTER TABLE bs_dict ADD [停用] bit NULL;
GO
IF COL_LENGTH('bd_account',N'上级科目') IS NULL ALTER TABLE bd_account ADD [上级科目] nvarchar(200) NULL;
IF COL_LENGTH('bd_account',N'余额方向') IS NULL ALTER TABLE bd_account ADD [余额方向] nvarchar(50) NULL;
IF COL_LENGTH('bd_account',N'停用')     IS NULL ALTER TABLE bd_account ADD [停用] bit NULL;
GO
IF COL_LENGTH('bs_uom',N'小数位数') IS NULL ALTER TABLE bs_uom ADD [小数位数] int NULL;
IF COL_LENGTH('bs_uom',N'停用')     IS NULL ALTER TABLE bs_uom ADD [停用] bit NULL;
GO

/* ---------- 3. yj_field 元数据(place 仅 detail;新字段一律非必填) ---------- */
/* --- EQUIP 设备 --- */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='EQUIP' AND col_name=N'设备型号')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
VALUES ('EQUIP',N'设备型号',N'设备型号',N'文本',N'detail',70,140,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='EQUIP' AND col_name=N'规格')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
VALUES ('EQUIP',N'规格',N'规格',N'文本',N'detail',80,140,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='EQUIP' AND col_name=N'安装车间')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible,ref_panel,ref_field,display_field)
VALUES ('EQUIP',N'安装车间',N'安装车间',N'参照',N'detail',90,140,1,0,0,1,N'DEPT',N'部门编码',N'部门名称');
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='EQUIP' AND col_name=N'启用日期')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
VALUES ('EQUIP',N'启用日期',N'启用日期',N'日期',N'detail',100,140,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='EQUIP' AND col_name=N'设备状态')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible,dict_sql)
VALUES ('EQUIP',N'设备状态',N'设备状态',N'下拉框',N'detail',110,140,1,0,0,1,N'SELECT 名称 FROM bs_dict WHERE 字典类别=''EQUIP_STATUS'' AND ISNULL(停用,0)=0 ORDER BY 代码');
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='EQUIP' AND col_name=N'保养周期(天)')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
VALUES ('EQUIP',N'保养周期(天)',N'保养周期(天)',N'整数',N'detail',120,140,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='EQUIP' AND col_name=N'保养责任人')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
VALUES ('EQUIP',N'保养责任人',N'保养责任人',N'文本',N'detail',130,140,1,0,0,1);
GO

/* --- TEAM 班组 --- */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TEAM' AND col_name=N'负责人')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
VALUES ('TEAM',N'负责人',N'负责人',N'文本',N'detail',50,140,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TEAM' AND col_name=N'人数')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
VALUES ('TEAM',N'人数',N'人数',N'整数',N'detail',60,140,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='TEAM' AND col_name=N'备注')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
VALUES ('TEAM',N'备注',N'备注',N'文本',N'detail',70,140,1,0,0,1);
GO

/* --- OP 工序 --- */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP' AND col_name=N'标准工时(分钟)')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
VALUES ('OP',N'标准工时(分钟)',N'标准工时(分钟)',N'小数',N'detail',130,140,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP' AND col_name=N'工序类型')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible,dict_sql)
VALUES ('OP',N'工序类型',N'工序类型',N'下拉框',N'detail',140,140,1,0,0,1,N'SELECT 名称 FROM bs_dict WHERE 字典类别=''OP_TYPE'' AND ISNULL(停用,0)=0 ORDER BY 代码');
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OP' AND col_name=N'检验要求')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
VALUES ('OP',N'检验要求',N'检验要求',N'文本',N'detail',150,140,1,0,0,1);
GO

/* --- DEPT 部门 --- */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='DEPT' AND col_name=N'上级部门')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible,ref_panel,ref_field,display_field)
VALUES ('DEPT',N'上级部门',N'上级部门',N'参照',N'detail',50,140,1,0,0,1,N'DEPT',N'部门编码',N'部门名称');
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='DEPT' AND col_name=N'部门类型')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible,dict_sql)
VALUES ('DEPT',N'部门类型',N'部门类型',N'下拉框',N'detail',60,140,1,0,0,1,N'SELECT 名称 FROM bs_dict WHERE 字典类别=''DEPT_TYPE'' AND ISNULL(停用,0)=0 ORDER BY 代码');
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='DEPT' AND col_name=N'电话')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
VALUES ('DEPT',N'电话',N'电话',N'文本',N'detail',70,140,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='DEPT' AND col_name=N'备注')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
VALUES ('DEPT',N'备注',N'备注',N'文本',N'detail',80,140,1,0,0,1);
GO

/* --- WH 仓库 --- */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WH' AND col_name=N'仓库类型')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible,dict_sql)
VALUES ('WH',N'仓库类型',N'仓库类型',N'下拉框',N'detail',70,140,1,0,0,1,N'SELECT 名称 FROM bs_dict WHERE 字典类别=''WH_TYPE'' AND ISNULL(停用,0)=0 ORDER BY 代码');
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WH' AND col_name=N'所属车间')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible,ref_panel,ref_field,display_field)
VALUES ('WH',N'所属车间',N'所属车间',N'参照',N'detail',80,140,1,0,0,1,N'DEPT',N'部门编码',N'部门名称');
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WH' AND col_name=N'联系人')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
VALUES ('WH',N'联系人',N'联系人',N'文本',N'detail',90,140,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WH' AND col_name=N'联系电话')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
VALUES ('WH',N'联系电话',N'联系电话',N'文本',N'detail',100,140,1,0,0,1);
GO

/* --- REGION 地区 --- */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='REGION' AND col_name=N'上级地区')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible,ref_panel,ref_field,display_field)
VALUES ('REGION',N'上级地区',N'上级地区',N'参照',N'detail',30,140,1,0,0,1,N'REGION',N'地区编码',N'地区名称');
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='REGION' AND col_name=N'停用')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
VALUES ('REGION',N'停用',N'停用',N'是否',N'detail',40,140,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='REGION' AND col_name=N'备注')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
VALUES ('REGION',N'备注',N'备注',N'文本',N'detail',50,140,1,0,0,1);
GO

/* --- FIN_EXP 费用类别 --- */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='FIN_EXP' AND col_name=N'上级类别')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible,ref_panel,ref_field,display_field)
VALUES ('FIN_EXP',N'上级类别',N'上级类别',N'参照',N'detail',40,140,1,0,0,1,N'FIN_EXP',N'费用类别编码',N'费用类别名称');
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='FIN_EXP' AND col_name=N'停用')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
VALUES ('FIN_EXP',N'停用',N'停用',N'是否',N'detail',50,140,1,0,0,1);
GO

/* --- REJECT 不合格原因 --- */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='REJECT' AND col_name=N'原因分类')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible,dict_sql)
VALUES ('REJECT',N'原因分类',N'原因分类',N'下拉框',N'detail',40,140,1,0,0,1,N'SELECT 名称 FROM bs_dict WHERE 字典类别=''REJECT_CLASS'' AND ISNULL(停用,0)=0 ORDER BY 代码');
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='REJECT' AND col_name=N'适用工序')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible,ref_panel,ref_field,display_field)
VALUES ('REJECT',N'适用工序',N'适用工序',N'参照',N'detail',50,140,1,0,0,1,N'OP',N'工序编码',N'工序名称');
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='REJECT' AND col_name=N'备注')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
VALUES ('REJECT',N'备注',N'备注',N'文本',N'detail',60,140,1,0,0,1);
GO

/* --- PROJ 项目 --- */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PROJ' AND col_name=N'客户')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible,ref_panel,ref_field,display_field)
VALUES ('PROJ',N'客户',N'客户',N'参照',N'detail',50,140,1,0,0,1,N'KHDA',N'dm',N'mc');
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PROJ' AND col_name=N'负责人')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
VALUES ('PROJ',N'负责人',N'负责人',N'文本',N'detail',60,140,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PROJ' AND col_name=N'开始日期')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
VALUES ('PROJ',N'开始日期',N'开始日期',N'日期',N'detail',70,140,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PROJ' AND col_name=N'结束日期')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
VALUES ('PROJ',N'结束日期',N'结束日期',N'日期',N'detail',80,140,1,0,0,1);
GO

/* --- FIN_TAX 税别资料 --- */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='FIN_TAX' AND col_name=N'停用')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
VALUES ('FIN_TAX',N'停用',N'停用',N'是否',N'detail',50,140,1,0,0,1);
GO

/* --- ZDGL 数据字典 --- */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='ZDGL' AND col_name=N'排序')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
VALUES ('ZDGL',N'排序',N'排序',N'整数',N'detail',5,140,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='ZDGL' AND col_name=N'停用')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
VALUES ('ZDGL',N'停用',N'停用',N'是否',N'detail',6,140,1,0,0,1);
GO

/* --- FIN_ACC 会计科目 --- */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='FIN_ACC' AND col_name=N'上级科目')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible,ref_panel,ref_field,display_field)
VALUES ('FIN_ACC',N'上级科目',N'上级科目',N'参照',N'detail',50,140,1,0,0,1,N'FIN_ACC',N'科目编码',N'科目名称');
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='FIN_ACC' AND col_name=N'余额方向')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible,dict_sql)
VALUES ('FIN_ACC',N'余额方向',N'余额方向',N'下拉框',N'detail',60,140,1,0,0,1,N'SELECT 名称 FROM bs_dict WHERE 字典类别=''BAL_DIR'' AND ISNULL(停用,0)=0 ORDER BY 代码');
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='FIN_ACC' AND col_name=N'停用')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
VALUES ('FIN_ACC',N'停用',N'停用',N'是否',N'detail',70,140,1,0,0,1);
GO

/* --- UOM 计量单位 --- */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='UOM' AND col_name=N'小数位数')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
VALUES ('UOM',N'小数位数',N'小数位数',N'整数',N'detail',60,140,1,0,0,1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='UOM' AND col_name=N'停用')
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible)
VALUES ('UOM',N'停用',N'停用',N'是否',N'detail',70,140,1,0,0,1);
GO

/* ---------- 4. 「数据字典」面板的类别下拉:补入新类别(保持可维护) ---------- */
UPDATE yj_field
SET dict_sql = N'SELECT v FROM (VALUES (N''JYRY''),(N''JYJG''),(N''WLFZ''),(N''DYJ''),(N''JLDW''),(N''PCXZ''),(N''KHLY''),(N''LHXZ''),(N''XSJGLX''),(N''DEPT_TYPE''),(N''OP_TYPE''),(N''REJECT_CLASS''),(N''WH_TYPE''),(N''BAL_DIR''),(N''EQUIP_STATUS'')) AS t(v)'
WHERE panel_code='ZDGL' AND col_name=N'字典类别';
GO

/* ---------- 5. en 译名(yj_translation,已存在则跳过) ---------- */
DECLARE @tr TABLE (ref_key nvarchar(200), text nvarchar(400));
INSERT INTO @tr (ref_key,text) VALUES
 (N'设备型号',N'Equipment Model'), (N'规格',N'Specification'), (N'安装车间',N'Installation Workshop'),
 (N'启用日期',N'Commissioning Date'), (N'设备状态',N'Equipment Status'), (N'保养周期(天)',N'Maintenance Cycle (Days)'),
 (N'保养责任人',N'Maintenance Owner'), (N'人数',N'Headcount'), (N'标准工时(分钟)',N'Standard Hours (min)'),
 (N'工序类型',N'Operation Type'), (N'检验要求',N'Inspection Requirement'), (N'上级部门',N'Parent Department'),
 (N'部门类型',N'Department Type'), (N'电话',N'Telephone'), (N'仓库类型',N'Warehouse Type'),
 (N'所属车间',N'Workshop'), (N'联系人',N'Contact'), (N'联系电话',N'Contact Phone'),
 (N'上级地区',N'Parent Region'), (N'上级类别',N'Parent Category'), (N'原因分类',N'Reason Category'),
 (N'适用工序',N'Applicable Operation'), (N'客户',N'Customer'), (N'开始日期',N'Start Date'),
 (N'结束日期',N'End Date'), (N'排序',N'Sort Order'), (N'上级科目',N'Parent Account'),
 (N'余额方向',N'Balance Direction'), (N'小数位数',N'Decimal Places');
INSERT INTO yj_translation (scope,ref_key,locale,text,source)
SELECT 'field', t.ref_key, 'en', t.text, 'manual'
FROM @tr t
WHERE NOT EXISTS (SELECT 1 FROM yj_translation x WHERE x.scope='field' AND x.ref_key=t.ref_key AND x.locale='en');
GO

PRINT N'基础档案补字段迁移完成';
GO
