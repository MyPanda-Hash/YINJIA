/* _fixture-wo-mixing-list.sql —— 测试账套(HSDZ_MES_TEST)的「混料记录」样表
   2026-10-22 第二版：结构与数据**取自服务器备份的真实表**（HSDZ_MES-manual-20261021-184953.bak，
   还原到临时库后读出 dbo.wo_mixing_list：27 列 + 8 行，均为 2026-10-21 08:04~08:13 真实落库的数据）。

   为什么要这份 fixture：本地正式库/测试库都没有这张表（它只在服务器上）。
   测试账套里放一份**同结构、同数据**的副本，才能：
     ① 本地验证迁移脚本/面板配置；
     ② 截图给业务确认「装完长这样」；
     ③ 提前发现列宽/类型/合计行的坑。
   ⚠ 服务器上的真表由服务端维护，本 fixture 只是副本，不参与任何部署。
   执行：只允许 HSDZ_MES_TEST。 */
SET NOCOUNT ON;
IF DB_NAME() <> N'HSDZ_MES_TEST' THROW 51000, N'本 fixture 只允许在 HSDZ_MES_TEST 执行。', 1;

-- 丢掉上一版凭猜测造的样表（列名不同，不能复用）
IF OBJECT_ID(N'dbo.wo_mixing_list', N'U') IS NOT NULL DROP TABLE dbo.wo_mixing_list;
GO

CREATE TABLE dbo.wo_mixing_list (
    id              bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_wo_mixing_list PRIMARY KEY,
    单据编号        nvarchar(60)  NULL,
    工单号          nvarchar(60)  NULL,
    工单行id        bigint        NULL,
    工单行号        int           NULL,
    配方单号        nvarchar(60)  NULL,
    配方版本        nvarchar(30)  NULL,
    序号            nvarchar(20)  NULL,
    物料种类        nvarchar(50)  NULL,
    物料编号        nvarchar(60)  NULL,
    物料名称        nvarchar(100) NULL,
    配料比          decimal(18,8) NULL CONSTRAINT DF_wo_mixing_list_配料比   DEFAULT ((0)),
    单支物料含量    decimal(18,8) NULL,
    设计添加量      decimal(18,8) NULL CONSTRAINT DF_wo_mixing_list_设计添加量 DEFAULT ((0)),
    计划用量        decimal(18,8) NULL CONSTRAINT DF_wo_mixing_list_计划用量 DEFAULT ((0)),
    实际用量        decimal(18,8) NULL CONSTRAINT DF_wo_mixing_list_实际用量 DEFAULT ((0)),
    标记            nvarchar(30)  NULL,
    asp_user1       nvarchar(20)  NULL CONSTRAINT DF_wo_mixing_list_asp_user1 DEFAULT (N''),
    asp_time1       datetime      NULL CONSTRAINT DF_wo_mixing_list_asp_time1_1 DEFAULT (GETDATE()),
    asp_user2       nvarchar(20)  NULL CONSTRAINT DF_wo_mixing_list_asp_user2 DEFAULT (N''),
    asp_time2       datetime      NULL,
    asp_user3       nvarchar(20)  NULL CONSTRAINT DF_wo_mixing_list_asp_user3 DEFAULT (N''),
    asp_time3       datetime      NULL,
    asp_cancel      varchar(1)    NULL CONSTRAINT DF_wo_mixing_list_asp_cancel DEFAULT ('N'),
    asp_user4       nvarchar(20)  NULL CONSTRAINT DF_wo_mixing_list_asp_user4 DEFAULT (N''),
    asp_time4       datetime      NULL,
    asp_print       int           NULL CONSTRAINT DF_wo_mixing_list_asp_print DEFAULT ((0))
);
GO

