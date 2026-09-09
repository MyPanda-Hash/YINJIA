-- 旧系统(HSDZ)遗留表兼容脚本:全新建库(无 .bak 还原)时补齐后端与迁移链硬编码依赖的表。
-- 覆盖:s_allno(单号池) / s_log(操作日志);其余面板数据表(dm_*、inh/outh/Porder、order_*、mate、kucun)
--       由下方生成段从 setup-db.sql 的 yj_field 定义自动生成(列与面板字段一一对应)。
-- 幂等:仅当表不存在时创建。
USE HSDZ_MES;
SET NOCOUNT ON;
GO
IF OBJECT_ID('dbo.s_allno') IS NULL
CREATE TABLE dbo.s_allno (
    id         int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    comm       varchar(10)  NOT NULL CONSTRAINT df_sallno_comm DEFAULT ('0'),
    dh         varchar(20)  NOT NULL,                -- 单号(前缀+yyMMdd+4位序号)
    lb         varchar(10)  NOT NULL,                -- 单号前缀类别
    ny         varchar(6)   NOT NULL,                -- 年月(yyMMdd)
    asp_user1  varchar(30)  NULL,
    asp_time1  datetime     NULL CONSTRAINT df_sallno_time DEFAULT (GETDATE()),
    asp_cancel char(1)      NOT NULL CONSTRAINT df_sallno_cancel DEFAULT ('N')
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_s_allno_lb_ny' AND object_id = OBJECT_ID('dbo.s_allno'))
    CREATE INDEX ix_s_allno_lb_ny ON dbo.s_allno (lb, ny, dh);
GO
IF OBJECT_ID('dbo.s_log') IS NULL
CREATE TABLE dbo.s_log (
    id        int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    userid    varchar(30)   NULL,
    rq        datetime      NULL CONSTRAINT df_slog_rq DEFAULT (GETDATE()),
    modulena  nvarchar(50)  NULL,
    gn        nvarchar(50)  NULL,
    remark    nvarchar(200) NULL,
    comm      varchar(50)   NULL
);
GO

-- ======== 以下由 gen-legacy-compat.cjs 从 setup-db.sql yj_field 定义生成(勿手工改) ========
GO
IF OBJECT_ID('dbo.dm_kh') IS NULL
CREATE TABLE dbo.dm_kh (
    id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [dm] nvarchar(200) NULL,
    [mc] nvarchar(200) NULL,
    [khjb] nvarchar(200) NULL,
    [addr] nvarchar(200) NULL,
    [tel] nvarchar(200) NULL,
    [ywman] nvarchar(200) NULL,
    [sui_no] nvarchar(200) NULL,
    [bank] nvarchar(200) NULL,
    [bank_no] nvarchar(200) NULL,
    [email] nvarchar(200) NULL,
    [frdb] nvarchar(200) NULL,
    [zczb] decimal(18,4) NULL,
    [clrq] datetime NULL,
    [bz] nvarchar(200) NULL,
    asp_cancel char(1) NOT NULL CONSTRAINT df_dm_kh_cancel DEFAULT ('N'),
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL,
    asp_user2 nvarchar(40) NULL, asp_time2 datetime NULL
);
GO
IF OBJECT_ID('dbo.dm_gf') IS NULL
CREATE TABLE dbo.dm_gf (
    id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [dm] nvarchar(200) NULL,
    [mc] nvarchar(200) NULL,
    [csjb] nvarchar(200) NULL,
    [addr] nvarchar(200) NULL,
    [tel] nvarchar(200) NULL,
    [ywman] nvarchar(200) NULL,
    [sui_no] nvarchar(200) NULL,
    [bank] nvarchar(200) NULL,
    [bank_no] nvarchar(200) NULL,
    [ckadd] nvarchar(200) NULL,
    [bz] nvarchar(200) NULL,
    asp_cancel char(1) NOT NULL CONSTRAINT df_dm_gf_cancel DEFAULT ('N'),
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL,
    asp_user2 nvarchar(40) NULL, asp_time2 datetime NULL
);
GO
IF OBJECT_ID('dbo.dm_ywy') IS NULL
CREATE TABLE dbo.dm_ywy (
    id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [dm] nvarchar(200) NULL,
    [mc] nvarchar(200) NULL,
    [lb] nvarchar(200) NULL,
    [zw] nvarchar(200) NULL,
    [bmmc] nvarchar(200) NULL,
    [tel] nvarchar(200) NULL,
    [rzrq] datetime NULL,
    [sfz] nvarchar(200) NULL,
    [bz] nvarchar(200) NULL,
    asp_cancel char(1) NOT NULL CONSTRAINT df_dm_ywy_cancel DEFAULT ('N'),
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL,
    asp_user2 nvarchar(40) NULL, asp_time2 datetime NULL
);
GO
IF OBJECT_ID('dbo.dm_ck') IS NULL
CREATE TABLE dbo.dm_ck (
    id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [dm] nvarchar(200) NULL,
    [mc] nvarchar(200) NULL,
    [bz] nvarchar(200) NULL,
    asp_cancel char(1) NOT NULL CONSTRAINT df_dm_ck_cancel DEFAULT ('N'),
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL,
    asp_user2 nvarchar(40) NULL, asp_time2 datetime NULL
);
GO
IF OBJECT_ID('dbo.dm_gx') IS NULL
CREATE TABLE dbo.dm_gx (
    id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [lb] nvarchar(50) NULL,
    [dm] nvarchar(200) NULL,
    [mc] nvarchar(200) NULL,
    [bz] nvarchar(200) NULL,
    asp_cancel char(1) NOT NULL CONSTRAINT df_dm_gx_cancel DEFAULT ('N'),
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL,
    asp_user2 nvarchar(40) NULL, asp_time2 datetime NULL
);
GO
IF OBJECT_ID('dbo.inh') IS NULL
CREATE TABLE dbo.inh (
    id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [inh_no] nvarchar(200) NULL,
    [in_date] datetime NULL,
    [ywman] nvarchar(200) NULL,
    [gfdm] nvarchar(50) NULL,
    [ckdm] nvarchar(50) NULL,
    [od_no] nvarchar(200) NULL,
    [bz1] nvarchar(200) NULL,
    [bz] nvarchar(200) NULL,
    [wzdm] nvarchar(200) NULL,
    [lot_no] nvarchar(200) NULL,
    [sl] decimal(18,4) NULL,
    [ddw] nvarchar(200) NULL,
    [ddwsl] decimal(18,4) NULL,
    [in_danj] decimal(18,4) NULL,
    [i_zk] decimal(18,4) NULL,
    [total_m] decimal(18,4) NULL,
    asp_cancel char(1) NOT NULL CONSTRAINT df_inh_cancel DEFAULT ('N'),
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL,
    asp_user2 nvarchar(40) NULL, asp_time2 datetime NULL
);
GO
IF OBJECT_ID('dbo.outh') IS NULL
CREATE TABLE dbo.outh (
    id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [outh_no] nvarchar(200) NULL,
    [out_date] datetime NULL,
    [ywman] nvarchar(200) NULL,
    [khdm] nvarchar(50) NULL,
    [ckdm] nvarchar(50) NULL,
    [llxz] nvarchar(50) NULL,
    [od_no] nvarchar(200) NULL,
    [bz] nvarchar(200) NULL,
    [wzdm] nvarchar(200) NULL,
    [lot_no] nvarchar(200) NULL,
    [sl] decimal(18,4) NULL,
    [ddw] nvarchar(200) NULL,
    [out_danj] decimal(18,4) NULL,
    [o_zk] decimal(18,4) NULL,
    [total_m] decimal(18,4) NULL,
    asp_cancel char(1) NOT NULL CONSTRAINT df_outh_cancel DEFAULT ('N'),
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL,
    asp_user2 nvarchar(40) NULL, asp_time2 datetime NULL
);
GO
IF OBJECT_ID('dbo.Porder') IS NULL
CREATE TABLE dbo.Porder (
    id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [od_no] nvarchar(200) NULL,
    [od_date] datetime NULL,
    [jh_date] datetime NULL,
    [ywman] nvarchar(200) NULL,
    [csdm] nvarchar(50) NULL,
    [chg] nvarchar(50) NULL,
    [tax_sm] nvarchar(200) NULL,
    [bz] nvarchar(200) NULL,
    [wzdm] nvarchar(200) NULL,
    [lot_no] nvarchar(200) NULL,
    [sl] decimal(18,4) NULL,
    [ddw] nvarchar(200) NULL,
    [od_danj] decimal(18,4) NULL,
    [od_zk] decimal(18,4) NULL,
    [od_zke] decimal(18,4) NULL,
    asp_cancel char(1) NOT NULL CONSTRAINT df_Porder_cancel DEFAULT ('N'),
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL,
    asp_user2 nvarchar(40) NULL, asp_time2 datetime NULL
);
GO
IF OBJECT_ID('dbo.order_bs') IS NULL
CREATE TABLE dbo.order_bs (
    id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [od_no] nvarchar(200) NULL,
    [cust_po] nvarchar(200) NULL,
    [od_date] datetime NULL,
    [jh_date] datetime NULL,
    [khdm] nvarchar(50) NULL,
    [ywman] nvarchar(200) NULL,
    [ddlx] nvarchar(200) NULL,
    [je] decimal(18,4) NULL,
    [total_qty] decimal(18,4) NULL,
    [bz] nvarchar(200) NULL,
    [wzdm] nvarchar(200) NULL,
    [od_xc] int NULL,
    [qty] decimal(18,4) NULL,
    [qty2] decimal(18,4) NULL,
    [od_danj] decimal(18,4) NULL,
    [od_zk] decimal(18,4) NULL,
    [fh_date] datetime NULL,
    asp_cancel char(1) NOT NULL CONSTRAINT df_order_bs_cancel DEFAULT ('N'),
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL,
    asp_user2 nvarchar(40) NULL, asp_time2 datetime NULL
);
GO
IF OBJECT_ID('dbo.order_bt') IS NULL
CREATE TABLE dbo.order_bt (
    id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [od_no] nvarchar(200) NULL,
    [cust_po] nvarchar(200) NULL,
    [od_date] datetime NULL,
    [jh_date] datetime NULL,
    [khdm] nvarchar(50) NULL,
    [ywman] nvarchar(200) NULL,
    [ddlx] nvarchar(200) NULL,
    [je] decimal(18,4) NULL,
    [total_qty] decimal(18,4) NULL,
    [bz] nvarchar(200) NULL,
    [wzdm] nvarchar(200) NULL,
    [od_xc] int NULL,
    [qty] decimal(18,4) NULL,
    [qty2] decimal(18,4) NULL,
    [od_danj] decimal(18,4) NULL,
    [od_zk] decimal(18,4) NULL,
    [fh_date] datetime NULL,
    asp_cancel char(1) NOT NULL CONSTRAINT df_order_bt_cancel DEFAULT ('N'),
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL,
    asp_user2 nvarchar(40) NULL, asp_time2 datetime NULL
);
GO
IF OBJECT_ID('dbo.mate') IS NULL
CREATE TABLE dbo.mate (
    id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [m_no] nvarchar(200) NULL,
    [m_date] datetime NULL,
    [wzdm1] nvarchar(200) NULL,
    [wzmc1] nvarchar(200) NULL,
    [jldw1] nvarchar(200) NULL,
    [xc] int NULL,
    [wzdm2] nvarchar(200) NULL,
    [wzmc2] nvarchar(200) NULL,
    [gg2] nvarchar(200) NULL,
    [jldw2] nvarchar(200) NULL,
    [bzl] decimal(18,4) NULL,
    [sl2] decimal(18,4) NULL,
    [in_dj] decimal(18,4) NULL,
    [jine] decimal(18,4) NULL,
    [bz] nvarchar(200) NULL,
    asp_cancel char(1) NOT NULL CONSTRAINT df_mate_cancel DEFAULT ('N'),
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL,
    asp_user2 nvarchar(40) NULL, asp_time2 datetime NULL
);
GO
IF OBJECT_ID('dbo.kucun') IS NULL
CREATE TABLE dbo.kucun (
    id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [wzdm] nvarchar(200) NULL,
    [ckdm] nvarchar(200) NULL,
    [lot_no] nvarchar(200) NULL,
    [khdm] nvarchar(200) NULL,
    [rkl] decimal(18,4) NULL,
    [ckl] decimal(18,4) NULL,
    [yl] decimal(18,4) NULL,
    [yl2] decimal(18,4) NULL,
    [in_date] datetime NULL,
    asp_cancel char(1) NOT NULL CONSTRAINT df_kucun_cancel DEFAULT ('N'),
    asp_user1 nvarchar(40) NULL, asp_time1 datetime NULL,
    asp_user2 nvarchar(40) NULL, asp_time2 datetime NULL
);
GO
