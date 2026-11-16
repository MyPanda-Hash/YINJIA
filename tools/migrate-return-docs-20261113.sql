/* ============================================================
   migrate-return-docs-20261113.sql — 2026-11-13
   补齐两张「金蝶有、MES 没有」的退货类单据(用户口径 2026-11-13:
   「销售退货 sal_in_bound 和 生产退料 inv_pick_ret … 根据金蝶erp的字段,和mes其他单据
    对这两个单据的字段显示和隐藏,补齐这两个单,并且测试转erp」)

   ① 销售退货单  SALE_IN       / bd_sale_in       + bl_sale_in       (SR 号)
   ② 生产退料单  MATERIAL_RET  / bd_material_ret + bl_material_ret (TL 号)
   各带 明细表(_DETAIL)/统计表(_STATS) 两个视图面板,口径对齐「其他入库单/其他出库单」。

   字段基线(不是凭印象):
     · 销售退货 = 销售出库(bd_sale_out/bl_sale_out,金蝶 sal_out_bound 接口并集)的整表克隆;
       金蝶 sal_in_bound 相对 sal_out_bound 的**新增头键**只有 return_reason_name 一族 + bill_stock_*
       + ivc_type/cus_*;本脚本只补「退货原因」一列(其余 id/发票/客户承担费用族不参与 MES 业务)。
     · 生产退料 = 材料出库(bd_material_out/bl_material_out,金蝶 inv_pick 接口并集)的整表克隆;
       金蝶 inv_pick_ret **是 inv_pick 的严格子集**(行键完全一致,头只少 pick_type/pick_use_*),
       故不补列,只把 MES 独有的「领料类型/领料用途/单据标签」隐藏。
     · 键集证据 tools/archive/_ret-docs-20261113/ret-field-keys.json(真实账套 6 单逐键实测);
       结构 dump  tools/archive/_ret-docs-20261113/mes-schema-dump.json。

   幂等:IF OBJECT_ID 守卫 + NOT EXISTS;两账套都执行(DbSync 按内容哈希登记)。
   生成器:tools/archive/_gen-return-docs-20261113.mjs(改规格后重跑,勿手改本文件)。
   ============================================================ */
SET NOCOUNT ON;
GO

-- ① 表 bd_sale_in(销售退货单头;结构 = bd_sale_out 克隆 + 金蝶新增键)
IF OBJECT_ID(N'dbo.bd_sale_in', N'U') IS NULL
CREATE TABLE dbo.bd_sale_in (
    [id] int NOT NULL IDENTITY(1,1),
    [单据日期] date NULL,
    [单据编号] nvarchar(200) NULL,
    [业务类型] nvarchar(100) NULL,
    [出库类别] nvarchar(100) NULL,
    [客户] nvarchar(200) NULL,
    [客户编码] nvarchar(200) NULL,
    [客户简称] nvarchar(200) NULL,
    [结算客户] nvarchar(200) NULL,
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
    [单据状态] nvarchar(10) NOT NULL,
    [审核人] nvarchar(50) NULL,
    [审核时间] datetime2 NULL,
    [审批人] nvarchar(50) NULL,
    [审批时间] datetime2 NULL,
    [asp_user1] nvarchar(50) NULL,
    [asp_time1] datetime2 NULL,
    [asp_user2] nvarchar(50) NULL,
    [asp_time2] datetime2 NULL,
    [asp_cancel] char(1) NULL,
    [创建时间] nvarchar(500) NULL,
    [单据状态2] nvarchar(500) NULL,
    [结算状态] nvarchar(500) NULL,
    [发货状态] nvarchar(500) NULL,
    [客户id] nvarchar(500) NULL,
    [经手人id] nvarchar(500) NULL,
    [经手人编码] nvarchar(500) NULL,
    [金额] nvarchar(500) NULL,
    [商品组合] nvarchar(500) NULL,
    [商品数量] nvarchar(500) NULL,
    [折前价税合计] nvarchar(500) NULL,
    [整单折扣额] nvarchar(500) NULL,
    [商品分录] nvarchar(500) NULL,
    [物流信息分录] nvarchar(500) NULL,
    [开票状态] nvarchar(500) NULL,
    [联系人电话] nvarchar(500) NULL,
    [联系人国家id] nvarchar(500) NULL,
    [联系人国家名称] nvarchar(500) NULL,
    [联系人国家编码] nvarchar(500) NULL,
    [联系人省份id] nvarchar(500) NULL,
    [联系人省份名称] nvarchar(500) NULL,
    [联系人省份编码] nvarchar(500) NULL,
    [联系人市区id] nvarchar(500) NULL,
    [联系人市区名称] nvarchar(500) NULL,
    [联系人市区编码] nvarchar(500) NULL,
    [联系人区县id] nvarchar(500) NULL,
    [联系人区县名称] nvarchar(500) NULL,
    [联系人区县编码] nvarchar(500) NULL,
    [联系人] nvarchar(500) NULL,
    [联系信息] nvarchar(500) NULL,
    [联系地址] nvarchar(500) NULL,
    [发货国家id] nvarchar(500) NULL,
    [发货国家名称] nvarchar(500) NULL,
    [发货国家编码] nvarchar(500) NULL,
    [发货省份id] nvarchar(500) NULL,
    [发货省份名称] nvarchar(500) NULL,
    [发货省份编码] nvarchar(500) NULL,
    [发货市区id] nvarchar(500) NULL,
    [发货市区名称] nvarchar(500) NULL,
    [发货市区编码] nvarchar(500) NULL,
    [发货区县id] nvarchar(500) NULL,
    [发货区县名称] nvarchar(500) NULL,
    [发货区县编码] nvarchar(500) NULL,
    [发货地址] nvarchar(500) NULL,
    [发货人2] nvarchar(500) NULL,
    [发货电话] nvarchar(500) NULL,
    [发货方式] nvarchar(500) NULL,
    [付款信息分录] nvarchar(500) NULL,
    [抵扣余额] nvarchar(500) NULL,
    [未结算金额] nvarchar(500) NULL,
    [附件] nvarchar(500) NULL,
    [附件地址] nvarchar(500) NULL,
    [审核人id] nvarchar(500) NULL,
    [审核人2] nvarchar(500) NULL,
    [审核人编码] nvarchar(500) NULL,
    [审核时间2] nvarchar(500) NULL,
    [应收款余额] nvarchar(500) NULL,
    [物流公司id] nvarchar(500) NULL,
    [采购费用] nvarchar(500) NULL,
    [费用分摊信息] nvarchar(500) NULL,
    [上次欠款] nvarchar(500) NULL,
    [交易类型] nvarchar(500) NULL,
    [部门id] nvarchar(500) NULL,
    [部门2] nvarchar(500) NULL,
    [部门编码] nvarchar(500) NULL,
    [整单折扣率%] nvarchar(500) NULL,
    [修改时间] nvarchar(500) NULL,
    [出入库状态] nvarchar(500) NULL,
    [创建人id] nvarchar(500) NULL,
    [创建人] nvarchar(500) NULL,
    [创建人编码] nvarchar(500) NULL,
    [修改人id] nvarchar(500) NULL,
    [修改人] nvarchar(500) NULL,
    [修改人编码] nvarchar(500) NULL,
    [单据标签] nvarchar(500) NULL,
    [客户承担费用分录] nvarchar(500) NULL,
    [交货方式id] nvarchar(500) NULL,
    [交货方式] nvarchar(500) NULL,
    [交货方式编码] nvarchar(500) NULL,
    [币种id] nvarchar(500) NULL,
    [到期日] nvarchar(500) NULL,
    [结算期限id] nvarchar(500) NULL,
    [结算期限编码] nvarchar(500) NULL,
    [结算期限] nvarchar(500) NULL,
    [配送路线分录] nvarchar(500) NULL,
    [采购费用分录] nvarchar(500) NULL,
    [币别名称] nvarchar(500) NULL,
    [ERP单号] nvarchar(100) NULL,
    [转ERP操作人] nvarchar(50) NULL,
    [转ERP时间] nvarchar(30) NULL,
    [是否已转ERP] nvarchar(10) NULL,
    [附件1] nvarchar(500) NULL,
    [附件2] nvarchar(500) NULL,
    [附件3] nvarchar(500) NULL,
    [附件4] nvarchar(500) NULL,
    [附件5] nvarchar(500) NULL,
    [附件6] nvarchar(500) NULL,
    [单据状态_bill_status] nvarchar(500) NULL,
    [customer_id] nvarchar(500) NULL,
    [emp_id] nvarchar(500) NULL,
    [ivc_status ] nvarchar(500) NULL,
    [contact_country_id] nvarchar(500) NULL,
    [contact_province_id] nvarchar(500) NULL,
    [contact_city_id] nvarchar(500) NULL,
    [contact_district_id] nvarchar(500) NULL,
    [dispatcher_country_id] nvarchar(500) NULL,
    [dispatcher_province_id] nvarchar(500) NULL,
    [dispatcher_city_id] nvarchar(500) NULL,
    [dispatcher_district_id] nvarchar(500) NULL,
    [发货人_dispatcher_linkman] nvarchar(500) NULL,
    [attachments] nvarchar(500) NULL,
    [auditor_id] nvarchar(500) NULL,
    [审核人_auditor_name] nvarchar(500) NULL,
    [auditor_number] nvarchar(500) NULL,
    [审核时间_audit_time] nvarchar(500) NULL,
    [f_logistics_id] nvarchar(500) NULL,
    [dept_id] nvarchar(500) NULL,
    [部门_dept_name] nvarchar(500) NULL,
    [creator_id] nvarchar(500) NULL,
    [creator_number] nvarchar(500) NULL,
    [modifier_id] nvarchar(500) NULL,
    [modifier_number] nvarchar(500) NULL,
    [delivery_type_id] nvarchar(500) NULL,
    [setting_term_id] nvarchar(500) NULL,
    [备用1] nvarchar(500) NULL,
    [备用2] nvarchar(500) NULL,
    [备用3] nvarchar(500) NULL,
    [备用4] nvarchar(500) NULL,
    [备用5] nvarchar(500) NULL,
    [备用6] nvarchar(500) NULL,
    [备用7] nvarchar(500) NULL,
    [备用8] nvarchar(500) NULL,
    [备用9] nvarchar(500) NULL,
    [备用10] nvarchar(500) NULL,
    [备用11] nvarchar(500) NULL,
    [备用12] nvarchar(500) NULL,
    [备用13] nvarchar(500) NULL,
    [备用14] nvarchar(500) NULL,
    [备用15] nvarchar(500) NULL,
    [备用16] nvarchar(500) NULL,
    [备用17] nvarchar(500) NULL,
    [备用18] nvarchar(500) NULL,
    [备用19] nvarchar(500) NULL,
    [备用20] nvarchar(500) NULL,
    [退货原因] nvarchar(200) NULL,
    CONSTRAINT [pk_bd_sale_in] PRIMARY KEY CLUSTERED ([id])
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_bd_sale_in_单据编号' AND object_id = OBJECT_ID(N'dbo.bd_sale_in'))
    CREATE NONCLUSTERED INDEX [IX_bd_sale_in_单据编号] ON dbo.bd_sale_in ([单据编号]);
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'销售退货单头表(2026-11-13 按金蝶 金蝶「销售退货单」sal_in_bound(头 77 键 / 行 102 键,真实账套 96 张) 与 MES 销售出库单 结构克隆)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'销售退货单·id', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'单据日期', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'单据日期';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'单据编号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单号(面板字段列)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'单据编号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'业务类型', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'业务类型';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'出库类别', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'出库类别';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'客户', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'客户';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'客户编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'销售退货单·客户编码', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'客户编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'客户简称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'客户简称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'结算客户', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'结算客户';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'经手人', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'经手人';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'验货人', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'验货人';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'项目', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'项目';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'仓库', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'仓库';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'送货地址', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'送货地址';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'发货单号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'发货单号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'发货日期', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'发货日期';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'来源单号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'来源单号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'部门', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'部门';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'门店', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'门店';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'匹配来源单号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'匹配来源单号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'验货日期', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'验货日期';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'发货人', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'发货人';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'收货仓库', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'收货仓库';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'来源单据', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'来源单据';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'外部单据号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'外部单据号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'销售订单号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'销售订单号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'备注', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'备注';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'单据状态', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'单据状态';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'审核人', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'审核人(流程)(面板字段列)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'审核人';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'审核时间', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'审核时间';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'审批人', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'审批人';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'审批时间', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'审批时间';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'asp_user1', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'销售退货单·asp_user1', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'asp_user1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'asp_time1', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'销售退货单·asp_time1', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'asp_time1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'asp_user2', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'销售退货单·asp_user2', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'asp_user2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'asp_time2', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'销售退货单·asp_time2', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'asp_time2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'asp_cancel', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'销售退货单·asp_cancel', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'asp_cancel';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'创建时间', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'创建时间';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'单据状态2', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'单据状态2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'结算状态', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'结算状态';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'发货状态', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'发货状态';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'客户id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'客户id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'经手人id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'经手人id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'经手人编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'经手人编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'金额', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'金额';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'商品组合', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'商品组合';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'商品数量', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'商品数量';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'折前价税合计', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'折前价税合计';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'整单折扣额', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'整单折扣额';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'商品分录', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'商品分录';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'物流信息分录', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'物流信息分录';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'开票状态', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'开票状态';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'联系人电话', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'联系人电话';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'联系人国家id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'联系人国家id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'联系人国家名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'联系人国家名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'联系人国家编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'联系人国家编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'联系人省份id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'联系人省份id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'联系人省份名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'联系人省份名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'联系人省份编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'联系人省份编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'联系人市区id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'联系人市区id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'联系人市区名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'联系人市区名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'联系人市区编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'联系人市区编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'联系人区县id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'联系人区县id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'联系人区县名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'联系人区县名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'联系人区县编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'联系人区县编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'联系人', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'联系人';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'联系信息', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'联系信息';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'联系地址', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'联系地址';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'发货国家id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'发货国家id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'发货国家名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'发货国家名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'发货国家编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'发货国家编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'发货省份id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'发货省份id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'发货省份名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'发货省份名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'发货省份编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'发货省份编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'发货市区id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'发货市区id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'发货市区名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'发货市区名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'发货市区编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'发货市区编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'发货区县id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'发货区县id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'发货区县名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'发货区县名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'发货区县编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'发货区县编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'发货地址', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'发货地址';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'发货人2', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'发货人2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'发货电话', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'发货电话';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'发货方式', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'发货方式';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'付款信息分录', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'付款信息分录';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'抵扣余额', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'抵扣余额';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'未结算金额', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'未结算金额';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'附件', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'附件';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'附件地址', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'附件地址';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'审核人id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'审核人id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'审核人2', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'审核人(业务)(面板字段列)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'审核人2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'审核人编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'审核人编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'审核时间2', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'销售退货单·审核时间2', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'审核时间2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'应收款余额', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'应收款余额';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'物流公司id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'物流公司id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'采购费用', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'采购费用';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'费用分摊信息', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'费用分摊信息';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'上次欠款', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'上次欠款';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'交易类型', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'交易类型';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'部门id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'部门id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'部门2', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'销售退货单·部门2', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'部门2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'部门编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'部门编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'整单折扣率%', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'整单折扣率%';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'修改时间', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'修改时间';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'出入库状态', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'出入库状态';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'创建人id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'创建人id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'创建人', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'创建人';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'创建人编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'创建人编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'修改人id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'修改人id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'修改人', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'修改人';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'修改人编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'修改人编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'单据标签', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'单据标签';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'客户承担费用分录', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'客户承担费用分录';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'交货方式id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'交货方式id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'交货方式', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'交货方式';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'交货方式编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'交货方式编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'币种id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'币种id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'到期日', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'到期日';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'结算期限id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'结算期限id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'结算期限编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'结算期限编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'结算期限', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'结算期限';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'配送路线分录', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'配送路线分录';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'采购费用分录', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'采购费用分录';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'币别名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'币别名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'ERP单号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'ERP单号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'转ERP操作人', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'转ERP操作人';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'转ERP时间', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'转ERP时间';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'是否已转ERP', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'销售退货单·是否已转ERP', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'是否已转ERP';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'附件1', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单据附件列位(与送料暂收单同款:页面单格聚合,上传按序占位,文件实体存 yj_attachment)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'附件1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'附件2', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单据附件列位(与送料暂收单同款:页面单格聚合,上传按序占位,文件实体存 yj_attachment)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'附件2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'附件3', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单据附件列位(与送料暂收单同款:页面单格聚合,上传按序占位,文件实体存 yj_attachment)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'附件3';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'附件4', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单据附件列位(与送料暂收单同款:页面单格聚合,上传按序占位,文件实体存 yj_attachment)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'附件4';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'附件5', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单据附件列位(与送料暂收单同款:页面单格聚合,上传按序占位,文件实体存 yj_attachment)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'附件5';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'附件6', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单据附件列位(与送料暂收单同款:页面单格聚合,上传按序占位,文件实体存 yj_attachment)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'附件6';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'单据状态_bill_status', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'单据状态_bill_status';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'customer_id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'customer_id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'emp_id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'emp_id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'ivc_status ', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'ivc_status ';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'contact_country_id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'contact_country_id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'contact_province_id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'contact_province_id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'contact_city_id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'contact_city_id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'contact_district_id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'contact_district_id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'dispatcher_country_id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'dispatcher_country_id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'dispatcher_province_id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'dispatcher_province_id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'dispatcher_city_id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'dispatcher_city_id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'dispatcher_district_id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'dispatcher_district_id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'发货人_dispatcher_linkman', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'发货人_dispatcher_linkman';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'attachments', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'attachments';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'auditor_id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'auditor_id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'审核人_auditor_name', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'审核人_auditor_name';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'auditor_number', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'auditor_number';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'审核时间_audit_time', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'审核时间_audit_time';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'f_logistics_id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'f_logistics_id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'dept_id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'所属部门(关联 yj_dept.id)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'dept_id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'部门_dept_name', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'部门_dept_name';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'creator_id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'creator_id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'creator_number', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'creator_number';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'modifier_id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'modifier_id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'modifier_number', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'modifier_number';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'delivery_type_id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'delivery_type_id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'setting_term_id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'setting_term_id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'备用1', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'备用1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'备用2', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'备用2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'备用3', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'备用3';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'备用4', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'备用4';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'备用5', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'备用5';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'备用6', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'备用6';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'备用7', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'备用7';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'备用8', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'备用8';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'备用9', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'备用9';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'备用10', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'备用10';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'备用11', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'备用11';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'备用12', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'备用12';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'备用13', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'备用13';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'备用14', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'备用14';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'备用15', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'备用15';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'备用16', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'备用16';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'备用17', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'备用17';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'备用18', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'备用18';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'备用19', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'备用19';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'备用20', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'备用20';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_sale_in'), N'退货原因', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'销售退货单↔金蝶 sal_in_bound 头键 return_reason_name(退货原因)', N'SCHEMA', N'dbo', N'TABLE', N'bd_sale_in', N'COLUMN', N'退货原因';
GO

