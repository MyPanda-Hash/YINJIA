/* ============================================================================
 * 采购订单「打印记录」——报表打印的留痕与重打(2026-11-07)
 * ----------------------------------------------------------------------------
 * 用户口径:「弹窗有对已经打印的做记录吗」→ 选 A:「像材料码那样」:
 *   每次打印存一份快照(版式 / 勾了哪几行 / 每行本次数量 / 合计 / 打印人 / 时间),
 *   弹窗底部列出来,可**重打**(原样再出纸、打印次数+1),可**作废**(只作废这张纸)。
 *
 * 为什么不复用材料码的 bd_pu_label / bl_pu_label:
 *   材料码表是「批次号登记 + 预约数量」——一张单 = 一个批次号,打印即占量,作废要释放预约;
 *   本表是**报表打印快照**——一次打印 = 一组"哪几行 × 各自数量",不占用订单余量。
 *   混用会让材料码的预约口径被报表打印污染(不可接受),故单独成对建表。
 *
 * 两张表(《数据库规范》§0.1 硬规矩 3:单据必须 bd_ 头 + bl_ 行成对;中文列名;
 *   bigint identity 主键;齐头 asp_user1/2 + asp_time1/2 + asp_cancel nvarchar(1)):
 *   bd_pu_print — 头:一次打印一行(单号 MP-yyyy-MM-nnnn / 采购订单号 / 版式 / 打印人 / 时间 / 次数 / 合计)
 *   bl_pu_print — 行:该次打印落纸的每一行(订单行id / 行号 / 物料快照 / 订单数量 / 打印数量 / 单价 / 小计 / 交期 / 备注)
 *
 * 口径(服务端 PuPrintService 同源实现):
 *   · 每次「确定并打印」= 新增 1 条头 + N 条行(**新快照,不覆盖旧记录**);
 *   · 重打 = 同一张头原样再打,只把 打印次数 +1,不新增记录;
 *   · 作废 = 软删(asp_cancel='Y'),只是"这张纸作废";报表不占用订单量 ⇒ **没有预约要释放**;
 *   · **不建面板**(沿用材料码两表口径):不插 yj_panel/yj_field、不进菜单、不配权限,
 *     只在采购订单打印弹窗里反查;权限 = 内部账号按 PU_ORDER 权、供应商按逐单归属。
 *
 * ⚠ 注释里不要写「斜杠+星号」相邻的组合:T-SQL 块注释可嵌套,v3.78 踩过。
 * ========================================================================== */

SET NOCOUNT ON;
GO

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
GO

/* ---------- ① 头表:一次打印一行 ---------- */
IF OBJECT_ID(N'dbo.bd_pu_print') IS NULL
CREATE TABLE dbo.bd_pu_print (
    id           bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_bd_pu_print PRIMARY KEY,
    [单据编号]   nvarchar(40)  NOT NULL,
    [单据日期]   date          NOT NULL,
    [采购订单号] nvarchar(200) NOT NULL,
    [供应商编码] nvarchar(100) NULL,
    [打印版式]   nvarchar(20)  NOT NULL CONSTRAINT df_bd_pu_print_fmt DEFAULT N'有金额',
    [打印人]     nvarchar(50)  NULL,
    [打印时间]   datetime2     NULL,
    [打印次数]   int           NOT NULL CONSTRAINT df_bd_pu_print_times DEFAULT 0,
    [行数]       int           NOT NULL CONSTRAINT df_bd_pu_print_rows DEFAULT 0,
    [数量合计]   decimal(18,4) NOT NULL CONSTRAINT df_bd_pu_print_qty DEFAULT 0,
    [金额合计]   decimal(18,4) NULL,
    [备注]       nvarchar(500) NULL,
    asp_user1    nvarchar(50)  NULL,
    asp_time1    datetime2     NULL,
    asp_user2    nvarchar(50)  NULL,
    asp_time2    datetime2     NULL,
    asp_cancel   nvarchar(1)   NOT NULL CONSTRAINT df_bd_pu_print_cancel DEFAULT N'N'
);
GO

