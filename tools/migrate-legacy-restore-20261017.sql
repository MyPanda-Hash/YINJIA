/* migrate-legacy-restore-20261017.sql — 把「服务器快照」里的 6 张经典 HSDZ 遗留表补回账套
 *
 * 【用户口径 2026-10-17】
 *   「当前服务器快照缺失的表需要补充回到当前的数据库内,数据也按照服务器快照完成恢复」
 *   —— 本脚本负责**建表 + 主键索引 + 表级/列级中文注明**;两账套(先正式后测试)均执行。
 *
 * 【为什么是这 6 张】
 *   与快照库 HSDZ_MES_SRV1015 逐表比对,正式库 HSDZ_MES 缺 14 张,分三类:
 *     ① 6 张经典遗留(本脚本):dm_langue / gscs / permission / s_commdata / s_sys / s_xtcs
 *     ② 6 张 2026-10-16 **主动下架**的检验单(另案处理,不在本脚本)
 *     ③ 2 张 *_bak_ 备份表(不补 —— AGENTS.md 明确 * 星号 bak 类棘轮基线必须为 0,补了体检 FAIL)
 *   这 6 张在后端源码里**只出现在注释中**(「对齐 HSDZ permission.GROP」),
 *   运行期零引用 ⇒ 补回来不改任何行为,纯粹是把经典 HSDZ 的资产恢复齐全。
 *
 * 【v2 修复(v1 建过表的库重跑本脚本即自愈)】
 *   ① `nchar` 宽度:v1 把字节长度当字符数,`nchar(1)` 被建成 `nchar(2)`(s_sys 7 列)
 *      —— 本节末尾的修复 ALTER 会按"字节长度不符"纠正;新建路径已直接写对。
 *   ② 主键/索引:v1 一个没建 —— 现在按快照补 PK(6 张)+ s_commdata 的 comm/jsz/xc 三个非聚集索引。
 *      ⚠ s_commdata 主键在快照上是系统自动名 `PK__s_commda__3214EC27C3DB5918`,
 *        本脚本改用规范名 `PK_s_commdata`(键列/聚集/唯一性完全一致,仅名字不同)。
 *   ③ 列级中文注明:v1 只加了表级 —— 现在把快照上的列注明逐条搬过来(NOT EXISTS 守卫)。
 *
 * 【数据怎么办 —— 本脚本**不灌数据**,这是有意的】
 *   快照里这 6 张表共 7,936 行,其中 s_commdata.JSZ 是**真实手机号**、gscs 是公司电话,
 *   按 AGENTS.md「敏感信息不入库(.env、AK/密码 —— 提交前 git grep 扫一遍)」不得写进 git。
 *   数据由 tools/archive/_migration-gap-20261017/_restore-legacy-data.sql 从快照库
 *   一次性回灌(带 DB_ID 守卫 + 空表守卫,幂等;仅本机可行,故意不进清单)。
 *
 * 【幂等】IF OBJECT_ID IS NULL CREATE TABLE;索引/注明 NOT EXISTS 守卫;nchar 修复带字节长度守卫。
 * 【登记】tools/db-inuse-tables.txt(快照回补节) + tools/db-legacy-whitelist.txt(table: 冻结)。
 * 【注】本文件由 tools/archive/_migration-gap-20261017/_GenLegacyDdl.java 生成,请勿手改。
 */
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

/* ===== dm_langue — 多语言词条表(经典 HSDZ:comm/id/frm/type + chs/cht/eng/oth/bz 五语文本;MES 多语言走 yj_translation,本表仅存档) ===== */
IF OBJECT_ID(N'dbo.dm_langue', N'U') IS NULL
CREATE TABLE dbo.[dm_langue] (
  [comm] nvarchar(20) NOT NULL,
  [id] int IDENTITY(1,1) NOT NULL,
  [frm] nvarchar(40) NULL,
  [type] nvarchar(200) NULL,
  [xc] int NULL DEFAULT ((0)),
  [lb_wi] int NULL DEFAULT ((0)),
  [lb_hi] int NULL DEFAULT ((0)),
  [chs] nvarchar(255) NULL,
  [cht] nvarchar(255) NULL,
  [eng] nvarchar(255) NULL,
  [oth] nvarchar(255) NULL,
  [bz] nvarchar(255) NULL,
  [asp_user1] nvarchar(20) NULL,
  [asp_time1] datetime2 NULL DEFAULT (getdate()),
  [asp_user2] nvarchar(20) NULL,
  [asp_time2] datetime2 NULL,
  [asp_user3] nvarchar(20) NULL,
  [asp_time3] datetime2 NULL,
  [asp_cancel] nvarchar(1) NULL DEFAULT (N'N'),
  [asp_user4] nvarchar(20) NULL,
  [asp_time4] datetime2 NULL,
  [asp_print] int NULL DEFAULT ((0))
);
IF OBJECT_ID(N'dbo.dm_langue', N'U') IS NOT NULL PRINT N'[OK] dm_langue 就位';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.dm_langue') AND is_primary_key = 1)
    ALTER TABLE dbo.[dm_langue] ADD CONSTRAINT [PK_dm_langue] PRIMARY KEY CLUSTERED (comm, id);
GO