-- ① 表 bl_sale_in(销售退货单明细;结构 = bl_sale_out 克隆)
IF OBJECT_ID(N'dbo.bl_sale_in', N'U') IS NULL
CREATE TABLE dbo.bl_sale_in (
    [id] int NOT NULL IDENTITY(1,1),
    [单据编号] nvarchar(100) NULL,
    [存货名称] nvarchar(200) NULL,
    [存货编码] nvarchar(200) NULL,
    [规格型号] nvarchar(200) NULL,
    [计量单位] nvarchar(100) NULL,
    [数量] decimal(18,4) NULL,
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
    [asp_user1] nvarchar(50) NULL,
    [asp_time1] datetime2 NULL,
    [asp_cancel] char(1) NULL,
    [asp_user2] nvarchar(50) NULL,
    [asp_time2] datetime2 NULL,
    [批号] nvarchar(30) NULL,
    [换算率] nvarchar(500) NULL,
    [商品id] nvarchar(500) NULL,
    [商品是否多单位] nvarchar(500) NULL,
    [商品是否序列号] nvarchar(500) NULL,
    [商品是否辅助属性] nvarchar(500) NULL,
    [商品是否保质期] nvarchar(500) NULL,
    [商品是否批次] nvarchar(500) NULL,
    [商品助记码] nvarchar(500) NULL,
    [仓库id] nvarchar(500) NULL,
    [仓库编码] nvarchar(500) NULL,
    [仓库启用仓位管理] nvarchar(500) NULL,
    [仓位id] nvarchar(500) NULL,
    [仓库名称_sp_name] nvarchar(500) NULL,
    [仓位编码] nvarchar(500) NULL,
    [辅助属性id] nvarchar(500) NULL,
    [辅助属性名称] nvarchar(500) NULL,
    [辅助属性编码] nvarchar(500) NULL,
    [辅助属性1id] nvarchar(500) NULL,
    [辅助属性1名称] nvarchar(500) NULL,
    [辅助属性1编码] nvarchar(500) NULL,
    [辅助属性2id] nvarchar(500) NULL,
    [辅助属性2名称] nvarchar(500) NULL,
    [辅助属性2编码] nvarchar(500) NULL,
    [辅助属性3id] nvarchar(500) NULL,
    [辅助属性3名称] nvarchar(500) NULL,
    [辅助属性3编码] nvarchar(500) NULL,
    [辅助属性4id] nvarchar(500) NULL,
    [辅助属性4名称] nvarchar(500) NULL,
    [辅助属性4编码] nvarchar(500) NULL,
    [辅助属性5id] nvarchar(500) NULL,
    [辅助属性5名称] nvarchar(500) NULL,
    [辅助属性5编码] nvarchar(500) NULL,
    [条形码] nvarchar(500) NULL,
    [实际含税单价] nvarchar(500) NULL,
    [基本单位id] nvarchar(500) NULL,
    [基本单位名称] nvarchar(500) NULL,
    [基本单位编码] nvarchar(500) NULL,
    [单位id] nvarchar(500) NULL,
    [单位编码] nvarchar(500) NULL,
    [换算系数] nvarchar(500) NULL,
    [库存基本数量] nvarchar(500) NULL,
    [退货数量] nvarchar(500) NULL,
    [税额_tax_amount] nvarchar(500) NULL,
    [整单折扣分摊] nvarchar(500) NULL,
    [折扣额] nvarchar(500) NULL,
    [费用] nvarchar(500) NULL,
    [分摊差额] nvarchar(500) NULL,
    [折扣率%] nvarchar(500) NULL,
    [折前金额] nvarchar(500) NULL,
    [实际不含税金额] nvarchar(500) NULL,
    [单位成本] nvarchar(500) NULL,
    [成本] nvarchar(500) NULL,
    [本次结算金额] nvarchar(500) NULL,
    [折扣金额2] nvarchar(500) NULL,
    [折后单价] nvarchar(500) NULL,
    [产地] nvarchar(500) NULL,
    [注册证号] nvarchar(500) NULL,
    [生产许可证] nvarchar(500) NULL,
    [保质期到期日] nvarchar(500) NULL,
    [有效期至] nvarchar(500) NULL,
    [保质期类型] nvarchar(500) NULL,
    [保质期] nvarchar(500) NULL,
    [序列号流转ID] nvarchar(500) NULL,
    [辅助单位id] nvarchar(500) NULL,
    [辅助单位编码] nvarchar(500) NULL,
    [辅助换算系数] nvarchar(500) NULL,
    [行号] nvarchar(500) NULL,
    [分录状态] nvarchar(500) NULL,
    [分录结算状态] nvarchar(500) NULL,
    [是否赠品] nvarchar(500) NULL,
    [源单id] nvarchar(500) NULL,
    [源单编号] nvarchar(500) NULL,
    [源单类型id] nvarchar(500) NULL,
    [源单类型名称] nvarchar(500) NULL,
    [源单类型编码] nvarchar(500) NULL,
    [源单内部id] nvarchar(500) NULL,
    [源单日期] nvarchar(500) NULL,
    [源单行号] nvarchar(500) NULL,
    [源单分录id] nvarchar(500) NULL,
    [序列号清单] nvarchar(500) NULL,
    [基本数量] nvarchar(500) NULL,
    [折扣税额] nvarchar(500) NULL,
    [客户单号] nvarchar(500) NULL,
    [未开票数量] nvarchar(500) NULL,
    [已开票数量] nvarchar(500) NULL,
    [已开票金额] nvarchar(500) NULL,
    [未开票金额] nvarchar(500) NULL,
    [价税合计本位币] nvarchar(500) NULL,
    [仓位名称] nvarchar(200) NULL,
    [折扣金额_dis_amount] nvarchar(500) NULL,
    [仓库] nvarchar(1000) NULL,
    [备用1] nvarchar(500) NULL,
    [备用2] nvarchar(500) NULL,
    [备用3] nvarchar(500) NULL,
    [备用4] nvarchar(500) NULL,
    [备用5] nvarchar(500) NULL,
    [备用6] nvarchar(500) NULL,
    [备用7] nvarchar(500) NULL,
    [备用8] nvarchar(500) NULL,
    [备用9] nvarchar(500) NULL,
    [备用10] nvarchar(500) NULL,
    [备用11] nvarchar(500) NULL,
    [备用12] nvarchar(500) NULL,
    [备用13] nvarchar(500) NULL,
    [备用14] nvarchar(500) NULL,
    [备用15] nvarchar(500) NULL,
    [备用16] nvarchar(500) NULL,
    [备用17] nvarchar(500) NULL,
    [备用18] nvarchar(500) NULL,
    [备用19] nvarchar(500) NULL,
    [备用20] nvarchar(500) NULL,
    CONSTRAINT [pk_bl_sale_in] PRIMARY KEY CLUSTERED ([id])
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_bl_sale_in_单据编号' AND object_id = OBJECT_ID(N'dbo.bl_sale_in'))
    CREATE NONCLUSTERED INDEX [IX_bl_sale_in_单据编号] ON dbo.bl_sale_in ([单据编号]);
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'销售退货单明细表(2026-11-13 按金蝶 金蝶「销售退货单」sal_in_bound(头 77 键 / 行 102 键,真实账套 96 张) 与 MES 销售出库单 结构克隆)', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'销售退货单·id', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'单据编号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单号(面板字段列)', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'单据编号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'存货名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'存货名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'存货编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'存货编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'规格型号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'规格型号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'计量单位', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'计量单位';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'数量', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'数量';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'智能选单', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'智能选单';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'成本价', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'成本价';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'税率%', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'税率%';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'售价', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'销售退货单·售价', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'售价';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'含税售价', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'含税售价';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'销售金额', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'销售金额';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'税额', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'税额';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'含税销售金额', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'含税销售金额';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'折扣金额', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'折扣金额';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'现存量', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'现存量';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'现存量说明', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'现存量说明';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'需求令号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'需求令号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'退货原因', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'退货原因';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'备注', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'备注';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'asp_user1', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'销售退货单·asp_user1', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'asp_user1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'asp_time1', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'销售退货单·asp_time1', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'asp_time1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'asp_cancel', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'销售退货单·asp_cancel', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'asp_cancel';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'asp_user2', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'销售退货单·asp_user2', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'asp_user2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'asp_time2', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'销售退货单·asp_time2', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'asp_time2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'批号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'批号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'换算率', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'换算率';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'商品id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'商品id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'商品是否多单位', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'商品是否多单位';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'商品是否序列号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'商品是否序列号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'商品是否辅助属性', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'商品是否辅助属性';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'商品是否保质期', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'商品是否保质期';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'商品是否批次', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'商品是否批次';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'商品助记码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'商品助记码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'仓库id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'仓库id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'仓库编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'仓库编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'仓库启用仓位管理', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'仓库启用仓位管理';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'仓位id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'仓位id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'仓库名称_sp_name', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'仓库名称_sp_name';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'仓位编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'仓位编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'辅助属性id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'辅助属性id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'辅助属性名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'辅助属性名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'辅助属性编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'辅助属性编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'辅助属性1id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'辅助属性1id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'辅助属性1名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'辅助属性1名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'辅助属性1编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'辅助属性1编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'辅助属性2id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'辅助属性2id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'辅助属性2名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'辅助属性2名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'辅助属性2编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'辅助属性2编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'辅助属性3id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'辅助属性3id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'辅助属性3名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'辅助属性3名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'辅助属性3编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'辅助属性3编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'辅助属性4id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'辅助属性4id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'辅助属性4名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'辅助属性4名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'辅助属性4编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'辅助属性4编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'辅助属性5id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'辅助属性5id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'辅助属性5名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'辅助属性5名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'辅助属性5编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'辅助属性5编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'条形码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'条形码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'实际含税单价', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'实际含税单价';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'基本单位id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'基本单位id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'基本单位名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'基本单位名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'基本单位编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'基本单位编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'单位id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'单位id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'单位编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'单位编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'换算系数', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'换算系数';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'库存基本数量', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'库存基本数量';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'退货数量', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'退货数量';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'税额_tax_amount', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'税额_tax_amount';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'整单折扣分摊', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'整单折扣分摊';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'折扣额', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'折扣额';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'费用', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'费用';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'分摊差额', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'分摊差额';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'折扣率%', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'折扣率%';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'折前金额', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'折前金额';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'实际不含税金额', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'实际不含税金额';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'单位成本', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'单位成本';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'成本', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'成本';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'本次结算金额', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'本次结算金额';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'折扣金额2', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'销售退货单·折扣金额2', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'折扣金额2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'折后单价', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'折后单价';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'产地', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'产地';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'注册证号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'注册证号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'生产许可证', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'生产许可证';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'保质期到期日', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'保质期到期日';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'有效期至', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'有效期至';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'保质期类型', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'保质期类型';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'保质期', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'保质期';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'序列号流转ID', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'序列号流转ID';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'辅助单位id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'辅助单位id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'辅助单位编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'辅助单位编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'辅助换算系数', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'辅助换算系数';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'行号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'行号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'分录状态', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'分录状态';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'分录结算状态', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'分录结算状态';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'是否赠品', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'是否赠品';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'源单id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'源单id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'源单编号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'源单编号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'源单类型id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'源单类型id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'源单类型名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'源单类型名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'源单类型编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'源单类型编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'源单内部id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'源单内部id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'源单日期', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'源单日期';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'源单行号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'采购订单行号(面板字段列)', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'源单行号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'源单分录id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'源单分录id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'序列号清单', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'序列号清单';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'基本数量', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'基本数量';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'折扣税额', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'折扣税额';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'客户单号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'客户单号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'未开票数量', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'未开票数量';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'已开票数量', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'已开票数量';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'已开票金额', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'已开票金额';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'未开票金额', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'未开票金额';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'价税合计本位币', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'价税合计本位币';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'仓位名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'仓位名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'折扣金额_dis_amount', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'折扣金额_dis_amount';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'仓库', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'仓库';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'备用1', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'备用1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'备用2', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'备用2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'备用3', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'备用3';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'备用4', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'备用4';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'备用5', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'备用5';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'备用6', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'备用6';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'备用7', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'备用7';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'备用8', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'备用8';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'备用9', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'备用9';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'备用10', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'备用10';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'备用11', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'备用11';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'备用12', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'备用12';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'备用13', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'备用13';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'备用14', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'备用14';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'备用15', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'备用15';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'备用16', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'备用16';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'备用17', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'备用17';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'备用18', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'备用18';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'备用19', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'备用19';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_sale_in') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_sale_in'), N'备用20', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_sale_in', N'COLUMN', N'备用20';
GO