/* ---------- ② 行表:该次打印落纸的每一行(快照) ---------- */
IF OBJECT_ID(N'dbo.bl_pu_print') IS NULL
CREATE TABLE dbo.bl_pu_print (
    id             bigint IDENTITY(1,1) NOT NULL CONSTRAINT pk_bl_pu_print PRIMARY KEY,
    [单据编号]     nvarchar(40)   NOT NULL,
    [采购订单行id] int            NULL,
    [行号]         nvarchar(50)   NULL,
    [物料编码]     nvarchar(100)  NULL,
    [物料名称]     nvarchar(200)  NULL,
    [规格型号]     nvarchar(200)  NULL,
    [单位]         nvarchar(50)   NULL,
    [订单数量]     decimal(18,4)  NULL,
    [打印数量]     decimal(18,4)  NOT NULL CONSTRAINT df_bl_pu_print_qty DEFAULT 0,
    [单价]         decimal(18,4)  NULL,
    [小计]         decimal(18,4)  NULL,
    [税率%]        decimal(18,4)  NULL,
    [交期要求]     nvarchar(50)   NULL,
    [备注]         nvarchar(500)  NULL,
    asp_user1      nvarchar(50)   NULL,
    asp_time1      datetime2      NULL,
    asp_user2      nvarchar(50)   NULL,
    asp_time2      datetime2      NULL,
    asp_cancel     nvarchar(1)    NOT NULL CONSTRAINT df_bl_pu_print_cancel DEFAULT N'N'
);
GO

/* ---------- ③ 补列(兼容首版已建表的库:税率% 用于重打时还原「是否含税」) ---------- */
IF COL_LENGTH(N'dbo.bl_pu_print', N'税率%') IS NULL
    ALTER TABLE dbo.bl_pu_print ADD [税率%] decimal(18,4) NULL;
GO

/* ---------- ④ 索引 ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_bd_pu_print_no' AND object_id = OBJECT_ID(N'dbo.bd_pu_print'))
    CREATE UNIQUE INDEX uq_bd_pu_print_no ON dbo.bd_pu_print ([单据编号]);
GO
-- 弹窗反查:某张采购订单的打印记录(只查存活行)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_bd_pu_print_order' AND object_id = OBJECT_ID(N'dbo.bd_pu_print'))
    CREATE INDEX ix_bd_pu_print_order ON dbo.bd_pu_print ([采购订单号], [打印时间] DESC) WHERE asp_cancel = N'N';
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_bl_pu_print_doc' AND object_id = OBJECT_ID(N'dbo.bl_pu_print'))
    CREATE INDEX ix_bl_pu_print_doc ON dbo.bl_pu_print ([单据编号]) WHERE asp_cancel = N'N';
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_bl_pu_print_line' AND object_id = OBJECT_ID(N'dbo.bl_pu_print'))
    CREATE INDEX ix_bl_pu_print_line ON dbo.bl_pu_print ([采购订单行id], [单据编号]);
GO

/* ---------- ④ 表 + 关键列中文注明(幂等:已有则不覆盖) ---------- */
DECLARE @c TABLE (tbl sysname, col sysname, txt nvarchar(400));
INSERT INTO @c (tbl, col, txt) VALUES
  (N'bd_pu_print', N'__TABLE__', N'采购订单打印记录(头):一次报表打印一行 = 采购订单号 + 版式(有金额/无金额) + 打印人/时间/次数 + 行数/数量合计/金额合计;重打只累加打印次数,不新增记录;作废仅软删(报表不占用订单量,无预约可释放)'),
  (N'bd_pu_print', N'单据编号',   N'打印记录单号:MP-yyyy-MM-nnnn(FormNoService 走 s_allno 号池)'),
  (N'bd_pu_print', N'单据日期',   N'打印日期(当天)'),
  (N'bd_pu_print', N'采购订单号', N'来源采购订单号(bd_pu_order.单据编号);与供应商打印面板同源,弹窗按它反查本单历史打印'),
  (N'bd_pu_print', N'供应商编码', N'打印时的供应商编码快照(订单编码后续可能被改,打印事实以快照为准)'),
  (N'bd_pu_print', N'打印版式',   N'报表版式:有金额 / 无金额(对应 print-formats 的两个采购订单版式)'),
  (N'bd_pu_print', N'打印人',     N'最近一次打印操作人'),
  (N'bd_pu_print', N'打印时间',   N'最近一次打印时间(重打会刷新)'),
  (N'bd_pu_print', N'打印次数',   N'累计打印次数(首次=1,重打+1;便于追溯"这张报表打过几次")'),
  (N'bd_pu_print', N'行数',       N'本次落纸的明细行数'),
  (N'bd_pu_print', N'数量合计',   N'本次落纸的数量合计(按勾选行与本次打印数量重算)'),
  (N'bd_pu_print', N'金额合计',   N'本次落纸的金额合计(有金额版式才有;无金额版式为 NULL)'),
  (N'bd_pu_print', N'备注',       N'备注(预留)'),
  (N'bl_pu_print', N'__TABLE__',  N'采购订单打印记录(行):该次打印落纸的每一行快照 —— 订单行id/行号/物料/订单数量/本次打印数量/单价/小计/交期/备注;改过数量的行小计=单价×数量,没改的沿用订单原金额'),
  (N'bl_pu_print', N'单据编号',   N'所属打印记录单号(bd_pu_print.单据编号)'),
  (N'bl_pu_print', N'采购订单行id', N'采购订单行 id(锚:bl_pu_order.id;重打按它回填,行被删也能按快照原样出纸)'),
  (N'bl_pu_print', N'行号',       N'采购订单行号(展示用)'),
  (N'bl_pu_print', N'物料编码',   N'物料编码(打印时快照)'),
  (N'bl_pu_print', N'物料名称',   N'物料名称(打印时快照)'),
  (N'bl_pu_print', N'规格型号',   N'规格型号(打印时快照)'),
  (N'bl_pu_print', N'单位',       N'单位(打印时快照)'),
  (N'bl_pu_print', N'订单数量',   N'订单数量(打印时快照,与本次打印数量对照)'),
  (N'bl_pu_print', N'打印数量',   N'本次打印数量(弹窗里填的那个数;纸上「数量」列印它)'),
  (N'bl_pu_print', N'单价',       N'单价(打印时快照;无金额版式也为空)'),
  (N'bl_pu_print', N'小计',       N'落纸小计:改过数量=单价×数量(4位),没改=订单原金额(含折扣/分摊时的原值)'),
  (N'bl_pu_print', N'税率%',      N'税率快照(纸面「是否含税」按行税率是否>0 判定;重打据此还原)'),
  (N'bl_pu_print', N'交期要求',   N'落纸「交期要求」列(行预计到货日期,缺省取订单交货日期)'),
  (N'bl_pu_print', N'备注',       N'落纸「备注」列(打印时快照)');

