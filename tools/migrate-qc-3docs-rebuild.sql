-- migrate-qc-3docs-rebuild.sql — 来料三单重建为 legacy 真实字段(2026-09-14)
-- 背景: migrate-qc-3docs.sql 建的 送料暂收单/来料检验单/暂收退回单 是简化草稿(六表 0 行),
--       本次按生产在用单据的真实字段重建: 暂收入库单(legacy dh)/暂收退料单(与入库一致)/检验单(legacy jyd)。
--       面板编码不变(QC_RECV/QC_RETURN/QC_INSP),菜单位置不变(品质管理·来料品质:暂收→检验→退料),
--       重建 表结构 + yj_field + 面板名;检验单头部新增 附件1..6(yj_attachment 锚点,PanelxForm 走 FileAttachCell)。
-- 惯例: 供应商代码/供应商=参照 PARTNER(往来单位编码/名称双向带动,同 PURCHASE_IN);部门=参照 DEPT;
--       物料编码=参照 INV 存货编码;同名列头行两表都有时一条 yj_field 行 place 合并(如 'header,detail',同旧版 备注)。
-- 幂等: 可重复执行。空表 DROP 重建;非空(生产已录数据时)只补新列保数据并留旧列。
-- 运行(UTF-8 无 BOM,需 -f 65001):
--   docker cp tools/migrate-qc-3docs-rebuild.sql mssql2019:/tmp/
--   docker exec mssql2019 bash -c "/opt/mssql-tools18/bin/sqlcmd -S localhost -U yinjia -P '***' -d HSDZ_MES -C -f 65001 -i /tmp/migrate-qc-3docs-rebuild.sql"
SET NOCOUNT ON;