-- ① 表 bd_material_ret(生产退料单头;结构 = bd_material_out 克隆)
IF OBJECT_ID(N'dbo.bd_material_ret', N'U') IS NULL
CREATE TABLE dbo.bd_material_ret (
    [id] int NOT NULL IDENTITY(1,1),
    [单据日期] date NULL,
    [单据编号] nvarchar(200) NULL,
    [业务类型] nvarchar(100) NULL,
    [生产车间] nvarchar(100) NULL,
    [出库类别] nvarchar(100) NULL,
    [领用人] nvarchar(200) NULL,
    [项目] nvarchar(200) NULL,
    [仓库] nvarchar(200) NULL,
    [来源单号] nvarchar(200) NULL,
    [加工单号] nvarchar(200) NULL,
    [备注] nvarchar(500) NULL,
    [单据状态] nvarchar(10) NOT NULL,
    [审核人] nvarchar(50) NULL,
    [审核时间] datetime2 NULL,
    [审批人] nvarchar(50) NULL,
    [审批时间] datetime2 NULL,
    [asp_user1] nvarchar(50) NULL,
    [asp_time1] datetime2 NULL,
    [asp_user2] nvarchar(50) NULL,
    [asp_time2] datetime2 NULL,
    [asp_cancel] char(1) NULL,
    [来源单据] nvarchar(100) NULL,
    [销售订单号] nvarchar(100) NULL,
    [匹配来源单号] nvarchar(100) NULL,
    [创建时间] nvarchar(500) NULL,
    [金蝶单据状态] nvarchar(500) NULL,
    [部门id] nvarchar(500) NULL,
    [部门编码] nvarchar(500) NULL,
    [领料类型] nvarchar(500) NULL,
    [修改时间] nvarchar(500) NULL,
    [金蝶审核时间] nvarchar(500) NULL,
    [创建人id] nvarchar(500) NULL,
    [创建人] nvarchar(500) NULL,
    [创建人编码] nvarchar(500) NULL,
    [修改人id] nvarchar(500) NULL,
    [修改人] nvarchar(500) NULL,
    [修改人编码] nvarchar(500) NULL,
    [单据类型名称] nvarchar(500) NULL,
    [单据类型编码] nvarchar(500) NULL,
    [单据类型id] nvarchar(500) NULL,
    [审核人id] nvarchar(500) NULL,
    [金蝶审核人] nvarchar(500) NULL,
    [审核人编码] nvarchar(500) NULL,
    [经手人id] nvarchar(500) NULL,
    [经手人编码] nvarchar(500) NULL,
    [单据标签] nvarchar(500) NULL,
    [领料用途名称] nvarchar(500) NULL,
    [领料用途id] nvarchar(500) NULL,
    [领料用途编码] nvarchar(500) NULL,
    [是否已转ERP] nvarchar(20) NULL,
    [ERP单号] nvarchar(100) NULL,
    [转ERP操作人] nvarchar(100) NULL,
    [转ERP时间] nvarchar(60) NULL,
    [asp_print] int NULL,
    [asp_time3] datetime2 NULL,
    [asp_time4] datetime2 NULL,
    [asp_user3] nvarchar(20) NULL,
    [asp_user4] nvarchar(20) NULL,
    [备用1] nvarchar(500) NULL,
    [备用2] nvarchar(500) NULL,
    [备用3] nvarchar(500) NULL,
    [备用4] nvarchar(500) NULL,
    [备用5] nvarchar(500) NULL,
    [备用6] nvarchar(500) NULL,
    [备用7] nvarchar(500) NULL,
    [备用8] nvarchar(500) NULL,
    [备用9] nvarchar(500) NULL,
    [备用10] nvarchar(500) NULL,
    [备用11] nvarchar(500) NULL,
    [备用12] nvarchar(500) NULL,
    [备用13] nvarchar(500) NULL,
    [备用14] nvarchar(500) NULL,
    [备用15] nvarchar(500) NULL,
    [备用16] nvarchar(500) NULL,
    [备用17] nvarchar(500) NULL,
    [备用18] nvarchar(500) NULL,
    [备用19] nvarchar(500) NULL,
    [备用20] nvarchar(500) NULL,
    [工单行号] int NULL,
    CONSTRAINT [pk_bd_material_ret] PRIMARY KEY CLUSTERED ([id])
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_bd_material_ret_单据编号' AND object_id = OBJECT_ID(N'dbo.bd_material_ret'))
    CREATE NONCLUSTERED INDEX [IX_bd_material_ret_单据编号] ON dbo.bd_material_ret ([单据编号]);
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'生产退料单头表(2026-11-13 按金蝶 金蝶「生产退料单」inv_pick_ret(头 27 键 / 行 73 键,真实账套 953 张) 与 MES 材料出库单 结构克隆)', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'生产退料单·id', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'单据日期', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'生产退料单·单据日期', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'单据日期';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'单据编号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单号(面板字段列)', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'单据编号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'业务类型', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'业务类型';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'生产车间', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'生产车间';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'出库类别', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'出库类别';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'领用人', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'领用人';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'项目', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'项目';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'仓库', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'仓库';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'来源单号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'来源单号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'加工单号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'加工单号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'备注', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'备注';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'单据状态', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'生产退料单·单据状态', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'单据状态';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'审核人', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'审核人(流程)(面板字段列)', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'审核人';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'审核时间', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'审核时间';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'审批人', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'审批人';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'审批时间', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'审批时间';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'asp_user1', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'创建人', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'asp_user1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'asp_time1', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'创建时间', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'asp_time1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'asp_user2', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'最后修改人', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'asp_user2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'asp_time2', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'最后修改时间', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'asp_time2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'asp_cancel', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'删除标记', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'asp_cancel';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'来源单据', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'来源单据';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'销售订单号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'销售订单号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'匹配来源单号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'匹配来源单号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'创建时间', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 create_time', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'创建时间';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'金蝶单据状态', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 bill_status', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'金蝶单据状态';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'部门id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 dept_id', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'部门id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'部门编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 dept_number', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'部门编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'领料类型', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 pick_type', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'领料类型';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'修改时间', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 modify_time', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'修改时间';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'金蝶审核时间', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 audit_time', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'金蝶审核时间';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'创建人id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 creator_id', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'创建人id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'创建人', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 creator_name', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'创建人';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'创建人编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 creator_number', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'创建人编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'修改人id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 modifier_id', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'修改人id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'修改人', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 modifier_name', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'修改人';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'修改人编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 modifier_number', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'修改人编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'单据类型名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 bill_type_name', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'单据类型名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'单据类型编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 bill_type_number', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'单据类型编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'单据类型id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 bill_type_id', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'单据类型id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'审核人id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 auditor_id', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'审核人id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'金蝶审核人', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 auditor_name', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'金蝶审核人';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'审核人编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 auditor_number', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'审核人编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'经手人id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 emp_id', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'经手人id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'经手人编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 emp_number', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'经手人编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'单据标签', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 mul_bill_label', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'单据标签';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'领料用途名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 pick_use_name', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'领料用途名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'领料用途id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 pick_use_id', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'领料用途id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'领料用途编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 pick_use_number', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'领料用途编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'是否已转ERP', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'转ERP回写:是/否(空=否);弃审自动清', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'是否已转ERP';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'ERP单号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'转ERP回写:金蝶生成的生产领料单号(SCLL-…)', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'ERP单号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'转ERP操作人', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'转ERP回写:操作人账号', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'转ERP操作人';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'转ERP时间', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'转ERP回写:时间(YYYY-MM-DD HH:mm:ss)', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'转ERP时间';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'asp_print', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'打印次数', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'asp_print';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'asp_time3', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'审核时间', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'asp_time3';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'asp_time4', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'删除时间', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'asp_time4';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'asp_user3', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'审核人', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'asp_user3';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'asp_user4', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'删除人', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'asp_user4';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'备用1', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'备用1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'备用2', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'备用2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'备用3', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'备用3';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'备用4', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'备用4';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'备用5', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'备用5';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'备用6', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'备用6';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'备用7', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'备用7';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'备用8', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'备用8';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'备用9', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'备用9';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'备用10', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'备用10';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'备用11', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'备用11';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'备用12', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'备用12';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'备用13', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'备用13';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'备用14', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'备用14';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'备用15', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'备用15';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'备用16', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'备用16';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'备用17', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'备用17';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'备用18', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'备用18';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'备用19', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'备用19';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'备用20', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'备用20';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bd_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bd_material_ret'), N'工单行号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'工单行号(领料出库关联生产工单行,与 plang.pl_xc 同义;转领料单按行写入,工单行号+加工单号 = 领料单的来源行键)', N'SCHEMA', N'dbo', N'TABLE', N'bd_material_ret', N'COLUMN', N'工单行号';
GO

-- ① 表 bl_material_ret(生产退料单明细;结构 = bl_material_out 克隆)
IF OBJECT_ID(N'dbo.bl_material_ret', N'U') IS NULL
CREATE TABLE dbo.bl_material_ret (
    [id] int NOT NULL IDENTITY(1,1),
    [单据编号] nvarchar(100) NULL,
    [仓库] nvarchar(100) NULL,
    [加工单号] nvarchar(200) NULL,
    [材料名称] nvarchar(100) NULL,
    [计量单位] nvarchar(100) NULL,
    [数量] decimal(18,4) NULL,
    [单价] decimal(18,4) NULL,
    [金额] decimal(18,4) NULL,
    [规格型号] nvarchar(200) NULL,
    [手工确定成本] bit NULL,
    [明细备注] nvarchar(200) NULL,
    [现存量] decimal(18,4) NULL,
    [现存量说明] nvarchar(200) NULL,
    [备注] nvarchar(500) NULL,
    [asp_user1] nvarchar(50) NULL,
    [asp_time1] datetime2 NULL,
    [asp_cancel] char(1) NULL,
    [asp_user2] nvarchar(50) NULL,
    [asp_time2] datetime2 NULL,
    [材料编码] nvarchar(100) NULL,
    [批号] nvarchar(30) NULL,
    [图片] nvarchar(500) NULL,
    [行号] nvarchar(500) NULL,
    [商品id] nvarchar(500) NULL,
    [商品是否多单位] nvarchar(500) NULL,
    [商品是否序列号] nvarchar(500) NULL,
    [商品是否辅助属性] nvarchar(500) NULL,
    [商品是否保质期] nvarchar(500) NULL,
    [商品是否批次] nvarchar(500) NULL,
    [仓库id] nvarchar(500) NULL,
    [仓库编码] nvarchar(500) NULL,
    [仓库启用仓位管理] nvarchar(500) NULL,
    [仓位id] nvarchar(500) NULL,
    [仓位名称] nvarchar(500) NULL,
    [仓位编码] nvarchar(500) NULL,
    [辅助属性id] nvarchar(500) NULL,
    [辅助属性名称] nvarchar(500) NULL,
    [辅助属性编码] nvarchar(500) NULL,
    [辅助属性1id] nvarchar(500) NULL,
    [辅助属性1名称] nvarchar(500) NULL,
    [辅助属性1编码] nvarchar(500) NULL,
    [辅助属性2id] nvarchar(500) NULL,
    [辅助属性2名称] nvarchar(500) NULL,
    [辅助属性2编码] nvarchar(500) NULL,
    [辅助属性3id] nvarchar(500) NULL,
    [辅助属性3名称] nvarchar(500) NULL,
    [辅助属性3编码] nvarchar(500) NULL,
    [条形码] nvarchar(500) NULL,
    [产地] nvarchar(500) NULL,
    [注册证号] nvarchar(500) NULL,
    [生产许可证] nvarchar(500) NULL,
    [保质期到期日] nvarchar(500) NULL,
    [有效期至] nvarchar(500) NULL,
    [保质期类型] nvarchar(500) NULL,
    [保质期] nvarchar(500) NULL,
    [序列号清单] nvarchar(500) NULL,
    [序列号流转ID] nvarchar(500) NULL,
    [基本单位id] nvarchar(500) NULL,
    [基本单位名称] nvarchar(500) NULL,
    [基本单位编码] nvarchar(500) NULL,
    [单位id] nvarchar(500) NULL,
    [单位编码] nvarchar(500) NULL,
    [辅助单位id] nvarchar(500) NULL,
    [辅助单位名称] nvarchar(500) NULL,
    [辅助单位编码] nvarchar(500) NULL,
    [换算率] nvarchar(500) NULL,
    [库存数量] nvarchar(500) NULL,
    [基本数量] nvarchar(500) NULL,
    [库存基本数量] nvarchar(500) NULL,
    [辅助数量] nvarchar(500) NULL,
    [默认浮动数量] nvarchar(500) NULL,
    [辅助换算系数] nvarchar(500) NULL,
    [换算系数] nvarchar(500) NULL,
    [成本] nvarchar(500) NULL,
    [单位成本] nvarchar(500) NULL,
    [源单编号] nvarchar(500) NULL,
    [源单类型id] nvarchar(500) NULL,
    [源单类型名称] nvarchar(500) NULL,
    [源单类型编码] nvarchar(500) NULL,
    [源单内部id] nvarchar(500) NULL,
    [源单日期] nvarchar(500) NULL,
    [源单行号] nvarchar(500) NULL,
    [源单分录id] nvarchar(500) NULL,
    [源单产品分录id] nvarchar(500) NULL,
    [asp_print] int NULL,
    [asp_time3] datetime2 NULL,
    [asp_time4] datetime2 NULL,
    [asp_user3] nvarchar(20) NULL,
    [asp_user4] nvarchar(20) NULL,
    [备用1] nvarchar(500) NULL,
    [备用2] nvarchar(500) NULL,
    [备用3] nvarchar(500) NULL,
    [备用4] nvarchar(500) NULL,
    [备用5] nvarchar(500) NULL,
    [备用6] nvarchar(500) NULL,
    [备用7] nvarchar(500) NULL,
    [备用8] nvarchar(500) NULL,
    [备用9] nvarchar(500) NULL,
    [备用10] nvarchar(500) NULL,
    [备用11] nvarchar(500) NULL,
    [备用12] nvarchar(500) NULL,
    [备用13] nvarchar(500) NULL,
    [备用14] nvarchar(500) NULL,
    [备用15] nvarchar(500) NULL,
    [备用16] nvarchar(500) NULL,
    [备用17] nvarchar(500) NULL,
    [备用18] nvarchar(500) NULL,
    [备用19] nvarchar(500) NULL,
    [备用20] nvarchar(500) NULL,
    CONSTRAINT [pk_bl_material_ret] PRIMARY KEY CLUSTERED ([id])
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_bl_material_ret_单据编号' AND object_id = OBJECT_ID(N'dbo.bl_material_ret'))
    CREATE NONCLUSTERED INDEX [IX_bl_material_ret_单据编号] ON dbo.bl_material_ret ([单据编号]);
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = 0 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'生产退料单明细表(2026-11-13 按金蝶 金蝶「生产退料单」inv_pick_ret(头 27 键 / 行 73 键,真实账套 953 张) 与 MES 材料出库单 结构克隆)', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'生产退料单·id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'单据编号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'单号(面板字段列)', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'单据编号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'仓库', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'仓库';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'加工单号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'加工单号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'材料名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'材料名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'计量单位', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'计量单位';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'数量', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'数量';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'单价', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'单价';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'金额', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'金额';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'规格型号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'规格型号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'手工确定成本', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'手工确定成本';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'明细备注', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'明细备注';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'现存量', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'现存量';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'现存量说明', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'现存量说明';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'备注', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'备注';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'asp_user1', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'创建人', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'asp_user1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'asp_time1', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'创建时间', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'asp_time1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'asp_cancel', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'删除标记', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'asp_cancel';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'asp_user2', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'最后修改人', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'asp_user2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'asp_time2', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'最后修改时间', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'asp_time2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'材料编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'材料编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'批号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'批号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'图片', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 picture', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'图片';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'行号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'行号(材料出库单·领料明细行序,从 1 连续;转领料/生成领料单按默认 BOM 展开顺序写入,面板明细首列展示)', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'行号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'商品id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 material_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'商品id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'商品是否多单位', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 material_is_multi_unit', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'商品是否多单位';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'商品是否序列号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 material_is_serial', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'商品是否序列号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'商品是否辅助属性', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 material_is_asst_attr', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'商品是否辅助属性';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'商品是否保质期', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 material_is_kf_period', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'商品是否保质期';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'商品是否批次', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 material_is_batch', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'商品是否批次';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'仓库id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 stock_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'仓库id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'仓库编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 stock_number', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'仓库编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'仓库启用仓位管理', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 stock_is_allow_freight', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'仓库启用仓位管理';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'仓位id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 sp_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'仓位id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'仓位名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 sp_name', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'仓位名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'仓位编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 sp_number', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'仓位编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'辅助属性id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux_prop_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'辅助属性id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'辅助属性名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux_prop_name', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'辅助属性名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'辅助属性编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux_prop_number', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'辅助属性编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'辅助属性1id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux1_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'辅助属性1id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'辅助属性1名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux1_name', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'辅助属性1名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'辅助属性1编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux1_number', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'辅助属性1编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'辅助属性2id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux2_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'辅助属性2id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'辅助属性2名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux2_name', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'辅助属性2名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'辅助属性2编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux2_number', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'辅助属性2编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'辅助属性3id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux3_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'辅助属性3id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'辅助属性3名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux3_name', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'辅助属性3名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'辅助属性3编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux3_number', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'辅助属性3编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'条形码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 barcode', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'条形码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'产地', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 pro_place', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'产地';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'注册证号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 pro_reg_no', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'注册证号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'生产许可证', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 pro_license', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'生产许可证';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'保质期到期日', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 kf_date', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'保质期到期日';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'有效期至', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 valid_date', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'有效期至';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'保质期类型', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 kf_type', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'保质期类型';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'保质期', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 kf_period', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'保质期';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'序列号清单', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 sn_list', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'序列号清单';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'序列号流转ID', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 sn_list_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'序列号流转ID';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'基本单位id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 base_unit_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'基本单位id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'基本单位名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 base_unit_name', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'基本单位名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'基本单位编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 base_unit_number', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'基本单位编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'单位id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 unit_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'单位id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'单位编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 unit_number', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'单位编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'辅助单位id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux_unit_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'辅助单位id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'辅助单位名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux_unit_name', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'辅助单位名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'辅助单位编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux_unit_number', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'辅助单位编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'换算率', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 conversion_rate', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'换算率';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'库存数量', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 inv_qty', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'库存数量';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'基本数量', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 base_qty', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'基本数量';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'库存基本数量', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 inv_base_qty', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'库存基本数量';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'辅助数量', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux_qty', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'辅助数量';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'默认浮动数量', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 def_float_qty', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'默认浮动数量';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'辅助换算系数', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 aux_coefficient', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'辅助换算系数';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'换算系数', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 coefficient', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'换算系数';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'成本', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 cost', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'成本';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'单位成本', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 unit_cost', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'单位成本';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'源单编号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 src_bill_no', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'源单编号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'源单类型id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 src_bill_type_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'源单类型id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'源单类型名称', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 src_bill_type_name', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'源单类型名称';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'源单类型编码', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 src_bill_type_number', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'源单类型编码';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'源单内部id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 src_inter_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'源单内部id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'源单日期', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 src_bill_date', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'源单日期';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'源单行号', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 src_seq', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'源单行号';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'源单分录id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 src_entry_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'源单分录id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'源单产品分录id', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'材料出库单↔金蝶生产领料单(inv_pick)接口键 src_product_entry_id', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'源单产品分录id';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'asp_print', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'打印次数', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'asp_print';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'asp_time3', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'审核时间', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'asp_time3';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'asp_time4', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'删除时间', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'asp_time4';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'asp_user3', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'审核人', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'asp_user3';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'asp_user4', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'删除人', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'asp_user4';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'备用1', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'备用1';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'备用2', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'备用2';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'备用3', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'备用3';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'备用4', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'备用4';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'备用5', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'备用5';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'备用6', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'备用6';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'备用7', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'备用7';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'备用8', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'备用8';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'备用9', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'备用9';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'备用10', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'备用10';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'备用11', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'备用11';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'备用12', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'备用12';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'备用13', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'备用13';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'备用14', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'备用14';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'备用15', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'备用15';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'备用16', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'备用16';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'备用17', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'备用17';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'备用18', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'备用18';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'备用19', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'备用19';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.bl_material_ret') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.bl_material_ret'), N'备用20', 'ColumnId') AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'预留扩展字段(未绑定)', N'SCHEMA', N'dbo', N'TABLE', N'bl_material_ret', N'COLUMN', N'备用20';
GO

