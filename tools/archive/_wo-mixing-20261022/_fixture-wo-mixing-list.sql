/* _fixture-wo-mixing-list.sql —— 仅用于 HSDZ_MES_TEST 的本地验证假数据(2026-10-22)
   目的:本地正式库与测试库都没有 wo_mixing_list（它只在服务器上），
         用一张"形状最接近"的样表验证 migrate-wo-mixing-list-20261022.sql 的自适应逻辑。
   ⚠ 真数据在服务器；本表是**演示/验证用假数据**，不参与任何部署。
   执行：SqlRunner（见 tools/archive/_wo-mixing-20261022/README.md） */
SET NOCOUNT ON;
IF DB_NAME() <> N'HSDZ_MES_TEST' THROW 51000, N'本 fixture 只允许在 HSDZ_MES_TEST 执行。', 1;

IF OBJECT_ID(N'dbo.wo_mixing_list', N'U') IS NULL
CREATE TABLE dbo.wo_mixing_list (
    id              bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_wo_mixing_list PRIMARY KEY,
    混料报工单号    nvarchar(120) NULL,
    工单号          nvarchar(120) NULL,
    工单行号        int NULL,
    配方单号        nvarchar(120) NULL,
    配方版本        nvarchar(60)  NULL,
    产品编号        nvarchar(200) NULL,
    产品名称        nvarchar(400) NULL,
    混料数量        decimal(18,4) NULL,
    单位            nvarchar(40)  NULL,
    状态            nvarchar(20)  NULL,
    批次号          nvarchar(80)  NULL,
    序号            nvarchar(40)  NULL,
    物料种类        nvarchar(100) NULL,
    物料编号        nvarchar(120) NULL,
    物料名称        nvarchar(200) NULL,
    配料比          decimal(18,6) NULL,
    单支物料含量    decimal(18,6) NULL,
    设计添加量      nvarchar(100) NULL,
    计划用量        decimal(18,4) NULL,
    实际用量        decimal(18,4) NULL,
    操作人          nvarchar(80)  NULL,
    创建时间        datetime2     NULL CONSTRAINT DF_wo_mixing_list_创建时间 DEFAULT (SYSDATETIME()),
    asp_user1       nvarchar(80)  NULL,
    asp_time1       datetime2     NULL CONSTRAINT DF_wo_mixing_list_asp_time1 DEFAULT (SYSDATETIME()),
    asp_user2       nvarchar(80)  NULL,
    asp_time2       datetime2     NULL,
    asp_cancel      char(1)       NULL CONSTRAINT DF_wo_mixing_list_asp_cancel DEFAULT ('N')
);

IF EXISTS (SELECT 1 FROM sys.extended_properties
           WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.wo_mixing_list')
             AND minor_id = 0 AND name = N'MS_Description')
    EXEC sys.sp_updateextendedproperty N'MS_Description',
        N'【本地验证假数据】混料记录展平样表：一 = 一个混料行(工单+配方快照+物料投料)。真数据在服务器。',
        N'SCHEMA', N'dbo', N'TABLE', N'wo_mixing_list';
ELSE
    EXEC sys.sp_addextendedproperty N'MS_Description',
        N'【本地验证假数据】混料记录展平样表：一 = 一个混料行(工单+配方快照+物料投料)。真数据在服务器。',
        N'SCHEMA', N'dbo', N'TABLE', N'wo_mixing_list';

IF NOT EXISTS (SELECT 1 FROM dbo.wo_mixing_list)
INSERT INTO dbo.wo_mixing_list
  (混料报工单号, 工单号, 工单行号, 配方单号, 配方版本, 产品编号, 产品名称, 混料数量, 单位, 状态, 批次号,
   序号, 物料种类, 物料编号, 物料名称, 配料比, 单支物料含量, 设计添加量, 计划用量, 实际用量, 操作人)
VALUES
 (N'HL-2026-10-0001', N'GD2026100001', 1, N'CP-MB-RO-01', N'V1.2', N'WL-CB-001', N'阻垢炭棒(10寸)', 5000, N'支', N'已报工',
  N'PC20261022001', N'1', N'主料', N'WL-FL-0001', N'阻垢颗粒料', 0.720000, 0.420000, N'2100g', 2100.0000, 2098.5000, N'张伟'),
 (N'HL-2026-10-0001', N'GD2026100001', 1, N'CP-MB-RO-01', N'V1.2', N'WL-CB-001', N'阻垢炭棒(10寸)', 5000, N'支', N'已报工',
  N'PC20261022001', N'2', N'辅料', N'WL-FL-0002', N'活性炭粉', 0.180000, 0.105000, N'525g', 525.0000, 526.2000, N'李娜'),
 (N'HL-2026-10-0001', N'GD2026100001', 1, N'CP-MB-RO-01', N'V1.2', N'WL-CB-001', N'阻垢炭棒(10寸)', 5000, N'支', N'已报工',
  N'PC20261022001', N'3', N'辅料', N'WL-FL-0003', N'食品级粘结剂', 0.100000, 0.058000, N'290g', 290.0000, 288.0000, N'王强');

SELECT COUNT(*) AS 假数据行数 FROM dbo.wo_mixing_list;
PRINT N'RESULT: FIXTURE-OK';
