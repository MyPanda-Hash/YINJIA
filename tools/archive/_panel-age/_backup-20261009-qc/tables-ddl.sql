-- tables-ddl.sql — 10 张待删表的列定义 + 索引 + 中文注明(重建骨架)
USE HSDZ_MES;
GO

-- ---- qc_op ----
CREATE TABLE dbo.[qc_op] (
  [id] int IDENTITY(1,1) NOT NULL,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20),
  [工单号] nvarchar(60),
  [工序] nvarchar(50),
  [检验员] nvarchar(50),
  [检验日期] nvarchar(20),
  [总结论] nvarchar(20),
  [备注] nvarchar(500),
  [单据状态] nvarchar(10) DEFAULT (N'草稿') NOT NULL,
  [审核人] nvarchar(50),
  [审核时间] nvarchar(30),
  [asp_user1] nvarchar(50),
  [asp_time1] datetime2,
  [asp_user2] nvarchar(50),
  [asp_time2] datetime2,
  [asp_cancel] char DEFAULT ('N'),
  [备用1] nvarchar(500),
  [备用2] nvarchar(500),
  [备用3] nvarchar(500),
  [备用4] nvarchar(500),
  [备用5] nvarchar(500),
  [备用6] nvarchar(500),
  [备用7] nvarchar(500),
  [备用8] nvarchar(500),
  [备用9] nvarchar(500),
  [备用10] nvarchar(500),
  [备用11] nvarchar(500),
  [备用12] nvarchar(500),
  [备用13] nvarchar(500),
  [备用14] nvarchar(500),
  [备用15] nvarchar(500),
  [备用16] nvarchar(500),
  [备用17] nvarchar(500),
  [备用18] nvarchar(500),
  [备用19] nvarchar(500),
  [备用20] nvarchar(500)
);
GO
CREATE UNIQUE CLUSTERED INDEX [PK__qc_op__3213E83F61B6256C] ON dbo.[qc_op] (id);
EXEC sp_addextendedproperty N'MS_Description', N'工序质检单头表(制程检验,首件/巡检语义)', N'SCHEMA', N'dbo', N'TABLE', N'qc_op';
GO

-- ---- qc_op_detail ----
CREATE TABLE dbo.[qc_op_detail] (
  [id] int IDENTITY(1,1) NOT NULL,
  [单据编号] nvarchar(60) NOT NULL,
  [检验项目] nvarchar(200),
  [标准要求] nvarchar(200),
  [检验结果] nvarchar(20),
  [实测数值] decimal(18,4),
  [备注] nvarchar(200),
  [asp_user1] nvarchar(50),
  [asp_time1] datetime2,
  [asp_user2] nvarchar(50),
  [asp_time2] datetime2,
  [asp_cancel] char DEFAULT ('N'),
  [备用1] nvarchar(500),
  [备用2] nvarchar(500),
  [备用3] nvarchar(500),
  [备用4] nvarchar(500),
  [备用5] nvarchar(500),
  [备用6] nvarchar(500),
  [备用7] nvarchar(500),
  [备用8] nvarchar(500),
  [备用9] nvarchar(500),
  [备用10] nvarchar(500),
  [备用11] nvarchar(500),
  [备用12] nvarchar(500),
  [备用13] nvarchar(500),
  [备用14] nvarchar(500),
  [备用15] nvarchar(500),
  [备用16] nvarchar(500),
  [备用17] nvarchar(500),
  [备用18] nvarchar(500),
  [备用19] nvarchar(500),
  [备用20] nvarchar(500)
);
GO
CREATE UNIQUE CLUSTERED INDEX [PK__qc_op_de__3213E83F5BEB86C4] ON dbo.[qc_op_detail] (id);
EXEC sp_addextendedproperty N'MS_Description', N'工序质检单行表(检验项目/标准/实测值)', N'SCHEMA', N'dbo', N'TABLE', N'qc_op_detail';
GO