-- ② 视图 v_sale_in_detail(= v_sale_out_detail 改表名/面板码)
IF OBJECT_ID(N'dbo.v_sale_in_detail', N'V') IS NOT NULL DROP VIEW dbo.v_sale_in_detail;
GO
CREATE VIEW v_sale_in_detail AS
SELECT ROW_NUMBER() OVER(ORDER BY h.id DESC, l.id) AS id, h.asp_cancel, h.[单据日期], h.asp_time1 AS [创建时间], h.[单据编号], h.[业务类型], NULL AS [仓库编码] /* 无数据源,布局列 */, h.[仓库], h.[出库类别], h.[客户编码], h.[客户], NULL AS [部门编码] /* 无数据源,布局列 */, h.[部门], NULL AS [经手人编码] /* 无数据源,布局列 */, h.[经手人], h.asp_user1 AS [制单人], s.shr AS [审核人], l.[存货编码], l.[存货名称] AS [存货], l.[规格型号], l.[计量单位], NULL AS [应发数量] /* 无数据源,布局列 */, l.[数量], NULL AS [计量单位2] /* 无数据源,布局列 */, NULL AS [应发数量2] /* 无数据源,布局列 */, NULL AS [数量2] /* 无数据源,布局列 */, l.[成本价], COALESCE(l.[成本价],0)*COALESCE(l.[数量],0) AS [成本金额], NULL AS [出库调整] /* 无数据源,布局列 */, h.[销售订单号], NULL AS [入库单号] /* 无数据源,布局列 */
FROM bd_sale_in h LEFT JOIN bl_sale_in l ON h.[单据编号]=l.[单据编号]
LEFT JOIN yj_doc_status s ON s.panel_code='SALE_IN' AND s.doc_no=h.[单据编号]
GO

-- ② 视图 v_sale_in_stats(= v_sale_out_stats 改表名/面板码)
IF OBJECT_ID(N'dbo.v_sale_in_stats', N'V') IS NOT NULL DROP VIEW dbo.v_sale_in_stats;
GO
CREATE VIEW v_sale_in_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.asp_cancel, h.[单据日期] AS [单据日期（周）], l.[存货编码], l.[存货名称] AS [存货], l.[规格型号], l.[计量单位] AS [主单位], NULL AS [辅单位], SUM(COALESCE(l.[数量],0)) AS [数量(主单位)], SUM(COALESCE(l.[成本价],0)*COALESCE(l.[数量],0))/NULLIF(SUM(COALESCE(l.[数量],0)),0) AS [成本价(主单位)], NULL AS [数量(辅单位)], NULL AS [成本价(辅单位)], SUM(COALESCE(l.[成本价],0)*COALESCE(l.[数量],0)) AS [成本金额], NULL AS [出库调整]
FROM bd_sale_in h LEFT JOIN bl_sale_in l ON h.[单据编号]=l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='SALE_IN' AND s.doc_no=h.[单据编号] AND s.canceled='Y')
GROUP BY h.asp_cancel, h.[单据日期], l.[存货编码], l.[存货名称], l.[规格型号], l.[计量单位]
GO

-- ② 视图 v_material_ret_detail(= v_material_out_detail 改表名/面板码)
IF OBJECT_ID(N'dbo.v_material_ret_detail', N'V') IS NOT NULL DROP VIEW dbo.v_material_ret_detail;
GO
CREATE VIEW v_material_ret_detail AS
SELECT ROW_NUMBER() OVER(ORDER BY h.id DESC, l.id) AS id, h.asp_cancel, h.[单据日期], h.asp_time1 AS [创建时间], h.[单据编号], h.[业务类型], NULL AS [仓库编码] /* 无数据源,布局列 */, h.[仓库], h.[出库类别], NULL AS [生产车间编码] /* 无数据源,布局列 */, h.[生产车间], NULL AS [领用人编码] /* 无数据源,布局列 */, h.[领用人], h.asp_user1 AS [制单人], s.shr AS [审核人], NULL AS [材料编码] /* 无数据源,布局列 */, l.[材料名称], l.[规格型号] AS [材料规格], NULL AS [明细.生产车间] /* 无数据源,布局列 */, NULL AS [工作中心] /* 无数据源,布局列 */, NULL AS [班组] /* 无数据源,布局列 */, NULL AS [工人] /* 无数据源,布局列 */, NULL AS [设备] /* 无数据源,布局列 */, l.[计量单位], l.[数量], l.[单价], l.[金额], NULL AS [计量单位2] /* 无数据源,布局列 */, NULL AS [数量2] /* 无数据源,布局列 */, NULL AS [出库调整] /* 无数据源,布局列 */
FROM bd_material_ret h LEFT JOIN bl_material_ret l ON h.[单据编号]=l.[单据编号]
LEFT JOIN yj_doc_status s ON s.panel_code='MATERIAL_RET' AND s.doc_no=h.[单据编号]
GO

-- ② 视图 v_material_ret_stats(= v_material_out_stats 改表名/面板码)
IF OBJECT_ID(N'dbo.v_material_ret_stats', N'V') IS NOT NULL DROP VIEW dbo.v_material_ret_stats;
GO
CREATE VIEW v_material_ret_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.asp_cancel, NULL AS [仓库编码], l.[仓库], NULL AS [材料编码], l.[材料名称], l.[规格型号] AS [材料规格], l.[计量单位] AS [主单位], NULL AS [计量单位(辅单位)], SUM(COALESCE(l.[数量],0)) AS [数量(主单位)], SUM(COALESCE(l.[金额],0))/NULLIF(SUM(COALESCE(l.[数量],0)),0) AS [单价(主单位)], SUM(COALESCE(l.[金额],0)) AS [金额], NULL AS [数量(辅单位)], NULL AS [单价(辅单位)], NULL AS [出库调整]
FROM bd_material_ret h LEFT JOIN bl_material_ret l ON h.[单据编号]=l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='MATERIAL_RET' AND s.doc_no=h.[单据编号] AND s.canceled='Y')
GROUP BY h.asp_cancel, l.[仓库], l.[材料名称], l.[规格型号], l.[计量单位]
GO

-- ③ 面板(yj_panel):主面板 2 张 + 明细表/统计表 4 张
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'SALE_IN')
INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, config, config_at, panel_name_en) VALUES (N'SALE_IN', N'销售退货单', N'库存核算', N'doc', N'bl_sale_in', N'bd_sale_in', N'单据编号', N'id', N'单据编号', N'SR', N'单据日期', 50, N'items', N'WMS管理', NULL, NULL, N'Sales Return Note');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'MATERIAL_RET')
INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, config, config_at, panel_name_en) VALUES (N'MATERIAL_RET', N'生产退料单', N'库存核算', N'doc', N'bl_material_ret', N'bd_material_ret', N'单据编号', N'id', N'单据编号', N'TL', N'单据日期', 50, N'items', N'WMS管理', NULL, NULL, N'Production Return Note');
UPDATE yj_panel SET config = N'{"headDefaults":{"业务类型":"生产退料"}}' WHERE panel_code = N'MATERIAL_RET' AND (config IS NULL OR LTRIM(RTRIM(config)) = N'');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'SALE_IN_DETAIL')
INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, config, config_at, panel_name_en) VALUES (N'SALE_IN_DETAIL', N'销售退货单明细表', N'报表', N'flat', N'v_sale_in_detail', NULL, NULL, N'id', NULL, NULL, NULL, 50, N'items', N'WMS管理', NULL, NULL, N'Sales Return Note Details');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'SALE_IN_STATS')
INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, config, config_at, panel_name_en) VALUES (N'SALE_IN_STATS', N'销售退货单统计表', N'报表', N'flat', N'v_sale_in_stats', NULL, NULL, N'id', NULL, NULL, NULL, 50, N'items', N'WMS管理', NULL, NULL, N'Sales Return Note Statistics');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'MATERIAL_RET_DETAIL')
INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, config, config_at, panel_name_en) VALUES (N'MATERIAL_RET_DETAIL', N'生产退料单明细表', N'报表', N'flat', N'v_material_ret_detail', NULL, NULL, N'id', NULL, NULL, NULL, 50, N'items', N'WMS管理', NULL, NULL, N'Production Return Note Details');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = N'MATERIAL_RET_STATS')
INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, config, config_at, panel_name_en) VALUES (N'MATERIAL_RET_STATS', N'生产退料单统计表', N'报表', N'flat', N'v_material_ret_stats', NULL, NULL, N'id', NULL, NULL, NULL, 50, N'items', N'WMS管理', NULL, NULL, N'Production Return Note Statistics');
GO

