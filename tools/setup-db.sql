/* YINJIA-MES 元数据初始化
   面板注册(yj_panel) + 字段定义(yj_field) + 单据状态(yj_doc_status) + 登录用户(yj_user)
   运行方式: sqlcmd -S localhost -E -i setup-db.sql
   注意: yj_* 表为 YINJIA-MES 专用,HSDZ_MES 原有表不做任何修改 */
USE HSDZ_MES;
SET NOCOUNT ON;
GO
IF SUSER_ID('yinjia') IS NULL
    CREATE LOGIN yinjia WITH PASSWORD = 'Yinjia@2026', CHECK_POLICY = OFF;
GO
IF USER_ID('yinjia') IS NULL
    CREATE USER yinjia FOR LOGIN yinjia;
ALTER ROLE db_datareader ADD MEMBER yinjia;
ALTER ROLE db_datawriter ADD MEMBER yinjia;
GO
IF OBJECT_ID('yj_field') IS NOT NULL DROP TABLE yj_field;
IF OBJECT_ID('yj_panel') IS NOT NULL DROP TABLE yj_panel;
IF OBJECT_ID('yj_doc_status') IS NOT NULL DROP TABLE yj_doc_status;
IF OBJECT_ID('yj_user') IS NOT NULL DROP TABLE yj_user;
GO
CREATE TABLE yj_panel (
    panel_code  varchar(40)  NOT NULL PRIMARY KEY,
    panel_name  nvarchar(60) NOT NULL,
    category    nvarchar(20) NOT NULL,           -- 单据 | 档案
    mode        varchar(20)  NOT NULL,           -- doc=单据(按单号分组) | archive=档案(一行一记录,合成单单据)
    line_table  sysname       NOT NULL,          -- 行表
    head_table  sysname       NULL,              -- 头表(仅 doc 模式头行分表时)
    group_col   sysname       NULL,              -- 单号列(doc)
    pk_col      sysname       NOT NULL,          -- 行主键列
    code_col    sysname       NULL,              -- 业务编号列(archive 编号来源)
    prefix      varchar(10)   NULL,              -- 新单号前缀(s_allno.lb)
    date_col    sysname       NULL,              -- 单据日期列
    page_size   int           NULL,
    detail_key  nvarchar(30)  NULL,              -- 明细页签键(单单据=业务键,单据=items)
    module_group nvarchar(40) NULL,              -- 模块分组(对齐 HSDZ permission.GROP)
    config      nvarchar(max) NULL,              -- 生成的 light-mes 面板配置缓存
    config_at   datetime      NULL
);
CREATE TABLE yj_field (
    id           int IDENTITY(1,1) PRIMARY KEY,
    panel_code   varchar(40)  NOT NULL,
    col_name     sysname       NOT NULL,
    label        nvarchar(60)  NOT NULL,
    data_type    nvarchar(20)  NOT NULL CONSTRAINT df_yjf_type DEFAULT (N'文本'),
    dict_sql     nvarchar(500) NULL,
    ref_panel    varchar(40)   NULL,
    ref_field    sysname       NULL,
    display_field sysname      NULL,
    place        varchar(60)  NOT NULL CONSTRAINT df_yjf_place DEFAULT ('detail'),
    seq          int           NOT NULL CONSTRAINT df_yjf_seq DEFAULT (0),
    width        int           NULL,
    editable     bit           NOT NULL CONSTRAINT df_yjf_edit DEFAULT (1),
    required     bit           NOT NULL CONSTRAINT df_yjf_req DEFAULT (0),
    hidden       bit           NOT NULL CONSTRAINT df_yjf_hidden DEFAULT (0)
);
CREATE INDEX ix_yjf_panel ON yj_field (panel_code, seq);
CREATE TABLE yj_doc_status (
    id          int IDENTITY(1,1) PRIMARY KEY,
    panel_code  varchar(40)  NOT NULL,
    doc_no      nvarchar(60)  NOT NULL,
    shr         nvarchar(40)  NULL,      -- 审核人
    shsj        datetime      NULL,      -- 审核时间
    canceled    char(1)       NOT NULL CONSTRAINT df_yjd_cancel DEFAULT ('N'),
    cancel_by   nvarchar(40)  NULL,
    cancel_at   datetime      NULL,
    pending     char(1)       NULL CONSTRAINT df_yjd_pending DEFAULT ('N'),  -- Y=审批中
    pending_by  nvarchar(40)  NULL,      -- 提交人
    pending_at  datetime      NULL,      -- 提交时间
    update_at   datetime      NOT NULL CONSTRAINT df_yjd_update DEFAULT (GETDATE()),
    CONSTRAINT uq_yj_doc UNIQUE (panel_code, doc_no)
);
CREATE TABLE yj_form_approval (
    id          int IDENTITY(1,1) PRIMARY KEY,
    panel_code  nvarchar(40)  NOT NULL,
    form_no     nvarchar(60)  NOT NULL,
    action      nvarchar(20)  NOT NULL,     -- SUBMIT / APPROVE / REJECT / UNAUDIT
    result      nvarchar(10)  NULL,         -- PENDING / APPROVED / REJECTED
    node_no     int           NOT NULL CONSTRAINT df_yjfa_node DEFAULT (1),  -- 审批节点(预留多级)
    operator    nvarchar(40)  NULL,
    opinion     nvarchar(max) NULL,
    create_time datetime2(3)  NOT NULL CONSTRAINT df_yjfa_time DEFAULT (SYSDATETIME())
);
CREATE INDEX ix_yjfa_doc ON yj_form_approval (panel_code, form_no, id);
CREATE TABLE yj_user (
    id            int IDENTITY(1,1) PRIMARY KEY,
    username      nvarchar(40)  NOT NULL UNIQUE,
    password_hash nvarchar(200) NOT NULL,
    real_name     nvarchar(60)  NULL,
    is_admin      char(1)       NOT NULL CONSTRAINT df_yju_admin DEFAULT ('N'),
    dept_id       int           NULL,     -- 部门(yj_dept)
    role_id       int           NULL,     -- 角色(yj_role;is_admin 随角色)
    enabled       char(1)       NOT NULL CONSTRAINT df_yju_en DEFAULT ('1')
);
GO
-- ============ 面板注册 ============
INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES
('KHDA',  N'客户档案',   N'基础档案', 'archive', 'dm_kh',    NULL,       NULL,     'id',  'dm', NULL, NULL,      100, 'khda', N'基础资料'),
('GFDA',  N'厂商档案',   N'基础档案', 'archive', 'dm_gf',    NULL,       NULL,     'id',  'dm', NULL, NULL,      100, 'gfda', N'基础资料'),
('YWYDA', N'业务员档案', N'基础档案', 'archive', 'dm_ywy',   NULL,       NULL,     'id',  'dm', NULL, NULL,      100, 'ywyda', N'基础资料'),
('CKDA',  N'仓库档案',   N'基础档案', 'archive', 'dm_ck',    NULL,       NULL,     'id',  'dm', NULL, NULL,      100, 'ckda', N'基础资料'),
('ZDGL',  N'数据字典',   N'基础档案', 'archive', 'dm_gx',    NULL,       NULL,     'id',  'dm', NULL, NULL,      100, 'zdgl', N'基础资料'),
('RKD',   N'入库单',     N'单据', 'doc',     'inh',      NULL,       'inh_no', 'id',  NULL, 'RK', 'in_date', 20, 'items', N'仓库管理'),
('CKD',   N'出库单',     N'单据', 'doc',     'outh',     NULL,       'outh_no','id',  NULL, 'LL', 'out_date',20, 'items', N'仓库管理'),
('CGD',   N'采购单',     N'单据', 'doc',     'Porder',   NULL,       'od_no',  'id',  NULL, 'CH', 'od_date', 20, 'items', N'订单管理'),
('KHDD',  N'客户订单',   N'单据', 'doc',     'order_bs', 'order_bt', 'od_no',  'id',  NULL, 'OD', 'od_date', 20, 'items', N'订单管理'),
('WLBOM', N'物料清单',   N'单据', 'doc',     'mate',     NULL,       'm_no',   'id',  NULL, 'WL', 'm_date',  20, 'items', N'生产管理'),
('STOCK_STATUS', N'库存状况', N'报表', 'flat', 'kucun', NULL, NULL, 'id', NULL, NULL, NULL, 100, 'items', N'仓库管理');
GO
-- ============ 字段定义 ============
-- KHDA 客户档案
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, required) VALUES
('KHDA','dm',N'客户代码','文本','detail',1,1),
('KHDA','mc',N'客户名称','文本','detail',2,1),
('KHDA','khjb',N'客户级别','文本','detail',3,0),
('KHDA','addr',N'地址','文本','detail',4,0),
('KHDA','tel',N'电话','文本','detail',5,0),
('KHDA','ywman',N'业务员','文本','detail',6,0),
('KHDA','sui_no',N'税号','文本','detail',7,0),
('KHDA','bank',N'开户行','文本','detail',8,0),
('KHDA','bank_no',N'银行账号','文本','detail',9,0),
('KHDA','email',N'邮箱','文本','detail',10,0),
('KHDA','frdb',N'法人代表','文本','detail',11,0),
('KHDA','zczb',N'注册资本','小数','detail',12,0),
('KHDA','clrq',N'成立日期','日期','detail',13,0),
('KHDA','bz',N'备注','文本','detail',14,0);
-- GFDA 厂商档案
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, required) VALUES
('GFDA','dm',N'厂商代码','文本','detail',1,1),
('GFDA','mc',N'厂商名称','文本','detail',2,1),
('GFDA','csjb',N'厂商级别','文本','detail',3,0),
('GFDA','addr',N'地址','文本','detail',4,0),
('GFDA','tel',N'电话','文本','detail',5,0),
('GFDA','ywman',N'业务员','文本','detail',6,0),
('GFDA','sui_no',N'税号','文本','detail',7,0),
('GFDA','bank',N'开户行','文本','detail',8,0),
('GFDA','bank_no',N'银行账号','文本','detail',9,0),
('GFDA','ckadd',N'收货地址','文本','detail',10,0),
('GFDA','bz',N'备注','文本','detail',11,0);
-- YWYDA 业务员档案
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, required) VALUES
('YWYDA','dm',N'业务员代码','文本','detail',1,1),
('YWYDA','mc',N'姓名','文本','detail',2,1),
('YWYDA','lb',N'类别','文本','detail',3,0),
('YWYDA','zw',N'职务','文本','detail',4,0),
('YWYDA','bmmc',N'部门','文本','detail',5,0),
('YWYDA','tel',N'电话','文本','detail',6,0),
('YWYDA','rzrq',N'入职日期','日期','detail',7,0),
('YWYDA','sfz',N'身份证号','文本','detail',8,0),
('YWYDA','bz',N'备注','文本','detail',9,0);
-- CKDA 仓库档案
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, required) VALUES
('CKDA','dm',N'仓库代码','文本','detail',1,1),
('CKDA','mc',N'仓库名称','文本','detail',2,1),
('CKDA','bz',N'备注','文本','detail',3,0);
-- ZDGL 数据字典
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, place, seq, required) VALUES
('ZDGL','lb',N'字典类别','下拉框',N'SELECT DISTINCT lb FROM dm_gx WHERE ISNULL(asp_cancel,''N'')<>''Y'' ORDER BY lb','detail',1,1),
('ZDGL','dm',N'代码','文本',NULL,'detail',2,1),
('ZDGL','mc',N'名称','文本',NULL,'detail',3,1),
('ZDGL','bz',N'备注','文本',NULL,'detail',4,0);
-- RKD 入库单
INSERT INTO yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field, place, seq, required) VALUES
('RKD','inh_no',N'入库单号','文本',NULL,NULL,NULL,'query,header',1,1),
('RKD','in_date',N'入库日期','日期',NULL,NULL,NULL,'query,header',2,0),
('RKD','ywman',N'业务员','文本',NULL,NULL,NULL,'header',3,0),
('RKD','gfdm',N'厂商代码','参照','GFDA','dm','mc','query,header',4,0),
('RKD','ckdm',N'仓库','参照','CKDA','dm','mc','query,header',5,0),
('RKD','od_no',N'来源单号','文本',NULL,NULL,NULL,'header,detail',6,0),
('RKD','bz1',N'业务类别','文本',NULL,NULL,NULL,'header',7,0),
('RKD','bz',N'备注','文本',NULL,NULL,NULL,'header,detail',8,0),
('RKD','wzdm',N'物料代码','文本',NULL,NULL,NULL,'query,detail',10,1),
('RKD','lot_no',N'批号','文本',NULL,NULL,NULL,'detail',11,0),
('RKD','sl',N'数量','小数',NULL,NULL,NULL,'detail',12,1),
('RKD','ddw',N'单位','文本',NULL,NULL,NULL,'detail',13,0),
('RKD','ddwsl',N'辅数量','小数',NULL,NULL,NULL,'detail',14,0),
('RKD','in_danj',N'单价','小数',NULL,NULL,NULL,'detail',15,0),
('RKD','i_zk',N'折扣%','小数',NULL,NULL,NULL,'detail',16,0),
('RKD','total_m',N'金额','小数',NULL,NULL,NULL,'detail',17,0);
-- CKD 出库单
INSERT INTO yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field, dict_sql, place, seq, required) VALUES
('CKD','outh_no',N'出库单号','文本',NULL,NULL,NULL,NULL,'query,header',1,1),
('CKD','out_date',N'出库日期','日期',NULL,NULL,NULL,NULL,'query,header',2,0),
('CKD','ywman',N'业务员','文本',NULL,NULL,NULL,NULL,'header',3,0),
('CKD','khdm',N'客户代码','参照','KHDA','dm','mc',NULL,'query,header',4,0),
('CKD','ckdm',N'仓库','参照','CKDA','dm','mc',NULL,'query,header',5,0),
('CKD','llxz',N'领料性质','下拉框',NULL,NULL,NULL,N'SELECT mc FROM dm_gx WHERE lb=''LHXZ'' AND ISNULL(asp_cancel,''N'')<>''Y'' ORDER BY dm','header',6,0),
('CKD','od_no',N'来源单号','文本',NULL,NULL,NULL,NULL,'header,detail',7,0),
('CKD','bz',N'备注','文本',NULL,NULL,NULL,NULL,'header,detail',8,0),
('CKD','wzdm',N'物料代码','文本',NULL,NULL,NULL,NULL,'query,detail',10,1),
('CKD','lot_no',N'批号','文本',NULL,NULL,NULL,NULL,'detail',11,0),
('CKD','sl',N'数量','小数',NULL,NULL,NULL,NULL,'detail',12,1),
('CKD','ddw',N'单位','文本',NULL,NULL,NULL,NULL,'detail',13,0),
('CKD','out_danj',N'单价','小数',NULL,NULL,NULL,NULL,'detail',14,0),
('CKD','o_zk',N'折扣%','小数',NULL,NULL,NULL,NULL,'detail',15,0),
('CKD','total_m',N'金额','小数',NULL,NULL,NULL,NULL,'detail',16,0);
-- CGD 采购单
INSERT INTO yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field, dict_sql, place, seq, required) VALUES
('CGD','od_no',N'采购单号','文本',NULL,NULL,NULL,NULL,'query,header',1,1),
('CGD','od_date',N'采购日期','日期',NULL,NULL,NULL,NULL,'query,header',2,0),
('CGD','jh_date',N'交货日期','日期',NULL,NULL,NULL,NULL,'header,detail',3,0),
('CGD','ywman',N'业务员','文本',NULL,NULL,NULL,NULL,'header',4,0),
('CGD','csdm',N'厂商代码','参照','GFDA','dm','mc',NULL,'query,header',5,0),
('CGD','chg',N'验收方式','下拉框',NULL,NULL,NULL,N'SELECT mc FROM dm_gx WHERE lb=''YSFS'' AND ISNULL(asp_cancel,''N'')<>''Y'' ORDER BY dm','header',6,0),
('CGD','tax_sm',N'税别','文本',NULL,NULL,NULL,NULL,'header,detail',7,0),
('CGD','bz',N'备注','文本',NULL,NULL,NULL,NULL,'header',8,0),
('CGD','wzdm',N'物料代码','文本',NULL,NULL,NULL,NULL,'query,detail',10,1),
('CGD','lot_no',N'批号','文本',NULL,NULL,NULL,NULL,'detail',11,0),
('CGD','sl',N'数量','小数',NULL,NULL,NULL,NULL,'detail',12,1),
('CGD','ddw',N'单位','文本',NULL,NULL,NULL,NULL,'detail',13,0),
('CGD','od_danj',N'单价','小数',NULL,NULL,NULL,NULL,'detail',14,0),
('CGD','od_zk',N'折扣%','小数',NULL,NULL,NULL,NULL,'detail',15,0),
('CGD','od_zke',N'金额','小数',NULL,NULL,NULL,NULL,'detail',16,0);
-- KHDD 客户订单(头 order_bt / 行 order_bs)
INSERT INTO yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field, place, seq, required) VALUES
('KHDD','od_no',N'订单编号','文本',NULL,NULL,NULL,'query,header',1,1),
('KHDD','cust_po',N'客户PO','文本',NULL,NULL,NULL,'query,header',2,0),
('KHDD','od_date',N'订单日期','日期',NULL,NULL,NULL,'query,header',3,0),
('KHDD','jh_date',N'交货日期','日期',NULL,NULL,NULL,'header',4,0),
('KHDD','khdm',N'客户代码','参照','KHDA','dm','mc','query,header',5,0),
('KHDD','ywman',N'业务员','文本',NULL,NULL,NULL,'header',6,0),
('KHDD','ddlx',N'订单类型','文本',NULL,NULL,NULL,'header',7,0),
('KHDD','je',N'金额','小数',NULL,NULL,NULL,'header',8,0),
('KHDD','total_qty',N'总数量','小数',NULL,NULL,NULL,'header',9,0),
('KHDD','bz',N'备注','文本',NULL,NULL,NULL,'header',10,0),
('KHDD','wzdm',N'产品代码','文本',NULL,NULL,NULL,'query,detail',11,1),
('KHDD','od_xc',N'行号','整数',NULL,NULL,NULL,'detail',12,0),
('KHDD','qty',N'订单数量','小数',NULL,NULL,NULL,'detail',13,1),
('KHDD','qty2',N'辅助数量','小数',NULL,NULL,NULL,'detail',14,0),
('KHDD','od_danj',N'单价','小数',NULL,NULL,NULL,'detail',15,0),
('KHDD','od_zk',N'折扣%','小数',NULL,NULL,NULL,'detail',16,0),
('KHDD','je',N'行金额','小数',NULL,NULL,NULL,'detail',17,0),
('KHDD','fh_date',N'交货日期','日期',NULL,NULL,NULL,'detail',18,0),
('KHDD','Remark',N'行备注','文本',NULL,NULL,NULL,'detail',19,0);
-- WLBOM 物料清单(BOM)
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, required) VALUES
('WLBOM','m_no',N'物料编码','文本','query,header',1,1),
('WLBOM','m_date',N'日期','日期','query,header',2,0),
('WLBOM','wzdm1',N'物料代码','文本','header',3,0),
('WLBOM','wzmc1',N'物料名称','文本','query,header',4,0),
('WLBOM','jldw1',N'单位','文本','header',5,0),
('WLBOM','xc',N'行序','整数','detail',9,0),
('WLBOM','wzdm2',N'子件代码','文本','detail',10,1),
('WLBOM','wzmc2',N'子件名称','文本','detail',11,0),
('WLBOM','gg2',N'规格型号','文本','detail',12,0),
('WLBOM','jldw2',N'子件单位','文本','detail',13,0),
('WLBOM','bzl',N'标准用量','小数','detail',14,0),
('WLBOM','sl2',N'损耗量','小数','detail',15,0),
('WLBOM','in_dj',N'单价','小数','detail',16,0),
('WLBOM','jine',N'金额','小数','detail',17,0),
('WLBOM','bz',N'备注','文本','detail',18,0);
-- STOCK_STATUS 库存状况(flat 平表,标签对齐 light-mes fillCurrentStock 契约)
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, required) VALUES
('STOCK_STATUS','wzdm',N'存货编码','文本','query,detail',1,0),
('STOCK_STATUS','wzdm',N'存货','文本','detail',2,0),
('STOCK_STATUS','ckdm',N'仓库','文本','query,detail',3,0),
('STOCK_STATUS','lot_no',N'批号','文本','query,detail',4,0),
('STOCK_STATUS','khdm',N'客户代码','文本','query,detail',5,0),
('STOCK_STATUS','rkl',N'累计入库量','小数','detail',6,0),
('STOCK_STATUS','ckl',N'累计出库量','小数','detail',7,0),
('STOCK_STATUS','yl',N'现存量(主)','小数','detail',8,0),
('STOCK_STATUS','yl2',N'辅助结余','小数','detail',9,0),
('STOCK_STATUS','in_date',N'入库日期','日期','detail',10,0);
GO
GRANT SELECT, INSERT, UPDATE, DELETE ON yj_panel TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON yj_field TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON yj_doc_status TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON yj_user TO yinjia;
GRANT SELECT, INSERT, UPDATE, DELETE ON yj_form_approval TO yinjia;
GO
DECLARE @fc int = (SELECT COUNT(*) FROM yj_field);
PRINT N'YINJIA-MES 元数据初始化完成: 10 面板 / ' + CAST(@fc AS nvarchar(10)) + N' 字段定义';
