-- 单据(头 bd_* / 行 bl_*)与报表视图(v_*)生成
USE HSDZ_MES;
SET NOCOUNT ON;


-- ===== DISPATCH 工序派工单(头 bd_dispatch / 行 bl_dispatch)===== 
IF OBJECT_ID('bd_dispatch') IS NULL CREATE TABLE bd_dispatch (
  id int IDENTITY(1,1) PRIMARY KEY,

  [单据日期] date NOT NULL,

  [单据编号] nvarchar(200) NOT NULL,

  [业务类型] nvarchar(100) NOT NULL,

  [生产车间] nvarchar(200) NOT NULL,

  [加工单号] nvarchar(200) NULL,

  [产品名称] nvarchar(200) NULL,

  [预开工日] date NULL,

  [预完工日] date NULL,

  [经手人] nvarchar(200) NULL,

  [项目] nvarchar(200) NULL,

  [部门] nvarchar(200) NULL,

  [备注] nvarchar(200) NULL,

  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿', [审核人] nvarchar(50) NULL, [审核时间] datetime2 NULL, [审批人] nvarchar(50) NULL, [审批时间] datetime2 NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

IF OBJECT_ID('bl_dispatch') IS NULL CREATE TABLE bl_dispatch (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(100) NOT NULL,

  [工序编码] nvarchar(200) NOT NULL,

  [工序名称] nvarchar(200) NULL,

  [产品名称] nvarchar(200) NULL,

  [生产车间] nvarchar(200) NULL,

  [工作中心] nvarchar(200) NULL,

  [设备] nvarchar(200) NULL,

  [班组] nvarchar(200) NULL,

  [工人] nvarchar(200) NULL,

  [加工类型] nvarchar(100) NOT NULL,

  [计划数量] decimal(18,4) NULL,

  [已派工数量] decimal(18,4) NULL,

  [派工数量] decimal(18,4) NOT NULL,

  [计量单位] nvarchar(100) NOT NULL,

  [预开工日] date NULL,

  [预完工日] date NULL,

  [派工加工状态] nvarchar(100) NULL,

  [累计汇报数量] decimal(18,4) NULL,

  [委外供应商] nvarchar(200) NULL,

  [规格型号] nvarchar(200) NULL,

  [备注] nvarchar(200) NULL,

  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL
);
GO


-- ===== FINISH_IN 产成品入库单(头 bd_finish_in / 行 bl_finish_in)===== 
IF OBJECT_ID('bd_finish_in') IS NULL CREATE TABLE bd_finish_in (
  id int IDENTITY(1,1) PRIMARY KEY,

  [单据日期] date NOT NULL,

  [单据编号] nvarchar(200) NOT NULL,

  [业务类型] nvarchar(100) NOT NULL,

  [入库类别] nvarchar(100) NULL,

  [生产车间] nvarchar(100) NULL,

  [加工单号] nvarchar(200) NULL,

  [经手人] nvarchar(200) NULL,

  [项目] nvarchar(200) NULL,

  [仓库] nvarchar(200) NULL,

  [销售订单号] nvarchar(200) NULL,

  [匹配来源单号] nvarchar(200) NULL,

  [凭证字号] nvarchar(200) NULL,

  [备注] nvarchar(500) NULL,

  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿', [审核人] nvarchar(50) NULL, [审核时间] datetime2 NULL, [审批人] nvarchar(50) NULL, [审批时间] datetime2 NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

IF OBJECT_ID('bl_finish_in') IS NULL CREATE TABLE bl_finish_in (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(100) NOT NULL,

  [产品名称] nvarchar(200) NOT NULL,

  [仓库] nvarchar(200) NOT NULL,

  [存货图片] nvarchar(200) NULL,

  [规格型号] nvarchar(200) NULL,

  [智能选单] nvarchar(200) NULL,

  [计量单位] nvarchar(100) NOT NULL,

  [金额] decimal(18,4) NULL,

  [单价] decimal(18,4) NULL,

  [实收数量] decimal(18,4) NOT NULL,

  [现存量] decimal(18,4) NULL,

  [现存量说明] nvarchar(200) NULL,

  [图号] nvarchar(200) NULL,

  [备注] nvarchar(500) NULL,

  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL
);
GO


-- ===== 报表 FINISH_IN_DETAIL 产成品入库单明细表(视图 v_finish_in_detail)===== 
EXEC('CREATE OR ALTER VIEW v_finish_in_detail AS SELECT h.[单据日期], NULL AS [创建时间], h.[单据编号], h.[业务类型], NULL AS [仓库编码], h.[仓库], h.[入库类别], NULL AS [生产车间编码], h.[生产车间], NULL AS [经手人编码], h.[经手人], NULL AS [备注], NULL AS [制单人], NULL AS [审核人], NULL AS [存货编码], NULL AS [存货], l.[规格型号], l.[计量单位], l.[实收数量], l.[单价], l.[金额], NULL AS [计量单位2], NULL AS [实收数量2] FROM bd_finish_in h LEFT JOIN bl_finish_in l ON h.[单据编号] = l.[单据编号];');


-- ===== 报表 FINISH_IN_STATS 产成品入库单统计表(视图 v_finish_in_stats)===== 
EXEC('CREATE OR ALTER VIEW v_finish_in_stats AS SELECT h.[单据日期], MAX(h.[项目]) AS [项目], NULL AS [存货编码], NULL AS [存货], MAX(l.[规格型号]) AS [规格型号], MAX(l.[计量单位]) AS [计量单位], NULL AS [辅单位], NULL AS [实收数量(主单位)], SUM(COALESCE(l.[单价], 0)) AS [单价], SUM(COALESCE(l.[金额], 0)) AS [金额], NULL AS [实收数量(辅单位)], NULL AS [单价(辅单位)], h.[仓库] FROM bd_finish_in h LEFT JOIN bl_finish_in l ON h.[单据编号] = l.[单据编号] GROUP BY h.[仓库], h.[单据日期];');


-- ===== MANU_ORDER 生产加工单(头 bd_manu_order / 行 bl_manu_order)===== 
IF OBJECT_ID('bd_manu_order') IS NULL CREATE TABLE bd_manu_order (
  id int IDENTITY(1,1) PRIMARY KEY,

  [合同号] date NOT NULL,

  [锭号] nvarchar(200) NOT NULL,

  [批号] nvarchar(100) NOT NULL,

  [生产车间] nvarchar(100) NOT NULL,

  [预开工日] date NULL,

  [预完工日] date NULL,

  [销售订单号] nvarchar(200) NULL,

  [客户编码] nvarchar(200) NULL,

  [客户] nvarchar(200) NULL,

  [测试程序] nvarchar(100) NOT NULL,

  [测试程序2] nvarchar(200) NULL,

  [生产订单客户] nvarchar(200) NULL,

  [机构] nvarchar(100) NOT NULL,

  [重量] decimal(18,4) NULL,

  [开工日期] date NULL,

  [完工日期] date NULL,

  [启用派工] bit NULL,

  [自动转移] bit NULL,

  [产品自动添加到材料] bit NULL,

  [是否手工修改单据编码] bit NULL,

  [外部单据号] nvarchar(200) NULL,

  [负责人] nvarchar(100) NULL,

  [启用领料申请] bit NULL,

  [对方仓库] nvarchar(100) NULL,

  [备注] nvarchar(500) NULL,

  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿', [审核人] nvarchar(50) NULL, [审核时间] datetime2 NULL, [审批人] nvarchar(50) NULL, [审批时间] datetime2 NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

IF OBJECT_ID('bl_manu_order') IS NULL CREATE TABLE bl_manu_order (
  id int IDENTITY(1,1) PRIMARY KEY,
  [合同号] nvarchar(100) NOT NULL,

  [生产类型] nvarchar(100) NULL,

  [产品编码] nvarchar(100) NULL,

  [存货图片] nvarchar(200) NULL,

  [产品名称] nvarchar(200) NULL,

  [规格型号] nvarchar(200) NULL,

  [型号] nvarchar(200) NULL,

  [适用BOM] nvarchar(100) NULL,

  [BOM展开方式] nvarchar(100) NULL,

  [生产单位] nvarchar(100) NULL,

  [数量] decimal(18,4) NULL,

  [齐套数量(主)] decimal(18,4) NULL,

  [累计汇报套数(工序单位)] decimal(18,4) NULL,

  [可用量] decimal(18,4) NULL,

  [可用量说明] nvarchar(200) NULL,

  [现存量] decimal(18,4) NULL,

  [现存量说明] nvarchar(200) NULL,

  [产品字符公用自定义项1] nvarchar(200) NULL,

  [图号] nvarchar(200) NULL,

  [单重] decimal(18,4) NULL,

  [总重] decimal(18,4) NULL,

  [需求令号] nvarchar(200) NULL,

  [备注] nvarchar(500) NULL,

  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL
);
GO


-- ===== 报表 MANU_ORDER_DETAIL 生产加工单明细表(视图 v_manu_order_detail)===== 
EXEC('CREATE OR ALTER VIEW v_manu_order_detail AS SELECT NULL AS [单据编号], NULL AS [单据状态], h.[生产车间], h.[客户编码], h.[客户], l.[产品编码], l.[产品名称], l.[规格型号], l.[生产单位], l.[数量], l.[齐套数量(主)], l.[累计汇报套数(工序单位)], l.[可用量], l.[现存量], l.[图号], l.[单重], l.[总重], l.[需求令号], h.[预开工日], h.[预完工日] FROM bd_manu_order h LEFT JOIN bl_manu_order l ON h.[合同号] = l.[合同号];');


-- ===== 报表 MANU_ORDER_STATS 生产加工单统计表(视图 v_manu_order_stats)===== 
EXEC('CREATE OR ALTER VIEW v_manu_order_stats AS SELECT l.[产品编码], MAX(l.[产品名称]) AS [产品名称], MAX(l.[规格型号]) AS [规格型号], MAX(l.[生产单位]) AS [生产单位], NULL AS [加工单数], NULL AS [计划数量], NULL AS [累计汇报数量], NULL AS [完工数量], NULL AS [生产进度%] FROM bd_manu_order h LEFT JOIN bl_manu_order l ON h.[合同号] = l.[合同号] GROUP BY l.[产品编码];');


-- ===== MATERIAL_OUT 材料出库单(头 bd_material_out / 行 bl_material_out)===== 
IF OBJECT_ID('bd_material_out') IS NULL CREATE TABLE bd_material_out (
  id int IDENTITY(1,1) PRIMARY KEY,

  [单据日期] date NOT NULL,

  [单据编号] nvarchar(200) NOT NULL,

  [业务类型] nvarchar(100) NOT NULL,

  [生产车间] nvarchar(100) NULL,

  [出库类别] nvarchar(100) NULL,

  [领用人] nvarchar(200) NULL,

  [项目] nvarchar(200) NULL,

  [仓库] nvarchar(200) NULL,

  [来源单号] nvarchar(200) NULL,

  [加工单号] nvarchar(200) NULL,

  [备注] nvarchar(500) NULL,

  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿', [审核人] nvarchar(50) NULL, [审核时间] datetime2 NULL, [审批人] nvarchar(50) NULL, [审批时间] datetime2 NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

IF OBJECT_ID('bl_material_out') IS NULL CREATE TABLE bl_material_out (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(100) NOT NULL,

  [仓库] nvarchar(100) NOT NULL,

  [加工单号] nvarchar(200) NULL,

  [材料名称] nvarchar(100) NOT NULL,

  [计量单位] nvarchar(100) NOT NULL,

  [数量] decimal(18,4) NOT NULL,

  [单价] decimal(18,4) NULL,

  [金额] decimal(18,4) NULL,

  [规格型号] nvarchar(200) NULL,

  [手工确定成本] bit NULL,

  [明细备注] nvarchar(200) NULL,

  [现存量] decimal(18,4) NULL,

  [现存量说明] nvarchar(200) NULL,

  [备注] nvarchar(500) NULL,

  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL
);
GO


-- ===== 报表 MATERIAL_OUT_DETAIL 材料出库单明细表(视图 v_material_out_detail)===== 
EXEC('CREATE OR ALTER VIEW v_material_out_detail AS SELECT h.[单据日期], NULL AS [创建时间], h.[单据编号], h.[业务类型], NULL AS [仓库编码], h.[仓库], h.[出库类别], NULL AS [生产车间编码], h.[生产车间], NULL AS [领用人编码], h.[领用人], NULL AS [制单人], NULL AS [审核人], NULL AS [材料编码], l.[材料名称], NULL AS [材料规格], NULL AS [明细.生产车间], NULL AS [工作中心], NULL AS [班组], NULL AS [工人], NULL AS [设备], l.[计量单位], l.[数量], l.[单价], l.[金额], NULL AS [计量单位2], NULL AS [数量2], NULL AS [出库调整] FROM bd_material_out h LEFT JOIN bl_material_out l ON h.[单据编号] = l.[单据编号];');


-- ===== 报表 MATERIAL_OUT_STATS 材料出库单统计表(视图 v_material_out_stats)===== 
EXEC('CREATE OR ALTER VIEW v_material_out_stats AS SELECT NULL AS [仓库编码], h.[仓库], NULL AS [材料编码], MAX(l.[材料名称]) AS [材料名称], NULL AS [材料规格], NULL AS [主单位], NULL AS [计量单位(辅单位)], NULL AS [数量(主单位)], NULL AS [单价(主单位)], SUM(COALESCE(l.[金额], 0)) AS [金额], NULL AS [数量(辅单位)], NULL AS [单价(辅单位)], NULL AS [出库调整], h.[单据日期] FROM bd_material_out h LEFT JOIN bl_material_out l ON h.[单据编号] = l.[单据编号] GROUP BY h.[仓库], h.[单据日期];');


-- ===== OTHER_IN 其他入库单(头 bd_other_in / 行 bl_other_in)===== 
IF OBJECT_ID('bd_other_in') IS NULL CREATE TABLE bd_other_in (
  id int IDENTITY(1,1) PRIMARY KEY,

  [单据日期] date NOT NULL,

  [单据编号] nvarchar(200) NOT NULL,

  [业务类型] nvarchar(100) NOT NULL,

  [项目] nvarchar(200) NULL,

  [仓库] nvarchar(200) NULL,

  [往来单位] nvarchar(200) NULL,

  [匹配来源单号] nvarchar(200) NULL,

  [备注] nvarchar(500) NULL,

  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿', [审核人] nvarchar(50) NULL, [审核时间] datetime2 NULL, [审批人] nvarchar(50) NULL, [审批时间] datetime2 NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

IF OBJECT_ID('bl_other_in') IS NULL CREATE TABLE bl_other_in (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(100) NOT NULL,

  [仓库] nvarchar(100) NOT NULL,

  [存货名称] nvarchar(100) NOT NULL,

  [规格型号] nvarchar(200) NULL,

  [计量单位] nvarchar(100) NOT NULL,

  [数量] decimal(18,4) NOT NULL,

  [智能选单] nvarchar(200) NULL,

  [计量单位2] nvarchar(100) NULL,

  [数量2] decimal(18,4) NULL,

  [单价] decimal(18,4) NULL,

  [金额] decimal(18,4) NULL,

  [现存量] decimal(18,4) NULL,

  [现存量说明] nvarchar(200) NULL,

  [备注] nvarchar(500) NULL,

  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL
);
GO


-- ===== 报表 OTHER_IN_DETAIL 其他入库单明细表(视图 v_other_in_detail)===== 
EXEC('CREATE OR ALTER VIEW v_other_in_detail AS SELECT h.[单据日期], NULL AS [创建时间], h.[单据编号], h.[业务类型], NULL AS [仓库编码], h.[仓库], NULL AS [入库类别], NULL AS [部门编码], NULL AS [部门], NULL AS [经手人编码], NULL AS [经手人], NULL AS [备注], NULL AS [制单人], NULL AS [审核人], NULL AS [存货编码], NULL AS [存货], l.[规格型号], l.[计量单位], l.[数量], l.[单价], l.[金额], l.[计量单位2], l.[数量2] FROM bd_other_in h LEFT JOIN bl_other_in l ON h.[单据编号] = l.[单据编号];');


-- ===== 报表 OTHER_IN_STATS 其他入库单统计表(视图 v_other_in_stats)===== 
EXEC('CREATE OR ALTER VIEW v_other_in_stats AS SELECT NULL AS [仓库编码], h.[仓库], NULL AS [存货编码], NULL AS [存货], MAX(l.[规格型号]) AS [规格型号], NULL AS [主单位], NULL AS [辅单位], NULL AS [数量(主单位)], SUM(COALESCE(l.[单价], 0)) AS [单价], SUM(COALESCE(l.[金额], 0)) AS [金额], NULL AS [数量(辅单位)], NULL AS [单价(辅单位)], h.[单据日期] FROM bd_other_in h LEFT JOIN bl_other_in l ON h.[单据编号] = l.[单据编号] GROUP BY h.[仓库], h.[单据日期];');


-- ===== OTHER_OUT 其他出库单(头 bd_other_out / 行 bl_other_out)===== 
IF OBJECT_ID('bd_other_out') IS NULL CREATE TABLE bd_other_out (
  id int IDENTITY(1,1) PRIMARY KEY,

  [单据日期] date NOT NULL,

  [单据编号] nvarchar(200) NOT NULL,

  [业务类型] nvarchar(100) NOT NULL,

  [出库类别] nvarchar(100) NULL,

  [部门] nvarchar(200) NULL,

  [经手人] nvarchar(200) NULL,

  [项目] nvarchar(200) NULL,

  [往来单位] nvarchar(200) NULL,

  [来源单据] nvarchar(200) NULL,

  [外部单据号] nvarchar(200) NULL,

  [来源单号] nvarchar(200) NULL,

  [数据来源] nvarchar(200) NULL,

  [销售订单号] nvarchar(200) NULL,

  [自动生入库单] bit NULL,

  [凭证字号] nvarchar(200) NULL,

  [项目.合同号] nvarchar(200) NULL,

  [备注] nvarchar(500) NULL,

  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿', [审核人] nvarchar(50) NULL, [审核时间] datetime2 NULL, [审批人] nvarchar(50) NULL, [审批时间] datetime2 NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

IF OBJECT_ID('bl_other_out') IS NULL CREATE TABLE bl_other_out (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(100) NOT NULL,

  [仓库] nvarchar(100) NOT NULL,

  [存货名称] nvarchar(100) NOT NULL,

  [规格型号] nvarchar(200) NULL,

  [计量单位] nvarchar(100) NOT NULL,

  [数量] decimal(18,4) NOT NULL,

  [单价] decimal(18,4) NULL,

  [金额] decimal(18,4) NULL,

  [现存量] decimal(18,4) NULL,

  [现存量说明] nvarchar(200) NULL,

  [备注] nvarchar(500) NULL,

  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL
);
GO


-- ===== 报表 OTHER_OUT_DETAIL 其他出库单明细表(视图 v_other_out_detail)===== 
EXEC('CREATE OR ALTER VIEW v_other_out_detail AS SELECT h.[单据日期], NULL AS [创建时间], h.[单据编号], h.[业务类型], NULL AS [仓库编码], l.[仓库], h.[出库类别], NULL AS [部门编码], h.[部门], NULL AS [经手人编码], h.[经手人], NULL AS [备注], NULL AS [制单人], NULL AS [审核人], NULL AS [存货编码], NULL AS [存货], l.[规格型号], l.[计量单位], l.[数量], l.[单价], l.[金额], NULL AS [计量单位2], NULL AS [数量2], NULL AS [出库调整], NULL AS [累计调拨入库量], NULL AS [合理损耗数量], NULL AS [入库单号] FROM bd_other_out h LEFT JOIN bl_other_out l ON h.[单据编号] = l.[单据编号];');


-- ===== 报表 OTHER_OUT_STATS 其他出库单统计表(视图 v_other_out_stats)===== 
EXEC('CREATE OR ALTER VIEW v_other_out_stats AS SELECT NULL AS [仓库编码], l.[仓库], NULL AS [存货编码], NULL AS [存货], MAX(l.[规格型号]) AS [规格型号], NULL AS [主单位], NULL AS [辅单位], NULL AS [数量(主单位)], SUM(COALESCE(l.[单价], 0)) AS [单价], SUM(COALESCE(l.[金额], 0)) AS [金额], NULL AS [数量(辅单位)], NULL AS [单价(辅单位)], NULL AS [出库调整], h.[单据日期] FROM bd_other_out h LEFT JOIN bl_other_out l ON h.[单据编号] = l.[单据编号] GROUP BY l.[仓库], h.[单据日期];');


-- ===== OUTSOURCE_IN 委外入库单(头 bd_outsource_in / 行 bl_outsource_in)===== 
IF OBJECT_ID('bd_outsource_in') IS NULL CREATE TABLE bd_outsource_in (
  id int IDENTITY(1,1) PRIMARY KEY,

  [单据日期] date NOT NULL,

  [单据编号] nvarchar(200) NOT NULL,

  [业务类型] nvarchar(100) NOT NULL,

  [委外供应商] nvarchar(200) NOT NULL,

  [委外加工单号] nvarchar(200) NULL,

  [仓库] nvarchar(200) NULL,

  [经手人] nvarchar(200) NULL,

  [备注] nvarchar(200) NULL,

  [来源单据] nvarchar(200) NULL,

  [来源单号] nvarchar(200) NULL,

  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿', [审核人] nvarchar(50) NULL, [审核时间] datetime2 NULL, [审批人] nvarchar(50) NULL, [审批时间] datetime2 NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

IF OBJECT_ID('bl_outsource_in') IS NULL CREATE TABLE bl_outsource_in (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(100) NOT NULL,

  [产品编码] nvarchar(200) NULL,

  [产品名称] nvarchar(200) NOT NULL,

  [规格型号] nvarchar(200) NULL,

  [计量单位] nvarchar(100) NOT NULL,

  [实收数量] decimal(18,4) NOT NULL,

  [单价] decimal(18,4) NULL,

  [金额] decimal(18,4) NULL,

  [现存量] decimal(18,4) NULL,

  [行中止] bit NULL,

  [备注] nvarchar(500) NULL,

  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL
);
GO


-- ===== OUTSOURCE_ISSUE 委外发料单(头 bd_outsource_issue / 行 bl_outsource_issue)===== 
IF OBJECT_ID('bd_outsource_issue') IS NULL CREATE TABLE bd_outsource_issue (
  id int IDENTITY(1,1) PRIMARY KEY,

  [单据日期] date NOT NULL,

  [单据编号] nvarchar(200) NOT NULL,

  [业务类型] nvarchar(100) NOT NULL,

  [委外供应商] nvarchar(200) NOT NULL,

  [委外加工单号] nvarchar(200) NULL,

  [仓库] nvarchar(200) NULL,

  [部门] nvarchar(200) NULL,

  [经手人] nvarchar(200) NULL,

  [备注] nvarchar(200) NULL,

  [来源单据] nvarchar(200) NULL,

  [来源单号] nvarchar(200) NULL,

  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿', [审核人] nvarchar(50) NULL, [审核时间] datetime2 NULL, [审批人] nvarchar(50) NULL, [审批时间] datetime2 NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

IF OBJECT_ID('bl_outsource_issue') IS NULL CREATE TABLE bl_outsource_issue (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(100) NOT NULL,

  [材料编码] nvarchar(200) NULL,

  [材料名称] nvarchar(200) NOT NULL,

  [规格型号] nvarchar(200) NULL,

  [计量单位] nvarchar(100) NOT NULL,

  [数量] decimal(18,4) NOT NULL,

  [单价] decimal(18,4) NULL,

  [金额] decimal(18,4) NULL,

  [仓库] nvarchar(200) NULL,

  [行中止] bit NULL,

  [备注] nvarchar(500) NULL,

  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL
);
GO


-- ===== OUTSOURCE_ORDER 委外加工单(头 bd_outsource_order / 行 bl_outsource_order)===== 
IF OBJECT_ID('bd_outsource_order') IS NULL CREATE TABLE bd_outsource_order (
  id int IDENTITY(1,1) PRIMARY KEY,

  [单据日期] date NOT NULL,

  [单据编号] nvarchar(200) NOT NULL,

  [业务类型] nvarchar(100) NOT NULL,

  [委外供应商] nvarchar(200) NOT NULL,

  [生产车间] nvarchar(100) NULL,

  [部门] nvarchar(200) NULL,

  [经手人] nvarchar(200) NULL,

  [交货日期] date NULL,

  [预完工日] date NULL,

  [备注] nvarchar(200) NULL,

  [来源单据] nvarchar(200) NULL,

  [来源单号] nvarchar(200) NULL,

  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿', [审核人] nvarchar(50) NULL, [审核时间] datetime2 NULL, [审批人] nvarchar(50) NULL, [审批时间] datetime2 NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

IF OBJECT_ID('bl_outsource_order') IS NULL CREATE TABLE bl_outsource_order (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(100) NOT NULL,

  [产品编码] nvarchar(200) NULL,

  [产品名称] nvarchar(200) NOT NULL,

  [规格型号] nvarchar(200) NULL,

  [计量单位] nvarchar(100) NOT NULL,

  [数量] decimal(18,4) NOT NULL,

  [委外单价] decimal(18,4) NULL,

  [金额] decimal(18,4) NULL,

  [现存量] decimal(18,4) NULL,

  [行中止] bit NULL,

  [备注] nvarchar(500) NULL,

  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL
);
GO


-- ===== PURCHASE_IN 采购入库单(头 bd_purchase_in / 行 bl_purchase_in)===== 
IF OBJECT_ID('bd_purchase_in') IS NULL CREATE TABLE bd_purchase_in (
  id int IDENTITY(1,1) PRIMARY KEY,

  [单据日期] date NOT NULL,

  [单据编号] nvarchar(200) NOT NULL,

  [业务类型] nvarchar(100) NOT NULL,

  [币种] nvarchar(100) NOT NULL,

  [汇率] decimal(18,4) NOT NULL,

  [供应商编码] nvarchar(200) NULL,

  [供应商] nvarchar(200) NOT NULL,

  [供应商简称] nvarchar(200) NULL,

  [经手人] nvarchar(200) NULL,

  [项目] nvarchar(200) NULL,

  [仓库] nvarchar(200) NULL,

  [外部单据号] nvarchar(200) NULL,

  [采购订单号] nvarchar(200) NULL,

  [合同号] nvarchar(200) NULL,

  [资金批次] nvarchar(200) NULL,

  [采购类型] nvarchar(100) NULL,

  [合同号最新] nvarchar(200) NULL,

  [备注] nvarchar(500) NULL,

  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿', [审核人] nvarchar(50) NULL, [审核时间] datetime2 NULL, [审批人] nvarchar(50) NULL, [审批时间] datetime2 NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

IF OBJECT_ID('bl_purchase_in') IS NULL CREATE TABLE bl_purchase_in (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(100) NOT NULL,

  [仓库] nvarchar(100) NOT NULL,

  [存货名称] nvarchar(100) NOT NULL,

  [存货图片] nvarchar(200) NULL,

  [规格型号] nvarchar(200) NULL,

  [实收数量] decimal(18,4) NOT NULL,

  [计量单位] nvarchar(100) NOT NULL,

  [实收数量2] decimal(18,4) NULL,

  [计量单位2] nvarchar(100) NULL,

  [计量单位组合] nvarchar(200) NULL,

  [换算率] decimal(18,4) NULL,

  [单价] decimal(18,4) NULL,

  [税率%] decimal(18,4) NULL,

  [单价2] decimal(18,4) NULL,

  [含税单价2] decimal(18,4) NULL,

  [含税单价] decimal(18,4) NULL,

  [金额] decimal(18,4) NULL,

  [含税金额] decimal(18,4) NULL,

  [费用调整] decimal(18,4) NULL,

  [费用金额] decimal(18,4) NULL,

  [现存量] decimal(18,4) NULL,

  [现存量说明] nvarchar(200) NULL,

  [产成品图片] nvarchar(200) NULL,

  [备注] nvarchar(500) NULL,

  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL
);
GO


-- ===== 报表 PURCHASE_IN_DETAIL 采购入库单明细表(视图 v_purchase_in_detail)===== 
EXEC('CREATE OR ALTER VIEW v_purchase_in_detail AS SELECT h.[单据日期], NULL AS [创建时间], h.[单据编号], h.[业务类型], NULL AS [仓库编码], h.[仓库], NULL AS [入库类别], h.[供应商编码], h.[供应商], NULL AS [部门编码], NULL AS [部门], NULL AS [经手人编码], h.[经手人], NULL AS [备注], NULL AS [制单人], NULL AS [审核人], NULL AS [存货编码], NULL AS [存货], l.[规格型号], l.[计量单位], l.[实收数量], l.[单价], l.[金额], l.[计量单位2], l.[实收数量2], NULL AS [入库调整], l.[费用调整], NULL AS [总成本], l.[费用金额] FROM bd_purchase_in h LEFT JOIN bl_purchase_in l ON h.[单据编号] = l.[单据编号];');


-- ===== 报表 PURCHASE_IN_STATS 采购入库单统计表(视图 v_purchase_in_stats)===== 
EXEC('CREATE OR ALTER VIEW v_purchase_in_stats AS SELECT NULL AS [仓库编码], h.[仓库], MAX(h.[供应商编码]) AS [供应商编码], h.[供应商], NULL AS [存货编码], NULL AS [存货], MAX(l.[规格型号]) AS [规格型号], NULL AS [主单位], NULL AS [辅单位], NULL AS [实收数量(主单位)], NULL AS [单价(主单位)], SUM(COALESCE(l.[金额], 0)) AS [金额], NULL AS [单价(辅单位)], NULL AS [入库调整], SUM(COALESCE(l.[费用调整], 0)) AS [费用调整], NULL AS [总成本], SUM(COALESCE(l.[费用金额], 0)) AS [费用金额], h.[单据日期] FROM bd_purchase_in h LEFT JOIN bl_purchase_in l ON h.[单据编号] = l.[单据编号] GROUP BY h.[仓库], h.[供应商], h.[单据日期];');


-- ===== PU_ORDER 采购订单(头 bd_pu_order / 行 bl_pu_order)===== 
IF OBJECT_ID('bd_pu_order') IS NULL CREATE TABLE bd_pu_order (
  id int IDENTITY(1,1) PRIMARY KEY,

  [单据日期] date NOT NULL,

  [单据编号] nvarchar(200) NOT NULL,

  [项目] nvarchar(200) NULL,

  [供应商] nvarchar(200) NOT NULL,

  [供应商编码] nvarchar(200) NULL,

  [币种] nvarchar(100) NOT NULL,

  [汇率] decimal(18,4) NOT NULL,

  [到货地址] nvarchar(200) NULL,

  [交货日期] date NULL,

  [发货状态] nvarchar(100) NULL,

  [合同号] nvarchar(200) NULL,

  [订金金额] decimal(18,4) NULL,

  [付款方式] nvarchar(100) NULL,

  [数据来源] nvarchar(200) NULL,

  [备注] nvarchar(500) NULL,

  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿', [审核人] nvarchar(50) NULL, [审核时间] datetime2 NULL, [审批人] nvarchar(50) NULL, [审批时间] datetime2 NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

IF OBJECT_ID('bl_pu_order') IS NULL CREATE TABLE bl_pu_order (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(100) NOT NULL,

  [物料编码] nvarchar(200) NOT NULL,

  [物料名称] nvarchar(200) NOT NULL,

  [规格型号] nvarchar(200) NULL,

  [单位] nvarchar(100) NOT NULL,

  [数量] decimal(18,4) NOT NULL,

  [单价] decimal(18,4) NOT NULL,

  [金额] decimal(18,4) NULL,

  [税率%] decimal(18,4) NULL,

  [含税单价] decimal(18,4) NULL,

  [含税金额] decimal(18,4) NULL,

  [数量2] decimal(18,4) NULL,

  [仓库] nvarchar(200) NULL,

  [计量单位2] nvarchar(100) NULL,

  [折扣%] decimal(18,4) NULL,

  [折扣金额] decimal(18,4) NULL,

  [预计到货日期] date NULL,

  [现存量] decimal(18,4) NULL,

  [现存量说明] nvarchar(200) NULL,

  [备注] nvarchar(500) NULL,

  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL
);
GO


-- ===== PU_REQ 请购单(头 bd_pu_req / 行 bl_pu_req)===== 
IF OBJECT_ID('bd_pu_req') IS NULL CREATE TABLE bd_pu_req (
  id int IDENTITY(1,1) PRIMARY KEY,

  [单据日期] date NOT NULL,

  [单据编号] nvarchar(200) NOT NULL,

  [部门] nvarchar(200) NULL,

  [请购人] nvarchar(200) NOT NULL,

  [项目] nvarchar(200) NULL,

  [建议供应商编码] nvarchar(200) NULL,

  [建议供应商] nvarchar(200) NULL,

  [建议供应商简称] nvarchar(200) NULL,

  [收货人] nvarchar(200) NULL,

  [电话] nvarchar(200) NULL,

  [需求日期] date NULL,

  [到货地址] nvarchar(200) NULL,

  [销售订单号] nvarchar(200) NULL,

  [外部单据号] nvarchar(200) NULL,

  [来源单据] nvarchar(200) NULL,

  [来源单号] nvarchar(200) NULL,

  [折扣] decimal(18,4) NULL,

  [总金额] decimal(18,4) NULL,

  [含税总金额] decimal(18,4) NULL,

  [备注] nvarchar(200) NULL,

  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿', [审核人] nvarchar(50) NULL, [审核时间] datetime2 NULL, [审批人] nvarchar(50) NULL, [审批时间] datetime2 NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

IF OBJECT_ID('bl_pu_req') IS NULL CREATE TABLE bl_pu_req (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(100) NOT NULL,

  [存货编码] nvarchar(200) NOT NULL,

  [存货名称] nvarchar(200) NOT NULL,

  [规格型号] nvarchar(200) NULL,

  [版本号] nvarchar(200) NULL,

  [采购单位] nvarchar(100) NOT NULL,

  [数量] decimal(18,4) NOT NULL,

  [数量2] decimal(18,4) NULL,

  [建议供应商] nvarchar(200) NULL,

  [报价] decimal(18,4) NULL,

  [单价] decimal(18,4) NULL,

  [含税单价] decimal(18,4) NULL,

  [税率%] decimal(18,4) NULL,

  [金额] decimal(18,4) NULL,

  [含税金额] decimal(18,4) NULL,

  [需求日期] date NULL,

  [来源单据] nvarchar(200) NULL,

  [来源单号] nvarchar(200) NULL,

  [现存量] decimal(18,4) NULL,

  [现存量说明] nvarchar(200) NULL,

  [是否带票] nvarchar(100) NULL,

  [备注] nvarchar(200) NULL,

  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL
);
GO


-- ===== SALE_OUT 销售出库单(头 bd_sale_out / 行 bl_sale_out)===== 
IF OBJECT_ID('bd_sale_out') IS NULL CREATE TABLE bd_sale_out (
  id int IDENTITY(1,1) PRIMARY KEY,

  [单据日期] date NOT NULL,

  [单据编号] nvarchar(200) NOT NULL,

  [业务类型] nvarchar(100) NOT NULL,

  [出库类别] nvarchar(100) NULL,

  [客户] nvarchar(200) NOT NULL,

  [客户编码] nvarchar(200) NULL,

  [客户简称] nvarchar(200) NULL,

  [结算客户] nvarchar(200) NOT NULL,

  [经手人] nvarchar(200) NULL,

  [验货人] nvarchar(200) NULL,

  [项目] nvarchar(200) NULL,

  [仓库] nvarchar(200) NULL,

  [送货地址] nvarchar(200) NULL,

  [发货单号] nvarchar(200) NULL,

  [发货日期] date NULL,

  [来源单号] nvarchar(200) NULL,

  [部门] nvarchar(200) NULL,

  [门店] nvarchar(200) NULL,

  [匹配来源单号] nvarchar(200) NULL,

  [验货日期] date NULL,

  [发货人] nvarchar(200) NULL,

  [收货仓库] nvarchar(200) NULL,

  [来源单据] nvarchar(200) NULL,

  [外部单据号] nvarchar(200) NULL,

  [销售订单号] nvarchar(200) NULL,

  [备注] nvarchar(500) NULL,

  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿', [审核人] nvarchar(50) NULL, [审核时间] datetime2 NULL, [审批人] nvarchar(50) NULL, [审批时间] datetime2 NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

IF OBJECT_ID('bl_sale_out') IS NULL CREATE TABLE bl_sale_out (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(100) NOT NULL,

  [仓库] nvarchar(200) NOT NULL,

  [存货名称] nvarchar(200) NOT NULL,

  [存货编码] nvarchar(200) NOT NULL,

  [规格型号] nvarchar(200) NULL,

  [计量单位] nvarchar(100) NOT NULL,

  [数量] decimal(18,4) NOT NULL,

  [智能选单] nvarchar(200) NULL,

  [成本价] decimal(18,4) NULL,

  [税率%] decimal(18,4) NULL,

  [售价] decimal(18,4) NULL,

  [含税售价] decimal(18,4) NULL,

  [销售金额] decimal(18,4) NULL,

  [税额] decimal(18,4) NULL,

  [含税销售金额] decimal(18,4) NULL,

  [折扣金额] decimal(18,4) NULL,

  [现存量] decimal(18,4) NULL,

  [现存量说明] nvarchar(200) NULL,

  [需求令号] nvarchar(200) NULL,

  [退货原因] nvarchar(100) NULL,

  [备注] nvarchar(500) NULL,

  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL
);
GO


-- ===== 报表 SALE_OUT_DETAIL 销售出库单明细表(视图 v_sale_out_detail)===== 
EXEC('CREATE OR ALTER VIEW v_sale_out_detail AS SELECT h.[单据日期], NULL AS [创建时间], h.[单据编号], h.[业务类型], NULL AS [仓库编码], h.[仓库], h.[出库类别], h.[客户编码], h.[客户], NULL AS [部门编码], h.[部门], NULL AS [经手人编码], h.[经手人], NULL AS [制单人], NULL AS [审核人], l.[存货编码], NULL AS [存货], l.[规格型号], l.[计量单位], NULL AS [应发数量], l.[数量], NULL AS [计量单位2], NULL AS [应发数量2], NULL AS [数量2], l.[成本价], NULL AS [成本金额], NULL AS [出库调整], h.[销售订单号], NULL AS [入库单号] FROM bd_sale_out h LEFT JOIN bl_sale_out l ON h.[单据编号] = l.[单据编号];');


-- ===== 报表 SALE_OUT_STATS 销售出库单统计表(视图 v_sale_out_stats)===== 
EXEC('CREATE OR ALTER VIEW v_sale_out_stats AS SELECT NULL AS [单据日期（周）], l.[存货编码], NULL AS [存货], MAX(l.[规格型号]) AS [规格型号], NULL AS [主单位], NULL AS [辅单位], NULL AS [数量(主单位)], NULL AS [成本价(主单位)], NULL AS [数量(辅单位)], NULL AS [成本价(辅单位)], NULL AS [成本金额], NULL AS [出库调整], h.[仓库], h.[单据日期] FROM bd_sale_out h LEFT JOIN bl_sale_out l ON h.[单据编号] = l.[单据编号] GROUP BY h.[仓库], l.[存货编码], h.[单据日期];');