-- ④ 面板字段(yj_field):逐行克隆源面板,再按金蝶键集做改名/隐藏/补列
-- SALE_IN  ← 克隆自 SALE_OUT(232 行)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'仓库')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'仓库', N'仓库', N'参照', NULL, N'WH', N'仓库名称', N'仓库名称', N'query,header,detail', 10, 110, 1, 1, 0, NULL, 1, N'Warehouse', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'单据日期')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 10, 140, 1, 1, 0, NULL, 1, N'Document Date', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'单据编号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 20, 140, 1, 1, 0, NULL, 1, N'Document Number', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'存货名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'存货名称', N'存货名称', N'参照', NULL, N'INV', N'存货名称', N'存货名称', N'detail', 20, 140, 1, 1, 0, NULL, 1, N'Inventory Name', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'存货编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'存货编码', N'存货编码', N'参照', NULL, N'INV', N'存货编码', N'存货名称', N'detail', 30, 140, 1, 1, 0, NULL, 1, N'Inventory Code', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'销售订单号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'销售订单号', N'销售订单号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 30, 150, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'出库类别')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'出库类别', N'退货类别', N'下拉框', N'SELECT v FROM (VALUES (N''普通销售''),(N''销售退货'')) AS t(v)', NULL, NULL, NULL, N'header', 40, 140, 1, 0, 0, NULL, 1, N'Outbound Category', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'规格型号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'规格型号', N'规格型号', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 140, 1, 0, 0, NULL, 1, N'Specification', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'客户')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'客户', N'客户', N'参照', NULL, N'KHDA', N'mc', N'mc', N'query,header', 50, 140, 1, 1, 0, NULL, 1, N'Customer', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'计量单位')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'计量单位', N'计量单位', N'下拉框', N'SELECT v FROM (VALUES (N''件''),(N''kg''),(N''套''),(N''升'')) AS t(v)', NULL, NULL, NULL, N'detail', 50, 140, 1, 1, 0, NULL, 1, N'Unit of measurement', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'源单编号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'源单编号', N'源单编号', N'文本', NULL, NULL, NULL, NULL, N'detail', 55, 140, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'源单行号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'源单行号', N'销售订单行号', N'文本', NULL, NULL, NULL, NULL, N'detail', 56, 120, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'客户编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'客户编码', N'客户编码', N'参照', NULL, N'KHDA', N'dm', N'mc', N'header', 60, 140, 1, 0, 0, NULL, 1, N'Customer Code', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'数量')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'数量', N'数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 60, 110, 1, 1, 0, NULL, 1, N'Quantity', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'批号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'批号', N'批次号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 60, 120, 1, 0, 0, NULL, 1, N'Lot No.', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'客户简称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'客户简称', N'客户简称', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 140, 1, 0, 1, NULL, 0, N'Customer Abbreviation', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'智能选单')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'智能选单', N'智能选单', N'文本', NULL, NULL, NULL, NULL, N'detail', 70, 140, 1, 0, 1, NULL, 0, N'Smart Menu', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'结算客户')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'结算客户', N'结算客户', N'参照', NULL, N'KHDA', N'dm', N'mc', N'query,header', 80, 140, 1, 0, 1, NULL, 0, N'Settlement customer', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'成本价')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'成本价', N'成本价', N'小数', NULL, NULL, NULL, NULL, N'detail', 80, 110, 1, 0, 1, NULL, 0, N'Cost price', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'经手人')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'经手人', N'经手人', N'参照', NULL, N'EMP', N'员工名称', N'员工名称', N'query,header', 90, 140, 1, 0, 0, NULL, 1, N'Person in charge', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'税率%')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'税率%', N'税率%', N'小数', N'SELECT v FROM (VALUES (N''0''),(N''3''),(N''6''),(N''9''),(N''13'')) AS t(v)', NULL, NULL, NULL, N'detail', 90, 110, 1, 0, 0, NULL, 1, N'Tax rate%', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'附件1')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'附件1', N'附件1', N'附件', NULL, NULL, NULL, NULL, N'header', 91, 220, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'附件2')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'附件2', N'附件2', N'附件', NULL, NULL, NULL, NULL, N'header', 92, 220, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'附件3')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'附件3', N'附件3', N'附件', NULL, NULL, NULL, NULL, N'header', 93, 220, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'附件4')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'附件4', N'附件4', N'附件', NULL, NULL, NULL, NULL, N'header', 94, 220, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'附件5')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'附件5', N'附件5', N'附件', NULL, NULL, NULL, NULL, N'header', 95, 220, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'附件6')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'附件6', N'附件6', N'附件', NULL, NULL, NULL, NULL, N'header', 96, 220, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'售价')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'售价', N'售价', N'小数', NULL, NULL, NULL, NULL, N'detail', 100, 110, 1, 1, 1, NULL, 0, N'Selling price', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'含税售价')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'含税售价', N'含税售价', N'小数', NULL, NULL, NULL, NULL, N'detail', 110, 110, 1, 0, 1, NULL, 0, N'Sales price including tax', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'销售金额')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'销售金额', N'销售金额', N'小数', NULL, NULL, NULL, NULL, N'detail', 120, 110, 1, 0, 1, NULL, 0, N'Sales amount', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'送货地址')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'送货地址', N'送货地址', N'文本', NULL, NULL, NULL, NULL, N'header', 130, 140, 1, 0, 1, NULL, 0, N'Shipping address', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'税额')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'税额', N'税额', N'小数', NULL, NULL, NULL, NULL, N'detail', 130, 110, 1, 0, 1, NULL, 0, N'Tax amt', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'发货单号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'发货单号', N'发货单号', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 140, 1, 0, 1, NULL, 0, N'Shipping order number', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'含税销售金额')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'含税销售金额', N'含税销售金额', N'小数', NULL, NULL, NULL, NULL, N'detail', 140, 110, 1, 0, 1, NULL, 0, N'Sales amount including tax', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'发货日期')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'发货日期', N'发货日期', N'日期', NULL, NULL, NULL, NULL, N'header', 150, 140, 1, 0, 1, NULL, 0, N'Shipping date', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'折扣金额')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'折扣金额', N'折扣金额', N'小数', NULL, NULL, NULL, NULL, N'detail', 150, 110, 1, 0, 1, NULL, 0, N'Discount amt', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'现存量')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'现存量', N'现存量', N'小数', NULL, NULL, NULL, NULL, N'detail', 160, 110, 1, 0, 0, NULL, 1, N'Current inventory', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'部门')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'部门', N'部门', N'参照', NULL, N'DEPT', N'部门名称', N'部门名称', N'header', 170, 140, 1, 0, 1, NULL, 0, N'Department', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'ERP单号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'ERP单号', N'ERP单号', N'文本', NULL, NULL, NULL, NULL, N'header', 170, 120, 0, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'门店')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'门店', N'门店', N'文本', NULL, NULL, NULL, NULL, N'header', 180, 140, 1, 0, 1, NULL, 0, N'Store', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'需求令号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'需求令号', N'需求令号', N'文本', NULL, NULL, NULL, NULL, N'detail', 180, 140, 1, 0, 1, NULL, 0, N'Demand Order No.', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'转ERP操作人')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'转ERP操作人', N'转ERP操作人', N'文本', NULL, NULL, NULL, NULL, N'header', 180, 100, 0, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'退货原因')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'退货原因', N'退货原因', N'下拉框', N'SELECT v FROM (VALUES (N''客户退货''),(N''质量原因''),(N''其他'')) AS t(v)', NULL, NULL, NULL, N'query,detail', 190, 140, 1, 0, 0, NULL, 1, N'Reason for return', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'转ERP时间')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'转ERP时间', N'转ERP时间', N'日期', NULL, NULL, NULL, NULL, N'header', 190, 130, 0, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'验货日期')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'验货日期', N'验货日期', N'日期', NULL, NULL, NULL, NULL, N'header', 200, 140, 1, 0, 1, NULL, 0, N'Inspection date', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'商品id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'商品id', N'商品id', N'文本', NULL, NULL, NULL, NULL, N'detail', 200, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'是否已转ERP')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'是否已转ERP', N'是否已转ERP', N'文本', NULL, NULL, NULL, NULL, N'header', 200, 80, 0, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'发货人')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'发货人', N'发货人', N'参照', NULL, N'EMP', N'员工名称', N'员工名称', N'header', 210, 140, 1, 0, 1, NULL, 0, N'Shipper', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'商品是否多单位')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'商品是否多单位', N'商品是否多单位', N'文本', NULL, NULL, NULL, NULL, N'detail', 210, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'收货仓库')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'收货仓库', N'收货仓库', N'参照', NULL, N'WH', N'仓库名称', N'仓库名称', N'header', 220, 140, 1, 0, 1, NULL, 0, N'Receiving Warehouse', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'商品是否序列号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'商品是否序列号', N'商品是否序列号', N'文本', NULL, NULL, NULL, NULL, N'detail', 220, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'创建时间')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'创建时间', N'创建时间', N'日期', NULL, NULL, NULL, NULL, N'header', 230, 130, 1, 0, 0, NULL, 1, N'Created at', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'商品是否辅助属性')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'商品是否辅助属性', N'商品是否辅助属性', N'文本', NULL, NULL, NULL, NULL, N'detail', 230, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'结算状态')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'结算状态', N'结算状态', N'文本', NULL, NULL, NULL, NULL, N'header', 240, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'商品是否保质期')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'商品是否保质期', N'商品是否保质期', N'文本', NULL, NULL, NULL, NULL, N'detail', 240, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'经手人编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'经手人编码', N'经手人编码', N'文本', NULL, NULL, NULL, NULL, N'header', 250, 130, 1, 0, 1, NULL, 0, N'Handler code', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'商品是否批次')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'商品是否批次', N'商品是否批次', N'文本', NULL, NULL, NULL, NULL, N'detail', 250, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'金额')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'金额', N'金额', N'文本', NULL, NULL, NULL, NULL, N'header', 260, 130, 1, 0, 0, NULL, 1, N'Amount', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'商品助记码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'商品助记码', N'商品助记码', N'文本', NULL, NULL, NULL, NULL, N'detail', 260, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'联系人电话')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'联系人电话', N'联系人电话', N'文本', NULL, NULL, NULL, NULL, N'header', 270, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'仓库id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'仓库id', N'仓库id', N'文本', NULL, NULL, NULL, NULL, N'detail', 270, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'联系人国家名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'联系人国家名称', N'联系人国家名称', N'文本', NULL, NULL, NULL, NULL, N'header', 280, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'联系人国家编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'联系人国家编码', N'联系人国家编码', N'文本', NULL, NULL, NULL, NULL, N'header', 290, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'仓库编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'仓库编码', N'仓库编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 290, 120, 1, 0, 1, NULL, 0, N'Warehouse Code', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'联系人省份名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'联系人省份名称', N'联系人省份名称', N'文本', NULL, NULL, NULL, NULL, N'header', 300, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'仓库启用仓位管理')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'仓库启用仓位管理', N'仓库启用仓位管理', N'文本', NULL, NULL, NULL, NULL, N'detail', 300, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'联系人省份编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'联系人省份编码', N'联系人省份编码', N'文本', NULL, NULL, NULL, NULL, N'header', 310, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'仓位id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'仓位id', N'仓位id', N'文本', NULL, NULL, NULL, NULL, N'detail', 310, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'联系人市区名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'联系人市区名称', N'联系人市区名称', N'文本', NULL, NULL, NULL, NULL, N'header', 320, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'仓位名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'仓位名称', N'仓位名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 320, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'联系人市区编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'联系人市区编码', N'联系人市区编码', N'文本', NULL, NULL, NULL, NULL, N'header', 330, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'仓位编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'仓位编码', N'仓位编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 330, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'联系人区县名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'联系人区县名称', N'联系人区县名称', N'文本', NULL, NULL, NULL, NULL, N'header', 340, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'辅助属性id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'辅助属性id', N'辅助属性id', N'文本', NULL, NULL, NULL, NULL, N'detail', 340, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'联系人区县编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'联系人区县编码', N'联系人区县编码', N'文本', NULL, NULL, NULL, NULL, N'header', 350, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'辅助属性名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'辅助属性名称', N'辅助属性名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 350, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'联系人')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'联系人', N'联系人', N'文本', NULL, NULL, NULL, NULL, N'header', 360, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'辅助属性编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'辅助属性编码', N'辅助属性编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 360, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'联系信息')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'联系信息', N'联系信息', N'文本', NULL, NULL, NULL, NULL, N'header', 370, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'辅助属性1id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'辅助属性1id', N'辅助属性1id', N'文本', NULL, NULL, NULL, NULL, N'detail', 370, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'联系地址')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'联系地址', N'联系地址', N'文本', NULL, NULL, NULL, NULL, N'header', 380, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'辅助属性1名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'辅助属性1名称', N'辅助属性1名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 380, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'发货国家名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'发货国家名称', N'发货国家名称', N'文本', NULL, NULL, NULL, NULL, N'header', 390, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'辅助属性1编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'辅助属性1编码', N'辅助属性1编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 390, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'发货国家编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'发货国家编码', N'发货国家编码', N'文本', NULL, NULL, NULL, NULL, N'header', 400, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'辅助属性2id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'辅助属性2id', N'辅助属性2id', N'文本', NULL, NULL, NULL, NULL, N'detail', 400, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'发货省份名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'发货省份名称', N'发货省份名称', N'文本', NULL, NULL, NULL, NULL, N'header', 410, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'辅助属性2名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'辅助属性2名称', N'辅助属性2名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 410, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'发货省份编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'发货省份编码', N'发货省份编码', N'文本', NULL, NULL, NULL, NULL, N'header', 420, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'辅助属性2编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'辅助属性2编码', N'辅助属性2编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 420, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'发货市区名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'发货市区名称', N'发货市区名称', N'文本', NULL, NULL, NULL, NULL, N'header', 430, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'辅助属性3id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'辅助属性3id', N'辅助属性3id', N'文本', NULL, NULL, NULL, NULL, N'detail', 430, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'发货市区编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'发货市区编码', N'发货市区编码', N'文本', NULL, NULL, NULL, NULL, N'header', 440, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'辅助属性3名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'辅助属性3名称', N'辅助属性3名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 440, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'发货区县名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'发货区县名称', N'发货区县名称', N'文本', NULL, NULL, NULL, NULL, N'header', 450, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'辅助属性3编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'辅助属性3编码', N'辅助属性3编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 450, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'发货区县编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'发货区县编码', N'发货区县编码', N'文本', NULL, NULL, NULL, NULL, N'header', 460, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'辅助属性4id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'辅助属性4id', N'辅助属性4id', N'文本', NULL, NULL, NULL, NULL, N'detail', 460, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'发货地址')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'发货地址', N'发货地址', N'文本', NULL, NULL, NULL, NULL, N'header', 470, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'辅助属性4名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'辅助属性4名称', N'辅助属性4名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 470, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'发货人2')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'发货人2', N'发货人2', N'文本', NULL, NULL, NULL, NULL, N'header', 480, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'辅助属性4编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'辅助属性4编码', N'辅助属性4编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 480, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'发货电话')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'发货电话', N'发货电话', N'文本', NULL, NULL, NULL, NULL, N'header', 490, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'辅助属性5id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'辅助属性5id', N'辅助属性5id', N'文本', NULL, NULL, NULL, NULL, N'detail', 490, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'发货方式')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'发货方式', N'发货方式', N'文本', NULL, NULL, NULL, NULL, N'header', 500, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'辅助属性5名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'辅助属性5名称', N'辅助属性5名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 500, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'附件')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'附件', N'附件', N'文本', NULL, NULL, NULL, NULL, N'header', 510, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'辅助属性5编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'辅助属性5编码', N'辅助属性5编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 510, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'附件地址')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'附件地址', N'附件地址', N'文本', NULL, NULL, NULL, NULL, N'header', 520, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'条形码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'条形码', N'条形码', N'文本', NULL, NULL, NULL, NULL, N'detail', 520, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'审核人编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'审核人编码', N'审核人编码', N'文本', NULL, NULL, NULL, NULL, N'header', 530, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'实际含税单价')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'实际含税单价', N'实际含税单价', N'文本', NULL, NULL, NULL, NULL, N'detail', 530, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'部门编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'部门编码', N'部门编码', N'文本', NULL, NULL, NULL, NULL, N'header', 540, 130, 1, 0, 1, NULL, 0, N'Department Code', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'基本单位id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'基本单位id', N'基本单位id', N'文本', NULL, NULL, NULL, NULL, N'detail', 540, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'修改时间')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'修改时间', N'修改时间', N'日期', NULL, NULL, NULL, NULL, N'header', 550, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'基本单位名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'基本单位名称', N'基本单位名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 550, 120, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'出入库状态')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'出入库状态', N'出入库状态', N'文本', NULL, NULL, NULL, NULL, N'header', 560, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'基本单位编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'基本单位编码', N'基本单位编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 560, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'创建人')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'创建人', N'创建人', N'文本', NULL, NULL, NULL, NULL, N'header', 570, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'单位id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'单位id', N'单位id', N'文本', NULL, NULL, NULL, NULL, N'detail', 570, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'创建人编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'创建人编码', N'创建人编码', N'文本', NULL, NULL, NULL, NULL, N'header', 580, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'单位编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'单位编码', N'单位编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 580, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'修改人')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'修改人', N'修改人', N'文本', NULL, NULL, NULL, NULL, N'header', 590, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'换算系数')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'换算系数', N'换算系数', N'文本', NULL, NULL, NULL, NULL, N'detail', 590, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'修改人编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'修改人编码', N'修改人编码', N'文本', NULL, NULL, NULL, NULL, N'header', 600, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'换算率')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'换算率', N'换算率', N'文本', NULL, NULL, NULL, NULL, N'detail', 600, 120, 1, 0, 1, NULL, 0, N'conversion rate', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'交货方式')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'交货方式', N'交货方式', N'文本', NULL, NULL, NULL, NULL, N'header', 610, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'库存基本数量')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'库存基本数量', N'库存基本数量', N'文本', NULL, NULL, NULL, NULL, N'detail', 610, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'交货方式编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'交货方式编码', N'交货方式编码', N'文本', NULL, NULL, NULL, NULL, N'header', 620, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'退货数量')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'退货数量', N'退货数量', N'文本', NULL, NULL, NULL, NULL, N'detail', 620, 120, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'到期日')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'到期日', N'到期日', N'日期', NULL, NULL, NULL, NULL, N'header', 630, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'结算期限编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'结算期限编码', N'结算期限编码', N'文本', NULL, NULL, NULL, NULL, N'header', 640, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'整单折扣分摊')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'整单折扣分摊', N'整单折扣分摊', N'文本', NULL, NULL, NULL, NULL, N'detail', 640, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'结算期限')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'结算期限', N'结算期限', N'文本', NULL, NULL, NULL, NULL, N'header', 650, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'折扣额')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'折扣额', N'折扣额', N'文本', NULL, NULL, NULL, NULL, N'detail', 650, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'币别名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'币别名称', N'币别名称', N'文本', NULL, NULL, NULL, NULL, N'header', 660, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'费用')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'费用', N'费用', N'文本', NULL, NULL, NULL, NULL, N'detail', 660, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'分摊差额')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'分摊差额', N'分摊差额', N'文本', NULL, NULL, NULL, NULL, N'detail', 670, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'折扣率%')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'折扣率%', N'折扣率%', N'文本', NULL, NULL, NULL, NULL, N'detail', 680, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'折前金额')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'折前金额', N'折前金额', N'文本', NULL, NULL, NULL, NULL, N'detail', 690, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'实际不含税金额')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'实际不含税金额', N'实际不含税金额', N'文本', NULL, NULL, NULL, NULL, N'detail', 700, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'单位成本')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'单位成本', N'单位成本', N'文本', NULL, NULL, NULL, NULL, N'detail', 710, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'成本')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'成本', N'成本', N'文本', NULL, NULL, NULL, NULL, N'detail', 720, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'本次结算金额')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'本次结算金额', N'本次结算金额', N'文本', NULL, NULL, NULL, NULL, N'detail', 730, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'折扣金额2')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'折扣金额2', N'折扣金额2', N'文本', NULL, NULL, NULL, NULL, N'detail', 740, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'折后单价')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'折后单价', N'折后单价', N'文本', NULL, NULL, NULL, NULL, N'detail', 750, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'产地')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'产地', N'产地', N'文本', NULL, NULL, NULL, NULL, N'detail', 760, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'注册证号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'注册证号', N'注册证号', N'文本', NULL, NULL, NULL, NULL, N'detail', 770, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'生产许可证')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'生产许可证', N'生产许可证', N'文本', NULL, NULL, NULL, NULL, N'detail', 780, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'保质期到期日')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'保质期到期日', N'保质期到期日', N'日期', NULL, NULL, NULL, NULL, N'detail', 790, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'有效期至')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'有效期至', N'有效期至', N'文本', NULL, NULL, NULL, NULL, N'detail', 800, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'保质期类型')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'保质期类型', N'保质期类型', N'文本', NULL, NULL, NULL, NULL, N'detail', 810, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'保质期')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'保质期', N'保质期', N'文本', NULL, NULL, NULL, NULL, N'detail', 820, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'序列号流转ID')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'序列号流转ID', N'序列号流转ID', N'文本', NULL, NULL, NULL, NULL, N'detail', 830, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'辅助单位id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'辅助单位id', N'辅助单位id', N'文本', NULL, NULL, NULL, NULL, N'detail', 840, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'辅助单位编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'辅助单位编码', N'辅助单位编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 850, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'辅助换算系数')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'辅助换算系数', N'辅助换算系数', N'文本', NULL, NULL, NULL, NULL, N'detail', 860, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'行号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'行号', N'行号', N'文本', NULL, NULL, NULL, NULL, N'detail', 870, 120, 1, 0, 1, NULL, 0, N'Line No.', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'分录状态')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'分录状态', N'分录状态', N'文本', NULL, NULL, NULL, NULL, N'detail', 880, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'分录结算状态')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'分录结算状态', N'分录结算状态', N'文本', NULL, NULL, NULL, NULL, N'detail', 890, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'是否赠品')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'是否赠品', N'是否赠品', N'文本', NULL, NULL, NULL, NULL, N'detail', 900, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'源单id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'源单id', N'源单id', N'文本', NULL, NULL, NULL, NULL, N'detail', 910, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'源单类型id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'源单类型id', N'源单类型id', N'文本', NULL, NULL, NULL, NULL, N'detail', 930, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'源单类型名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'源单类型名称', N'源单类型名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 940, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'源单类型编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'源单类型编码', N'源单类型编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 950, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'源单内部id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'源单内部id', N'源单内部id', N'文本', NULL, NULL, NULL, NULL, N'detail', 960, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'源单日期')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'源单日期', N'源单日期', N'日期', NULL, NULL, NULL, NULL, N'detail', 970, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'单据状态_bill_status')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'单据状态_bill_status', N'单据状态_bill_status', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'ivc_status ')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'ivc_status ', N'ivc_status ', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'发货人_dispatcher_linkman')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'发货人_dispatcher_linkman', N'发货人_dispatcher_linkman', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'附件')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'附件', N'附件', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'审核人_auditor_name')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'审核人_auditor_name', N'审核人_auditor_name', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'审核人编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'审核人编码', N'审核人编码', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'审核时间_audit_time')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'审核时间_audit_time', N'审核时间_audit_time', N'日期', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'部门_dept_name')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'部门_dept_name', N'部门_dept_name', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'创建人编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'创建人编码', N'创建人编码', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'修改人编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'修改人编码', N'修改人编码', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'仓库名称_sp_name')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'仓库名称_sp_name', N'仓库名称_sp_name', N'文本', NULL, NULL, NULL, NULL, N'detail', 970, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'税额_tax_amount')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'税额_tax_amount', N'税额_tax_amount', N'文本', NULL, NULL, NULL, NULL, N'detail', 970, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'折扣金额_dis_amount')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'折扣金额_dis_amount', N'折扣金额_dis_amount', N'文本', NULL, NULL, NULL, NULL, N'detail', 970, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'auditor_number')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'auditor_number', N'auditor_number', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'attachments')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'attachments', N'attachments', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'联系人区县id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'联系人区县id', N'联系人区县id', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'交货方式id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'交货方式id', N'交货方式id', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'物流信息分录')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'物流信息分录', N'物流信息分录', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'发货市区id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'发货市区id', N'发货市区id', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'modifier_number')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'modifier_number', N'modifier_number', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'经手人id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'经手人id', N'经手人id', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'采购费用分录')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'采购费用分录', N'采购费用分录', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'物流公司id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'物流公司id', N'物流公司id', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'发货国家id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'发货国家id', N'发货国家id', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'发货状态')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'发货状态', N'发货状态', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'修改人id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'修改人id', N'修改人id', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'交易类型')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'交易类型', N'交易类型', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'客户承担费用分录')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'客户承担费用分录', N'客户承担费用分录', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'抵扣余额')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'抵扣余额', N'抵扣余额', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'单据标签')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'单据标签', N'单据标签', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'费用分摊信息')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'费用分摊信息', N'费用分摊信息', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'发货区县id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'发货区县id', N'发货区县id', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'创建人id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'创建人id', N'创建人id', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'应收款余额')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'应收款余额', N'应收款余额', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'商品数量')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'商品数量', N'商品数量', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'整单折扣率%')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'整单折扣率%', N'整单折扣率%', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'发货省份id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'发货省份id', N'发货省份id', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'采购费用')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'采购费用', N'采购费用', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'审核人id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'审核人id', N'审核人id', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'联系人省份id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'联系人省份id', N'联系人省份id', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'整单折扣额')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'整单折扣额', N'整单折扣额', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'联系人国家id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'联系人国家id', N'联系人国家id', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'creator_number')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'creator_number', N'creator_number', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'上次欠款')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'上次欠款', N'上次欠款', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'未结算金额')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'未结算金额', N'未结算金额', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'部门id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'部门id', N'部门id', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'商品分录')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'商品分录', N'商品分录', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'商品组合')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'商品组合', N'商品组合', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'客户id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'客户id', N'客户id', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'付款信息分录')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'付款信息分录', N'付款信息分录', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'币种id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'币种id', N'币种id', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'折前价税合计')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'折前价税合计', N'折前价税合计', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'结算期限id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'结算期限id', N'结算期限id', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'联系人市区id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'联系人市区id', N'联系人市区id', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'配送路线分录')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'配送路线分录', N'配送路线分录', N'文本', NULL, NULL, NULL, NULL, N'header', 970, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'源单分录id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'源单分录id', N'源单分录id', N'文本', NULL, NULL, NULL, NULL, N'detail', 990, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'序列号清单')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'序列号清单', N'序列号清单', N'文本', NULL, NULL, NULL, NULL, N'detail', 1000, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'基本数量')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'基本数量', N'基本数量', N'文本', NULL, NULL, NULL, NULL, N'detail', 1010, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'折扣税额')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'折扣税额', N'折扣税额', N'文本', NULL, NULL, NULL, NULL, N'detail', 1020, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'客户单号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'客户单号', N'客户单号', N'文本', NULL, NULL, NULL, NULL, N'detail', 1030, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'未开票数量')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'未开票数量', N'未开票数量', N'文本', NULL, NULL, NULL, NULL, N'detail', 1040, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'已开票数量')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'已开票数量', N'已开票数量', N'文本', NULL, NULL, NULL, NULL, N'detail', 1050, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'已开票金额')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'已开票金额', N'已开票金额', N'文本', NULL, NULL, NULL, NULL, N'detail', 1060, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'未开票金额')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'未开票金额', N'未开票金额', N'文本', NULL, NULL, NULL, NULL, N'detail', 1070, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'价税合计本位币')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'价税合计本位币', N'价税合计本位币', N'文本', NULL, NULL, NULL, NULL, N'detail', 1080, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
-- SALE_IN 补列:退货原因(金蝶键)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN' AND col_name = N'退货原因')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN', N'退货原因', N'退货原因', N'文本', NULL, NULL, NULL, NULL, N'header', 45, 160, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
-- MATERIAL_RET  ← 克隆自 MATERIAL_OUT(119 行)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'单据编号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 10, 140, 1, 1, 0, NULL, 1, N'Document Number', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'单据日期')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 20, 140, 1, 1, 0, NULL, 1, N'Document Date', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'材料编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'材料编码', N'材料编码', N'参照', NULL, N'INV', N'存货编码', N'存货名称', N'query,detail', 25, 120, 1, 1, 0, NULL, 1, N'Material Code', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'批号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'批号', N'批次号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 27, 120, 1, 0, 0, NULL, 1, N'Lot No.', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'加工单号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'加工单号', N'加工单号', N'文本', NULL, NULL, NULL, NULL, N'header,detail', 30, 120, 1, 0, 0, NULL, 1, N'Work order no.', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'材料名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'材料名称', N'材料名称', N'参照', NULL, N'INV', N'存货名称', N'存货名称', N'detail', 30, 140, 1, 1, 0, NULL, 1, N'Material Name', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'仓库')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'仓库', N'仓库', N'参照', NULL, N'WH', N'仓库名称', N'仓库名称', N'query,header,detail', 40, 110, 1, 0, 1, NULL, 0, N'Warehouse', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'计量单位')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'计量单位', N'计量单位', N'参照', NULL, N'UOM', N'计量单位名称', N'计量单位名称', N'detail', 40, 140, 1, 1, 0, NULL, 1, N'Unit of measurement', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'数量')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'数量', N'数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 50, 110, 1, 1, 0, NULL, 1, N'Quantity', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'工单行号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'工单行号', N'工单行号', N'整数', NULL, NULL, NULL, NULL, N'query,header', 50, 80, 0, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'业务类型')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'业务类型', N'业务类型', N'下拉框', N'SELECT v FROM (VALUES (N''销售出库''),(N''材料出库''),(N''其他出库'')) AS t(v)', NULL, NULL, NULL, N'query,header', 60, 140, 1, 1, 0, NULL, 1, N'Business Type', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'单价')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'单价', N'单价', N'小数', NULL, NULL, NULL, NULL, N'detail', 60, 110, 1, 0, 0, NULL, 1, N'Unit Price', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'生产车间')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'生产车间', N'生产线', N'参照', NULL, NULL, NULL, NULL, N'query,header', 70, 140, 0, 0, 0, NULL, 1, N'Workshop', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'金额')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'金额', N'金额', N'小数', NULL, NULL, NULL, NULL, N'detail', 70, 110, 1, 0, 0, NULL, 1, N'Amount', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'出库类别')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'出库类别', N'退料类别', N'下拉框', N'SELECT v FROM (VALUES (N''直接领料''),(N''自制领料''),(N''退料''),(N''共耗领料'')) AS t(v)', NULL, NULL, NULL, N'query,header', 80, 140, 1, 0, 0, NULL, 1, N'Outbound Category', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'规格型号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'规格型号', N'规格型号', N'文本', NULL, NULL, NULL, NULL, N'detail', 80, 140, 1, 0, 0, NULL, 1, N'Specification', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'领用人')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'领用人', N'领用人', N'参照', NULL, N'EMP', N'员工名称', N'员工名称', N'query,header', 90, 140, 1, 0, 0, NULL, 1, N'User of the item', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'手工确定成本')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'手工确定成本', N'手工确定成本', N'是否', NULL, NULL, NULL, NULL, N'detail', 90, 140, 1, 0, 0, NULL, 1, N'Manually determine costs', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'项目')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'项目', N'项目', N'参照', NULL, N'PROJ', N'项目名称', N'项目名称', N'header', 100, 140, 1, 0, 0, NULL, 1, N'Project', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'明细备注')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'明细备注', N'明细备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 100, 140, 1, 0, 0, NULL, 1, N'Detail Remarks', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'来源单据')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'来源单据', N'来源单据', N'文本', NULL, NULL, NULL, NULL, N'query,header', 110, 110, 1, 0, 0, NULL, 1, N'Source doc', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'现存量')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'现存量', N'现存量', N'小数', NULL, NULL, NULL, NULL, N'detail', 110, 110, 1, 0, 0, NULL, 1, N'Current inventory', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'销售订单号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'销售订单号', N'销售订单号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 120, 130, 1, 0, 0, NULL, 1, N'Sales order no.', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'现存量说明')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'现存量说明', N'现存量说明', N'文本', NULL, NULL, NULL, NULL, N'detail', 120, 140, 1, 0, 0, NULL, 1, N'Quantity on Hand Description', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'来源单号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'来源单号', N'来源单号', N'文本', NULL, NULL, NULL, NULL, N'header', 130, 140, 1, 0, 0, NULL, 1, N'Source Order No.', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'匹配来源单号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'匹配来源单号', N'匹配来源单号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 140, 130, 1, 0, 0, NULL, 1, N'Matched source no.', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'ERP单号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'ERP单号', N'ERP单号', N'文本', NULL, NULL, NULL, NULL, N'header', 150, 130, 0, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'转ERP操作人')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'转ERP操作人', N'转ERP操作人', N'文本', NULL, NULL, NULL, NULL, N'header', 160, 130, 0, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'转ERP时间')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'转ERP时间', N'转ERP时间', N'文本', NULL, NULL, NULL, NULL, N'header', 170, 130, 0, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'是否已转ERP')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'是否已转ERP', N'是否已转ERP', N'文本', NULL, NULL, NULL, NULL, N'header', 180, 130, 0, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'备注')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 190, 200, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'创建时间')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'创建时间', N'创建时间', N'文本', NULL, NULL, NULL, NULL, N'header', 200, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'金蝶单据状态')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'金蝶单据状态', N'金蝶单据状态', N'文本', NULL, NULL, NULL, NULL, N'header', 210, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'部门id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'部门id', N'部门id', N'文本', NULL, NULL, NULL, NULL, N'header', 220, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'部门编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'部门编码', N'部门编码', N'参照', NULL, N'DEPT', N'部门编码', N'部门名称', N'header', 230, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'领料类型')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'领料类型', N'领料类型', N'文本', NULL, NULL, NULL, NULL, N'header', 240, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'修改时间')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'修改时间', N'修改时间', N'文本', NULL, NULL, NULL, NULL, N'header', 250, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'金蝶审核时间')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'金蝶审核时间', N'金蝶审核时间', N'文本', NULL, NULL, NULL, NULL, N'header', 260, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'创建人id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'创建人id', N'创建人id', N'文本', NULL, NULL, NULL, NULL, N'header', 270, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'创建人')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'创建人', N'创建人', N'文本', NULL, NULL, NULL, NULL, N'header', 280, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'创建人编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'创建人编码', N'创建人编码', N'文本', NULL, NULL, NULL, NULL, N'header', 290, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'修改人id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'修改人id', N'修改人id', N'文本', NULL, NULL, NULL, NULL, N'header', 300, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'修改人')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'修改人', N'修改人', N'文本', NULL, NULL, NULL, NULL, N'header', 310, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'修改人编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'修改人编码', N'修改人编码', N'文本', NULL, NULL, NULL, NULL, N'header', 320, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'单据类型名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'单据类型名称', N'单据类型名称', N'文本', NULL, NULL, NULL, NULL, N'header', 330, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'单据类型编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'单据类型编码', N'单据类型编码', N'文本', NULL, NULL, NULL, NULL, N'header', 340, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'单据类型id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'单据类型id', N'单据类型id', N'文本', NULL, NULL, NULL, NULL, N'header', 350, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'审核人id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'审核人id', N'审核人id', N'文本', NULL, NULL, NULL, NULL, N'header', 360, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'金蝶审核人')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'金蝶审核人', N'金蝶审核人', N'文本', NULL, NULL, NULL, NULL, N'header', 370, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'审核人编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'审核人编码', N'审核人编码', N'文本', NULL, NULL, NULL, NULL, N'header', 380, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'经手人id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'经手人id', N'经手人id', N'文本', NULL, NULL, NULL, NULL, N'header', 390, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'经手人编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'经手人编码', N'经手人编码', N'参照', NULL, N'EMP', N'员工编码', N'员工名称', N'header', 400, 130, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'单据标签')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'单据标签', N'单据标签', N'文本', NULL, NULL, NULL, NULL, N'header', 410, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'领料用途名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'领料用途名称', N'领料用途名称', N'文本', NULL, NULL, NULL, NULL, N'header', 420, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'领料用途id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'领料用途id', N'领料用途id', N'文本', NULL, NULL, NULL, NULL, N'header', 430, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'领料用途编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'领料用途编码', N'领料用途编码', N'文本', NULL, NULL, NULL, NULL, N'header', 440, 130, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'图片')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'图片', N'图片', N'文本', NULL, NULL, NULL, NULL, N'detail', 970, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'行号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'行号', N'行号', N'文本', NULL, NULL, NULL, NULL, N'detail', 971, 120, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'商品id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'商品id', N'商品id', N'文本', NULL, NULL, NULL, NULL, N'detail', 972, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'商品是否多单位')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'商品是否多单位', N'商品是否多单位', N'文本', NULL, NULL, NULL, NULL, N'detail', 973, 120, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'商品是否序列号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'商品是否序列号', N'商品是否序列号', N'文本', NULL, NULL, NULL, NULL, N'detail', 974, 120, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'商品是否辅助属性')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'商品是否辅助属性', N'商品是否辅助属性', N'文本', NULL, NULL, NULL, NULL, N'detail', 975, 120, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'商品是否保质期')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'商品是否保质期', N'商品是否保质期', N'文本', NULL, NULL, NULL, NULL, N'detail', 976, 120, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'商品是否批次')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'商品是否批次', N'商品是否批次', N'文本', NULL, NULL, NULL, NULL, N'detail', 977, 120, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'仓库id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'仓库id', N'仓库id', N'文本', NULL, NULL, NULL, NULL, N'detail', 978, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'仓库编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'仓库编码', N'仓库编码', N'参照', NULL, N'WH', N'仓库编码', N'仓库名称', N'detail', 979, 120, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'仓库启用仓位管理')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'仓库启用仓位管理', N'仓库启用仓位管理', N'文本', NULL, NULL, NULL, NULL, N'detail', 980, 120, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'仓位id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'仓位id', N'仓位id', N'文本', NULL, NULL, NULL, NULL, N'detail', 981, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'仓位名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'仓位名称', N'仓位名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 982, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'仓位编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'仓位编码', N'仓位编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 983, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'辅助属性id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'辅助属性id', N'辅助属性id', N'文本', NULL, NULL, NULL, NULL, N'detail', 984, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'辅助属性名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'辅助属性名称', N'辅助属性名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 985, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'辅助属性编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'辅助属性编码', N'辅助属性编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 986, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'辅助属性1id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'辅助属性1id', N'辅助属性1id', N'文本', NULL, NULL, NULL, NULL, N'detail', 987, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'辅助属性1名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'辅助属性1名称', N'辅助属性1名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 988, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'辅助属性1编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'辅助属性1编码', N'辅助属性1编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 989, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'辅助属性2id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'辅助属性2id', N'辅助属性2id', N'文本', NULL, NULL, NULL, NULL, N'detail', 990, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'辅助属性2名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'辅助属性2名称', N'辅助属性2名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 991, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'辅助属性2编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'辅助属性2编码', N'辅助属性2编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 992, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'辅助属性3id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'辅助属性3id', N'辅助属性3id', N'文本', NULL, NULL, NULL, NULL, N'detail', 993, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'辅助属性3名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'辅助属性3名称', N'辅助属性3名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 994, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'辅助属性3编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'辅助属性3编码', N'辅助属性3编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 995, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'条形码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'条形码', N'条形码', N'文本', NULL, NULL, NULL, NULL, N'detail', 996, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'产地')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'产地', N'产地', N'文本', NULL, NULL, NULL, NULL, N'detail', 997, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'注册证号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'注册证号', N'注册证号', N'文本', NULL, NULL, NULL, NULL, N'detail', 998, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'生产许可证')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'生产许可证', N'生产许可证', N'文本', NULL, NULL, NULL, NULL, N'detail', 999, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'保质期到期日')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'保质期到期日', N'保质期到期日', N'文本', NULL, NULL, NULL, NULL, N'detail', 1000, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'有效期至')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'有效期至', N'有效期至', N'文本', NULL, NULL, NULL, NULL, N'detail', 1001, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'保质期类型')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'保质期类型', N'保质期类型', N'文本', NULL, NULL, NULL, NULL, N'detail', 1002, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'保质期')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'保质期', N'保质期', N'文本', NULL, NULL, NULL, NULL, N'detail', 1003, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'序列号清单')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'序列号清单', N'序列号清单', N'文本', NULL, NULL, NULL, NULL, N'detail', 1004, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'序列号流转ID')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'序列号流转ID', N'序列号流转ID', N'文本', NULL, NULL, NULL, NULL, N'detail', 1005, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'基本单位id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'基本单位id', N'基本单位id', N'文本', NULL, NULL, NULL, NULL, N'detail', 1006, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'基本单位名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'基本单位名称', N'基本单位名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 1007, 120, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'基本单位编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'基本单位编码', N'基本单位编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 1008, 120, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'单位id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'单位id', N'单位id', N'文本', NULL, NULL, NULL, NULL, N'detail', 1009, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'单位编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'单位编码', N'单位编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 1010, 120, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'辅助单位id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'辅助单位id', N'辅助单位id', N'文本', NULL, NULL, NULL, NULL, N'detail', 1011, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'辅助单位名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'辅助单位名称', N'辅助单位名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 1012, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'辅助单位编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'辅助单位编码', N'辅助单位编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 1013, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'换算率')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'换算率', N'换算率', N'文本', NULL, NULL, NULL, NULL, N'detail', 1014, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'库存数量')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'库存数量', N'库存数量', N'文本', NULL, NULL, NULL, NULL, N'detail', 1015, 120, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'基本数量')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'基本数量', N'基本数量', N'文本', NULL, NULL, NULL, NULL, N'detail', 1016, 120, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'库存基本数量')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'库存基本数量', N'库存基本数量', N'文本', NULL, NULL, NULL, NULL, N'detail', 1017, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'辅助数量')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'辅助数量', N'辅助数量', N'文本', NULL, NULL, NULL, NULL, N'detail', 1018, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'默认浮动数量')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'默认浮动数量', N'默认浮动数量', N'文本', NULL, NULL, NULL, NULL, N'detail', 1019, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'辅助换算系数')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'辅助换算系数', N'辅助换算系数', N'文本', NULL, NULL, NULL, NULL, N'detail', 1020, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'换算系数')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'换算系数', N'换算系数', N'文本', NULL, NULL, NULL, NULL, N'detail', 1021, 120, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'成本')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'成本', N'成本', N'文本', NULL, NULL, NULL, NULL, N'detail', 1022, 120, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'单位成本')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'单位成本', N'单位成本', N'文本', NULL, NULL, NULL, NULL, N'detail', 1023, 120, 1, 0, 0, NULL, 1, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'源单编号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'源单编号', N'源单编号', N'文本', NULL, NULL, NULL, NULL, N'detail', 1024, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'源单类型id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'源单类型id', N'源单类型id', N'文本', NULL, NULL, NULL, NULL, N'detail', 1025, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'源单类型名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'源单类型名称', N'源单类型名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 1026, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'源单类型编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'源单类型编码', N'源单类型编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 1027, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'源单内部id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'源单内部id', N'源单内部id', N'文本', NULL, NULL, NULL, NULL, N'detail', 1028, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'源单日期')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'源单日期', N'源单日期', N'文本', NULL, NULL, NULL, NULL, N'detail', 1029, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'源单行号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'源单行号', N'源单行号', N'文本', NULL, NULL, NULL, NULL, N'detail', 1030, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'源单分录id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'源单分录id', N'源单分录id', N'文本', NULL, NULL, NULL, NULL, N'detail', 1031, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET' AND col_name = N'源单产品分录id')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET', N'源单产品分录id', N'源单产品分录id', N'文本', NULL, NULL, NULL, NULL, N'detail', 1032, 120, 1, 0, 1, NULL, 0, NULL, NULL, NULL, NULL);
-- SALE_IN_DETAIL  ← 克隆自 SALE_OUT_DETAIL(29 行)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'单据日期')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'query,detail', 10, 120, 0, 0, 0, NULL, 1, N'Date', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'创建时间')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'创建时间', N'创建时间', N'日期', NULL, NULL, NULL, NULL, N'detail', 20, 120, 0, 0, 0, NULL, 1, N'Created at', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'单据编号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 30, 120, 0, 0, 0, NULL, 1, N'Document Number', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'业务类型')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'业务类型', N'业务类型', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 40, 120, 0, 0, 0, NULL, 1, N'Business Type', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'仓库编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'仓库编码', N'仓库编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 120, 0, 0, 0, NULL, 1, N'Warehouse Code', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'仓库')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'仓库', N'仓库', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 60, 120, 0, 0, 0, NULL, 1, N'Warehouse', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'出库类别')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'出库类别', N'出库类别', N'文本', NULL, NULL, NULL, NULL, N'detail', 70, 120, 0, 0, 0, NULL, 1, N'Outbound Category', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'客户编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'客户编码', N'客户编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 80, 120, 0, 0, 0, NULL, 1, N'Customer Code', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'客户')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'客户', N'客户', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 90, 120, 0, 0, 0, NULL, 1, N'Customer', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'部门编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'部门编码', N'部门编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 100, 120, 0, 0, 0, NULL, 1, N'Department Code', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'部门')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'部门', N'部门', N'文本', NULL, NULL, NULL, NULL, N'detail', 110, 120, 0, 0, 0, NULL, 1, N'Department', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'经手人编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'经手人编码', N'经手人编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 120, 120, 0, 0, 0, NULL, 1, N'Handler code', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'经手人')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'经手人', N'经手人', N'文本', NULL, NULL, NULL, NULL, N'detail', 130, 120, 0, 0, 0, NULL, 1, N'Person in charge', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'制单人')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'制单人', N'制单人', N'文本', NULL, NULL, NULL, NULL, N'detail', 140, 120, 0, 0, 0, NULL, 1, N'Prepared by', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'审核人')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, NULL, N'detail', 150, 120, 0, 0, 0, NULL, 1, N'Approved by', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'存货编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'存货编码', N'存货编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 160, 120, 0, 0, 0, NULL, 1, N'Inventory Code', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'存货')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'存货', N'存货', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 170, 120, 0, 0, 0, NULL, 1, N'Inventory', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'规格型号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'规格型号', N'规格型号', N'文本', NULL, NULL, NULL, NULL, N'detail', 180, 120, 0, 0, 0, NULL, 1, N'Specification', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'计量单位')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'计量单位', N'计量单位', N'文本', NULL, NULL, NULL, NULL, N'detail', 190, 120, 0, 0, 0, NULL, 1, N'Unit of measurement', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'应发数量')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'应发数量', N'应发数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 200, 120, 0, 0, 0, NULL, 1, N'Due qty', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'数量')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'数量', N'数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 210, 120, 0, 0, 0, NULL, 1, N'Quantity', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'计量单位2')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'计量单位2', N'计量单位2', N'文本', NULL, NULL, NULL, NULL, N'detail', 220, 120, 0, 0, 0, NULL, 1, N'Unit of measurement 2', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'应发数量2')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'应发数量2', N'应发数量2', N'小数', NULL, NULL, NULL, NULL, N'detail', 230, 120, 0, 0, 0, NULL, 1, N'Due qty 2', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'数量2')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'数量2', N'数量2', N'小数', NULL, NULL, NULL, NULL, N'detail', 240, 120, 0, 0, 0, NULL, 1, N'Quantity 2', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'成本价')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'成本价', N'成本价', N'小数', NULL, NULL, NULL, NULL, N'detail', 250, 120, 0, 0, 0, NULL, 1, N'Cost price', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'成本金额')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'成本金额', N'成本金额', N'小数', NULL, NULL, NULL, NULL, N'detail', 260, 120, 0, 0, 0, NULL, 1, N'Cost amount', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'出库调整')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'出库调整', N'出库调整', N'小数', NULL, NULL, NULL, NULL, N'detail', 270, 120, 0, 0, 0, NULL, 1, N'Issue adjustment', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'销售订单号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'销售订单号', N'销售订单号', N'文本', NULL, NULL, NULL, NULL, N'detail', 280, 120, 0, 0, 0, NULL, 1, N'Sales order no.', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_DETAIL' AND col_name = N'入库单号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_DETAIL', N'入库单号', N'入库单号', N'文本', NULL, NULL, NULL, NULL, N'detail', 290, 120, 0, 0, 0, NULL, 1, N'Receipt No.', NULL, NULL, NULL);
-- SALE_IN_STATS  ← 克隆自 SALE_OUT_STATS(12 行)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_STATS' AND col_name = N'单据日期（周）')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_STATS', N'单据日期（周）', N'单据日期（周）', N'日期', NULL, NULL, NULL, NULL, N'detail', 10, 120, 0, 0, 0, NULL, 1, N'Doc date (week)', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_STATS' AND col_name = N'存货编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_STATS', N'存货编码', N'存货编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 120, 0, 0, 0, NULL, 1, N'Inventory Code', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_STATS' AND col_name = N'存货')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_STATS', N'存货', N'存货', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 30, 120, 0, 0, 0, NULL, 1, N'Inventory', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_STATS' AND col_name = N'规格型号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_STATS', N'规格型号', N'规格型号', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 120, 0, 0, 0, NULL, 1, N'Specification', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_STATS' AND col_name = N'主单位')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_STATS', N'主单位', N'主单位', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 120, 0, 0, 0, NULL, 1, N'Main unit', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_STATS' AND col_name = N'辅单位')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_STATS', N'辅单位', N'辅单位', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 120, 0, 0, 0, NULL, 1, N'Auxiliary unit', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_STATS' AND col_name = N'数量(主单位)')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_STATS', N'数量(主单位)', N'数量(主单位)', N'文本', NULL, NULL, NULL, NULL, N'detail', 70, 120, 0, 0, 0, NULL, 1, N'Qty (main)', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_STATS' AND col_name = N'成本价(主单位)')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_STATS', N'成本价(主单位)', N'成本价(主单位)', N'文本', NULL, NULL, NULL, NULL, N'detail', 80, 120, 0, 0, 0, NULL, 1, N'Unit cost (main)', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_STATS' AND col_name = N'数量(辅单位)')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_STATS', N'数量(辅单位)', N'数量(辅单位)', N'文本', NULL, NULL, NULL, NULL, N'detail', 90, 120, 0, 0, 0, NULL, 1, N'Qty (aux)', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_STATS' AND col_name = N'成本价(辅单位)')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_STATS', N'成本价(辅单位)', N'成本价(辅单位)', N'文本', NULL, NULL, NULL, NULL, N'detail', 100, 120, 0, 0, 0, NULL, 1, N'Unit cost (aux)', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_STATS' AND col_name = N'成本金额')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_STATS', N'成本金额', N'成本金额', N'小数', NULL, NULL, NULL, NULL, N'detail', 110, 120, 0, 0, 0, NULL, 1, N'Cost amount', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_IN_STATS' AND col_name = N'出库调整')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'SALE_IN_STATS', N'出库调整', N'出库调整', N'小数', NULL, NULL, NULL, NULL, N'detail', 120, 120, 0, 0, 0, NULL, 1, N'Issue adjustment', NULL, NULL, NULL);
-- MATERIAL_RET_DETAIL  ← 克隆自 MATERIAL_OUT_DETAIL(29 行)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'材料名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'材料名称', N'材料', N'文本', NULL, NULL, NULL, NULL, N'query', 5, 120, 0, 0, 0, NULL, 0, N'Material', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'单据日期')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'query,detail', 10, 120, 0, 0, 0, NULL, 1, N'Date', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'创建时间')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'创建时间', N'创建时间', N'日期', NULL, NULL, NULL, NULL, N'detail', 20, 120, 0, 0, 0, NULL, 1, N'Created at', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'单据编号')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 30, 120, 0, 0, 0, NULL, 1, N'Document Number', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'业务类型')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'业务类型', N'业务类型', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 40, 120, 0, 0, 0, NULL, 1, N'Business Type', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'仓库编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'仓库编码', N'仓库编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 120, 0, 0, 0, NULL, 1, N'Warehouse Code', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'仓库')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'仓库', N'仓库', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 60, 120, 0, 0, 0, NULL, 1, N'Warehouse', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'出库类别')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'出库类别', N'出库类别', N'文本', NULL, NULL, NULL, NULL, N'detail', 70, 120, 0, 0, 0, NULL, 1, N'Outbound Category', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'生产车间编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'生产车间编码', N'生产车间编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 80, 120, 0, 0, 0, NULL, 1, N'Workshop code', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'生产车间')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'生产车间', N'生产车间', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 90, 120, 0, 0, 0, NULL, 1, N'Workshop', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'领用人编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'领用人编码', N'领用人编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 100, 120, 0, 0, 0, NULL, 1, N'Picker code', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'领用人')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'领用人', N'领用人', N'文本', NULL, NULL, NULL, NULL, N'detail', 110, 120, 0, 0, 0, NULL, 1, N'User of the item', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'制单人')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'制单人', N'制单人', N'文本', NULL, NULL, NULL, NULL, N'detail', 120, 120, 0, 0, 0, NULL, 1, N'Prepared by', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'审核人')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, NULL, N'detail', 130, 120, 0, 0, 0, NULL, 1, N'Approved by', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'材料编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'材料编码', N'材料编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 140, 120, 0, 0, 0, NULL, 1, N'Material Code', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'材料名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'材料名称', N'材料名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 150, 120, 0, 0, 0, NULL, 1, N'Material Name', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'材料规格')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'材料规格', N'材料规格', N'文本', NULL, NULL, NULL, NULL, N'detail', 160, 120, 0, 0, 0, NULL, 1, N'Material spec', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'明细.生产车间')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'明细.生产车间', N'明细.生产车间', N'文本', NULL, NULL, NULL, NULL, N'detail', 170, 120, 0, 0, 0, NULL, 1, N'Workshop (line)', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'工作中心')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'工作中心', N'工作中心', N'文本', NULL, NULL, NULL, NULL, N'detail', 180, 120, 0, 0, 0, NULL, 1, N'Work Center', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'班组')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'班组', N'班组', N'文本', NULL, NULL, NULL, NULL, N'detail', 190, 120, 0, 0, 0, NULL, 1, N'Work team', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'工人')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'工人', N'工人', N'文本', NULL, NULL, NULL, NULL, N'detail', 200, 120, 0, 0, 0, NULL, 1, N'worker', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'设备')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'设备', N'设备', N'文本', NULL, NULL, NULL, NULL, N'detail', 210, 120, 0, 0, 0, NULL, 1, N'Equipment', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'计量单位')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'计量单位', N'计量单位', N'文本', NULL, NULL, NULL, NULL, N'detail', 220, 120, 0, 0, 0, NULL, 1, N'Unit of measurement', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'数量')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'数量', N'数量', N'小数', NULL, NULL, NULL, NULL, N'detail', 230, 120, 0, 0, 0, NULL, 1, N'Quantity', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'单价')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'单价', N'单价', N'小数', NULL, NULL, NULL, NULL, N'detail', 240, 120, 0, 0, 0, NULL, 1, N'Unit Price', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'金额')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'金额', N'金额', N'小数', NULL, NULL, NULL, NULL, N'detail', 250, 120, 0, 0, 0, NULL, 1, N'Amount', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'计量单位2')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'计量单位2', N'计量单位2', N'文本', NULL, NULL, NULL, NULL, N'detail', 260, 120, 0, 0, 0, NULL, 1, N'Unit of measurement 2', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'数量2')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'数量2', N'数量2', N'小数', NULL, NULL, NULL, NULL, N'detail', 270, 120, 0, 0, 0, NULL, 1, N'Quantity 2', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_DETAIL' AND col_name = N'出库调整')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_DETAIL', N'出库调整', N'出库调整', N'小数', NULL, NULL, NULL, NULL, N'detail', 280, 120, 0, 0, 0, NULL, 1, N'Issue adjustment', NULL, NULL, NULL);
-- MATERIAL_RET_STATS  ← 克隆自 MATERIAL_OUT_STATS(14 行)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_STATS' AND col_name = N'材料名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_STATS', N'材料名称', N'材料', N'文本', NULL, NULL, NULL, NULL, N'query', 5, 120, 0, 0, 0, NULL, 0, N'Material', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_STATS' AND col_name = N'仓库编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_STATS', N'仓库编码', N'仓库编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 120, 0, 0, 0, NULL, 1, N'Warehouse Code', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_STATS' AND col_name = N'仓库')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_STATS', N'仓库', N'仓库', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 20, 120, 0, 0, 0, NULL, 1, N'Warehouse', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_STATS' AND col_name = N'材料编码')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_STATS', N'材料编码', N'材料编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 120, 0, 0, 0, NULL, 1, N'Material Code', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_STATS' AND col_name = N'材料名称')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_STATS', N'材料名称', N'材料名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 120, 0, 0, 0, NULL, 1, N'Material Name', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_STATS' AND col_name = N'材料规格')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_STATS', N'材料规格', N'材料规格', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 120, 0, 0, 0, NULL, 1, N'Material spec', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_STATS' AND col_name = N'主单位')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_STATS', N'主单位', N'主单位', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 120, 0, 0, 0, NULL, 1, N'Main unit', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_STATS' AND col_name = N'计量单位(辅单位)')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_STATS', N'计量单位(辅单位)', N'计量单位(辅单位)', N'文本', NULL, NULL, NULL, NULL, N'detail', 70, 120, 0, 0, 0, NULL, 1, N'UOM (aux)', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_STATS' AND col_name = N'数量(主单位)')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_STATS', N'数量(主单位)', N'数量(主单位)', N'文本', NULL, NULL, NULL, NULL, N'detail', 80, 120, 0, 0, 0, NULL, 1, N'Qty (main)', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_STATS' AND col_name = N'单价(主单位)')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_STATS', N'单价(主单位)', N'单价(主单位)', N'文本', NULL, NULL, NULL, NULL, N'detail', 90, 120, 0, 0, 0, NULL, 1, N'Unit price (main)', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_STATS' AND col_name = N'金额')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_STATS', N'金额', N'金额', N'小数', NULL, NULL, NULL, NULL, N'detail', 100, 120, 0, 0, 0, NULL, 1, N'Amount', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_STATS' AND col_name = N'数量(辅单位)')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_STATS', N'数量(辅单位)', N'数量(辅单位)', N'文本', NULL, NULL, NULL, NULL, N'detail', 110, 120, 0, 0, 0, NULL, 1, N'Qty (aux)', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_STATS' AND col_name = N'单价(辅单位)')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_STATS', N'单价(辅单位)', N'单价(辅单位)', N'文本', NULL, NULL, NULL, NULL, N'detail', 120, 120, 0, 0, 0, NULL, 1, N'Unit price (aux)', NULL, NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'MATERIAL_RET_STATS' AND col_name = N'出库调整')
INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group, ref_filter, tab_key) VALUES (N'MATERIAL_RET_STATS', N'出库调整', N'出库调整', N'小数', NULL, NULL, NULL, NULL, N'detail', 130, 120, 0, 0, 0, NULL, 1, N'Issue adjustment', NULL, NULL, NULL);
GO