/* ===== gscs — 公司参数表(经典 HSDZ:一行一公司,gsmc 公司名称/gsdh 电话/web 等 55 列;MES 无引用,仅存档) ===== */
IF OBJECT_ID(N'dbo.gscs', N'U') IS NULL
CREATE TABLE dbo.[gscs] (
  [id] int IDENTITY(1,1) NOT NULL,
  [comm] nvarchar(20) NOT NULL DEFAULT ((0)),
  [gsmc] nvarchar(50) NOT NULL,
  [gsdh] nvarchar(50) NULL,
  [tpwz] nvarchar(50) NULL,
  [xpsm1] nvarchar(50) NULL,
  [xpsm2] nvarchar(50) NULL,
  [bz] nvarchar(50) NULL,
  [tm_cd] float NULL DEFAULT ((0)),
  [tm_gd] float NULL DEFAULT ((0)),
  [tm_zyjj] float NULL DEFAULT ((0)),
  [tm_sxjj] float NULL DEFAULT ((0)),
  [tm_sbj] float NULL DEFAULT ((0)),
  [tm_zbj] float NULL DEFAULT ((0)),
  [rem] nvarchar(200) NULL,
  [web] nvarchar(50) NULL,
  [djzk] nvarchar(20) NULL,
  [ghf] float NULL DEFAULT ((0)),
  [ysys] nvarchar(10) NULL,
  [yspy] nvarchar(10) NULL,
  [ysfh] nvarchar(10) NULL,
  [mybs] int NULL DEFAULT ((0)),
  [hg] int NULL DEFAULT ((0)),
  [mysj] int NULL DEFAULT ((0)),
  [kjjm] nvarchar(20) NULL,
  [pos_dj] nvarchar(2) NULL,
  [hzb] int NULL DEFAULT ((0)),
  [zzb] int NULL DEFAULT ((0)),
  [rem1] nvarchar(200) NULL,
  [gsgs] nvarchar(20) NULL,
  [gszg] nvarchar(20) NULL,
  [xpzs] nvarchar(1) NULL,
  [xpbt] nvarchar(50) NULL,
  [msbdh] nvarchar(20) NULL,
  [beginday] datetime2 NULL,
  [endday] datetime2 NULL,
  [comqty] int NULL DEFAULT ((0)),
  [mobqty] int NULL DEFAULT ((0)),
  [fkc] nvarchar(1) NULL,
  [pfwj] nvarchar(50) NULL,
  [sf] nvarchar(50) NULL,
  [sczg] nvarchar(50) NULL,
  [jsfs] nvarchar(5) NULL,
  [ver] nvarchar(5) NULL,
  [maxrecord] int NULL DEFAULT ((0)),
  [asp_user1] nvarchar(20) NULL,
  [asp_time1] datetime2 NULL DEFAULT (getdate()),
  [asp_user2] nvarchar(20) NULL,
  [asp_time2] datetime2 NULL,
  [asp_user3] nvarchar(20) NULL,
  [asp_time3] datetime2 NULL,
  [asp_cancel] nvarchar(1) NULL DEFAULT (N'N'),
  [asp_user4] nvarchar(20) NULL,
  [asp_time4] datetime2 NULL,
  [asp_print] int NULL DEFAULT ((0))
);
IF OBJECT_ID(N'dbo.gscs', N'U') IS NOT NULL PRINT N'[OK] gscs 就位';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.gscs') AND is_primary_key = 1)
    ALTER TABLE dbo.[gscs] ADD CONSTRAINT [PK_gscs] PRIMARY KEY CLUSTERED (id);
GO

/* ===== permission — 权限明细表(经典 HSDZ:USERID 账号 × MODULE1 模块 × RW 权限位 × GROP 分组;MES 权限走 yj_role/yj_role_panel,本表仅存档) ===== */
IF OBJECT_ID(N'dbo.permission', N'U') IS NULL
CREATE TABLE dbo.[permission] (
  [COMM] nvarchar(20) NOT NULL DEFAULT ((0)),
  [ID] int IDENTITY(1,1) NOT NULL,
  [USERID] nvarchar(20) NOT NULL,
  [MODULE1] nvarchar(20) NOT NULL,
  [RW] nvarchar(10) NOT NULL,
  [MODULE_NA] nvarchar(20) NULL,
  [GROP] nvarchar(40) NULL,
  [REMARK] nvarchar(200) NULL,
  [asp_user1] nvarchar(20) NULL,
  [asp_time1] datetime2 NULL DEFAULT (getdate()),
  [asp_user2] nvarchar(20) NULL,
  [asp_time2] datetime2 NULL,
  [asp_user3] nvarchar(20) NULL,
  [asp_time3] datetime2 NULL,
  [asp_cancel] nvarchar(1) NULL DEFAULT (N'N'),
  [asp_user4] nvarchar(20) NULL,
  [asp_time4] datetime2 NULL,
  [asp_print] int NULL DEFAULT ((0))
);
IF OBJECT_ID(N'dbo.permission', N'U') IS NOT NULL PRINT N'[OK] permission 就位';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.permission') AND is_primary_key = 1)
    ALTER TABLE dbo.[permission] ADD CONSTRAINT [PK_permission] PRIMARY KEY CLUSTERED (COMM, ID);
GO

