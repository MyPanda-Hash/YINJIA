-- 表结构重建(「成型检验单 QC_MOLD_INSP / 切炭检验单 QC_CUT_INSP / 成品检验规范 QC_FIN_SPEC」下架备份)
-- 来源库: jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true
-- 生成工具: tools/archive/_qc-drop3/_BackupQc3.java   备份时间: Fri Oct 16 02:03:25 GMT+08:00 2026
-- 回退:先跑 tables-ddl.sql 重建表,再跑 restore-metadata.sql 与 data.sql(全幂等由人工确认后执行)

IF OBJECT_ID(N'dbo.qc_mold_insp_head', N'U') IS NULL
CREATE TABLE dbo.[qc_mold_insp_head] (
  [id] bigint IDENTITY(1,1) NOT NULL,
  [单据编号] nvarchar(50) NOT NULL,
  [单据日期] date NULL,
  [工单号] nvarchar(50) NULL,
  [批次号] nvarchar(50) NULL,
  [报工单号] nvarchar(50) NULL,
  [工序] nvarchar(50) NULL,
  [产品编码] nvarchar(50) NULL,
  [产品名称] nvarchar(200) NULL,
  [规格型号] nvarchar(200) NULL,
  [生产线] nvarchar(50) NULL,
  [生产车间] nvarchar(50) NULL,
  [报工数量] decimal(18,4) NULL,
  [检验数量] decimal(18,4) NULL,
  [检验员] nvarchar(50) NULL,
  [检验日期] date NULL,
  [总结论] nvarchar(20) NULL,
  [处理方式] nvarchar(50) NULL,
  [备注] nvarchar(500) NULL,
  [审核人] nvarchar(50) NULL,
  [审核时间] datetime2 NULL,
  [asp_user1] nvarchar(50) NULL,
  [asp_time1] datetime2 NULL,
  [asp_user2] nvarchar(50) NULL,
  [asp_time2] datetime2 NULL,
  [asp_cancel] nvarchar(1) NULL DEFAULT (N'N'),
  [单据状态] nvarchar(20) NULL,
  [检验方案] nvarchar(200) NULL,
  [文件编码] nvarchar(50) NULL,
  [执行标准] nvarchar(200) NULL,
  [工单行号] int NULL
);
PRINT N'qc_mold_insp_head 就绪';
GO

IF OBJECT_ID(N'dbo.qc_mold_insp_detail', N'U') IS NULL
CREATE TABLE dbo.[qc_mold_insp_detail] (
  [id] bigint IDENTITY(1,1) NOT NULL,
  [单据编号] nvarchar(50) NOT NULL,
  [行号] int NULL,
  [检验项目] nvarchar(100) NULL,
  [检验要求] nvarchar(200) NULL,
  [实测数值] nvarchar(100) NULL,
  [判定] nvarchar(20) NULL,
  [数量] decimal(18,4) NULL,
  [处理方式] nvarchar(50) NULL,
  [备注] nvarchar(200) NULL,
  [asp_user1] nvarchar(50) NULL,
  [asp_time1] datetime2 NULL,
  [asp_user2] nvarchar(50) NULL,
  [asp_time2] datetime2 NULL,
  [asp_cancel] nvarchar(1) NULL DEFAULT (N'N'),
  [表区] nvarchar(50) NULL,
  [检验方法] nvarchar(1000) NULL,
  [合格数量] decimal(18,4) NULL,
  [不合格数量] decimal(18,4) NULL,
  [检查频率] nvarchar(50) NULL,
  [测量值1] decimal(18,4) NULL,
  [测量值2] decimal(18,4) NULL,
  [测量值3] decimal(18,4) NULL,
  [测量值4] decimal(18,4) NULL,
  [测量值5] decimal(18,4) NULL
);
PRINT N'qc_mold_insp_detail 就绪';
GO

IF OBJECT_ID(N'dbo.qc_cut_insp_head', N'U') IS NULL
CREATE TABLE dbo.[qc_cut_insp_head] (
  [id] bigint IDENTITY(1,1) NOT NULL,
  [单据编号] nvarchar(50) NOT NULL,
  [单据日期] date NULL,
  [工单号] nvarchar(50) NULL,
  [批次号] nvarchar(50) NULL,
  [报工单号] nvarchar(50) NULL,
  [工序] nvarchar(50) NULL,
  [产品编码] nvarchar(50) NULL,
  [产品名称] nvarchar(200) NULL,
  [规格型号] nvarchar(200) NULL,
  [生产线] nvarchar(50) NULL,
  [生产车间] nvarchar(50) NULL,
  [报工数量] decimal(18,4) NULL,
  [检验数量] decimal(18,4) NULL,
  [检验员] nvarchar(50) NULL,
  [检验日期] date NULL,
  [总结论] nvarchar(20) NULL,
  [处理方式] nvarchar(50) NULL,
  [备注] nvarchar(500) NULL,
  [审核人] nvarchar(50) NULL,
  [审核时间] datetime2 NULL,
  [asp_user1] nvarchar(50) NULL,
  [asp_time1] datetime2 NULL,
  [asp_user2] nvarchar(50) NULL,
  [asp_time2] datetime2 NULL,
  [asp_cancel] nvarchar(1) NULL DEFAULT (N'N'),
  [单据状态] nvarchar(20) NULL,
  [检验方案] nvarchar(200) NULL,
  [文件编码] nvarchar(50) NULL,
  [执行标准] nvarchar(200) NULL,
  [工单行号] int NULL
);
PRINT N'qc_cut_insp_head 就绪';
GO