-- ---- qc_record ----
CREATE TABLE dbo.[qc_record] (
  [id] int IDENTITY(1,1) NOT NULL,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20),
  [检验类型] nvarchar(30),
  [车间] nvarchar(50),
  [产品编号] nvarchar(100),
  [规格] nvarchar(200),
  [抽样数量] decimal(18,4),
  [不良率] decimal(18,4),
  [检验员] nvarchar(50),
  [总结论] nvarchar(20),
  [处理方式] nvarchar(200),
  [备注] nvarchar(500),
  [单据状态] nvarchar(10) DEFAULT (N'草稿') NOT NULL,
  [审核人] nvarchar(50),
  [审核时间] nvarchar(30),
  [asp_user1] nvarchar(50),
  [asp_time1] datetime2,
  [asp_user2] nvarchar(50),
  [asp_time2] datetime2,
  [asp_cancel] char DEFAULT ('N'),
  [备用1] nvarchar(500),
  [备用2] nvarchar(500),
  [备用3] nvarchar(500),
  [备用4] nvarchar(500),
  [备用5] nvarchar(500),
  [备用6] nvarchar(500),
  [备用7] nvarchar(500),
  [备用8] nvarchar(500),
  [备用9] nvarchar(500),
  [备用10] nvarchar(500),
  [备用11] nvarchar(500),
  [备用12] nvarchar(500),
  [备用13] nvarchar(500),
  [备用14] nvarchar(500),
  [备用15] nvarchar(500),
  [备用16] nvarchar(500),
  [备用17] nvarchar(500),
  [备用18] nvarchar(500),
  [备用19] nvarchar(500),
  [备用20] nvarchar(500)
);
GO
CREATE UNIQUE CLUSTERED INDEX [PK__qc_recor__3213E83F71554427] ON dbo.[qc_record] (id);
EXEC sp_addextendedproperty N'MS_Description', N'检验记录单头表(八类合一:首件/烧结制程/脱模/来料/材料进厂/黑水/巡线/管控点)', N'SCHEMA', N'dbo', N'TABLE', N'qc_record';
GO

-- ---- qc_record_detail ----
CREATE TABLE dbo.[qc_record_detail] (
  [id] int IDENTITY(1,1) NOT NULL,
  [单据编号] nvarchar(60) NOT NULL,
  [检验项目] nvarchar(200),
  [标准要求] nvarchar(200),
  [检验结果] nvarchar(20),
  [实测数值] decimal(18,4),
  [品序号] nvarchar(20),
  [备注] nvarchar(200),
  [asp_user1] nvarchar(50),
  [asp_time1] datetime2,
  [asp_user2] nvarchar(50),
  [asp_time2] datetime2,
  [asp_cancel] char DEFAULT ('N'),
  [备用1] nvarchar(500),
  [备用2] nvarchar(500),
  [备用3] nvarchar(500),
  [备用4] nvarchar(500),
  [备用5] nvarchar(500),
  [备用6] nvarchar(500),
  [备用7] nvarchar(500),
  [备用8] nvarchar(500),
  [备用9] nvarchar(500),
  [备用10] nvarchar(500),
  [备用11] nvarchar(500),
  [备用12] nvarchar(500),
  [备用13] nvarchar(500),
  [备用14] nvarchar(500),
  [备用15] nvarchar(500),
  [备用16] nvarchar(500),
  [备用17] nvarchar(500),
  [备用18] nvarchar(500),
  [备用19] nvarchar(500),
  [备用20] nvarchar(500)
);
GO
CREATE UNIQUE CLUSTERED INDEX [PK__qc_recor__3213E83FA78BE710] ON dbo.[qc_record_detail] (id);
EXEC sp_addextendedproperty N'MS_Description', N'检验记录单行表(检验项目/标准要求/结果/品序号)', N'SCHEMA', N'dbo', N'TABLE', N'qc_record_detail';
GO

-- ---- qc_disposal ----
CREATE TABLE dbo.[qc_disposal] (
  [id] int IDENTITY(1,1) NOT NULL,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20),
  [来源单号] nvarchar(60),
  [物料编码] nvarchar(100),
  [物料名称] nvarchar(200),
  [批号] nvarchar(30),
  [数量] decimal(18,4),
  [原仓库] nvarchar(100),
  [处置方式] nvarchar(20),
  [处置原因] nvarchar(500),
  [经手人] nvarchar(50),
  [备注] nvarchar(500),
  [单据状态] nvarchar(10) DEFAULT (N'草稿') NOT NULL,
  [审核人] nvarchar(50),
  [审核时间] nvarchar(30),
  [asp_user1] nvarchar(50),
  [asp_time1] datetime2,
  [asp_user2] nvarchar(50),
  [asp_time2] datetime2,
  [asp_cancel] char DEFAULT ('N'),
  [备用1] nvarchar(500),
  [备用2] nvarchar(500),
  [备用3] nvarchar(500),
  [备用4] nvarchar(500),
  [备用5] nvarchar(500),
  [备用6] nvarchar(500),
  [备用7] nvarchar(500),
  [备用8] nvarchar(500),
  [备用9] nvarchar(500),
  [备用10] nvarchar(500),
  [备用11] nvarchar(500),
  [备用12] nvarchar(500),
  [备用13] nvarchar(500),
  [备用14] nvarchar(500),
  [备用15] nvarchar(500),
  [备用16] nvarchar(500),
  [备用17] nvarchar(500),
  [备用18] nvarchar(500),
  [备用19] nvarchar(500),
  [备用20] nvarchar(500)
);
GO
CREATE UNIQUE CLUSTERED INDEX [PK__qc_dispo__3213E83F2C07B79C] ON dbo.[qc_disposal] (id);
EXEC sp_addextendedproperty N'MS_Description', N'不良品处理单(转隔离仓/报废,审核即移仓过账)', N'SCHEMA', N'dbo', N'TABLE', N'qc_disposal';
GO