/* ===== s_commdata — 通讯数据表(经典 HSDZ:短信/语音外呼队列 —— JSZ=接收号码/CTMC 内容/KEY 接口键/DSFS 发送方式;MES 无引用,仅存档) ===== */
IF OBJECT_ID(N'dbo.s_commdata', N'U') IS NULL
CREATE TABLE dbo.[s_commdata] (
  [COMM] nvarchar(20) NOT NULL,
  [ID] int IDENTITY(1,1) NOT NULL,
  [JSZ] nvarchar(18) NOT NULL,
  [XC] int NOT NULL,
  [SZSJ] datetime2 NOT NULL,
  [JBXX] nvarchar(100) NULL,
  [ZDYXX] nvarchar(250) NULL,
  [DSFS] tinyint NULL,
  [FCSJ] datetime2 NULL,
  [YDSJ] datetime2 NULL,
  [TXF] tinyint NULL,
  [YDF] tinyint NULL,
  [FSZ] nvarchar(18) NULL,
  [CTMC] nvarchar(50) NULL,
  [KEY] nvarchar(20) NULL,
  [KEYZ] nvarchar(20) NULL,
  [SYWJ] nvarchar(20) NULL,
  [REMARK] nvarchar(255) NULL,
  [asp_user1] nvarchar(20) NULL,
  [asp_time1] datetime2 NULL DEFAULT (getdate()),
  [asp_user2] nvarchar(20) NULL,
  [asp_time2] datetime2 NULL,
  [asp_user3] nvarchar(20) NULL,
  [asp_time3] datetime2 NULL,
  [asp_cancel] nvarchar(1) NULL DEFAULT (N'N'),
  [asp_user4] nvarchar(20) NULL,
  [asp_time4] datetime2 NULL,
  [asp_print] int NULL DEFAULT ((0))
);
IF OBJECT_ID(N'dbo.s_commdata', N'U') IS NOT NULL PRINT N'[OK] s_commdata 就位';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.s_commdata') AND is_primary_key = 1)
    ALTER TABLE dbo.[s_commdata] ADD CONSTRAINT [PK_s_commdata] PRIMARY KEY CLUSTERED (COMM, ID);   -- 快照原名为自动生成的 PK__s_commda__3214EC27C3DB5918
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.s_commdata') AND name = N'comm')
    CREATE NONCLUSTERED INDEX [comm] ON dbo.[s_commdata] (COMM);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.s_commdata') AND name = N'jsz')
    CREATE NONCLUSTERED INDEX [jsz] ON dbo.[s_commdata] (JSZ);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.s_commdata') AND name = N'xc')
    CREATE NONCLUSTERED INDEX [xc] ON dbo.[s_commdata] (XC);
GO

/* ===== s_sys — 系统表(经典 HSDZ:界面元素与菜单的字段级元数据 —— COMM/MC 名称/SYSMENUNO 菜单号/LB_* 控件位置/GROP 分组/五语标题;MES 面板元数据走 yj_panel/yj_field,本表仅存档) ===== */
IF OBJECT_ID(N'dbo.s_sys', N'U') IS NULL
CREATE TABLE dbo.[s_sys] (
  [COMM] nvarchar(20) NOT NULL,
  [ID] int IDENTITY(1,1) NOT NULL,
  [SYSMENUNO] nvarchar(50) NULL,
  [MC] nvarchar(20) NOT NULL,
  [USERNA] nvarchar(20) NOT NULL,
  [XC] int NOT NULL DEFAULT ((0)),
  [LANKD] int NULL DEFAULT ((0)),
  [LB_LEFT] int NULL DEFAULT ((0)),
  [LB_TOP] int NULL DEFAULT ((0)),
  [LB_WI] int NULL DEFAULT ((0)),
  [LB_HI] int NULL DEFAULT ((0)),
  [LB_TAB] nchar(1) NULL,
  [LB_YN] nchar(1) NULL,
  [LB_TYPE] nvarchar(20) NULL,
  [LB_VALUE] nvarchar(20) NULL,
  [LB_LEN] int NULL DEFAULT ((0)),
  [DISP_ORDER] int NULL DEFAULT ((0)),
  [FILE_STR] nvarchar(50) NULL,
  [FLIE_NA] nvarchar(150) NULL,
  [DISP_YN] nchar(1) NULL,
  [KEY_YN] nchar(1) NULL,
  [HEAD_YN] nchar(1) NULL,
  [CHS] nvarchar(250) NULL,
  [CHT] nvarchar(250) NULL,
  [ENG] nvarchar(250) NULL,
  [OTH] nvarchar(250) NULL,
  [BZ] nvarchar(250) NULL,
  [GMF] nvarchar(1) NULL,
  [GROP] nvarchar(40) NULL,
  [ISDOUBLE] nchar(1) NULL,
  [ISDATE] nchar(1) NULL,
  [REMARK] nvarchar(255) NULL,
  [VER] nvarchar(5) NULL,
  [control] nvarchar(250) NULL,
  [Listna] nvarchar(250) NULL,
  [Cur_Lang] nvarchar(10) NULL,
  [asp_user1] nvarchar(20) NULL,
  [asp_time1] datetime2 NULL DEFAULT (getdate()),
  [asp_user2] nvarchar(20) NULL,
  [asp_time2] datetime2 NULL,
  [asp_user3] nvarchar(20) NULL,
  [asp_time3] datetime2 NULL,
  [asp_cancel] nvarchar(1) NULL DEFAULT (N'N'),
  [asp_user4] nvarchar(20) NULL,
  [asp_time4] datetime2 NULL,
  [asp_print] int NULL DEFAULT ((0))
);
IF OBJECT_ID(N'dbo.s_sys', N'U') IS NOT NULL PRINT N'[OK] s_sys 就位';

IF COL_LENGTH(N'dbo.s_sys', N'LB_TAB') IS NOT NULL AND COL_LENGTH(N'dbo.s_sys', N'LB_TAB') <> 2
    ALTER TABLE dbo.[s_sys] ALTER COLUMN [LB_TAB] nchar(1) NULL;
