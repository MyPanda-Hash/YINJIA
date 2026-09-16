-- migrate-separate-header-detail.sql — 采购入库/销售出库:表头 vs 表格 数据彻底分离
-- 问题:销售出库 header 里堆了 85+ 个字段(生成器把所有头级 API 键全注册了),含分录引用/技术字段/与 MES 重复的
-- 原则:
--   表头 = 单据级(编号/日期/客户/仓库/经手人/汇率/金额/备注/状态/审核/创建时间/联系人/发货地址/到期日/交货方式/出库类别)
--   表格 = 行级(存货/规格/数量/单位/单价/税率/含税价/金额/批号/仓库/现存量/备注/退货数量)
-- 做法:表头只留精选核心字段,其余全删(不注册);表格保持行级字段不变
SET NOCOUNT ON;

-- ══ 销售出库:表头只保留核心字段 ══
-- 先全隐藏
UPDATE yj_field SET hidden=1, visible=0 WHERE panel_code='SALE_OUT' AND place LIKE '%header%';
-- 精选显示(与表头重设计一致 + 少量补充)
UPDATE yj_field SET hidden=0, visible=1 WHERE panel_code='SALE_OUT' AND place LIKE '%header%' AND col_name IN (
  N'单据编号', N'单据日期',                                     -- 核心
  N'客户', N'客户编码',                                          -- 往来
  N'仓库',                                                       -- 出库必须
  N'经手人', N'汇率',                                            -- 人员/币种
  N'金额', N'备注',                                              -- 金额/说明
  N'创建时间',                                                   -- 审计
  N'出入库状态', N'结算状态', N'到期日',                         -- 状态/财务
  N'联系人电话', N'交货方式', N'出库类别',                       -- 联系/物流
  N'结算期限', N'币别名称'                                       -- 补充(有数据显示)
);

-- 删除不该在表头的(分录引用/技术字段/与 MES 重复/纯 id 类)
DELETE FROM yj_field WHERE panel_code='SALE_OUT' AND place LIKE '%header%' AND (
  -- 子表分录引用(不是展示字段,是数组引用)
  col_name IN (N'商品分录', N'物流信息分录', N'付款信息分录', N'客户承担费用分录', N'配送路线分录', N'采购费用分录')
  -- 与 MES 原生字段重复的状态(单据状态2 是金蝶原始值,MES 用状态机)
  OR col_name IN (N'单据状态2', N'审核人2', N'审核时间2', N'部门2')
  -- 纯 id 类(已在 id 清理中处理过,双保险)
  OR col_name LIKE '%id' AND col_name NOT LIKE '%编码%'
  -- 折前/折扣系列(订单概念,出库单一般不用)
  OR col_name IN (N'折前价税合计', N'整单折扣额', N'整单折扣率%', N'商品组合', N'商品数量')
  -- 财务余额(出库面板不常看)
  OR col_name IN (N'应收款余额', N'上次欠款', N'抵扣余额', N'未结算金额', N'采购费用', N'费用分摊信息')
  -- 交易类型/开票状态/单据标签(技术性太强)
  OR col_name IN (N'交易类型', N'开票状态', N'单据标签', N'发货状态')
);

-- ══ 采购入库:表头也做同样清理(虽然 EXTRA 头字段已清,但确认干净) ══
DELETE FROM yj_field WHERE panel_code='PURCHASE_IN' AND place LIKE '%header%' AND (
  col_name IN (N'商品分录', N'物流信息分录', N'付款信息分录', N'采购费用分录')
  OR col_name IN (N'单据状态2', N'审核人2', N'审核时间2')
  OR (col_name LIKE '%id' AND col_name NOT LIKE '%编码%')
  OR col_name IN (N'折前价税合计', N'整单折扣额', N'整单折扣率%', N'商品组合', N'商品数量')
  OR col_name IN (N'应收款余额', N'上次欠款', N'抵扣余额', N'未结算金额', N'采购费用', N'费用分摊信息')
  OR col_name IN (N'交易类型', N'开票状态', N'单据标签')
);

GO
-- 自检
SELECT panel_code, place,
  COUNT(*) AS 总,
  SUM(CASE WHEN ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1 THEN 1 ELSE 0 END) AS 显示
FROM yj_field WHERE panel_code IN ('PURCHASE_IN','SALE_OUT')
GROUP BY panel_code, place ORDER BY panel_code, place;
-- 显示的表头字段
SELECT panel_code, col_name FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT') AND place LIKE '%header%' AND ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1
ORDER BY panel_code, seq;
GO
PRINT N'表头表格分离完成';
GO