-- ⑤ 角色权限(yj_role_panel):与源面板同权(管理员/车间/仓库等角色照旧可见可审)
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1 AND panel_code = N'SALE_IN')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1, N'SALE_IN', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1031 AND panel_code = N'SALE_IN')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1031, N'SALE_IN', N'Y', N'view,query,add,modify,modlog,del,export,print,audit,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1029 AND panel_code = N'SALE_IN')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1029, N'SALE_IN', N'N', N'view,query,export,print,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1045 AND panel_code = N'SALE_IN')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1045, N'SALE_IN', N'N', N'view,query');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 2 AND panel_code = N'SALE_IN')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (2, N'SALE_IN', N'N', N'view,query,add,modify,modlog,del,export,print,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1036 AND panel_code = N'SALE_IN')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1036, N'SALE_IN', N'N', N'view,query,export,print,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1043 AND panel_code = N'SALE_IN')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1043, N'SALE_IN', N'Y', N'view,query,add,modify,modlog,del,export,print,audit,field,warn,selfaudit');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1049 AND panel_code = N'SALE_IN')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1049, N'SALE_IN', N'Y', N'view,query,add,modify,modlog,del,export,print,audit,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1042 AND panel_code = N'SALE_IN')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1042, N'SALE_IN', N'Y', N'view,query,add,modify,modlog,del,export,print,audit,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1 AND panel_code = N'MATERIAL_RET')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1, N'MATERIAL_RET', N'N', N'view,query,add,modify,modlog,del,export');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1031 AND panel_code = N'MATERIAL_RET')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1031, N'MATERIAL_RET', N'Y', N'view,query,add,modify,modlog,del,export,print,audit,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1029 AND panel_code = N'MATERIAL_RET')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1029, N'MATERIAL_RET', N'N', N'view,query,export,print,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 2 AND panel_code = N'MATERIAL_RET')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (2, N'MATERIAL_RET', N'N', N'view,query,add,modify,modlog,del,export,print,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1036 AND panel_code = N'MATERIAL_RET')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1036, N'MATERIAL_RET', N'N', N'view,query,export,print,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1043 AND panel_code = N'MATERIAL_RET')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1043, N'MATERIAL_RET', N'Y', N'view,query,add,modify,modlog,del,export,print,audit,field,warn,selfaudit');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1049 AND panel_code = N'MATERIAL_RET')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1049, N'MATERIAL_RET', N'Y', N'view,query,add,modify,modlog,del,export,print,audit,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1042 AND panel_code = N'MATERIAL_RET')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1042, N'MATERIAL_RET', N'Y', N'view,query,add,modify,modlog,del,export,print,audit,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1 AND panel_code = N'SALE_IN_DETAIL')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1, N'SALE_IN_DETAIL', N'N', N'view,query,export,print');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1031 AND panel_code = N'SALE_IN_DETAIL')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1031, N'SALE_IN_DETAIL', N'N', N'view,query,add,modify,modlog,del,export,print');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1029 AND panel_code = N'SALE_IN_DETAIL')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1029, N'SALE_IN_DETAIL', N'N', N'view,query,export,print,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1045 AND panel_code = N'SALE_IN_DETAIL')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1045, N'SALE_IN_DETAIL', N'N', N'view,query');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 2 AND panel_code = N'SALE_IN_DETAIL')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (2, N'SALE_IN_DETAIL', N'N', N'view,query,add,modify,modlog,del,export,print,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1036 AND panel_code = N'SALE_IN_DETAIL')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1036, N'SALE_IN_DETAIL', N'N', N'view,query,export,print,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1043 AND panel_code = N'SALE_IN_DETAIL')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1043, N'SALE_IN_DETAIL', N'Y', N'view,query,add,modify,modlog,del,export,print,audit,field,warn,selfaudit');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1049 AND panel_code = N'SALE_IN_DETAIL')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1049, N'SALE_IN_DETAIL', N'Y', N'view,query,add,modify,modlog,del,export,print,audit,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1042 AND panel_code = N'SALE_IN_DETAIL')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1042, N'SALE_IN_DETAIL', N'Y', N'view,query,add,modify,modlog,del,export,print,audit,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1 AND panel_code = N'SALE_IN_STATS')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1, N'SALE_IN_STATS', N'N', N'view,query,export,print');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1031 AND panel_code = N'SALE_IN_STATS')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1031, N'SALE_IN_STATS', N'Y', N'view,query,add,modify,modlog,del,export,print,audit,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1029 AND panel_code = N'SALE_IN_STATS')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1029, N'SALE_IN_STATS', N'N', N'view,query,export,print,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1045 AND panel_code = N'SALE_IN_STATS')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1045, N'SALE_IN_STATS', N'N', N'view,query');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 2 AND panel_code = N'SALE_IN_STATS')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (2, N'SALE_IN_STATS', N'N', N'view,query,add,modify,modlog,del,export,print,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1036 AND panel_code = N'SALE_IN_STATS')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1036, N'SALE_IN_STATS', N'N', N'view,query,export,print,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1043 AND panel_code = N'SALE_IN_STATS')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1043, N'SALE_IN_STATS', N'Y', N'view,query,add,modify,modlog,del,export,print,audit,field,warn,selfaudit');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1049 AND panel_code = N'SALE_IN_STATS')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1049, N'SALE_IN_STATS', N'Y', N'view,query,add,modify,modlog,del,export,print,audit,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1042 AND panel_code = N'SALE_IN_STATS')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1042, N'SALE_IN_STATS', N'Y', N'view,query,add,modify,modlog,del,export,print,audit,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1 AND panel_code = N'MATERIAL_RET_DETAIL')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1, N'MATERIAL_RET_DETAIL', N'N', N'view,query,export,print');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1031 AND panel_code = N'MATERIAL_RET_DETAIL')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1031, N'MATERIAL_RET_DETAIL', N'N', N'view,query,add,modify,modlog,del,export,print');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1029 AND panel_code = N'MATERIAL_RET_DETAIL')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1029, N'MATERIAL_RET_DETAIL', N'N', N'view,query,export,print,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 2 AND panel_code = N'MATERIAL_RET_DETAIL')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (2, N'MATERIAL_RET_DETAIL', N'N', N'view,query,add,modify,modlog,del,export,print,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1036 AND panel_code = N'MATERIAL_RET_DETAIL')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1036, N'MATERIAL_RET_DETAIL', N'N', N'view,query,export,print,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1043 AND panel_code = N'MATERIAL_RET_DETAIL')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1043, N'MATERIAL_RET_DETAIL', N'Y', N'view,query,add,modify,modlog,del,export,print,audit,field,warn,selfaudit');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1049 AND panel_code = N'MATERIAL_RET_DETAIL')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1049, N'MATERIAL_RET_DETAIL', N'Y', N'view,query,add,modify,modlog,del,export,print,audit,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1042 AND panel_code = N'MATERIAL_RET_DETAIL')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1042, N'MATERIAL_RET_DETAIL', N'Y', N'view,query,add,modify,modlog,del,export,print,audit,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1 AND panel_code = N'MATERIAL_RET_STATS')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1, N'MATERIAL_RET_STATS', N'N', N'view,query,export,print');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1031 AND panel_code = N'MATERIAL_RET_STATS')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1031, N'MATERIAL_RET_STATS', N'N', N'view,query,add,modify,modlog,del,export,print');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1029 AND panel_code = N'MATERIAL_RET_STATS')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1029, N'MATERIAL_RET_STATS', N'N', N'view,query,export,print,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1042 AND panel_code = N'MATERIAL_RET_STATS')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1042, N'MATERIAL_RET_STATS', N'Y', N'view,query,add,modify,modlog,del,export,print,audit,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 2 AND panel_code = N'MATERIAL_RET_STATS')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (2, N'MATERIAL_RET_STATS', N'N', N'view,query,add,modify,modlog,del,export,print,field,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1036 AND panel_code = N'MATERIAL_RET_STATS')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1036, N'MATERIAL_RET_STATS', N'N', N'view,query,export,print,warn');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1043 AND panel_code = N'MATERIAL_RET_STATS')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1043, N'MATERIAL_RET_STATS', N'Y', N'view,query,add,modify,modlog,del,export,print,audit,field,warn,selfaudit');
IF NOT EXISTS (SELECT 1 FROM yj_role_panel WHERE role_id = 1049 AND panel_code = N'MATERIAL_RET_STATS')
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms) VALUES (1049, N'MATERIAL_RET_STATS', N'Y', N'view,query,add,modify,modlog,del,export,print,audit,field,warn');
GO

