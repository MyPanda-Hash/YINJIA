-- ============================================================================
-- schema.sql —— 6 张已删除遗留表的【结构留档】（表数据见同目录 *.csv）
--
-- 来源库   : HSDZ_MES_0909（实例 localhost）
--            该库是 2026-09-10 从 HSDZ_MES_damaged_20260910.bak 恢复的快照库（294 张表）。
--            这 6 张表在正式库 HSDZ_MES 与测试库 HSDZ_MES_TEST 已于 2026-09-29
--            「未用表清理」中删除（共清 244 张），目前仅该快照库仍保留。
-- 生成方式 : _export-legacy-tables.java 直读系统目录视图——
--            列名/类型/长度/精度/可空性取自 sys.columns + sys.types，
--            IDENTITY 种子与步长取自 sys.identity_columns，
--            中文注释取自 sys.extended_properties(MS_Description)。全部实测，非人工臆测。
-- 生成日期 : 2026-10-15
--
-- 中文注释来源: 这些表在 HSDZ_MES_0909 里自身的 MS_Description；已逐条与
--   deploy/sync-db-comments.sql 比对：该文件对这 6 张表收录的注释与实测值【无一条文本不符】，
--   其多出的 3 条（dm_langue.xc / dm_langue.bz / gscs.bz，实测库中无该扩展属性）也已保留并标注。
--   ⚠ dm_langue 的表注释「语言（作废）」与实测数据不符，本文件按事实写成
--     「微信/移动端在线用户表」，原始注释保留在表头说明里备查。
--
-- ⚠⚠ 这是留档 / 复原脚本，只适用于临时库或新库：
--    ✗ 不要 在 HSDZ_MES / HSDZ_MES_TEST 上执行 —— 那两张库已把 244 张未用表清干净，
--      跑它等于把其中这 6 张又塞回去，破坏 tools/db-inuse-tables.txt 台账与
--      docs/development/数据库表清单.md 的登记。
--    ✓ 正确用法：CREATE DATABASE <临时库> → 对该临时库执行本脚本 → 只为比对/取数，用完即删。
--    ✓ 幂等：每张表都套 IF OBJECT_ID(N'dbo.xxx', N'U') IS NULL，重复执行不会覆盖/重建已有表。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- gscs —— 老「公司参数」单行表：公司名(gscs.gsmc)/电话/授权用户数(comqty/mobqty)/皮肤(pfwj)…… 带门诊药房味
-- HSDZ_MES_0909 实测行数：1
-- ----------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.gscs', N'U') IS NULL
BEGIN
CREATE TABLE dbo.[gscs] (
    [id] int IDENTITY(1,1) NOT NULL,
    [comm] nvarchar(20) NOT NULL,               -- 公司
    [gsmc] nvarchar(50) NOT NULL,
    [gsdh] nvarchar(50) NULL,
    [tpwz] nvarchar(50) NULL,
    [xpsm1] nvarchar(50) NULL,
    [xpsm2] nvarchar(50) NULL,
    [bz] nvarchar(50) NULL,                     -- 备注（注释仅见于 deploy/sync-db-comments.sql）
    [tm_cd] float NULL,
    [tm_gd] float NULL,
    [tm_zyjj] float NULL,
    [tm_sxjj] float NULL,
    [tm_sbj] float NULL,
    [tm_zbj] float NULL,
    [rem] nvarchar(200) NULL,
    [web] nvarchar(50) NULL,                    -- 网址
    [djzk] nvarchar(20) NULL,                   -- 归属公司
    [ghf] float NULL,                           -- 预设挂号费
    [ysys] nvarchar(10) NULL,                   -- 预设医生
    [yspy] nvarchar(10) NULL,                   -- 预设配药
    [ysfh] nvarchar(10) NULL,                   -- 预设复核
    [mybs] int NULL,                            -- 每页显示笔数
    [hg] int NULL,                              -- 行高
    [mysj] int NULL,                            -- 显示几个月的数据
    [kjjm] nvarchar(20) NULL,                   -- 开机界面
    [pos_dj] nvarchar(2) NULL,                  -- POS机是否显示单价
    [hzb] int NULL,                             -- 处方打印位置横坐标
    [zzb] int NULL,                             -- 处方打印位置纵坐标
    [rem1] nvarchar(200) NULL,                  -- 备注
    [gsgs] nvarchar(20) NULL,
    [gszg] nvarchar(20) NULL,
    [xpzs] nvarchar(1) NULL,
    [xpbt] nvarchar(50) NULL,                   -- 小票标题
    [msbdh] nvarchar(20) NULL,
    [beginday] datetime2(7) NULL,               -- 开始日期
    [endday] datetime2(7) NULL,                 -- 结束日期
    [comqty] int NULL,                          -- 电脑用户数
    [mobqty] int NULL,                          -- 手机用户数
    [fkc] nvarchar(1) NULL,                     -- 是否允许负库存(作废，改在系统参数中)
    [pfwj] nvarchar(50) NULL,                   -- 皮肤文件
    [sf] nvarchar(50) NULL,                     -- 运算服务器编号
    [sczg] nvarchar(50) NULL,
    [jsfs] nvarchar(5) NULL,                    -- 结算方式(年，月)
    [ver] nvarchar(5) NULL,                     -- 使用版本号
    [maxrecord] int NULL,                       -- 最大记录数
    [asp_user1] nvarchar(20) NULL,              -- 创建人
    [asp_time1] datetime2(7) NULL,              -- 创建时间
    [asp_user2] nvarchar(20) NULL,              -- 最后修改人
    [asp_time2] datetime2(7) NULL,              -- 最后修改时间
    [asp_user3] nvarchar(20) NULL,              -- 审核人
    [asp_time3] datetime2(7) NULL,              -- 审核时间
    [asp_cancel] nvarchar(1) NULL,              -- 删除标记
    [asp_user4] nvarchar(20) NULL,              -- 删除人
    [asp_time4] datetime2(7) NULL,              -- 删除时间
    [asp_print] int NULL                        -- 打印次数
);
END;
GO