IF OBJECT_ID(N'dbo.qc_cut_insp_detail', N'U') IS NULL
CREATE TABLE dbo.[qc_cut_insp_detail] (
  [id] bigint IDENTITY(1,1) NOT NULL,
  [单据编号] nvarchar(50) NOT NULL,
  [行号] int NULL,
  [检验项目] nvarchar(100) NULL,
  [检验要求] nvarchar(200) NULL,
  [实测数值] nvarchar(100) NULL,
  [判定] nvarchar(20) NULL,
  [数量] decimal(18,4) NULL,
  [处理方式] nvarchar(50) NULL,
  [备注] nvarchar(200) NULL,
  [asp_user1] nvarchar(50) NULL,
  [asp_time1] datetime2 NULL,
  [asp_user2] nvarchar(50) NULL,
  [asp_time2] datetime2 NULL,
  [asp_cancel] nvarchar(1) NULL DEFAULT (N'N'),
  [表区] nvarchar(50) NULL,
  [检验方法] nvarchar(1000) NULL,
  [合格数量] decimal(18,4) NULL,
  [不合格数量] decimal(18,4) NULL,
  [检查频率] nvarchar(50) NULL,
  [测量值1] decimal(18,4) NULL,
  [测量值2] decimal(18,4) NULL,
  [测量值3] decimal(18,4) NULL,
  [测量值4] decimal(18,4) NULL,
  [测量值5] decimal(18,4) NULL
);
PRINT N'qc_cut_insp_detail 就绪';
GO

IF OBJECT_ID(N'dbo.qc_fin_spec_head', N'U') IS NULL
CREATE TABLE dbo.[qc_fin_spec_head] (
  [id] bigint IDENTITY(1,1) NOT NULL,
  [单据编号] nvarchar(50) NOT NULL,
  [单据日期] date NULL,
  [文件编号] nvarchar(50) NULL,
  [文件名称] nvarchar(200) NULL,
  [版本版次] nvarchar(20) NULL,
  [管控状态] nvarchar(20) NULL,
  [发行日期] date NULL,
  [工单号] nvarchar(50) NULL,
  [报工单号] nvarchar(50) NULL,
  [产品编码] nvarchar(50) NULL,
  [产品名称] nvarchar(200) NULL,
  [规格型号] nvarchar(100) NULL,
  [批次号] nvarchar(50) NULL,
  [目的] nvarchar(1000) NULL,
  [范围] nvarchar(1000) NULL,
  [职责和权限] nvarchar(2000) NULL,
  [取样要求] nvarchar(1000) NULL,
  [工作程序] nvarchar(2000) NULL,
  [制定] nvarchar(50) NULL,
  [审核] nvarchar(50) NULL,
  [核准] nvarchar(50) NULL,
  [备注] nvarchar(500) NULL,
  [审核人] nvarchar(50) NULL,
  [审核时间] datetime2 NULL,
  [asp_user1] nvarchar(50) NULL,
  [asp_time1] datetime2 NULL,
  [asp_user2] nvarchar(50) NULL,
  [asp_time2] datetime2 NULL,
  [asp_cancel] nvarchar(1) NULL DEFAULT (N'N'),
  [单据状态] nvarchar(20) NULL
);
PRINT N'qc_fin_spec_head 就绪';
GO

IF OBJECT_ID(N'dbo.qc_fin_spec_detail', N'U') IS NULL
CREATE TABLE dbo.[qc_fin_spec_detail] (
  [id] bigint IDENTITY(1,1) NOT NULL,
  [单据编号] nvarchar(50) NOT NULL,
  [行号] int NULL,
  [表区] nvarchar(50) NULL,
  [检验对象] nvarchar(100) NULL,
  [版本] nvarchar(20) NULL,
  [修订理由与内容简述] nvarchar(500) NULL,
  [修订日期] date NULL,
  [拟定] nvarchar(50) NULL,
  [检验项目] nvarchar(100) NULL,
  [称料] nvarchar(50) NULL,
  [接受标准] nvarchar(500) NULL,
  [检验方法] nvarchar(1000) NULL,
  [合格处置] nvarchar(100) NULL,
  [不合格处置] nvarchar(100) NULL,
  [备注] nvarchar(200) NULL,
  [asp_user1] nvarchar(50) NULL,
  [asp_time1] datetime2 NULL,
  [asp_user2] nvarchar(50) NULL,
  [asp_time2] datetime2 NULL,
  [asp_cancel] nvarchar(1) NULL DEFAULT (N'N')
);
PRINT N'qc_fin_spec_detail 就绪';
GO