-- ⑥ 译名(yj_translation):面板名 + 本次新增/改名的字段标签(9 语)
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单' AND locale = N'en')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单', N'en', N'Sales Return Note', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单' AND locale = N'ja')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单', N'ja', N'販売返品票', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单' AND locale = N'ko')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单', N'ko', N'판매 반품 전표', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单' AND locale = N'zh-TW')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单', N'zh-TW', N'銷售退貨單', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单' AND locale = N'de')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单', N'de', N'Verkaufsrücksendung', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单' AND locale = N'es')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单', N'es', N'Nota de devolución de ventas', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单' AND locale = N'fr')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单', N'fr', N'Note de retour de vente', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单' AND locale = N'ru')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单', N'ru', N'Накладная на возврат продажи', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单' AND locale = N'th')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单', N'th', N'ใบรับคืนสินค้าขาย', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单' AND locale = N'vi')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单', N'vi', N'Phiếu trả lại hàng bán', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单明细表' AND locale = N'en')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单明细表', N'en', N'Sales Return Note Details', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单明细表' AND locale = N'ja')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单明细表', N'ja', N'販売返品明細表', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单明细表' AND locale = N'ko')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单明细表', N'ko', N'판매 반품 세부 목록', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单明细表' AND locale = N'zh-TW')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单明细表', N'zh-TW', N'銷售退貨單明細表', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单明细表' AND locale = N'de')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单明细表', N'de', N'Verkaufsrücksendung Details', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单明细表' AND locale = N'es')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单明细表', N'es', N'Detalles de la nota de devolución', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单明细表' AND locale = N'fr')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单明细表', N'fr', N'Détails de la note de retour', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单明细表' AND locale = N'ru')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单明细表', N'ru', N'Детали накладной на возврат', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单明细表' AND locale = N'th')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单明细表', N'th', N'รายละเอียดใบรับคืน', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单明细表' AND locale = N'vi')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单明细表', N'vi', N'Chi tiết phiếu trả lại hàng bán', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单统计表' AND locale = N'en')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单统计表', N'en', N'Sales Return Statistics', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单统计表' AND locale = N'ja')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单统计表', N'ja', N'販売返品統計表', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单统计表' AND locale = N'ko')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单统计表', N'ko', N'판매 반품 통계표', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单统计表' AND locale = N'zh-TW')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单统计表', N'zh-TW', N'銷售退貨單統計表', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单统计表' AND locale = N'de')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单统计表', N'de', N'Verkaufsrücksendung Statistik', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单统计表' AND locale = N'es')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单统计表', N'es', N'Estadísticas de devoluciones', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单统计表' AND locale = N'fr')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单统计表', N'fr', N'Statistiques des retours de vente', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单统计表' AND locale = N'ru')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单统计表', N'ru', N'Статистика возвратов продаж', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单统计表' AND locale = N'th')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单统计表', N'th', N'สถิติการรับคืน', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'销售退货单统计表' AND locale = N'vi')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'销售退货单统计表', N'vi', N'Thống kê trả lại hàng bán', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单' AND locale = N'en')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单', N'en', N'Production Return Note', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单' AND locale = N'ja')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单', N'ja', N'生産返料票', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单' AND locale = N'ko')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单', N'ko', N'생산 반납 전표', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单' AND locale = N'zh-TW')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单', N'zh-TW', N'生產退料單', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单' AND locale = N'de')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单', N'de', N'Produktionsrückgabe', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单' AND locale = N'es')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单', N'es', N'Nota de devolución de producción', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单' AND locale = N'fr')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单', N'fr', N'Note de retour de production', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单' AND locale = N'ru')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单', N'ru', N'Накладная на возврат производства', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单' AND locale = N'th')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单', N'th', N'ใบรับคืนการผลิต', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单' AND locale = N'vi')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单', N'vi', N'Phiếu hoàn trả sản xuất', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单明细表' AND locale = N'en')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单明细表', N'en', N'Production Return Note Details', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单明细表' AND locale = N'ja')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单明细表', N'ja', N'生産返料明細表', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单明细表' AND locale = N'ko')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单明细表', N'ko', N'생산 반납 세부 목록', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单明细表' AND locale = N'zh-TW')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单明细表', N'zh-TW', N'生產退料單明細表', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单明细表' AND locale = N'de')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单明细表', N'de', N'Produktionsrückgabe Details', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单明细表' AND locale = N'es')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单明细表', N'es', N'Detalles de la devolución de producción', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单明细表' AND locale = N'fr')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单明细表', N'fr', N'Détails de la note de retour de production', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单明细表' AND locale = N'ru')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单明细表', N'ru', N'Детали накладной возврата производства', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单明细表' AND locale = N'th')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单明细表', N'th', N'รายละเอียดใบรับคืนการผลิต', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单明细表' AND locale = N'vi')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单明细表', N'vi', N'Chi tiết phiếu hoàn trả sản xuất', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单统计表' AND locale = N'en')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单统计表', N'en', N'Production Return Statistics', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单统计表' AND locale = N'ja')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单统计表', N'ja', N'生産返料統計表', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单统计表' AND locale = N'ko')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单统计表', N'ko', N'생산 반납 통계표', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单统计表' AND locale = N'zh-TW')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单统计表', N'zh-TW', N'生產退料單統計表', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单统计表' AND locale = N'de')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单统计表', N'de', N'Produktionsrückgabe Statistik', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单统计表' AND locale = N'es')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单统计表', N'es', N'Estadísticas de devolución de producción', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单统计表' AND locale = N'fr')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单统计表', N'fr', N'Statistiques des retours de production', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单统计表' AND locale = N'ru')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单统计表', N'ru', N'Статистика возвратов производства', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单统计表' AND locale = N'th')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单统计表', N'th', N'สถิติการรับคืนการผลิต', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'panel' AND ref_key = N'生产退料单统计表' AND locale = N'vi')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'panel', N'生产退料单统计表', N'vi', N'Thống kê hoàn trả sản xuất', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'退货类别' AND locale = N'en')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'退货类别', N'en', N'Return Category', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'退货类别' AND locale = N'ja')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'退货类别', N'ja', N'返品カテゴリ', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'退货类别' AND locale = N'ko')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'退货类别', N'ko', N'반품 분류', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'退货类别' AND locale = N'zh-TW')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'退货类别', N'zh-TW', N'退貨類別', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'退货类别' AND locale = N'de')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'退货类别', N'de', N'Rückgabekategorie', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'退货类别' AND locale = N'es')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'退货类别', N'es', N'Categoría de devolución', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'退货类别' AND locale = N'fr')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'退货类别', N'fr', N'Catégorie de retour', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'退货类别' AND locale = N'ru')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'退货类别', N'ru', N'Категория возврата', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'退货类别' AND locale = N'th')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'退货类别', N'th', N'ประเภทการคืน', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'退货类别' AND locale = N'vi')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'退货类别', N'vi', N'Loại trả lại', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'退料类别' AND locale = N'en')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'退料类别', N'en', N'Return Material Category', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'退料类别' AND locale = N'ja')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'退料类别', N'ja', N'返料カテゴリ', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'退料类别' AND locale = N'ko')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'退料类别', N'ko', N'반납 분류', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'退料类别' AND locale = N'zh-TW')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'退料类别', N'zh-TW', N'退料類別', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'退料类别' AND locale = N'de')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'退料类别', N'de', N'Rückgabematerial-Kategorie', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'退料类别' AND locale = N'es')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'退料类别', N'es', N'Categoría de devolución de material', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'退料类别' AND locale = N'fr')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'退料类别', N'fr', N'Catégorie de retour de matériau', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'退料类别' AND locale = N'ru')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'退料类别', N'ru', N'Категория возврата материала', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'退料类别' AND locale = N'th')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'退料类别', N'th', N'ประเภทการคืนวัสดุ', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'退料类别' AND locale = N'vi')
INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'退料类别', N'vi', N'Loại hoàn trả vật tư', N'manual');
GO