-- ----------------------------------------------------------------------------
-- dm_langue —— ⚠ 表注释「语言（作废）」是错的：实测 frm 为微信ID/手机号、lb_wi 为在线标志、asp_time1 为登录时间，真身是「微信/移动端在线用户表」
-- HSDZ_MES_0909 实测行数：15
-- ----------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.dm_langue', N'U') IS NULL
BEGIN
CREATE TABLE dbo.[dm_langue] (
    [comm] nvarchar(20) NOT NULL,
    [id] int IDENTITY(1,1) NOT NULL,
    [frm] nvarchar(40) NULL,                    -- 微信ID
    [type] nvarchar(200) NULL,
    [xc] int NULL,                              -- 行序（注释仅见于 deploy/sync-db-comments.sql）
    [lb_wi] int NULL,                           -- 1=在线，0=不在线
    [lb_hi] int NULL,
    [chs] nvarchar(255) NULL,
    [cht] nvarchar(255) NULL,
    [eng] nvarchar(255) NULL,
    [oth] nvarchar(255) NULL,
    [bz] nvarchar(255) NULL,                    -- 备注（注释仅见于 deploy/sync-db-comments.sql）
    [asp_user1] nvarchar(20) NULL,              -- 创建人
    [asp_time1] datetime2(7) NULL,              -- 创建时间
    [asp_user2] nvarchar(20) NULL,              -- 最后修改人
    [asp_time2] datetime2(7) NULL,              -- 最后修改时间
    [asp_user3] nvarchar(20) NULL,              -- 审核人
    [asp_time3] datetime2(7) NULL,              -- 审核时间
    [asp_cancel] nvarchar(1) NULL,              -- 删除标记
    [asp_user4] nvarchar(20) NULL,              -- 删除人
    [asp_time4] datetime2(7) NULL,              -- 删除时间
    [asp_print] int NULL                        -- 打印次数
);
END;
GO

-- ----------------------------------------------------------------------------
-- permission —— 老系统 用户×画面 读写权限明细（USERID/MODULE1/RW，GROP=分组），现由 yj_user/yj_role/yj_role_panel 取代
-- HSDZ_MES_0909 实测行数：1529
-- ----------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.permission', N'U') IS NULL
BEGIN
CREATE TABLE dbo.[permission] (
    [COMM] nvarchar(20) NOT NULL,               -- 公司
    [ID] int IDENTITY(1,1) NOT NULL,
    [USERID] nvarchar(20) NOT NULL,
    [MODULE1] nvarchar(20) NOT NULL,
    [RW] nvarchar(10) NOT NULL,
    [MODULE_NA] nvarchar(20) NULL,
    [GROP] nvarchar(40) NULL,                   -- 系统画面
    [REMARK] nvarchar(200) NULL,                -- 备注
    [asp_user1] nvarchar(20) NULL,              -- 创建人
    [asp_time1] datetime2(7) NULL,              -- 创建时间
    [asp_user2] nvarchar(20) NULL,              -- 最后修改人
    [asp_time2] datetime2(7) NULL,              -- 最后修改时间
    [asp_user3] nvarchar(20) NULL,              -- 审核人
    [asp_time3] datetime2(7) NULL,              -- 审核时间
    [asp_cancel] nvarchar(1) NULL,              -- 删除标记
    [asp_user4] nvarchar(20) NULL,              -- 删除人
    [asp_time4] datetime2(7) NULL,              -- 删除时间
    [asp_print] int NULL                        -- 打印次数
);
END;
GO

