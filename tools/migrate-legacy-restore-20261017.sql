/* migrate-legacy-restore-20261017.sql — 把「服务器快照」里的 6 张经典 HSDZ 遗留表补回账套
 *
 * 【用户口径 2026-10-17】
 *   「当前服务器快照缺失的表需要补充回到当前的数据库内,数据也按照服务器快照完成恢复」
 *   —— 本脚本负责**建表 + 中文注明**;两账套(先正式后测试)均执行。
 *
 * 【为什么是这 6 张】
 *   与快照库 HSDZ_MES_SRV1015 逐表比对,正式库 HSDZ_MES 缺 14 张,分三类:
 *     ① 6 张经典遗留(本脚本):dm_langue / gscs / permission / s_commdata / s_sys / s_xtcs
 *     ② 6 张 2026-10-16 **主动下架**的检验单(另案处理,不在本脚本)
 *     ③ 2 张 *_bak_ 备份表(不补 —— AGENTS.md 明确 * 星号 bak 类棘轮基线必须为 0,补了体检 FAIL)
 *   这 6 张在后端源码里**只出现在注释中**(「对齐 HSDZ permission.GROP」),
 *   运行期零引用 ⇒ 补回来不改任何行为,纯粹是把经典 HSDZ 的资产恢复齐全。
 *
 * 【数据怎么办 —— 本脚本**不灌数据**,这是有意的】
 *   快照里这 6 张表共 7,936 行,其中 s_commdata.JSZ 是**真实手机号**、gscs 是公司电话,
 *   按 AGENTS.md「敏感信息不入库(.env、AK/密码 —— 提交前 git grep 扫一遍)」不得写进 git。
 *   数据由 tools/archive/_migration-gap-20261017/_restore-legacy-data.sql 从快照库
 *   一次性回灌(带 DB_ID 守卫 + 空表守卫,幂等;仅本机可行,故意不进清单)。
 *
 * 【幂等】IF OBJECT_ID IS NULL CREATE TABLE;注明 NOT EXISTS 才加。重跑为 no-op。
 * 【登记】tools/db-inuse-tables.txt(例外保留·快照回补) + tools/db-legacy-whitelist.txt(table: 冻结)。
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
  [LB_TAB] nchar(2) NULL,
  [LB_YN] nchar(2) NULL,
  [LB_TYPE] nvarchar(20) NULL,
  [LB_VALUE] nvarchar(20) NULL,
  [LB_LEN] int NULL DEFAULT ((0)),
  [DISP_ORDER] int NULL DEFAULT ((0)),
  [FILE_STR] nvarchar(50) NULL,
  [FLIE_NA] nvarchar(150) NULL,
  [DISP_YN] nchar(2) NULL,
  [KEY_YN] nchar(2) NULL,
  [HEAD_YN] nchar(2) NULL,
  [CHS] nvarchar(250) NULL,
  [CHT] nvarchar(250) NULL,
  [ENG] nvarchar(250) NULL,
  [OTH] nvarchar(250) NULL,
  [BZ] nvarchar(250) NULL,
  [GMF] nvarchar(1) NULL,
  [GROP] nvarchar(40) NULL,
  [ISDOUBLE] nchar(2) NULL,
  [ISDATE] nchar(2) NULL,
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
GO

/* ===== 表级中文注明(MS_Description;已存在则不覆盖) ===== */
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

/* ===== 自检 ===== */
DECLARE @bad int = 0, @msg nvarchar(400) = N'';
IF OBJECT_ID(N'dbo.dm_langue', N'U') IS NULL BEGIN SET @bad = @bad + 1; SET @msg = @msg + N'dm_langue '; END
IF OBJECT_ID(N'dbo.gscs', N'U') IS NULL BEGIN SET @bad = @bad + 1; SET @msg = @msg + N'gscs '; END
IF OBJECT_ID(N'dbo.permission', N'U') IS NULL BEGIN SET @bad = @bad + 1; SET @msg = @msg + N'permission '; END
IF OBJECT_ID(N'dbo.s_commdata', N'U') IS NULL BEGIN SET @bad = @bad + 1; SET @msg = @msg + N's_commdata '; END
IF OBJECT_ID(N'dbo.s_sys', N'U') IS NULL BEGIN SET @bad = @bad + 1; SET @msg = @msg + N's_sys '; END
IF OBJECT_ID(N'dbo.s_xtcs', N'U') IS NULL BEGIN SET @bad = @bad + 1; SET @msg = @msg + N's_xtcs '; END
DECLARE @dbn sysname = DB_NAME();
RAISERROR(N'[自检] %s:6 张遗留表,缺失 %d 张 %s', 10, 1, @dbn, @bad, @msg);
IF @bad = 0 RAISERROR(N'[OK] 6 张经典 HSDZ 遗留表已就位(dm_langue/gscs/permission/s_commdata/s_sys/s_xtcs)', 10, 1);
ELSE RAISERROR(N'[FAIL] 遗留表补齐不完整', 16, 1);
GO
