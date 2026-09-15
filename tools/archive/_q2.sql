SET NOCOUNT ON;
-- 新增字段填充率(测试 50 条口径)
SELECT COUNT(*) AS 商品数,
  SUM(CASE WHEN ISNULL(助记码,'')<>'' THEN 1 ELSE 0 END) AS 助记码,
  SUM(CASE WHEN ISNULL(所属类别,'')<>'' THEN 1 ELSE 0 END) AS 所属类别,
  SUM(CASE WHEN ISNULL(辅助单位,'')<>'' THEN 1 ELSE 0 END) AS 辅助单位,
  SUM(CASE WHEN 是否可销售=1 THEN 1 ELSE 0 END) AS 可销售,
  SUM(CASE WHEN ISNULL(采购价,0)<>0 THEN 1 ELSE 0 END) AS 采购价,
  SUM(CASE WHEN ISNULL(零售价,0)<>0 THEN 1 ELSE 0 END) AS 零售价,
  SUM(CASE WHEN ISNULL(参考成本,0)<>0 THEN 1 ELSE 0 END) AS 参考成本,
  SUM(CASE WHEN ISNULL(备注,'')<>'' THEN 1 ELSE 0 END) AS 备注,
  SUM(CASE WHEN ISNULL(商品标签,'')<>'' THEN 1 ELSE 0 END) AS 商品标签
FROM bs_inv WHERE 外部数据ID IS NOT NULL;
SELECT TOP 2 存货编码, 所属类别, 助记码, 辅助单位, 采购价, 零售价, 参考成本, 商品类型 FROM bs_inv WHERE 外部数据ID IS NOT NULL ORDER BY id DESC;
-- 客户新增字段
SELECT COUNT(*) AS 客户数,
  SUM(CASE WHEN ISNULL(结算客户,'')<>'' THEN 1 ELSE 0 END) AS 结算客户,
  SUM(CASE WHEN ISNULL(部门,'')<>'' THEN 1 ELSE 0 END) AS 部门,
  SUM(CASE WHEN ISNULL(gj,'')<>'' THEN 1 ELSE 0 END) AS 国家,
  SUM(CASE WHEN ISNULL(sheng,'')<>'' THEN 1 ELSE 0 END) AS 省,
  SUM(CASE WHEN ISNULL(shi,'')<>'' THEN 1 ELSE 0 END) AS 市,
  SUM(CASE WHEN ISNULL(开票名称,'')<>'' THEN 1 ELSE 0 END) AS 开票名称,
  SUM(CASE WHEN ISNULL(联系人性别,'')<>'' THEN 1 ELSE 0 END) AS 联系人性别,
  SUM(CASE WHEN ISNULL(lxr,'')<>'' THEN 1 ELSE 0 END) AS 联系人,
  SUM(CASE WHEN ISNULL(创建时间,'')<>'' THEN 1 ELSE 0 END) AS 创建时间
FROM dm_kh WHERE 外部数据ID IS NOT NULL;
SELECT TOP 2 dm, mc, 结算客户, 部门, gj, sheng, shi, lxr, 联系人性别, 增值税税率, 自动抵扣预收款 FROM dm_kh WHERE 外部数据ID IS NOT NULL ORDER BY id DESC;
-- 其它档案新增字段
SELECT TOP 3 员工编码, 员工名称, 性别, 部门编码, 入职日期 FROM bs_emp WHERE 外部数据ID IS NOT NULL ORDER BY id DESC;
SELECT TOP 3 仓库编码, 仓库名称, 国家, 省, 启用仓位管理, 允许零库存出库 FROM bs_wh ORDER BY id;
SELECT TOP 3 计量单位编码, 单位类型, 长编码, 精度处理 FROM bs_uom ORDER BY id;
-- 已删字段确认(应为 0 行)
SELECT COUNT(*) AS 已删MES独有字段 FROM yj_field WHERE
 (panel_code='INV' AND col_name IN (N'是否检验',N'检验方式',N'数据来源',N'ERP更新时间',N'最新成本'))
 OR (panel_code='EMP' AND col_name IN (N'办公电话',N'证件类型',N'职务',N'职称',N'业务员'))
 OR (panel_code='DEPT' AND col_name IN (N'部门类型',N'电话'))
 OR (panel_code='WH' AND col_name IN (N'仓库类型',N'所属车间',N'联系人'))
 OR (panel_code='UOM' AND col_name IN (N'主单位',N'换算率'))
 OR (panel_code='GFDA' AND col_name IN (N'csjb',N'ckadd'));