IF EXISTS (SELECT 1 FROM sys.extended_properties
           WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.wo_mixing_list')
             AND minor_id = 0 AND name = N'MS_Description')
    EXEC sys.sp_updateextendedproperty N'MS_Description',
        N'【测试账套副本】混料记录行表（服务器 wo_mixing_list 的真实结构+真实 8 行，2026-10-21 备份读出）',
        N'SCHEMA', N'dbo', N'TABLE', N'wo_mixing_list';
ELSE
    EXEC sys.sp_addextendedproperty N'MS_Description',
        N'【测试账套副本】混料记录行表（服务器 wo_mixing_list 的真实结构+真实 8 行，2026-10-21 备份读出）',
        N'SCHEMA', N'dbo', N'TABLE', N'wo_mixing_list';

/* 服务器上的真实 8 行（原样搬过来：包含 5 行重复行、2 行未保存的草稿行 —— 那是真实数据本来的样子，
   不做任何"清洗"，否则截图会骗人） */
INSERT INTO dbo.wo_mixing_list
  (单据编号, 工单号, 工单行id, 工单行号, 配方单号, 配方版本, 序号, 物料种类, 物料编号, 物料名称,
   配料比, 单支物料含量, 设计添加量, 计划用量, 实际用量, 标记, asp_user1, asp_time1, asp_user3, asp_cancel)
VALUES
 (N'PL2610210002', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  0, NULL, 0, 1, 0, N'Y', N'Admin', '2026-10-21 08:04:19', N'Admin', 'N'),
 (N'PL2610210002', N'GD-2026-10-0089', 0, 3, N'CS0001', NULL, N'1', NULL, N'YJ-TJHZ-001', N'雅可比CS(80-200)',
  0, 0.086, 0, 1, 0.39, N'Y', N'Admin', '2026-10-21 08:04:19', N'Admin', 'N'),
 (N'PL2610210002', N'GD-2026-10-0089', 0, 3, N'CS0001', NULL, N'1', NULL, N'YJ-TJHZ-001', N'雅可比CS(80-200)',
  0, 0.086, 0, 1, 0.39, N'Y', N'Admin', '2026-10-21 08:04:19', N'Admin', 'N'),
 (N'PL2610210002', N'GD-2026-10-0089', 0, 3, N'CS0001', NULL, N'1', NULL, N'YJ-TJHZ-001', N'雅可比CS(80-200)',
  0, 0.086, 0, 1, 0.39, N'Y', N'Admin', '2026-10-21 08:04:19', N'Admin', 'N'),
 (N'PL2610210002', N'GD-2026-10-0089', 0, 3, N'CS0001', NULL, N'1', NULL, N'YJ-TJHZ-001', N'雅可比CS(80-200)',
  0, 0.086, 0, 1, 0.39, N'Y', N'Admin', '2026-10-21 08:04:19', N'Admin', 'N'),
 (N'PL2610210002', N'GD-2026-10-0089', 0, 3, N'CS0001', NULL, N'1', NULL, N'YJ-TJHZ-001', N'雅可比CS(80-200)',
  0, 0.086, 0, 1, 0.39, N'Y', N'Admin', '2026-10-21 08:04:19', N'Admin', 'N'),
 (NULL, N'GD-2026-10-0089', 0, 3, N'CS0001', NULL, N'1', NULL, N'YJ-TJHZ-001', N'雅可比CS(80-200)',
  0, 0.086, 0, 226.18, 0.39, N'N', N'Admin', '2026-10-21 08:09:57', NULL, 'N'),
 (NULL, N'GD-2026-10-0089', 0, 3, N'CS0001', NULL, N'2', NULL, N'YJ-YKRS-005', N'英克瑞斯椰完活性炭',
  0, 0.021, 0, 55.23, 0.39, N'N', N'Admin', '2026-10-21 08:13:09', NULL, 'N');

SELECT COUNT(*) AS 行数, COUNT(DISTINCT 单据编号) AS 单据数 FROM dbo.wo_mixing_list;
SELECT N'RESULT: FIXTURE-OK' AS 结果;