-- ---- rod_return ----
CREATE TABLE dbo.[rod_return] (
  [id] int IDENTITY(1,1) NOT NULL,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20),
  [产品编号] nvarchar(100),
  [规格] nvarchar(200),
  [生产数量] decimal(18,4),
  [不良数量] decimal(18,4),
  [不良现象] nvarchar(500),
  [责任部门] nvarchar(100),
  [备注] nvarchar(500),
  [单据状态] nvarchar(10) DEFAULT (N'草稿') NOT NULL,
  [审核人] nvarchar(50),
  [审核时间] nvarchar(30),
  [asp_user1] nvarchar(50),
  [asp_time1] datetime2,
  [asp_user2] nvarchar(50),
  [asp_time2] datetime2,
  [asp_cancel] char DEFAULT ('N'),
  [备用1] nvarchar(500),
  [备用2] nvarchar(500),
  [备用3] nvarchar(500),
  [备用4] nvarchar(500),
  [备用5] nvarchar(500),
  [备用6] nvarchar(500),
  [备用7] nvarchar(500),
  [备用8] nvarchar(500),
  [备用9] nvarchar(500),
  [备用10] nvarchar(500),
  [备用11] nvarchar(500),
  [备用12] nvarchar(500),
  [备用13] nvarchar(500),
  [备用14] nvarchar(500),
  [备用15] nvarchar(500),
  [备用16] nvarchar(500),
  [备用17] nvarchar(500),
  [备用18] nvarchar(500),
  [备用19] nvarchar(500),
  [备用20] nvarchar(500)
);
GO
CREATE UNIQUE CLUSTERED INDEX [PK__rod_retu__3213E83F43DDEB34] ON dbo.[rod_return] (id);
EXEC sp_addextendedproperty N'MS_Description', N'炭棒不良退货登记头表', N'SCHEMA', N'dbo', N'TABLE', N'rod_return';
GO

-- ---- rod_return_detail ----
CREATE TABLE dbo.[rod_return_detail] (
  [id] int IDENTITY(1,1) NOT NULL,
  [单据编号] nvarchar(60),
  [asp_cancel] char DEFAULT ('N'),
  [asp_user1] nvarchar(50),
  [asp_user2] nvarchar(50),
  [asp_time1] datetime2,
  [asp_time2] datetime2,
  [备用1] nvarchar(500),
  [备用2] nvarchar(500),
  [备用3] nvarchar(500),
  [备用4] nvarchar(500),
  [备用5] nvarchar(500),
  [备用6] nvarchar(500),
  [备用7] nvarchar(500),
  [备用8] nvarchar(500),
  [备用9] nvarchar(500),
  [备用10] nvarchar(500),
  [备用11] nvarchar(500),
  [备用12] nvarchar(500),
  [备用13] nvarchar(500),
  [备用14] nvarchar(500),
  [备用15] nvarchar(500),
  [备用16] nvarchar(500),
  [备用17] nvarchar(500),
  [备用18] nvarchar(500),
  [备用19] nvarchar(500),
  [备用20] nvarchar(500)
);
GO
CREATE UNIQUE CLUSTERED INDEX [PK__rod_retu__3213E83F844C6604] ON dbo.[rod_return_detail] (id);
EXEC sp_addextendedproperty N'MS_Description', N'炭棒不良退货登记占位行表(恒空,doc模式要求)', N'SCHEMA', N'dbo', N'TABLE', N'rod_return_detail';
GO