IF COL_LENGTH(N'dbo.s_sys', N'LB_YN') IS NOT NULL AND COL_LENGTH(N'dbo.s_sys', N'LB_YN') <> 2
    ALTER TABLE dbo.[s_sys] ALTER COLUMN [LB_YN] nchar(1) NULL;
IF COL_LENGTH(N'dbo.s_sys', N'DISP_YN') IS NOT NULL AND COL_LENGTH(N'dbo.s_sys', N'DISP_YN') <> 2
    ALTER TABLE dbo.[s_sys] ALTER COLUMN [DISP_YN] nchar(1) NULL;
IF COL_LENGTH(N'dbo.s_sys', N'KEY_YN') IS NOT NULL AND COL_LENGTH(N'dbo.s_sys', N'KEY_YN') <> 2
    ALTER TABLE dbo.[s_sys] ALTER COLUMN [KEY_YN] nchar(1) NULL;
IF COL_LENGTH(N'dbo.s_sys', N'HEAD_YN') IS NOT NULL AND COL_LENGTH(N'dbo.s_sys', N'HEAD_YN') <> 2
    ALTER TABLE dbo.[s_sys] ALTER COLUMN [HEAD_YN] nchar(1) NULL;
IF COL_LENGTH(N'dbo.s_sys', N'ISDOUBLE') IS NOT NULL AND COL_LENGTH(N'dbo.s_sys', N'ISDOUBLE') <> 2
    ALTER TABLE dbo.[s_sys] ALTER COLUMN [ISDOUBLE] nchar(1) NULL;
IF COL_LENGTH(N'dbo.s_sys', N'ISDATE') IS NOT NULL AND COL_LENGTH(N'dbo.s_sys', N'ISDATE') <> 2
    ALTER TABLE dbo.[s_sys] ALTER COLUMN [ISDATE] nchar(1) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.s_sys') AND is_primary_key = 1)
    ALTER TABLE dbo.[s_sys] ADD CONSTRAINT [PK_s_sys] PRIMARY KEY CLUSTERED (COMM, ID);
GO

/* ===== s_xtcs — 系统参数表(经典 HSDZ:dm 代码/mc 名称/value 取值 —— 工单二维码长度/超交百分比/预订交期天数等;MES 运行期参数走 yj_app_setting,本表仅存档) ===== */
IF OBJECT_ID(N'dbo.s_xtcs', N'U') IS NULL
CREATE TABLE dbo.[s_xtcs] (
  [comm] nvarchar(20) NOT NULL,
  [id] int IDENTITY(1,1) NOT NULL,
  [dm] nvarchar(15) NULL,
  [mc] nvarchar(20) NULL,
  [sm] nvarchar(50) NULL,
  [value] nvarchar(30) NULL,
  [bz] nvarchar(255) NULL,
  [asp_user1] nvarchar(20) NULL,
  [asp_time1] datetime2 NULL DEFAULT (getdate()),
  [asp_user2] nvarchar(20) NULL,
  [asp_time2] datetime2 NULL,
  [asp_user3] nvarchar(20) NULL,
  [asp_time3] datetime2 NULL,
  [asp_cancel] nvarchar(1) NULL DEFAULT (N'N'),
  [asp_user4] nvarchar(20) NULL,
  [asp_time4] datetime2 NULL,
  [asp_print] int NULL DEFAULT ((0))
);
IF OBJECT_ID(N'dbo.s_xtcs', N'U') IS NOT NULL PRINT N'[OK] s_xtcs 就位';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.s_xtcs') AND is_primary_key = 1)
    ALTER TABLE dbo.[s_xtcs] ADD CONSTRAINT [PK_s_xtcs] PRIMARY KEY CLUSTERED (comm, id);
GO

/* ===== 中文注明:表级 + 列级(逐条 NOT EXISTS 守卫) ===== */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'dm_langue' AND ep.name = N'MS_Description' AND ep.minor_id = 0)
  EXEC sp_addextendedproperty N'MS_Description', N'多语言词条表(经典 HSDZ:comm/id/frm/type + chs/cht/eng/oth/bz 五语文本;MES 多语言走 yj_translation,本表仅存档)', N'SCHEMA', N'dbo', N'TABLE', N'dm_langue';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = 0)
  EXEC sp_addextendedproperty N'MS_Description', N'公司参数表(经典 HSDZ:一行一公司,gsmc 公司名称/gsdh 电话/web 等 55 列;MES 无引用,仅存档)', N'SCHEMA', N'dbo', N'TABLE', N'gscs';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'permission' AND ep.name = N'MS_Description' AND ep.minor_id = 0)
  EXEC sp_addextendedproperty N'MS_Description', N'权限明细表(经典 HSDZ:USERID 账号 × MODULE1 模块 × RW 权限位 × GROP 分组;MES 权限走 yj_role/yj_role_panel,本表仅存档)', N'SCHEMA', N'dbo', N'TABLE', N'permission';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = 0)
  EXEC sp_addextendedproperty N'MS_Description', N'通讯数据表(经典 HSDZ:短信/语音外呼队列 —— JSZ=接收号码/CTMC 内容/KEY 接口键/DSFS 发送方式;MES 无引用,仅存档)', N'SCHEMA', N'dbo', N'TABLE', N's_commdata';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = 0)
  EXEC sp_addextendedproperty N'MS_Description', N'系统表(经典 HSDZ:界面元素与菜单的字段级元数据 —— COMM/MC 名称/SYSMENUNO 菜单号/LB_* 控件位置/GROP 分组/五语标题;MES 面板元数据走 yj_panel/yj_field,本表仅存档)', N'SCHEMA', N'dbo', N'TABLE', N's_sys';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_xtcs' AND ep.name = N'MS_Description' AND ep.minor_id = 0)
  EXEC sp_addextendedproperty N'MS_Description', N'系统参数表(经典 HSDZ:dm 代码/mc 名称/value 取值 —— 工单二维码长度/超交百分比/预订交期天数等;MES 运行期参数走 yj_app_setting,本表仅存档)', N'SCHEMA', N'dbo', N'TABLE', N's_xtcs';
