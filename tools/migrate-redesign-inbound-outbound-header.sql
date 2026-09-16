-- migrate-redesign-inbound-outbound-header.sql — 采购入库/销售出库表头重设计(对齐 SO/PU 风格)
-- 原则:①核心业务字段显示(编号/日期/供应商客户/仓库/经手人/金额/状态/备注)
--      ②编码只留 供应商编码/客户编码/仓库编码 三个
--      ③技术字段全隐藏(创建修改审核人系列/交易类型/商品分录/物流分录/应收余额/欠款/发货国家编码等)
SET NOCOUNT ON;

-- ══ PURCHASE_IN 采购入库表头 ══
-- 先全部隐藏
UPDATE yj_field SET hidden=1, visible=0 WHERE panel_code='PURCHASE_IN' AND place LIKE '%header%';
-- 精选显示(query 位保留)
UPDATE yj_field SET hidden=0, visible=1 WHERE panel_code='PURCHASE_IN' AND place LIKE '%header%' AND col_name IN (
  N'单据编号', N'单据日期',                                    -- 核心
  N'供应商', N'供应商编码',                                     -- 往来(编码仅此一个)
  N'仓库',                                                     -- 入库必须
  N'经手人',                                                   -- 人员
  N'汇率',                                                     -- 币种
  N'备注',                                                     -- 说明
  N'金额',                                                     -- 应付金额(total_amount)
  N'创建时间',                                                 -- 审计(仅留这一个)
  N'结算状态',                                                 -- 财务
  N'到期日',                                                   -- 财务
  N'联系人电话',                                               -- 联系(解密)
  N'交货方式',                                                 -- 物流
  N'入库类别'                                                  -- 入库必须(原有MES字段)
);

-- ══ SALE_OUT 销售出库表头 ══
UPDATE yj_field SET hidden=1, visible=0 WHERE panel_code='SALE_OUT' AND place LIKE '%header%';
UPDATE yj_field SET hidden=0, visible=1 WHERE panel_code='SALE_OUT' AND place LIKE '%header%' AND col_name IN (
  N'单据编号', N'单据日期',                                    -- 核心
  N'客户', N'客户编码',                                        -- 往来(编码仅此一个)
  N'仓库',                                                     -- 出库必须
  N'经手人',                                                   -- 人员
  N'汇率',                                                     -- 币种
  N'备注',                                                     -- 说明
  N'金额',                                                     -- 销售金额(total_amount)
  N'创建时间',                                                 -- 审计
  N'出入库状态',                                               -- 出库必须
  N'结算状态',                                                 -- 财务
  N'到期日',                                                   -- 财务
  N'联系人电话',                                               -- 联系(解密)
  N'交货方式',                                                 -- 物流
  N'出库类别'                                                  -- 出库必须(原有MES字段)
);

GO
-- 自检
SELECT panel_code, place,
  SUM(CASE WHEN ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1 THEN 1 ELSE 0 END) AS 显示
FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT') AND place LIKE '%header%'
GROUP BY panel_code, place;
-- 显示的表头字段
SELECT panel_code, col_name, label FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','SALE_OUT') AND place LIKE '%header%' AND ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1
ORDER BY panel_code, seq;
GO
PRINT N'表头重设计完成';
GO