-- ⑦ 自检(全 PASS 才算迁移成功)
DECLARE @chk TABLE(项 nvarchar(60), 期望 int, 实际 int);
INSERT @chk SELECT N'table bd_sale_in', 1, COUNT(*) FROM sys.tables WHERE name = 'bd_sale_in';
INSERT @chk SELECT N'table bl_sale_in', 1, COUNT(*) FROM sys.tables WHERE name = 'bl_sale_in';
INSERT @chk SELECT N'table bd_material_ret', 1, COUNT(*) FROM sys.tables WHERE name = 'bd_material_ret';
INSERT @chk SELECT N'table bl_material_ret', 1, COUNT(*) FROM sys.tables WHERE name = 'bl_material_ret';
INSERT @chk SELECT N'view v_sale_in_detail', 1, COUNT(*) FROM sys.views WHERE name = 'v_sale_in_detail';
INSERT @chk SELECT N'view v_material_ret_stats', 1, COUNT(*) FROM sys.views WHERE name = 'v_material_ret_stats';
INSERT @chk SELECT N'panel SALE_IN', 1, COUNT(*) FROM yj_panel WHERE panel_code = 'SALE_IN';
INSERT @chk SELECT N'panel MATERIAL_RET', 1, COUNT(*) FROM yj_panel WHERE panel_code = 'MATERIAL_RET';
INSERT @chk SELECT N'fields SALE_IN > 200', 1, CASE WHEN (SELECT COUNT(*) FROM yj_field WHERE panel_code='SALE_IN') > 200 THEN 1 ELSE 0 END;
INSERT @chk SELECT N'fields MATERIAL_RET > 100', 1, CASE WHEN (SELECT COUNT(*) FROM yj_field WHERE panel_code='MATERIAL_RET') > 100 THEN 1 ELSE 0 END;
INSERT @chk SELECT N'translations SALE_IN 9', 1, CASE WHEN (SELECT COUNT(*) FROM yj_translation WHERE scope='panel' AND ref_key=N'销售退货单') >= 9 THEN 1 ELSE 0 END;
SELECT 项, 期望, 实际, CASE WHEN 期望 = 实际 THEN N'PASS' ELSE N'FAIL' END AS 结果 FROM @chk;
SELECT CASE WHEN EXISTS (SELECT 1 FROM @chk WHERE 期望 <> 实际) THEN N'RESULT: FAIL' ELSE N'RESULT: ALL-PASS' END AS 结论;
GO