GO

/* ===== 列级中文注明(照搬快照) ===== */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'dm_langue' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.dm_langue'), N'frm', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'微信ID', N'SCHEMA', N'dbo', N'TABLE', N'dm_langue', N'COLUMN', N'frm';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'dm_langue' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.dm_langue'), N'lb_wi', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'1=在线，0=不在线', N'SCHEMA', N'dbo', N'TABLE', N'dm_langue', N'COLUMN', N'lb_wi';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'dm_langue' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.dm_langue'), N'asp_user1', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'创建人', N'SCHEMA', N'dbo', N'TABLE', N'dm_langue', N'COLUMN', N'asp_user1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'dm_langue' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.dm_langue'), N'asp_time1', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'创建时间', N'SCHEMA', N'dbo', N'TABLE', N'dm_langue', N'COLUMN', N'asp_time1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'dm_langue' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.dm_langue'), N'asp_user2', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'最后修改人', N'SCHEMA', N'dbo', N'TABLE', N'dm_langue', N'COLUMN', N'asp_user2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'dm_langue' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.dm_langue'), N'asp_time2', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'最后修改时间', N'SCHEMA', N'dbo', N'TABLE', N'dm_langue', N'COLUMN', N'asp_time2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'dm_langue' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.dm_langue'), N'asp_user3', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'审核人', N'SCHEMA', N'dbo', N'TABLE', N'dm_langue', N'COLUMN', N'asp_user3';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'dm_langue' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.dm_langue'), N'asp_time3', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'审核时间', N'SCHEMA', N'dbo', N'TABLE', N'dm_langue', N'COLUMN', N'asp_time3';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'dm_langue' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.dm_langue'), N'asp_cancel', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'删除标记', N'SCHEMA', N'dbo', N'TABLE', N'dm_langue', N'COLUMN', N'asp_cancel';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'dm_langue' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.dm_langue'), N'asp_user4', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'删除人', N'SCHEMA', N'dbo', N'TABLE', N'dm_langue', N'COLUMN', N'asp_user4';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'dm_langue' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.dm_langue'), N'asp_time4', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'删除时间', N'SCHEMA', N'dbo', N'TABLE', N'dm_langue', N'COLUMN', N'asp_time4';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'dm_langue' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.dm_langue'), N'asp_print', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'打印次数', N'SCHEMA', N'dbo', N'TABLE', N'dm_langue', N'COLUMN', N'asp_print';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'comm', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'公司', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'comm';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'web', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'网址', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'web';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'djzk', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'归属公司', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'djzk';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'ghf', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'预设挂号费', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'ghf';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'ysys', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'预设医生', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'ysys';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'yspy', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'预设配药', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'yspy';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'ysfh', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'预设复核', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'ysfh';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'mybs', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'每页显示笔数', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'mybs';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'hg', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'行高', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'hg';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'mysj', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'显示几个月的数据', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'mysj';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'kjjm', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'开机界面', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'kjjm';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'pos_dj', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'POS机是否显示单价', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'pos_dj';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'hzb', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'处方打印位置横坐标', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'hzb';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'zzb', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'处方打印位置纵坐标', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'zzb';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'rem1', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'备注', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'rem1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'xpbt', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'小票标题', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'xpbt';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'beginday', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'开始日期', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'beginday';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'endday', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'结束日期', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'endday';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'comqty', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'电脑用户数', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'comqty';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'mobqty', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'手机用户数', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'mobqty';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'fkc', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'是否允许负库存(作废，改在系统参数中)', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'fkc';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'pfwj', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'皮肤文件', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'pfwj';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'sf', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'运算服务器编号', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'sf';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'jsfs', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'结算方式(年，月)', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'jsfs';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'ver', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'使用版本号', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'ver';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'maxrecord', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'最大记录数', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'maxrecord';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'asp_user1', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'创建人', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'asp_user1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'asp_time1', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'创建时间', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'asp_time1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'asp_user2', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'最后修改人', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'asp_user2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'asp_time2', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'最后修改时间', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'asp_time2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'asp_user3', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'审核人', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'asp_user3';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'asp_time3', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'审核时间', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'asp_time3';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'asp_cancel', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'删除标记', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'asp_cancel';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'asp_user4', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'删除人', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'asp_user4';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'asp_time4', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'删除时间', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'asp_time4';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'gscs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.gscs'), N'asp_print', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'打印次数', N'SCHEMA', N'dbo', N'TABLE', N'gscs', N'COLUMN', N'asp_print';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'permission' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.permission'), N'COMM', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'公司', N'SCHEMA', N'dbo', N'TABLE', N'permission', N'COLUMN', N'COMM';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'permission' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.permission'), N'GROP', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'系统画面', N'SCHEMA', N'dbo', N'TABLE', N'permission', N'COLUMN', N'GROP';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'permission' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.permission'), N'REMARK', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'备注', N'SCHEMA', N'dbo', N'TABLE', N'permission', N'COLUMN', N'REMARK';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'permission' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.permission'), N'asp_user1', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'创建人', N'SCHEMA', N'dbo', N'TABLE', N'permission', N'COLUMN', N'asp_user1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'permission' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.permission'), N'asp_time1', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'创建时间', N'SCHEMA', N'dbo', N'TABLE', N'permission', N'COLUMN', N'asp_time1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'permission' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.permission'), N'asp_user2', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'最后修改人', N'SCHEMA', N'dbo', N'TABLE', N'permission', N'COLUMN', N'asp_user2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'permission' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.permission'), N'asp_time2', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'最后修改时间', N'SCHEMA', N'dbo', N'TABLE', N'permission', N'COLUMN', N'asp_time2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'permission' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.permission'), N'asp_user3', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'审核人', N'SCHEMA', N'dbo', N'TABLE', N'permission', N'COLUMN', N'asp_user3';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'permission' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.permission'), N'asp_time3', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'审核时间', N'SCHEMA', N'dbo', N'TABLE', N'permission', N'COLUMN', N'asp_time3';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'permission' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.permission'), N'asp_cancel', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'删除标记', N'SCHEMA', N'dbo', N'TABLE', N'permission', N'COLUMN', N'asp_cancel';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'permission' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.permission'), N'asp_user4', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'删除人', N'SCHEMA', N'dbo', N'TABLE', N'permission', N'COLUMN', N'asp_user4';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'permission' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.permission'), N'asp_time4', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'删除时间', N'SCHEMA', N'dbo', N'TABLE', N'permission', N'COLUMN', N'asp_time4';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N'permission' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.permission'), N'asp_print', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'打印次数', N'SCHEMA', N'dbo', N'TABLE', N'permission', N'COLUMN', N'asp_print';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_commdata'), N'COMM', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'公司代号', N'SCHEMA', N'dbo', N'TABLE', N's_commdata', N'COLUMN', N'COMM';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_commdata'), N'JSZ', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'接收者', N'SCHEMA', N'dbo', N'TABLE', N's_commdata', N'COLUMN', N'JSZ';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_commdata'), N'XC', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'项次', N'SCHEMA', N'dbo', N'TABLE', N's_commdata', N'COLUMN', N'XC';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_commdata'), N'SZSJ', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'上载时间', N'SCHEMA', N'dbo', N'TABLE', N's_commdata', N'COLUMN', N'SZSJ';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_commdata'), N'JBXX', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'基本信息', N'SCHEMA', N'dbo', N'TABLE', N's_commdata', N'COLUMN', N'JBXX';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_commdata'), N'ZDYXX', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'自定义信息', N'SCHEMA', N'dbo', N'TABLE', N's_commdata', N'COLUMN', N'ZDYXX';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_commdata'), N'DSFS', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'定时发送', N'SCHEMA', N'dbo', N'TABLE', N's_commdata', N'COLUMN', N'DSFS';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_commdata'), N'FCSJ', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'发出时间', N'SCHEMA', N'dbo', N'TABLE', N's_commdata', N'COLUMN', N'FCSJ';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_commdata'), N'YDSJ', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'阅读时间', N'SCHEMA', N'dbo', N'TABLE', N's_commdata', N'COLUMN', N'YDSJ';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_commdata'), N'TXF', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'提醒否', N'SCHEMA', N'dbo', N'TABLE', N's_commdata', N'COLUMN', N'TXF';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_commdata'), N'YDF', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'已读否', N'SCHEMA', N'dbo', N'TABLE', N's_commdata', N'COLUMN', N'YDF';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_commdata'), N'FSZ', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'发送者', N'SCHEMA', N'dbo', N'TABLE', N's_commdata', N'COLUMN', N'FSZ';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_commdata'), N'CTMC', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'窗体名称', N'SCHEMA', N'dbo', N'TABLE', N's_commdata', N'COLUMN', N'CTMC';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_commdata'), N'KEY', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'主KEY', N'SCHEMA', N'dbo', N'TABLE', N's_commdata', N'COLUMN', N'KEY';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_commdata'), N'KEYZ', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'主KEY值', N'SCHEMA', N'dbo', N'TABLE', N's_commdata', N'COLUMN', N'KEYZ';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_commdata'), N'SYWJ', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'提示的声音文件', N'SCHEMA', N'dbo', N'TABLE', N's_commdata', N'COLUMN', N'SYWJ';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_commdata'), N'REMARK', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'备注', N'SCHEMA', N'dbo', N'TABLE', N's_commdata', N'COLUMN', N'REMARK';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_commdata'), N'asp_user1', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'创建人', N'SCHEMA', N'dbo', N'TABLE', N's_commdata', N'COLUMN', N'asp_user1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_commdata'), N'asp_time1', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'创建时间', N'SCHEMA', N'dbo', N'TABLE', N's_commdata', N'COLUMN', N'asp_time1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_commdata'), N'asp_user2', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'最后修改人', N'SCHEMA', N'dbo', N'TABLE', N's_commdata', N'COLUMN', N'asp_user2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_commdata'), N'asp_time2', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'最后修改时间', N'SCHEMA', N'dbo', N'TABLE', N's_commdata', N'COLUMN', N'asp_time2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_commdata'), N'asp_user3', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'审核人', N'SCHEMA', N'dbo', N'TABLE', N's_commdata', N'COLUMN', N'asp_user3';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_commdata'), N'asp_time3', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'审核时间', N'SCHEMA', N'dbo', N'TABLE', N's_commdata', N'COLUMN', N'asp_time3';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_commdata'), N'asp_cancel', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'删除标记', N'SCHEMA', N'dbo', N'TABLE', N's_commdata', N'COLUMN', N'asp_cancel';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_commdata'), N'asp_user4', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'删除人', N'SCHEMA', N'dbo', N'TABLE', N's_commdata', N'COLUMN', N'asp_user4';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_commdata'), N'asp_time4', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'删除时间', N'SCHEMA', N'dbo', N'TABLE', N's_commdata', N'COLUMN', N'asp_time4';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_commdata' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_commdata'), N'asp_print', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'打印次数', N'SCHEMA', N'dbo', N'TABLE', N's_commdata', N'COLUMN', N'asp_print';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'COMM', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'注册公司代号', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'COMM';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'ID', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'ID', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'ID';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'SYSMENUNO', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'画面代号', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'SYSMENUNO';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'MC', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'名称', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'MC';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'USERNA', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'用户', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'USERNA';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'XC', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'项次', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'XC';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'LANKD', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'栏宽', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'LANKD';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'LB_LEFT', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'小数位数', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'LB_LEFT';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'LB_TOP', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'上坐标', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'LB_TOP';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'LB_WI', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'宽度', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'LB_WI';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'LB_HI', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'高度', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'LB_HI';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'LB_TAB', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'TAB', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'LB_TAB';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'LB_YN', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'是否标签', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'LB_YN';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'LB_TYPE', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'标签类别', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'LB_TYPE';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'LB_VALUE', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'取值内容', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'LB_VALUE';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'LB_LEN', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'字段长度', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'LB_LEN';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'DISP_ORDER', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'显示顺序', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'DISP_ORDER';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'FILE_STR', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'字段', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'FILE_STR';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'FLIE_NA', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'字段名', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'FLIE_NA';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'DISP_YN', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'是否显示', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'DISP_YN';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'KEY_YN', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'主KEY', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'KEY_YN';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'HEAD_YN', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'是否表头字段', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'HEAD_YN';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'CHS', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'简体', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'CHS';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'CHT', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'繁体', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'CHT';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'ENG', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'英文', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'ENG';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'OTH', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'其他', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'OTH';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'BZ', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'标题', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'BZ';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'GMF', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'购买否', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'GMF';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'GROP', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'模组', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'GROP';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'ISDOUBLE', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'是否小数', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'ISDOUBLE';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'ISDATE', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'是日期', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'ISDATE';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'REMARK', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'备注', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'REMARK';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'VER', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'版本号', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'VER';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'control', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'控制器名', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'control';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'Listna', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'页面名', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'Listna';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'Cur_Lang', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'当前语言', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'Cur_Lang';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'asp_user1', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'创建人', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'asp_user1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'asp_time1', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'创建时间', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'asp_time1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'asp_user2', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'最后修改人', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'asp_user2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'asp_time2', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'最后修改时间', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'asp_time2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'asp_user3', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'审核人', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'asp_user3';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'asp_time3', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'审核时间', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'asp_time3';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'asp_cancel', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'删除标记', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'asp_cancel';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'asp_user4', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'删除人', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'asp_user4';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'asp_time4', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'删除时间', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'asp_time4';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_sys' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_sys'), N'asp_print', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'打印次数', N'SCHEMA', N'dbo', N'TABLE', N's_sys', N'COLUMN', N'asp_print';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_xtcs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_xtcs'), N'comm', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'公司', N'SCHEMA', N'dbo', N'TABLE', N's_xtcs', N'COLUMN', N'comm';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_xtcs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_xtcs'), N'dm', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'代码', N'SCHEMA', N'dbo', N'TABLE', N's_xtcs', N'COLUMN', N'dm';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_xtcs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_xtcs'), N'mc', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'参数名称', N'SCHEMA', N'dbo', N'TABLE', N's_xtcs', N'COLUMN', N'mc';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_xtcs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_xtcs'), N'sm', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'参数说明', N'SCHEMA', N'dbo', N'TABLE', N's_xtcs', N'COLUMN', N'sm';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_xtcs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_xtcs'), N'value', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'参数值', N'SCHEMA', N'dbo', N'TABLE', N's_xtcs', N'COLUMN', N'value';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_xtcs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_xtcs'), N'bz', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'备注', N'SCHEMA', N'dbo', N'TABLE', N's_xtcs', N'COLUMN', N'bz';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_xtcs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_xtcs'), N'asp_user1', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'创建人', N'SCHEMA', N'dbo', N'TABLE', N's_xtcs', N'COLUMN', N'asp_user1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_xtcs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_xtcs'), N'asp_time1', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'创建时间', N'SCHEMA', N'dbo', N'TABLE', N's_xtcs', N'COLUMN', N'asp_time1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_xtcs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_xtcs'), N'asp_user2', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'最后修改人', N'SCHEMA', N'dbo', N'TABLE', N's_xtcs', N'COLUMN', N'asp_user2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_xtcs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_xtcs'), N'asp_time2', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'最后修改时间', N'SCHEMA', N'dbo', N'TABLE', N's_xtcs', N'COLUMN', N'asp_time2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_xtcs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_xtcs'), N'asp_user3', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'审核人', N'SCHEMA', N'dbo', N'TABLE', N's_xtcs', N'COLUMN', N'asp_user3';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_xtcs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_xtcs'), N'asp_time3', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'审核时间', N'SCHEMA', N'dbo', N'TABLE', N's_xtcs', N'COLUMN', N'asp_time3';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_xtcs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_xtcs'), N'asp_cancel', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'删除标记', N'SCHEMA', N'dbo', N'TABLE', N's_xtcs', N'COLUMN', N'asp_cancel';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_xtcs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_xtcs'), N'asp_user4', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'删除人', N'SCHEMA', N'dbo', N'TABLE', N's_xtcs', N'COLUMN', N'asp_user4';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_xtcs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_xtcs'), N'asp_time4', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'删除时间', N'SCHEMA', N'dbo', N'TABLE', N's_xtcs', N'COLUMN', N'asp_time4';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
               WHERE tb.name = N's_xtcs' AND ep.name = N'MS_Description' AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.s_xtcs'), N'asp_print', 'ColumnId'))
  EXEC sp_addextendedproperty N'MS_Description', N'打印次数', N'SCHEMA', N'dbo', N'TABLE', N's_xtcs', N'COLUMN', N'asp_print';