DECLARE @t sysname, @col sysname, @txt nvarchar(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col, txt FROM @c;
OPEN cur;
FETCH NEXT FROM cur INTO @t, @col, @txt;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF @col = N'__TABLE__'
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                       WHERE major_id = OBJECT_ID(N'dbo.' + @t) AND minor_id = 0 AND name = N'MS_Description')
            EXEC sp_addextendedproperty N'MS_Description', @txt, N'SCHEMA', N'dbo', N'TABLE', @t;
    END
    ELSE IF COL_LENGTH(N'dbo.' + @t, @col) IS NOT NULL
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                       WHERE major_id = OBJECT_ID(N'dbo.' + @t)
                         AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @t), @col, 'ColumnId')
                         AND name = N'MS_Description')
            EXEC sp_addextendedproperty N'MS_Description', @txt, N'SCHEMA', N'dbo', N'TABLE', @t, N'COLUMN', @col;
    END
    FETCH NEXT FROM cur INTO @t, @col, @txt;
END
CLOSE cur;
DEALLOCATE cur;
GO

/* ---------- ⑤ 收尾自检(不过即报错,脚本不登记) ---------- */
IF OBJECT_ID(N'dbo.bd_pu_print') IS NULL OR OBJECT_ID(N'dbo.bl_pu_print') IS NULL
    THROW 50001, N'自检失败:bd_pu_print / bl_pu_print 未建', 1;
IF (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.bd_pu_print')) < 17
    THROW 50002, N'自检失败:bd_pu_print 列数不足', 1;
IF (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.bl_pu_print')) < 19
    THROW 50003, N'自检失败:bl_pu_print 列数不足', 1;
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_pu_print') AND minor_id = 0 AND name = N'MS_Description') = 0
    THROW 50004, N'自检失败:bd_pu_print 缺表级中文注明', 1;
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_pu_print') AND minor_id = 0 AND name = N'MS_Description') = 0
    THROW 50005, N'自检失败:bl_pu_print 缺表级中文注明', 1;
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_pu_print') AND minor_id > 0 AND name = N'MS_Description') < 10
    THROW 50006, N'自检失败:bd_pu_print 列级中文注明不足', 1;
IF (SELECT COUNT(*) FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_pu_print') AND minor_id > 0 AND name = N'MS_Description') < 10
    THROW 50007, N'自检失败:bl_pu_print 列级中文注明不足', 1;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_bd_pu_print_no' AND object_id = OBJECT_ID(N'dbo.bd_pu_print'))
    THROW 50008, N'自检失败:缺唯一索引 uq_bd_pu_print_no', 1;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_bd_pu_print_order' AND object_id = OBJECT_ID(N'dbo.bd_pu_print'))
    THROW 50009, N'自检失败:缺索引 ix_bd_pu_print_order', 1;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_bl_pu_print_doc' AND object_id = OBJECT_ID(N'dbo.bl_pu_print'))
    THROW 50010, N'自检失败:缺索引 ix_bl_pu_print_doc', 1;
PRINT N'[OK] bd_pu_print / bl_pu_print 建表 + 注明 + 索引自检通过';
GO