-- ══════════ 1. 暂收入库单 QC_RECV(qc_recv/qc_recv_detail,前缀 ZS) ══════════
EXEC(N'IF OBJECT_ID(''qc_recv'') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM qc_recv) DROP TABLE qc_recv;'); -- 动态SQL:表不存在时同批编译不过(2026-09-23 合并重放修复)
IF OBJECT_ID('qc_recv') IS NULL CREATE TABLE qc_recv (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [业务员] nvarchar(50) NULL,
  [供应商代码] nvarchar(100) NULL,
  [供应商] nvarchar(200) NULL,
  [部门] nvarchar(100) NULL,
  [部门名称] nvarchar(100) NULL,
  [数量] decimal(18,4) NULL,
  [备注] nvarchar(500) NULL,
  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿',
  [审核人] nvarchar(50) NULL,
  [审核时间] nvarchar(30) NULL,
  [审批人] nvarchar(50) NULL,
  [审批时间] nvarchar(30) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
IF OBJECT_ID('qc_recv') IS NOT NULL AND COL_LENGTH('dbo.qc_recv', N'业务员') IS NULL ALTER TABLE qc_recv ADD [业务员] nvarchar(50) NULL, [供应商代码] nvarchar(100) NULL, [部门] nvarchar(100) NULL, [部门名称] nvarchar(100) NULL, [数量] decimal(18,4) NULL;
EXEC(N'IF OBJECT_ID(''qc_recv_detail'') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM qc_recv_detail) DROP TABLE qc_recv_detail;'); -- 动态SQL:表不存在时同批编译不过(2026-09-23 合并重放修复)
IF OBJECT_ID('qc_recv_detail') IS NULL CREATE TABLE qc_recv_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [物料编码] nvarchar(100) NULL,
  [物料名称] nvarchar(200) NULL,
  [型号] nvarchar(200) NULL,
  [物料描述] nvarchar(500) NULL,
  [数量] decimal(18,4) NULL,
  [日期] nvarchar(20) NULL,
  [供应商] nvarchar(200) NULL,
  [单价] decimal(18,4) NULL,
  [折扣] decimal(18,4) NULL,
  [金额] decimal(18,4) NULL,
  [备注] nvarchar(500) NULL,
  [采购单号] nvarchar(60) NULL,
  [入库数量] decimal(18,4) NULL,
  [入库单号] nvarchar(60) NULL,
  [领料单号] nvarchar(60) NULL,
  [结案] nvarchar(10) NULL,
  [税别代码] nvarchar(40) NULL,
  [税别说明] nvarchar(100) NULL,
  [税额] decimal(18,4) NULL,
  [总金额] decimal(18,4) NULL,
  [订单号] nvarchar(60) NULL,
  [箱数] decimal(18,4) NULL,
  [部门] nvarchar(100) NULL,
  [部门名称] nvarchar(100) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
-- 非空陈旧结构逐列补齐(每列独立判断,任意中间状态可收敛;已有列自动跳过)
IF OBJECT_ID('qc_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_recv_detail', N'型号') IS NULL ALTER TABLE qc_recv_detail ADD [型号] nvarchar(200) NULL;
IF OBJECT_ID('qc_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_recv_detail', N'物料描述') IS NULL ALTER TABLE qc_recv_detail ADD [物料描述] nvarchar(500) NULL;
IF OBJECT_ID('qc_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_recv_detail', N'日期') IS NULL ALTER TABLE qc_recv_detail ADD [日期] nvarchar(20) NULL;
IF OBJECT_ID('qc_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_recv_detail', N'供应商') IS NULL ALTER TABLE qc_recv_detail ADD [供应商] nvarchar(200) NULL;
IF OBJECT_ID('qc_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_recv_detail', N'单价') IS NULL ALTER TABLE qc_recv_detail ADD [单价] decimal(18,4) NULL;
IF OBJECT_ID('qc_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_recv_detail', N'折扣') IS NULL ALTER TABLE qc_recv_detail ADD [折扣] decimal(18,4) NULL;
IF OBJECT_ID('qc_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_recv_detail', N'金额') IS NULL ALTER TABLE qc_recv_detail ADD [金额] decimal(18,4) NULL;
IF OBJECT_ID('qc_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_recv_detail', N'采购单号') IS NULL ALTER TABLE qc_recv_detail ADD [采购单号] nvarchar(60) NULL;
IF OBJECT_ID('qc_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_recv_detail', N'入库数量') IS NULL ALTER TABLE qc_recv_detail ADD [入库数量] decimal(18,4) NULL;
IF OBJECT_ID('qc_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_recv_detail', N'入库单号') IS NULL ALTER TABLE qc_recv_detail ADD [入库单号] nvarchar(60) NULL;
IF OBJECT_ID('qc_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_recv_detail', N'领料单号') IS NULL ALTER TABLE qc_recv_detail ADD [领料单号] nvarchar(60) NULL;
IF OBJECT_ID('qc_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_recv_detail', N'结案') IS NULL ALTER TABLE qc_recv_detail ADD [结案] nvarchar(10) NULL;
IF OBJECT_ID('qc_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_recv_detail', N'税别代码') IS NULL ALTER TABLE qc_recv_detail ADD [税别代码] nvarchar(40) NULL;
IF OBJECT_ID('qc_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_recv_detail', N'税别说明') IS NULL ALTER TABLE qc_recv_detail ADD [税别说明] nvarchar(100) NULL;
IF OBJECT_ID('qc_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_recv_detail', N'税额') IS NULL ALTER TABLE qc_recv_detail ADD [税额] decimal(18,4) NULL;
IF OBJECT_ID('qc_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_recv_detail', N'总金额') IS NULL ALTER TABLE qc_recv_detail ADD [总金额] decimal(18,4) NULL;
IF OBJECT_ID('qc_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_recv_detail', N'订单号') IS NULL ALTER TABLE qc_recv_detail ADD [订单号] nvarchar(60) NULL;
IF OBJECT_ID('qc_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_recv_detail', N'箱数') IS NULL ALTER TABLE qc_recv_detail ADD [箱数] decimal(18,4) NULL;
IF OBJECT_ID('qc_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_recv_detail', N'部门') IS NULL ALTER TABLE qc_recv_detail ADD [部门] nvarchar(100) NULL;
IF OBJECT_ID('qc_recv_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_recv_detail', N'部门名称') IS NULL ALTER TABLE qc_recv_detail ADD [部门名称] nvarchar(100) NULL;
GO
-- ══════════ 2. 暂收退料单 QC_RETURN(qc_return/qc_return_detail,前缀 TH,与入库一致) ══════════
EXEC(N'IF OBJECT_ID(''qc_return'') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM qc_return) DROP TABLE qc_return;'); -- 动态SQL:表不存在时同批编译不过(2026-09-23 合并重放修复)
IF OBJECT_ID('qc_return') IS NULL CREATE TABLE qc_return (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [业务员] nvarchar(50) NULL,
  [供应商代码] nvarchar(100) NULL,
  [供应商] nvarchar(200) NULL,
  [部门] nvarchar(100) NULL,
  [部门名称] nvarchar(100) NULL,
  [数量] decimal(18,4) NULL,
  [备注] nvarchar(500) NULL,
  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿',
  [审核人] nvarchar(50) NULL,
  [审核时间] nvarchar(30) NULL,
  [审批人] nvarchar(50) NULL,
  [审批时间] nvarchar(30) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
IF OBJECT_ID('qc_return') IS NOT NULL AND COL_LENGTH('dbo.qc_return', N'业务员') IS NULL ALTER TABLE qc_return ADD [业务员] nvarchar(50) NULL, [供应商代码] nvarchar(100) NULL, [部门] nvarchar(100) NULL, [部门名称] nvarchar(100) NULL, [数量] decimal(18,4) NULL;
EXEC(N'IF OBJECT_ID(''qc_return_detail'') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM qc_return_detail) DROP TABLE qc_return_detail;'); -- 动态SQL:表不存在时同批编译不过(2026-09-23 合并重放修复)
IF OBJECT_ID('qc_return_detail') IS NULL CREATE TABLE qc_return_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [物料编码] nvarchar(100) NULL,
  [物料名称] nvarchar(200) NULL,
  [型号] nvarchar(200) NULL,
  [物料描述] nvarchar(500) NULL,
  [数量] decimal(18,4) NULL,
  [日期] nvarchar(20) NULL,
  [供应商] nvarchar(200) NULL,
  [单价] decimal(18,4) NULL,
  [折扣] decimal(18,4) NULL,
  [金额] decimal(18,4) NULL,
  [备注] nvarchar(500) NULL,
  [采购单号] nvarchar(60) NULL,
  [入库数量] decimal(18,4) NULL,
  [入库单号] nvarchar(60) NULL,
  [领料单号] nvarchar(60) NULL,
  [结案] nvarchar(10) NULL,
  [税别代码] nvarchar(40) NULL,
  [税别说明] nvarchar(100) NULL,
  [税额] decimal(18,4) NULL,
  [总金额] decimal(18,4) NULL,
  [订单号] nvarchar(60) NULL,
  [箱数] decimal(18,4) NULL,
  [部门] nvarchar(100) NULL,
  [部门名称] nvarchar(100) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
IF OBJECT_ID('qc_return_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_return_detail', N'型号') IS NULL ALTER TABLE qc_return_detail ADD [型号] nvarchar(200) NULL;
IF OBJECT_ID('qc_return_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_return_detail', N'物料描述') IS NULL ALTER TABLE qc_return_detail ADD [物料描述] nvarchar(500) NULL;
IF OBJECT_ID('qc_return_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_return_detail', N'日期') IS NULL ALTER TABLE qc_return_detail ADD [日期] nvarchar(20) NULL;
IF OBJECT_ID('qc_return_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_return_detail', N'供应商') IS NULL ALTER TABLE qc_return_detail ADD [供应商] nvarchar(200) NULL;
IF OBJECT_ID('qc_return_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_return_detail', N'单价') IS NULL ALTER TABLE qc_return_detail ADD [单价] decimal(18,4) NULL;
IF OBJECT_ID('qc_return_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_return_detail', N'折扣') IS NULL ALTER TABLE qc_return_detail ADD [折扣] decimal(18,4) NULL;
IF OBJECT_ID('qc_return_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_return_detail', N'金额') IS NULL ALTER TABLE qc_return_detail ADD [金额] decimal(18,4) NULL;
IF OBJECT_ID('qc_return_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_return_detail', N'采购单号') IS NULL ALTER TABLE qc_return_detail ADD [采购单号] nvarchar(60) NULL;
IF OBJECT_ID('qc_return_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_return_detail', N'入库数量') IS NULL ALTER TABLE qc_return_detail ADD [入库数量] decimal(18,4) NULL;
IF OBJECT_ID('qc_return_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_return_detail', N'入库单号') IS NULL ALTER TABLE qc_return_detail ADD [入库单号] nvarchar(60) NULL;
IF OBJECT_ID('qc_return_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_return_detail', N'领料单号') IS NULL ALTER TABLE qc_return_detail ADD [领料单号] nvarchar(60) NULL;
IF OBJECT_ID('qc_return_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_return_detail', N'结案') IS NULL ALTER TABLE qc_return_detail ADD [结案] nvarchar(10) NULL;
IF OBJECT_ID('qc_return_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_return_detail', N'税别代码') IS NULL ALTER TABLE qc_return_detail ADD [税别代码] nvarchar(40) NULL;
IF OBJECT_ID('qc_return_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_return_detail', N'税别说明') IS NULL ALTER TABLE qc_return_detail ADD [税别说明] nvarchar(100) NULL;
IF OBJECT_ID('qc_return_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_return_detail', N'税额') IS NULL ALTER TABLE qc_return_detail ADD [税额] decimal(18,4) NULL;
IF OBJECT_ID('qc_return_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_return_detail', N'总金额') IS NULL ALTER TABLE qc_return_detail ADD [总金额] decimal(18,4) NULL;
IF OBJECT_ID('qc_return_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_return_detail', N'订单号') IS NULL ALTER TABLE qc_return_detail ADD [订单号] nvarchar(60) NULL;
IF OBJECT_ID('qc_return_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_return_detail', N'箱数') IS NULL ALTER TABLE qc_return_detail ADD [箱数] decimal(18,4) NULL;
IF OBJECT_ID('qc_return_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_return_detail', N'部门') IS NULL ALTER TABLE qc_return_detail ADD [部门] nvarchar(100) NULL;
IF OBJECT_ID('qc_return_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_return_detail', N'部门名称') IS NULL ALTER TABLE qc_return_detail ADD [部门名称] nvarchar(100) NULL;
GO
-- ══════════ 3. 检验单 QC_INSP(qc_insp/qc_insp_detail,前缀 IJ,头部 6 附件) ══════════
EXEC(N'IF OBJECT_ID(''qc_insp'') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM qc_insp) DROP TABLE qc_insp;'); -- 动态SQL:表不存在时同批编译不过(2026-09-23 合并重放修复)
IF OBJECT_ID('qc_insp') IS NULL CREATE TABLE qc_insp (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [业务员] nvarchar(50) NULL,
  [供应商代码] nvarchar(100) NULL,
  [供应商] nvarchar(200) NULL,
  [部门] nvarchar(100) NULL,
  [部门名称] nvarchar(100) NULL,
  [数量] decimal(18,4) NULL,
  [附件1] nvarchar(500) NULL, [附件2] nvarchar(500) NULL, [附件3] nvarchar(500) NULL,
  [附件4] nvarchar(500) NULL, [附件5] nvarchar(500) NULL, [附件6] nvarchar(500) NULL,
  [备注] nvarchar(500) NULL,
  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿',
  [审核人] nvarchar(50) NULL,
  [审核时间] nvarchar(30) NULL,
  [审批人] nvarchar(50) NULL,
  [审批时间] nvarchar(30) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
IF OBJECT_ID('qc_insp') IS NOT NULL AND COL_LENGTH('dbo.qc_insp', N'附件1') IS NULL ALTER TABLE qc_insp ADD [业务员] nvarchar(50) NULL, [供应商代码] nvarchar(100) NULL, [部门] nvarchar(100) NULL, [部门名称] nvarchar(100) NULL, [数量] decimal(18,4) NULL, [附件1] nvarchar(500) NULL, [附件2] nvarchar(500) NULL, [附件3] nvarchar(500) NULL, [附件4] nvarchar(500) NULL, [附件5] nvarchar(500) NULL, [附件6] nvarchar(500) NULL;
-- 检验员/批号/送检数量:legacy 真实表本无此三列,但 v_lot_trace(批号追溯视图)在用,重建保留(2026-09-17 收编入链时补)
IF OBJECT_ID('qc_insp') IS NOT NULL AND COL_LENGTH('dbo.qc_insp', N'检验员') IS NULL ALTER TABLE qc_insp ADD [检验员] nvarchar(50) NULL;
EXEC(N'IF OBJECT_ID(''qc_insp_detail'') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM qc_insp_detail) DROP TABLE qc_insp_detail;'); -- 动态SQL:表不存在时同批编译不过(2026-09-23 合并重放修复)
IF OBJECT_ID('qc_insp_detail') IS NULL CREATE TABLE qc_insp_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [物料编码] nvarchar(100) NULL,
  [物料名称] nvarchar(200) NULL,
  [型号] nvarchar(200) NULL,
  [物料描述] nvarchar(500) NULL,
  [批号] nvarchar(30) NULL,
  [送检数量] decimal(18,4) NULL,
  [数量] decimal(18,4) NULL,
  [箱数] decimal(18,4) NULL,
  [日期] nvarchar(20) NULL,
  [备注] nvarchar(500) NULL,
  [合格数量] decimal(18,4) NULL,
  [不良数量] decimal(18,4) NULL,
  [结案] nvarchar(10) NULL,
  [入库单号] nvarchar(60) NULL,
  [仓库代码] nvarchar(60) NULL,
  [抽样方案] nvarchar(100) NULL,
  [品质复核人] nvarchar(50) NULL,
  [品质复核时间] nvarchar(30) NULL,
  [部门] nvarchar(100) NULL,
  [部门名称] nvarchar(100) NULL,
  [业务员] nvarchar(50) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
IF OBJECT_ID('qc_insp_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_insp_detail', N'箱数') IS NULL ALTER TABLE qc_insp_detail ADD [型号] nvarchar(200) NULL, [物料描述] nvarchar(500) NULL, [箱数] decimal(18,4) NULL, [日期] nvarchar(20) NULL, [结案] nvarchar(10) NULL, [入库单号] nvarchar(60) NULL, [仓库代码] nvarchar(60) NULL, [抽样方案] nvarchar(100) NULL, [品质复核人] nvarchar(50) NULL, [品质复核时间] nvarchar(30) NULL, [部门] nvarchar(100) NULL, [部门名称] nvarchar(100) NULL, [业务员] nvarchar(50) NULL;
IF OBJECT_ID('qc_insp_detail') IS NOT NULL AND COL_LENGTH('dbo.qc_insp_detail', N'批号') IS NULL ALTER TABLE qc_insp_detail ADD [批号] nvarchar(30) NULL, [送检数量] decimal(18,4) NULL;
GO

-- ══════════ 4. 面板注册/改名(编码不变;全新库 INSERT,已有库 UPDATE 改名) ══════════
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='QC_RECV')
  INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
  VALUES ('QC_RECV', N'暂收入库单', N'采购管理', 'doc', 'qc_recv_detail', 'qc_recv', N'单据编号', N'id', N'单据编号', N'ZS', N'单据日期', 20, 'items', N'智能供应链', N'Temporary Receipt Inbound');
ELSE
  UPDATE yj_panel SET panel_name=N'暂收入库单', panel_name_en=N'Temporary Receipt Inbound', head_table='qc_recv', line_table='qc_recv_detail', prefix=N'ZS', date_col=N'单据日期' WHERE panel_code='QC_RECV';
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='QC_RETURN')
  INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
  VALUES ('QC_RETURN', N'暂收退料单', N'采购管理', 'doc', 'qc_return_detail', 'qc_return', N'单据编号', N'id', N'单据编号', N'TH', N'单据日期', 20, 'items', N'智能供应链', N'Temporary Receipt Return');
ELSE
  UPDATE yj_panel SET panel_name=N'暂收退料单', panel_name_en=N'Temporary Receipt Return', head_table='qc_return', line_table='qc_return_detail', prefix=N'TH', date_col=N'单据日期' WHERE panel_code='QC_RETURN';
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='QC_INSP')
  INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
  VALUES ('QC_INSP', N'检验单', N'采购管理', 'doc', 'qc_insp_detail', 'qc_insp', N'单据编号', N'id', N'单据编号', N'IJ', N'单据日期', 20, 'items', N'智能供应链', N'Inspection Sheet');