-- ----------------------------------------------------------------------------
-- s_commdata —— 老移动端推送通知记录：接收手机号(JSZ)/发送者(FSZ)/提示音(SYWJ)/已读标志(YDF)/阅读时间(YDSJ)
-- HSDZ_MES_0909 实测行数：712
-- ----------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.s_commdata', N'U') IS NULL
BEGIN
CREATE TABLE dbo.[s_commdata] (
    [COMM] nvarchar(20) NOT NULL,               -- 公司代号
    [ID] int IDENTITY(1,1) NOT NULL,
    [JSZ] nvarchar(18) NOT NULL,                -- 接收者
    [XC] int NOT NULL,                          -- 项次
    [SZSJ] datetime2(7) NOT NULL,               -- 上载时间
    [JBXX] nvarchar(100) NULL,                  -- 基本信息
    [ZDYXX] nvarchar(250) NULL,                 -- 自定义信息
    [DSFS] tinyint NULL,                        -- 定时发送
    [FCSJ] datetime2(7) NULL,                   -- 发出时间
    [YDSJ] datetime2(7) NULL,                   -- 阅读时间
    [TXF] tinyint NULL,                         -- 提醒否
    [YDF] tinyint NULL,                         -- 已读否
    [FSZ] nvarchar(18) NULL,                    -- 发送者
    [CTMC] nvarchar(50) NULL,                   -- 窗体名称
    [KEY] nvarchar(20) NULL,                    -- 主KEY
    [KEYZ] nvarchar(20) NULL,                   -- 主KEY值
    [SYWJ] nvarchar(20) NULL,                   -- 提示的声音文件
    [REMARK] nvarchar(255) NULL,                -- 备注
    [asp_user1] nvarchar(20) NULL,              -- 创建人
    [asp_time1] datetime2(7) NULL,              -- 创建时间
    [asp_user2] nvarchar(20) NULL,              -- 最后修改人
    [asp_time2] datetime2(7) NULL,              -- 最后修改时间
    [asp_user3] nvarchar(20) NULL,              -- 审核人
    [asp_time3] datetime2(7) NULL,              -- 审核时间
    [asp_cancel] nvarchar(1) NULL,              -- 删除标记
    [asp_user4] nvarchar(20) NULL,              -- 删除人
    [asp_time4] datetime2(7) NULL,              -- 删除时间
    [asp_print] int NULL                        -- 打印次数
);
END;
GO

-- ----------------------------------------------------------------------------
-- s_sys —— 老面板引擎的「画面字段元数据表」= yj_field 的前身：241 个画面，含 CHS/CHT/ENG/OTH 四语标签（老字段中文名+多语言译名的唯一存底）
-- HSDZ_MES_0909 实测行数：5660
-- ----------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.s_sys', N'U') IS NULL
BEGIN
CREATE TABLE dbo.[s_sys] (
    [COMM] nvarchar(20) NOT NULL,               -- 注册公司代号
    [ID] int IDENTITY(1,1) NOT NULL,            -- ID
    [SYSMENUNO] nvarchar(50) NULL,              -- 画面代号
    [MC] nvarchar(20) NOT NULL,                 -- 名称
    [USERNA] nvarchar(20) NOT NULL,             -- 用户
    [XC] int NOT NULL,                          -- 项次
    [LANKD] int NULL,                           -- 栏宽
    [LB_LEFT] int NULL,                         -- 小数位数
    [LB_TOP] int NULL,                          -- 上坐标
    [LB_WI] int NULL,                           -- 宽度
    [LB_HI] int NULL,                           -- 高度
    [LB_TAB] nchar(1) NULL,                     -- TAB
    [LB_YN] nchar(1) NULL,                      -- 是否标签
    [LB_TYPE] nvarchar(20) NULL,                -- 标签类别
    [LB_VALUE] nvarchar(20) NULL,               -- 取值内容
    [LB_LEN] int NULL,                          -- 字段长度
    [DISP_ORDER] int NULL,                      -- 显示顺序
    [FILE_STR] nvarchar(50) NULL,               -- 字段
    [FLIE_NA] nvarchar(150) NULL,               -- 字段名
    [DISP_YN] nchar(1) NULL,                    -- 是否显示
    [KEY_YN] nchar(1) NULL,                     -- 主KEY
    [HEAD_YN] nchar(1) NULL,                    -- 是否表头字段
    [CHS] nvarchar(250) NULL,                   -- 简体
    [CHT] nvarchar(250) NULL,                   -- 繁体
    [ENG] nvarchar(250) NULL,                   -- 英文
    [OTH] nvarchar(250) NULL,                   -- 其他
    [BZ] nvarchar(250) NULL,                    -- 标题
    [GMF] nvarchar(1) NULL,                     -- 购买否
    [GROP] nvarchar(40) NULL,                   -- 模组
    [ISDOUBLE] nchar(1) NULL,                   -- 是否小数
    [ISDATE] nchar(1) NULL,                     -- 是日期
    [REMARK] nvarchar(255) NULL,                -- 备注
    [VER] nvarchar(5) NULL,                     -- 版本号
    [control] nvarchar(250) NULL,               -- 控制器名
    [Listna] nvarchar(250) NULL,                -- 页面名
    [Cur_Lang] nvarchar(10) NULL,               -- 当前语言
    [asp_user1] nvarchar(20) NULL,              -- 创建人
    [asp_time1] datetime2(7) NULL,              -- 创建时间
    [asp_user2] nvarchar(20) NULL,              -- 最后修改人
    [asp_time2] datetime2(7) NULL,              -- 最后修改时间
    [asp_user3] nvarchar(20) NULL,              -- 审核人
    [asp_time3] datetime2(7) NULL,              -- 审核时间
    [asp_cancel] nvarchar(1) NULL,              -- 删除标记
    [asp_user4] nvarchar(20) NULL,              -- 删除人
    [asp_time4] datetime2(7) NULL,              -- 删除时间
    [asp_print] int NULL                        -- 打印次数
);
END;
GO

-- ----------------------------------------------------------------------------
-- s_xtcs —— 老系统参数（报工自动打印/是否允许负库存/报工前必须领料/税额小数位…），现由 yj_app_setting 承接
-- HSDZ_MES_0909 实测行数：14
-- ----------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.s_xtcs', N'U') IS NULL
BEGIN
CREATE TABLE dbo.[s_xtcs] (
    [comm] nvarchar(20) NOT NULL,               -- 公司
    [id] int IDENTITY(1,1) NOT NULL,
    [dm] nvarchar(15) NULL,                     -- 代码
    [mc] nvarchar(20) NULL,                     -- 参数名称
    [sm] nvarchar(50) NULL,                     -- 参数说明
    [value] nvarchar(30) NULL,                  -- 参数值
    [bz] nvarchar(255) NULL,                    -- 备注
    [asp_user1] nvarchar(20) NULL,              -- 创建人
    [asp_time1] datetime2(7) NULL,              -- 创建时间
    [asp_user2] nvarchar(20) NULL,              -- 最后修改人
    [asp_time2] datetime2(7) NULL,              -- 最后修改时间
    [asp_user3] nvarchar(20) NULL,              -- 审核人
    [asp_time3] datetime2(7) NULL,              -- 审核时间
    [asp_cancel] nvarchar(1) NULL,              -- 删除标记
    [asp_user4] nvarchar(20) NULL,              -- 删除人
    [asp_time4] datetime2(7) NULL,              -- 删除时间
    [asp_print] int NULL                        -- 打印次数
);
END;
GO

-- ============================================================================
-- 已知注释疑点（本文件保留原始注释不改写，仅在此备注）
--   1) dm_langue 的表注释「语言（作废）」—— 错。实测 frm 是微信ID/手机号（长度 11~28）、
--      lb_wi 是在线标志（15 行全为 1）、asp_time1 是登录时间 ⇒ 真身是微信/移动端在线用户表。
--      本文件表头已按事实注明。
--   2) s_sys.LB_LEFT 的注释「小数位数」—— 与同组 LB_TOP/LB_WI/LB_HI（上坐标/宽度/高度）不搭，
--      且实测取值 0~200，更像「左坐标」；疑为 deploy/sync-db-comments.sql 的错位注释。
--      本文件按原样保留该注释，仅此备注，未擅自改写。
-- ============================================================================