GO

/* ===== 自检 ===== */
DECLARE @bad int = 0, @msg nvarchar(400) = N'';
IF OBJECT_ID(N'dbo.dm_langue', N'U') IS NULL BEGIN SET @bad = @bad + 1; SET @msg = @msg + N'dm_langue 缺表 '; END
ELSE BEGIN
  IF (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.dm_langue')) <> 22 BEGIN SET @bad = @bad + 1; SET @msg = @msg + N'dm_langue 列数 '; END
  IF (SELECT COUNT(*) FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.dm_langue') AND type > 0) <> 1 BEGIN SET @bad = @bad + 1; SET @msg = @msg + N'dm_langue 索引 '; END
  IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.dm_langue') AND name = N'MS_Description') <> 13 BEGIN SET @bad = @bad + 1; SET @msg = @msg + N'dm_langue 注明 '; END
END
IF OBJECT_ID(N'dbo.gscs', N'U') IS NULL BEGIN SET @bad = @bad + 1; SET @msg = @msg + N'gscs 缺表 '; END
ELSE BEGIN
  IF (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.gscs')) <> 55 BEGIN SET @bad = @bad + 1; SET @msg = @msg + N'gscs 列数 '; END
  IF (SELECT COUNT(*) FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.gscs') AND type > 0) <> 1 BEGIN SET @bad = @bad + 1; SET @msg = @msg + N'gscs 索引 '; END
  IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.gscs') AND name = N'MS_Description') <> 37 BEGIN SET @bad = @bad + 1; SET @msg = @msg + N'gscs 注明 '; END
END
IF OBJECT_ID(N'dbo.permission', N'U') IS NULL BEGIN SET @bad = @bad + 1; SET @msg = @msg + N'permission 缺表 '; END
ELSE BEGIN
  IF (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.permission')) <> 18 BEGIN SET @bad = @bad + 1; SET @msg = @msg + N'permission 列数 '; END
  IF (SELECT COUNT(*) FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.permission') AND type > 0) <> 1 BEGIN SET @bad = @bad + 1; SET @msg = @msg + N'permission 索引 '; END
  IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.permission') AND name = N'MS_Description') <> 14 BEGIN SET @bad = @bad + 1; SET @msg = @msg + N'permission 注明 '; END
END
IF OBJECT_ID(N'dbo.s_commdata', N'U') IS NULL BEGIN SET @bad = @bad + 1; SET @msg = @msg + N's_commdata 缺表 '; END
ELSE BEGIN
  IF (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.s_commdata')) <> 28 BEGIN SET @bad = @bad + 1; SET @msg = @msg + N's_commdata 列数 '; END
  IF (SELECT COUNT(*) FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.s_commdata') AND type > 0) <> 4 BEGIN SET @bad = @bad + 1; SET @msg = @msg + N's_commdata 索引 '; END
  IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.s_commdata') AND name = N'MS_Description') <> 28 BEGIN SET @bad = @bad + 1; SET @msg = @msg + N's_commdata 注明 '; END
END
IF OBJECT_ID(N'dbo.s_sys', N'U') IS NULL BEGIN SET @bad = @bad + 1; SET @msg = @msg + N's_sys 缺表 '; END
ELSE BEGIN
  IF (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.s_sys')) <> 46 BEGIN SET @bad = @bad + 1; SET @msg = @msg + N's_sys 列数 '; END
  IF (SELECT COUNT(*) FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.s_sys') AND type > 0) <> 1 BEGIN SET @bad = @bad + 1; SET @msg = @msg + N's_sys 索引 '; END
  IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.s_sys') AND name = N'MS_Description') <> 47 BEGIN SET @bad = @bad + 1; SET @msg = @msg + N's_sys 注明 '; END
END
IF OBJECT_ID(N'dbo.s_xtcs', N'U') IS NULL BEGIN SET @bad = @bad + 1; SET @msg = @msg + N's_xtcs 缺表 '; END
ELSE BEGIN
  IF (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.s_xtcs')) <> 17 BEGIN SET @bad = @bad + 1; SET @msg = @msg + N's_xtcs 列数 '; END
  IF (SELECT COUNT(*) FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.s_xtcs') AND type > 0) <> 1 BEGIN SET @bad = @bad + 1; SET @msg = @msg + N's_xtcs 索引 '; END
  IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.s_xtcs') AND name = N'MS_Description') <> 17 BEGIN SET @bad = @bad + 1; SET @msg = @msg + N's_xtcs 注明 '; END
END
DECLARE @dbn sysname = DB_NAME();
RAISERROR(N'[自检] %s:6 张遗留表(表/列数/索引/注明),不符项 %d %s', 10, 1, @dbn, @bad, @msg);
IF @bad = 0 RAISERROR(N'[OK] 6 张经典 HSDZ 遗留表已就位(表+列+主键索引+表级/列级中文注明)', 10, 1);
ELSE RAISERROR(N'[FAIL] 遗留表补齐不完整(见上一行)', 16, 1);
GO