ELSE
  UPDATE yj_panel SET panel_name=N'检验单', panel_name_en=N'Inspection Sheet', head_table='qc_insp', line_table='qc_insp_detail', prefix=N'IJ', date_col=N'单据日期' WHERE panel_code='QC_INSP';
GO

-- ══════════ 5. 字段元数据:清旧插新(一条 col_name 一行;头行两表都有时 place 合并) ══════════
DELETE FROM yj_field WHERE panel_code IN ('QC_RECV','QC_RETURN','QC_INSP');
GO
-- 5.1 暂收入库单(明细行字段顺序对齐 legacy:单号→物料→数量→日期→供应商→单价→折扣→金额→备注→采购单号→入库数量→入库单号→领料单号→结案→税别→订单号→箱数→部门)
--     双位置字段(供应商/部门/部门名称/数量/备注/单据编号)拆成 表头行+明细行 两行元数据,两处顺序各自独立
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('QC_RECV', N'单据编号', N'单号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 10, 140, 0, 1, 0, 1),
('QC_RECV', N'单据日期', N'日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 20, 120, 1, 1, 0, 1),
('QC_RECV', N'业务员', N'业务员', N'文本', NULL, NULL, NULL, NULL, N'query,header', 30, 100, 1, 0, 0, 1),
('QC_RECV', N'供应商代码', N'供应商代码', N'参照', NULL, N'PARTNER', N'往来单位编码', N'往来单位名称', N'query,header', 40, 130, 1, 0, 0, 1),
('QC_RECV', N'供应商', N'供应商', N'参照', NULL, N'PARTNER', N'往来单位名称', N'往来单位名称', N'query,header', 50, 180, 1, 0, 0, 1),
('QC_RECV', N'部门', N'部门', N'参照', NULL, N'DEPT', N'部门名称', N'部门名称', N'header', 60, 120, 1, 0, 0, 1),
('QC_RECV', N'部门名称', N'部门名称', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 120, 1, 0, 0, 1),
('QC_RECV', N'数量', N'数量', N'小数', NULL, NULL, NULL, NULL, N'header', 80, 100, 1, 0, 0, 1),
('QC_RECV', N'单据编号', N'单号', N'文本', NULL, NULL, NULL, NULL, N'detail', 190, 150, 0, 0, 0, 1),
('QC_RECV', N'物料编码', N'物料编码', N'参照', NULL, N'INV', N'存货编码', N'存货编码', N'query,detail', 200, 130, 1, 1, 0, 1),
('QC_RECV', N'物料名称', N'物料名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 210, 160, 1, 0, 0, 1),
('QC_RECV', N'型号', N'型号', N'文本', NULL, NULL, NULL, NULL, N'detail', 220, 140, 1, 0, 0, 1),
('QC_RECV', N'物料描述', N'物料描述', N'文本', NULL, NULL, NULL, NULL, N'detail', 230, 200, 1, 0, 0, 1),
('QC_RECV', N'数量', N'数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 240, 100, 1, 0, 0, 1),
('QC_RECV', N'日期', N'日期', N'日期', NULL, NULL, NULL, NULL, N'detail', 250, 110, 1, 0, 0, 1),
('QC_RECV', N'供应商', N'供应商', N'参照', NULL, N'PARTNER', N'往来单位名称', N'往来单位名称', N'detail', 260, 160, 1, 0, 0, 1),
('QC_RECV', N'单价', N'单价', N'小数', NULL, NULL, NULL, NULL, N'detail', 270, 90, 1, 0, 0, 1),
('QC_RECV', N'折扣', N'折扣', N'小数', NULL, NULL, NULL, NULL, N'detail', 280, 80, 1, 0, 0, 1),
('QC_RECV', N'金额', N'金额', N'小数', NULL, NULL, NULL, NULL, N'detail', 290, 100, 1, 0, 0, 1),
('QC_RECV', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 300, 200, 1, 0, 0, 1),
('QC_RECV', N'采购单号', N'采购单号', N'参照', NULL, N'PU_ORDER', N'单据编号', N'单据编号', N'detail', 310, 140, 1, 0, 0, 1),
('QC_RECV', N'入库数量', N'入库数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 320, 100, 1, 0, 0, 1),
('QC_RECV', N'入库单号', N'入库单号', N'文本', NULL, NULL, NULL, NULL, N'detail', 330, 130, 1, 0, 0, 1),
('QC_RECV', N'领料单号', N'领料单号', N'文本', NULL, NULL, NULL, NULL, N'detail', 340, 130, 1, 0, 0, 1),
('QC_RECV', N'结案', N'结案', N'下拉框', N'SELECT v FROM (VALUES (N''是''),(N''否'')) AS t(v)', NULL, NULL, NULL, N'detail', 350, 80, 1, 0, 0, 1),
('QC_RECV', N'税别代码', N'税别代码', N'文本', NULL, NULL, NULL, NULL, N'detail', 360, 100, 1, 0, 0, 1),
('QC_RECV', N'税别说明', N'税别说明', N'文本', NULL, NULL, NULL, NULL, N'detail', 370, 120, 1, 0, 0, 1),
('QC_RECV', N'税额', N'税额', N'小数', NULL, NULL, NULL, NULL, N'detail', 380, 90, 1, 0, 0, 1),
('QC_RECV', N'总金额', N'总金额', N'小数', NULL, NULL, NULL, NULL, N'detail', 390, 100, 1, 0, 0, 1),
('QC_RECV', N'订单号', N'订单号', N'参照', NULL, N'SO_ORDER', N'单据编号', N'单据编号', N'detail', 400, 140, 1, 0, 0, 1),
('QC_RECV', N'箱数', N'箱数', N'小数', NULL, NULL, NULL, NULL, N'detail', 410, 80, 1, 0, 0, 1),
('QC_RECV', N'部门', N'部门', N'参照', NULL, N'DEPT', N'部门名称', N'部门名称', N'detail', 420, 100, 1, 0, 0, 1),
('QC_RECV', N'部门名称', N'部门名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 430, 100, 1, 0, 0, 1);
GO
-- 5.2 暂收退料单(与入库一致)
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('QC_RETURN', N'单据编号', N'单号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 10, 140, 0, 1, 0, 1),
('QC_RETURN', N'单据日期', N'日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 20, 120, 1, 1, 0, 1),
('QC_RETURN', N'业务员', N'业务员', N'文本', NULL, NULL, NULL, NULL, N'query,header', 30, 100, 1, 0, 0, 1),
('QC_RETURN', N'供应商代码', N'供应商代码', N'参照', NULL, N'PARTNER', N'往来单位编码', N'往来单位名称', N'query,header', 40, 130, 1, 0, 0, 1),
('QC_RETURN', N'供应商', N'供应商', N'参照', NULL, N'PARTNER', N'往来单位名称', N'往来单位名称', N'query,header', 50, 180, 1, 0, 0, 1),
('QC_RETURN', N'部门', N'部门', N'参照', NULL, N'DEPT', N'部门名称', N'部门名称', N'header', 60, 120, 1, 0, 0, 1),
('QC_RETURN', N'部门名称', N'部门名称', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 120, 1, 0, 0, 1),
('QC_RETURN', N'数量', N'数量', N'小数', NULL, NULL, NULL, NULL, N'header', 80, 100, 1, 0, 0, 1),
('QC_RETURN', N'单据编号', N'单号', N'文本', NULL, NULL, NULL, NULL, N'detail', 190, 150, 0, 0, 0, 1),
('QC_RETURN', N'物料编码', N'物料编码', N'参照', NULL, N'INV', N'存货编码', N'存货编码', N'query,detail', 200, 130, 1, 1, 0, 1),
('QC_RETURN', N'物料名称', N'物料名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 210, 160, 1, 0, 0, 1),
('QC_RETURN', N'型号', N'型号', N'文本', NULL, NULL, NULL, NULL, N'detail', 220, 140, 1, 0, 0, 1),
('QC_RETURN', N'物料描述', N'物料描述', N'文本', NULL, NULL, NULL, NULL, N'detail', 230, 200, 1, 0, 0, 1),
('QC_RETURN', N'数量', N'数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 240, 100, 1, 0, 0, 1),
('QC_RETURN', N'日期', N'日期', N'日期', NULL, NULL, NULL, NULL, N'detail', 250, 110, 1, 0, 0, 1),
('QC_RETURN', N'供应商', N'供应商', N'参照', NULL, N'PARTNER', N'往来单位名称', N'往来单位名称', N'detail', 260, 160, 1, 0, 0, 1),
('QC_RETURN', N'单价', N'单价', N'小数', NULL, NULL, NULL, NULL, N'detail', 270, 90, 1, 0, 0, 1),
('QC_RETURN', N'折扣', N'折扣', N'小数', NULL, NULL, NULL, NULL, N'detail', 280, 80, 1, 0, 0, 1),
('QC_RETURN', N'金额', N'金额', N'小数', NULL, NULL, NULL, NULL, N'detail', 290, 100, 1, 0, 0, 1),
('QC_RETURN', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 300, 200, 1, 0, 0, 1),
('QC_RETURN', N'采购单号', N'采购单号', N'参照', NULL, N'PU_ORDER', N'单据编号', N'单据编号', N'detail', 310, 140, 1, 0, 0, 1),
('QC_RETURN', N'入库数量', N'入库数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 320, 100, 1, 0, 0, 1),
('QC_RETURN', N'入库单号', N'入库单号', N'文本', NULL, NULL, NULL, NULL, N'detail', 330, 130, 1, 0, 0, 1),
('QC_RETURN', N'领料单号', N'领料单号', N'文本', NULL, NULL, NULL, NULL, N'detail', 340, 130, 1, 0, 0, 1),
('QC_RETURN', N'结案', N'结案', N'下拉框', N'SELECT v FROM (VALUES (N''是''),(N''否'')) AS t(v)', NULL, NULL, NULL, N'detail', 350, 80, 1, 0, 0, 1),
('QC_RETURN', N'税别代码', N'税别代码', N'文本', NULL, NULL, NULL, NULL, N'detail', 360, 100, 1, 0, 0, 1),
('QC_RETURN', N'税别说明', N'税别说明', N'文本', NULL, NULL, NULL, NULL, N'detail', 370, 120, 1, 0, 0, 1),
('QC_RETURN', N'税额', N'税额', N'小数', NULL, NULL, NULL, NULL, N'detail', 380, 90, 1, 0, 0, 1),
('QC_RETURN', N'总金额', N'总金额', N'小数', NULL, NULL, NULL, NULL, N'detail', 390, 100, 1, 0, 0, 1),
('QC_RETURN', N'订单号', N'订单号', N'参照', NULL, N'SO_ORDER', N'单据编号', N'单据编号', N'detail', 400, 140, 1, 0, 0, 1),
('QC_RETURN', N'箱数', N'箱数', N'小数', NULL, NULL, NULL, NULL, N'detail', 410, 80, 1, 0, 0, 1),
('QC_RETURN', N'部门', N'部门', N'参照', NULL, N'DEPT', N'部门名称', N'部门名称', N'detail', 420, 100, 1, 0, 0, 1),
('QC_RETURN', N'部门名称', N'部门名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 430, 100, 1, 0, 0, 1);
GO
-- 5.3 检验单(头部 6 附件:data_type=附件,PanelxForm 渲染 FileAttachCell,yj_attachment 存文件)
-- 5.3 检验单(头部 6 附件:data_type=附件,PanelxForm/PanelxList 渲染 FileAttachCell,yj_attachment 存文件)
--     表头 8 字段+附件1..6;明细按规格:单号→物料→数量→箱数→日期→备注→合格/不良→结案→入库→仓库→抽样→复核→部门→业务员
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES
('QC_INSP', N'单据编号', N'单号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 10, 140, 0, 1, 0, 1),
('QC_INSP', N'单据日期', N'日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 20, 120, 1, 1, 0, 1),
('QC_INSP', N'业务员', N'业务员', N'文本', NULL, NULL, NULL, NULL, N'query,header', 30, 100, 1, 0, 0, 1),
('QC_INSP', N'供应商代码', N'供应商代码', N'参照', NULL, N'PARTNER', N'往来单位编码', N'往来单位名称', N'query,header', 40, 130, 1, 0, 0, 1),
('QC_INSP', N'供应商', N'供应商', N'参照', NULL, N'PARTNER', N'往来单位名称', N'往来单位名称', N'query,header', 50, 180, 1, 0, 0, 1),
('QC_INSP', N'部门', N'部门', N'参照', NULL, N'DEPT', N'部门名称', N'部门名称', N'header', 60, 120, 1, 0, 0, 1),
('QC_INSP', N'部门名称', N'部门名称', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 120, 1, 0, 0, 1),
('QC_INSP', N'数量', N'数量', N'小数', NULL, NULL, NULL, NULL, N'header', 80, 100, 1, 0, 0, 1),
('QC_INSP', N'附件1', N'附件1', N'附件', NULL, NULL, NULL, NULL, N'header', 91, 220, 1, 0, 0, 1),
('QC_INSP', N'附件2', N'附件2', N'附件', NULL, NULL, NULL, NULL, N'header', 92, 220, 1, 0, 0, 1),
('QC_INSP', N'附件3', N'附件3', N'附件', NULL, NULL, NULL, NULL, N'header', 93, 220, 1, 0, 0, 1),
('QC_INSP', N'附件4', N'附件4', N'附件', NULL, NULL, NULL, NULL, N'header', 94, 220, 1, 0, 0, 1),
('QC_INSP', N'附件5', N'附件5', N'附件', NULL, NULL, NULL, NULL, N'header', 95, 220, 1, 0, 0, 1),
('QC_INSP', N'附件6', N'附件6', N'附件', NULL, NULL, NULL, NULL, N'header', 96, 220, 1, 0, 0, 1),
('QC_INSP', N'单据编号', N'单号', N'文本', NULL, NULL, NULL, NULL, N'detail', 190, 150, 0, 0, 0, 1),
('QC_INSP', N'物料编码', N'物料编码', N'参照', NULL, N'INV', N'存货编码', N'存货编码', N'query,detail', 200, 130, 1, 1, 0, 1),
('QC_INSP', N'物料名称', N'物料名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 210, 160, 1, 0, 0, 1),
('QC_INSP', N'型号', N'型号', N'文本', NULL, NULL, NULL, NULL, N'detail', 220, 140, 1, 0, 0, 1),
('QC_INSP', N'物料描述', N'物料描述', N'文本', NULL, NULL, NULL, NULL, N'detail', 230, 200, 1, 0, 0, 1),
('QC_INSP', N'数量', N'数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 240, 100, 1, 0, 0, 1),
('QC_INSP', N'箱数', N'箱数', N'小数', NULL, NULL, NULL, NULL, N'detail', 250, 80, 1, 0, 0, 1),
('QC_INSP', N'日期', N'日期', N'日期', NULL, NULL, NULL, NULL, N'detail', 260, 110, 1, 0, 0, 1),
('QC_INSP', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 270, 200, 1, 0, 0, 1),
('QC_INSP', N'合格数量', N'合格数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 280, 100, 1, 1, 0, 1),
('QC_INSP', N'不良数量', N'不良数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 290, 100, 1, 0, 0, 1),
('QC_INSP', N'结案', N'结案', N'下拉框', N'SELECT v FROM (VALUES (N''是''),(N''否'')) AS t(v)', NULL, NULL, NULL, N'detail', 300, 80, 1, 0, 0, 1),
('QC_INSP', N'入库单号', N'入库单号', N'文本', NULL, NULL, NULL, NULL, N'detail', 310, 130, 1, 0, 0, 1),
('QC_INSP', N'仓库代码', N'仓库代码', N'文本', NULL, NULL, NULL, NULL, N'detail', 320, 100, 1, 0, 0, 1),
('QC_INSP', N'抽样方案', N'抽样方案', N'文本', NULL, NULL, NULL, NULL, N'detail', 330, 120, 1, 0, 0, 1),
('QC_INSP', N'品质复核人', N'品质复核人', N'文本', NULL, NULL, NULL, NULL, N'detail', 340, 100, 1, 0, 0, 1),
('QC_INSP', N'品质复核时间', N'品质复核时间', N'文本', NULL, NULL, NULL, NULL, N'detail', 350, 120, 1, 0, 0, 1),
('QC_INSP', N'部门', N'部门', N'参照', NULL, N'DEPT', N'部门名称', N'部门名称', N'detail', 360, 100, 1, 0, 0, 1),
('QC_INSP', N'部门名称', N'部门名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 370, 100, 1, 0, 0, 1),
('QC_INSP', N'业务员', N'业务员', N'文本', NULL, NULL, NULL, NULL, N'detail', 380, 100, 1, 0, 0, 1);
GO

-- ══════════ 6. 译名(en/ja 手工交付;其余语言走 /locale/dict 机翻兜底) ══════════
-- 6.1 面板名(旧名收编清理,新名 en+ja)
DELETE FROM yj_translation WHERE scope='panel' AND ref_key IN (N'送料暂收单', N'来料检验单', N'暂收退回单');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'暂收入库单' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'暂收入库单', 'en', N'Temporary Receipt Inbound', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'暂收入库单' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'暂收入库单', 'ja', N'仮受入庫伝票', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'暂收退料单' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'暂收退料单', 'en', N'Temporary Receipt Return', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'暂收退料单' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'暂收退料单', 'ja', N'仮受返品伝票', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'检验单' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'检验单', 'en', N'Inspection Sheet', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'检验单' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'检验单', 'ja', N'検査伝票', 'manual');
GO
-- 6.2 字段标签(en;已存在的共享标签幂等跳过)
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'供应商代码' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'供应商代码', 'en', N'Supplier Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'型号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'型号', 'en', N'Model', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'物料描述' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'物料描述', 'en', N'Description', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'折扣' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'折扣', 'en', N'Discount', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'采购单号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'采购单号', 'en', N'PO No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'领料单号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'领料单号', 'en', N'Requisition No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结案' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结案', 'en', N'Closed', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'税别代码' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'税别代码', 'en', N'Tax Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'税别说明' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'税别说明', 'en', N'Tax Type', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'税额' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'税额', 'en', N'Tax', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'总金额' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'总金额', 'en', N'Total Amount', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'箱数' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'箱数', 'en', N'Boxes', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'不良数量' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'不良数量', 'en', N'Defective Qty', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'入库单号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'入库单号', 'en', N'Inbound No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库代码' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库代码', 'en', N'Warehouse Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'抽样方案' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'抽样方案', 'en', N'Sampling Plan', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'品质复核人' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'品质复核人', 'en', N'QC Reviewer', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'品质复核时间' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'品质复核时间', 'en', N'QC Review Time', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件1' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件1', 'en', N'Attachment 1', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件2' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件2', 'en', N'Attachment 2', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件3' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件3', 'en', N'Attachment 3', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件4' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件4', 'en', N'Attachment 4', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件5' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件5', 'en', N'Attachment 5', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件6' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件6', 'en', N'Attachment 6', 'manual');
GO
-- 6.3 字段标签(ja;同上幂等)
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'供应商代码' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'供应商代码', 'ja', N'仕入先コード', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'供应商' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'供应商', 'ja', N'仕入先', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'业务员' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'业务员', 'ja', N'営業担当', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'型号' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'型号', 'ja', N'型番', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'物料描述' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'物料描述', 'ja', N'品目説明', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'折扣' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'折扣', 'ja', N'割引', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'采购单号' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'采购单号', 'ja', N'発注番号', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'领料单号' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'领料单号', 'ja', N'出庫依頼番号', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'结案' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'结案', 'ja', N'完了', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'税别代码' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'税别代码', 'ja', N'税区分コード', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'税别说明' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'税别说明', 'ja', N'税区分名', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'税额' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'税额', 'ja', N'税額', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'总金额' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'总金额', 'ja', N'総額', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'订单号' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'订单号', 'ja', N'注文番号', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'箱数' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'箱数', 'ja', N'箱数', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'合格数量' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'合格数量', 'ja', N'合格数量', 'manual');
UPDATE yj_translation SET text = N'不良数' WHERE scope='field' AND ref_key=N'不良数量' AND locale='ja' AND text=N'不良数量';
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'不良数量' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'不良数量', 'ja', N'不良数', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'入库单号' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'入库单号', 'ja', N'入庫番号', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'仓库代码' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'仓库代码', 'ja', N'倉庫コード', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'抽样方案' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'抽样方案', 'ja', N'サンプリング方式', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'品质复核人' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'品质复核人', 'ja', N'品質確認者', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'品质复核时间' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'品质复核时间', 'ja', N'品質確認日時', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件1' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件1', 'ja', N'添付ファイル1', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件2' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件2', 'ja', N'添付ファイル2', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件3' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件3', 'ja', N'添付ファイル3', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件4' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件4', 'ja', N'添付ファイル4', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件5' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件5', 'ja', N'添付ファイル5', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'附件6' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'附件6', 'ja', N'添付ファイル6', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'入库数量' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'入库数量', 'en', N'Inbound Qty', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'入库数量' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'入库数量', 'ja', N'入庫数量', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单号', 'en', N'Doc No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'单号' AND locale='ja') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'单号', 'ja', N'伝票番号', 'manual');
GO

-- ══════════ 7. 收尾:幽灵字段自检(detail 行必须有行表列,header 行必须有头表或行表列) ══════════
SELECT p.panel_code,
       SUM(CASE WHEN f.place LIKE '%detail%' AND COL_LENGTH('dbo.' + p.line_table, f.col_name) IS NULL THEN 1 ELSE 0 END) AS missing_line_cols,
       SUM(CASE WHEN f.place LIKE '%header%' AND COL_LENGTH('dbo.' + p.head_table, f.col_name) IS NULL
                 AND COL_LENGTH('dbo.' + p.line_table, f.col_name) IS NULL THEN 1 ELSE 0 END) AS missing_head_cols
FROM yj_field f JOIN yj_panel p ON p.panel_code = f.panel_code
WHERE f.panel_code IN ('QC_RECV','QC_RETURN','QC_INSP')
GROUP BY p.panel_code;
PRINT N'migrate-qc-3docs-rebuild 完成:来料三单重建(暂收入库单/暂收退料单/检验单+6附件)+字段+en/ja译名';
GO
