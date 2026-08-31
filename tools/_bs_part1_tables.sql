-- 基础设置模块迁移(light-mes → HSDZ_MES):18 面板 archive 模式
-- 生成物:物理表 bs_* + yj_panel/yj_field + 现有数据;翻译词条由 gen-locales/dict 接口补齐
USE HSDZ_MES;
SET NOCOUNT ON;

-- ===== BOM 物料清单 =====
IF OBJECT_ID('bs_bom') IS NULL CREATE TABLE bs_bom (
  id int IDENTITY(1,1) PRIMARY KEY,
  [物料清单编码] nvarchar(200) NOT NULL,
  [父件编码] nvarchar(200) NOT NULL,
  [父件名称] nvarchar(200) NOT NULL,
  [虚拟件] bit NULL,
  [版本号] nvarchar(200) NULL,
  [计量单位] nvarchar(100) NULL,
  [生产数量] decimal(18,4) NULL,
  [生产车间] nvarchar(100) NULL,
  [预入仓库] nvarchar(200) NULL,
  [默认BOM] bit NULL,
  [子件编码] nvarchar(200) NOT NULL,
  [子件名称] nvarchar(200) NULL,
  [规格型号] nvarchar(200) NULL,
  [子件计量单位] nvarchar(100) NULL,
  [定额数量] decimal(18,4) NULL,
  [损耗率%] decimal(18,4) NULL,
  [需用数量] decimal(18,4) NULL,
  [备注] nvarchar(500) NULL,
  [状态] nvarchar(10) NOT NULL DEFAULT N'启用',
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

-- ===== DEPT 部门 =====
IF OBJECT_ID('bs_dept') IS NULL CREATE TABLE bs_dept (
  id int IDENTITY(1,1) PRIMARY KEY,
  [部门编码] nvarchar(200) NOT NULL,
  [部门名称] nvarchar(200) NOT NULL,
  [负责人] nvarchar(200) NULL,
  [停用] bit NULL,
  [备注] nvarchar(500) NULL,
  [状态] nvarchar(10) NOT NULL DEFAULT N'启用',
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

-- ===== EMP 员工 =====
IF OBJECT_ID('bs_emp') IS NULL CREATE TABLE bs_emp (
  id int IDENTITY(1,1) PRIMARY KEY,
  [员工编码] nvarchar(200) NOT NULL,
  [员工名称] nvarchar(200) NOT NULL,
  [所属部门] nvarchar(100) NULL,
  [业务员] nvarchar(200) NULL,
  [证件类型] nvarchar(200) NULL,
  [证件号码] nvarchar(200) NULL,
  [职务] nvarchar(200) NULL,
  [职称] nvarchar(200) NULL,
  [办公电话] nvarchar(200) NULL,
  [手机] nvarchar(200) NULL,
  [停用] bit NULL,
  [备注] nvarchar(500) NULL,
  [状态] nvarchar(10) NOT NULL DEFAULT N'启用',
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

-- ===== EQUIP 设备 =====
IF OBJECT_ID('bs_equip') IS NULL CREATE TABLE bs_equip (
  id int IDENTITY(1,1) PRIMARY KEY,
  [设备编码] nvarchar(200) NOT NULL,
  [设备名称] nvarchar(200) NOT NULL,
  [所属部门] nvarchar(100) NULL,
  [负责人] nvarchar(200) NULL,
  [产量/小时] decimal(18,4) NULL,
  [停用] bit NULL,
  [备注] nvarchar(500) NULL,
  [状态] nvarchar(10) NOT NULL DEFAULT N'启用',
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

-- ===== INV 存货 =====
IF OBJECT_ID('bs_inv') IS NULL CREATE TABLE bs_inv (
  id int IDENTITY(1,1) PRIMARY KEY,
  [所属类别] nvarchar(100) NOT NULL,
  [存货编码] nvarchar(200) NOT NULL,
  [存货名称] nvarchar(200) NOT NULL,
  [规格型号] nvarchar(200) NULL,
  [计价方式] nvarchar(100) NULL,
  [品牌] nvarchar(200) NULL,
  [计量单位] nvarchar(100) NULL,
  [属性] nvarchar(100) NULL,
  [参考成本] decimal(18,4) NULL,
  [最新成本] decimal(18,4) NULL,
  [建档日期] date NULL,
  [停用] bit NULL,
  [备注] nvarchar(500) NULL,
  [状态] nvarchar(10) NOT NULL DEFAULT N'启用',
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

-- ===== INV_PRICE 存货价格本 =====
IF OBJECT_ID('bs_inv_price') IS NULL CREATE TABLE bs_inv_price (
  id int IDENTITY(1,1) PRIMARY KEY,
  [存货编码] nvarchar(200) NOT NULL,
  [存货名称] nvarchar(200) NOT NULL,
  [规格型号] nvarchar(200) NULL,
  [品牌] nvarchar(200) NULL,
  [计量单位] nvarchar(200) NOT NULL,
  [采购价] decimal(18,4) NULL,
  [委外价] decimal(18,4) NULL,
  [零售价] decimal(18,4) NULL,
  [普通客户价] decimal(18,4) NULL,
  [一级批发价] decimal(18,4) NULL,
  [二级批发价] decimal(18,4) NULL,
  [三级批发价] decimal(18,4) NULL,
  [四级批发价] decimal(18,4) NULL,
  [五级批发价] decimal(18,4) NULL,
  [最新售价] decimal(18,4) NULL,
  [最低售价] decimal(18,4) NULL,
  [最新进价] decimal(18,4) NULL,
  [最高进价] decimal(18,4) NULL,
  [加价率%] decimal(18,4) NULL,
  [最近修改日期] date NULL,
  [最高委外价] decimal(18,4) NULL,
  [扣率%] decimal(18,4) NULL,
  [操作员] nvarchar(200) NULL,
  [建档人] nvarchar(200) NULL,
  [备注] nvarchar(500) NULL,
  [状态] nvarchar(10) NOT NULL DEFAULT N'启用',
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

-- ===== OP 工序 =====
IF OBJECT_ID('bs_op') IS NULL CREATE TABLE bs_op (
  id int IDENTITY(1,1) PRIMARY KEY,
  [工序编码] nvarchar(200) NOT NULL,
  [工序名称] nvarchar(200) NOT NULL,
  [默认车间] nvarchar(100) NULL,
  [关键工序] bit NULL,
  [加工方式] nvarchar(100) NULL,
  [标准合格率%] decimal(18,4) NULL,
  [按辅单位计价] bit NULL,
  [辅单位] nvarchar(100) NULL,
  [换算率] decimal(18,4) NULL,
  [默认工资类型] nvarchar(100) NULL,
  [计件依据] nvarchar(100) NULL,
  [是否停用] bit NULL,
  [备注] nvarchar(500) NULL,
  [状态] nvarchar(10) NOT NULL DEFAULT N'启用',
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

-- ===== PARTNER 往来单位 =====
IF OBJECT_ID('bs_partner') IS NULL CREATE TABLE bs_partner (
  id int IDENTITY(1,1) PRIMARY KEY,
  [往来单位编码] nvarchar(200) NOT NULL,
  [往来单位名称] nvarchar(200) NOT NULL,
  [性质] nvarchar(100) NULL,
  [结算客户] bit NULL,
  [客户价格等级] nvarchar(100) NULL,
  [分管部门] nvarchar(100) NULL,
  [分管人员] nvarchar(200) NULL,
  [建档日期] date NULL,
  [应收余额] decimal(18,4) NULL,
  [应付余额] decimal(18,4) NULL,
  [预收余额] decimal(18,4) NULL,
  [预付余额] decimal(18,4) NULL,
  [往来余额] decimal(18,4) NULL,
  [停用] bit NULL,
  [职位] nvarchar(200) NULL,
  [备注] nvarchar(500) NULL,
  [状态] nvarchar(10) NOT NULL DEFAULT N'启用',
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

-- ===== PROJ 项目 =====
IF OBJECT_ID('bs_proj') IS NULL CREATE TABLE bs_proj (
  id int IDENTITY(1,1) PRIMARY KEY,
  [项目编码] nvarchar(200) NOT NULL,
  [项目名称] nvarchar(200) NOT NULL,
  [停用] bit NULL,
  [所属类别] nvarchar(200) NULL,
  [备注] nvarchar(500) NULL,
  [状态] nvarchar(10) NOT NULL DEFAULT N'启用',
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

-- ===== QC_ITEM 检验项目 =====
IF OBJECT_ID('bs_qc_item') IS NULL CREATE TABLE bs_qc_item (
  id int IDENTITY(1,1) PRIMARY KEY,
  [项目编码] nvarchar(200) NOT NULL,
  [项目名称] nvarchar(200) NOT NULL,
  [检验内容] nvarchar(200) NOT NULL,
  [检验标准] nvarchar(200) NOT NULL,
  [数据类型] nvarchar(100) NOT NULL,
  [计量单位] nvarchar(200) NULL,
  [判定规则] nvarchar(100) NOT NULL,
  [标准下限] decimal(18,4) NULL,
  [标准上限] decimal(18,4) NULL,
  [停用] bit NULL,
  [备注] nvarchar(500) NULL,
  [状态] nvarchar(10) NOT NULL DEFAULT N'启用',
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

-- ===== QC_PLAN 检验方案 =====
IF OBJECT_ID('bs_qc_plan') IS NULL CREATE TABLE bs_qc_plan (
  id int IDENTITY(1,1) PRIMARY KEY,
  [方案编码] nvarchar(200) NOT NULL,
  [方案名称] nvarchar(200) NOT NULL,
  [适用存货] nvarchar(200) NULL,
  [适用存货类别] nvarchar(200) NULL,
  [检验方式] nvarchar(100) NOT NULL,
  [抽检比例%] decimal(18,4) NULL,
  [停用] bit NULL,
  [备注] nvarchar(500) NULL,
  [状态] nvarchar(10) NOT NULL DEFAULT N'启用',
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

-- ===== REGION 地区 =====
IF OBJECT_ID('bs_region') IS NULL CREATE TABLE bs_region (
  id int IDENTITY(1,1) PRIMARY KEY,
  [地区编码] nvarchar(200) NOT NULL,
  [地区名称] nvarchar(200) NOT NULL,
  [备注] nvarchar(500) NULL,
  [状态] nvarchar(10) NOT NULL DEFAULT N'启用',
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

-- ===== REJECT 不合格原因 =====
IF OBJECT_ID('bs_reject') IS NULL CREATE TABLE bs_reject (
  id int IDENTITY(1,1) PRIMARY KEY,
  [不合格原因编码] nvarchar(200) NOT NULL,
  [不合格原因] nvarchar(200) NOT NULL,
  [停用] bit NULL,
  [备注] nvarchar(500) NULL,
  [状态] nvarchar(10) NOT NULL DEFAULT N'启用',
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

-- ===== ROUTE 工艺路线 =====
IF OBJECT_ID('bs_route') IS NULL CREATE TABLE bs_route (
  id int IDENTITY(1,1) PRIMARY KEY,
  [工艺路线编码] nvarchar(200) NOT NULL,
  [工艺路线名称] nvarchar(200) NOT NULL,
  [停用] bit NULL,
  [加工顺序] int NULL,
  [工序编码] nvarchar(200) NOT NULL,
  [工序名称] nvarchar(200) NULL,
  [加工方式] nvarchar(100) NULL,
  [生产车间] nvarchar(100) NULL,
  [工资类型] nvarchar(100) NULL,
  [计件依据] nvarchar(100) NULL,
  [委外供应商] nvarchar(200) NULL,
  [按辅单位计价] bit NULL,
  [辅单位] nvarchar(100) NULL,
  [换算率] decimal(18,4) NULL,
  [默认报工数量] decimal(18,4) NULL,
  [关键工序] bit NULL,
  [标准合格率%] decimal(18,4) NULL,
  [备注] nvarchar(500) NULL,
  [状态] nvarchar(10) NOT NULL DEFAULT N'启用',
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

-- ===== TEAM 班组 =====
IF OBJECT_ID('bs_team') IS NULL CREATE TABLE bs_team (
  id int IDENTITY(1,1) PRIMARY KEY,
  [班组编码] nvarchar(200) NOT NULL,
  [班组名称] nvarchar(200) NOT NULL,
  [所属部门] nvarchar(100) NULL,
  [是否停用] bit NULL,
  [备注] nvarchar(500) NULL,
  [状态] nvarchar(10) NOT NULL DEFAULT N'启用',
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

-- ===== UOM 计量单位 =====
IF OBJECT_ID('bs_uom') IS NULL CREATE TABLE bs_uom (
  id int IDENTITY(1,1) PRIMARY KEY,
  [计量单位编码] nvarchar(200) NOT NULL,
  [计量单位名称] nvarchar(200) NOT NULL,
  [单位类型] nvarchar(100) NULL,
  [主单位] nvarchar(200) NULL,
  [换算率] decimal(18,4) NULL,
  [备注] nvarchar(500) NULL,
  [状态] nvarchar(10) NOT NULL DEFAULT N'启用',
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

-- ===== WC 工作中心 =====
IF OBJECT_ID('bs_wc') IS NULL CREATE TABLE bs_wc (
  id int IDENTITY(1,1) PRIMARY KEY,
  [工作中心编码] nvarchar(200) NOT NULL,
  [工作中心名称] nvarchar(200) NOT NULL,
  [简称] nvarchar(200) NULL,
  [所属分类] nvarchar(100) NULL,
  [所属部门] nvarchar(100) NULL,
  [负责人] nvarchar(200) NULL,
  [班组] nvarchar(100) NULL,
  [工人] nvarchar(200) NULL,
  [设备] nvarchar(200) NULL,
  [产量/小时] decimal(18,4) NULL,
  [工作时间取值] nvarchar(100) NULL,
  [工作时间（小时）] decimal(18,4) NULL,
  [加班时间（小时）] decimal(18,4) NULL,
  [停用] bit NULL,
  [备注] nvarchar(500) NULL,
  [状态] nvarchar(10) NOT NULL DEFAULT N'启用',
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

-- ===== WH 仓库 =====
IF OBJECT_ID('bs_wh') IS NULL CREATE TABLE bs_wh (
  id int IDENTITY(1,1) PRIMARY KEY,
  [仓库编码] nvarchar(200) NOT NULL,
  [仓库名称] nvarchar(200) NOT NULL,
  [仓库地址] nvarchar(200) NULL,
  [负责人] nvarchar(200) NULL,
  [停用] bit NULL,
  [允许零库存出库] bit NULL,
  [备注] nvarchar(500) NULL,
  [状态] nvarchar(10) NOT NULL DEFAULT N'启用',
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO
