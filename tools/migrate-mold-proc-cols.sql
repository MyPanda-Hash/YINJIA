-- migrate-mold-proc-cols.sql — 成型工艺清单:结构性标签补物理列(允许 NULL,仅为查询兼容)
SET NOCOUNT ON;
GO
BEGIN TRY
IF COL_LENGTH('rd_mold_proc_head', '炭棒规格') IS NULL ALTER TABLE rd_mold_proc_head ADD [炭棒规格] nvarchar(100) NULL;
IF COL_LENGTH('rd_mold_proc_head', '工序') IS NULL ALTER TABLE rd_mold_proc_head ADD [工序] nvarchar(50) NULL;
IF COL_LENGTH('rd_mold_proc_head', '工序管控要求') IS NULL ALTER TABLE rd_mold_proc_head ADD [工序管控要求] nvarchar(100) NULL;
IF COL_LENGTH('rd_mold_proc_head', '灌料') IS NULL ALTER TABLE rd_mold_proc_head ADD [灌料] nvarchar(50) NULL;
IF COL_LENGTH('rd_mold_proc_head', '烧结') IS NULL ALTER TABLE rd_mold_proc_head ADD [烧结] nvarchar(50) NULL;
IF COL_LENGTH('rd_mold_proc_head', '烧结时间/调速器参数') IS NULL ALTER TABLE rd_mold_proc_head ADD [烧结时间/调速器参数] nvarchar(100) NULL;
IF COL_LENGTH('rd_mold_proc_head', '热压') IS NULL ALTER TABLE rd_mold_proc_head ADD [热压] nvarchar(50) NULL;
IF COL_LENGTH('rd_mold_proc_head', '冷却') IS NULL ALTER TABLE rd_mold_proc_head ADD [冷却] nvarchar(50) NULL;
IF COL_LENGTH('rd_mold_proc_head', '脱模') IS NULL ALTER TABLE rd_mold_proc_head ADD [脱模] nvarchar(50) NULL;
IF COL_LENGTH('rd_mold_proc_head', '炭棒尺寸') IS NULL ALTER TABLE rd_mold_proc_head ADD [炭棒尺寸] nvarchar(50) NULL;
IF COL_LENGTH('rd_mold_proc_head', '密度管控') IS NULL ALTER TABLE rd_mold_proc_head ADD [密度管控] nvarchar(50) NULL;
IF COL_LENGTH('rd_mold_proc_head', '管控要求') IS NULL ALTER TABLE rd_mold_proc_head ADD [管控要求] nvarchar(50) NULL;
IF COL_LENGTH('rd_mold_proc_head', '跌落强度') IS NULL ALTER TABLE rd_mold_proc_head ADD [跌落强度] nvarchar(50) NULL;
IF COL_LENGTH('rd_mold_proc_head', '高度cm') IS NULL ALTER TABLE rd_mold_proc_head ADD [高度cm] nvarchar(50) NULL;
IF COL_LENGTH('rd_mold_proc_head', '要求') IS NULL ALTER TABLE rd_mold_proc_head ADD [要求] nvarchar(50) NULL;
IF COL_LENGTH('rd_mold_proc_head', '抗压强度') IS NULL ALTER TABLE rd_mold_proc_head ADD [抗压强度] nvarchar(50) NULL;
IF COL_LENGTH('rd_mold_proc_head', '压头下降速度mm/min') IS NULL ALTER TABLE rd_mold_proc_head ADD [压头下降速度mm/min] nvarchar(50) NULL;
IF COL_LENGTH('rd_mold_proc_head', '压降') IS NULL ALTER TABLE rd_mold_proc_head ADD [压降] nvarchar(50) NULL;
IF COL_LENGTH('rd_mold_proc_head', '测试管路') IS NULL ALTER TABLE rd_mold_proc_head ADD [测试管路] nvarchar(50) NULL;
IF COL_LENGTH('rd_mold_proc_head', '测试流速L/min') IS NULL ALTER TABLE rd_mold_proc_head ADD [测试流速L/min] nvarchar(50) NULL;
END TRY
BEGIN CATCH
  PRINT '加列跳过(无 DDL 权限)';
END CATCH
GO
PRINT N'成型工艺清单结构性标签物理列补齐完成';
GO