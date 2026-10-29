/* 把 fixture 临时改成"没有 id 列的视图"，验证迁移脚本的包装视图分支 */
SET NOCOUNT ON;
IF DB_NAME() <> N'HSDZ_MES_TEST' THROW 51000, N'只允许在 HSDZ_MES_TEST 执行。', 1;
IF OBJECT_ID(N'dbo.wo_mixing_list', N'U') IS NOT NULL
    EXEC sp_rename N'dbo.wo_mixing_list', N'wo_mixing_list_src';
GO
IF OBJECT_ID(N'dbo.wo_mixing_list', N'V') IS NULL
EXEC(N'CREATE VIEW dbo.wo_mixing_list AS
SELECT 混料报工单号, 工单号, 工单行号, 配方单号, 配方版本, 产品编号, 产品名称, 混料数量, 单位, 状态,
       批次号, 序号, 物料种类, 物料编号, 物料名称, 配料比, 单支物料含量, 设计添加量, 计划用量, 实际用量,
       操作人, 创建时间, asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel
  FROM dbo.wo_mixing_list_src;');
GO
SELECT name, type_desc FROM sys.objects WHERE name LIKE N'wo_mixing_list%' ORDER BY name;
PRINT N'RESULT: SWITCHED-TO-VIEW-NO-ID';
