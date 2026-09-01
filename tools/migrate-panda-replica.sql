-- ============================================================
-- PANDA 一比一复刻:已迁移面板(单据/明细表/统计表)字段与 PANDA 基准逐列对齐
-- 由 _replica-gen2.cjs 生成;幂等。配套 _replica-plan.md 为改动清单。
-- 无数据源的 PANDA 布局列以 NULL 输出(保留 T+ 版式,业务启用后接数据)。
-- ============================================================
USE HSDZ_MES;
SET NOCOUNT ON;

-- ===== Part 1 单据面板:查询/表单/明细列 1:1 =====
-- ---------- SO_ORDER(销售订单) 查询6/表单11/明细15 ----------
UPDATE yj_field SET label=N'部门.负责人' WHERE panel_code='SO_ORDER' AND col_name=N'部门负责人' AND label=N'部门负责人';
-- place/seq 按 PANDA 顺序重排
UPDATE yj_field SET place=N'query,header', seq=10 WHERE panel_code='SO_ORDER' AND (label=N'单据编号');
UPDATE yj_field SET place=N'query,header', seq=20 WHERE panel_code='SO_ORDER' AND (label=N'单据日期');
UPDATE yj_field SET place=N'query,header', seq=30 WHERE panel_code='SO_ORDER' AND (label=N'客户');
UPDATE yj_field SET place=N'query,header', seq=80 WHERE panel_code='SO_ORDER' AND (label=N'业务员');
UPDATE yj_field SET place=N'query,header', seq=60 WHERE panel_code='SO_ORDER' AND (label=N'部门');
UPDATE yj_field SET place=N'query,header,detail', seq=130 WHERE panel_code='SO_ORDER' AND (label=N'预计交货日期');
UPDATE yj_field SET place=N'header', seq=40 WHERE panel_code='SO_ORDER' AND (label=N'客户编码');
UPDATE yj_field SET place=N'header', seq=50 WHERE panel_code='SO_ORDER' AND (label=N'结算客户');
UPDATE yj_field SET place=N'header', seq=70 WHERE panel_code='SO_ORDER' AND (label=N'部门.负责人' OR label=N'部门负责人');
UPDATE yj_field SET place=N'header', seq=90 WHERE panel_code='SO_ORDER' AND (label=N'项目');
UPDATE yj_field SET place=N'header', seq=110 WHERE panel_code='SO_ORDER' AND (label=N'联系人');
UPDATE yj_field SET place=N'detail', seq=10 WHERE panel_code='SO_ORDER' AND (label=N'存货名称.品牌' OR label=N'存货名称品牌');
UPDATE yj_field SET place=N'detail', seq=20 WHERE panel_code='SO_ORDER' AND (label=N'存货名称');
UPDATE yj_field SET place=N'detail', seq=30 WHERE panel_code='SO_ORDER' AND (label=N'存货编码');
UPDATE yj_field SET place=N'detail', seq=40 WHERE panel_code='SO_ORDER' AND (label=N'规格型号');
UPDATE yj_field SET place=N'detail', seq=50 WHERE panel_code='SO_ORDER' AND (label=N'数量');
UPDATE yj_field SET place=N'detail', seq=60 WHERE panel_code='SO_ORDER' AND (label=N'销售单位');
UPDATE yj_field SET place=N'detail', seq=70 WHERE panel_code='SO_ORDER' AND (label=N'单价');
UPDATE yj_field SET place=N'detail', seq=80 WHERE panel_code='SO_ORDER' AND (label=N'税率%');
UPDATE yj_field SET place=N'detail', seq=90 WHERE panel_code='SO_ORDER' AND (label=N'含税单价');
UPDATE yj_field SET place=N'detail', seq=100 WHERE panel_code='SO_ORDER' AND (label=N'金额');
UPDATE yj_field SET place=N'detail', seq=110 WHERE panel_code='SO_ORDER' AND (label=N'含税金额');
UPDATE yj_field SET place=N'detail', seq=120 WHERE panel_code='SO_ORDER' AND (label=N'折扣金额');
UPDATE yj_field SET place=N'detail', seq=140 WHERE panel_code='SO_ORDER' AND (label=N'现存量');
UPDATE yj_field SET place=N'detail', seq=150 WHERE panel_code='SO_ORDER' AND (label=N'备注');
-- ---------- PU_REQ(请购单) 查询10/表单20/明细21 ----------
-- place/seq 按 PANDA 顺序重排
UPDATE yj_field SET place=N'query,header', seq=10 WHERE panel_code='PU_REQ' AND (label=N'单据日期');
UPDATE yj_field SET place=N'query,header', seq=20 WHERE panel_code='PU_REQ' AND (label=N'单据编号');
UPDATE yj_field SET place=N'query,header', seq=30 WHERE panel_code='PU_REQ' AND (label=N'部门');
UPDATE yj_field SET place=N'query,header', seq=40 WHERE panel_code='PU_REQ' AND (label=N'请购人');
UPDATE yj_field SET place=N'query,header', seq=50 WHERE panel_code='PU_REQ' AND (label=N'项目');
UPDATE yj_field SET place=N'query,header,detail', seq=80 WHERE panel_code='PU_REQ' AND (label=N'建议供应商');
UPDATE yj_field SET place=N'query,header,detail', seq=150 WHERE panel_code='PU_REQ' AND (label=N'需求日期');
UPDATE yj_field SET place=N'query,header', seq=120 WHERE panel_code='PU_REQ' AND (label=N'到货地址');
UPDATE yj_field SET place=N'query,header', seq=130 WHERE panel_code='PU_REQ' AND (label=N'销售订单号');
UPDATE yj_field SET place=N'query,header', seq=140 WHERE panel_code='PU_REQ' AND (label=N'外部单据号');
UPDATE yj_field SET place=N'header', seq=60 WHERE panel_code='PU_REQ' AND (label=N'建议供应商编码');
UPDATE yj_field SET place=N'header', seq=80 WHERE panel_code='PU_REQ' AND (label=N'建议供应商简称');
UPDATE yj_field SET place=N'header', seq=90 WHERE panel_code='PU_REQ' AND (label=N'收货人');
UPDATE yj_field SET place=N'header', seq=100 WHERE panel_code='PU_REQ' AND (label=N'电话');
UPDATE yj_field SET place=N'header,detail', seq=160 WHERE panel_code='PU_REQ' AND (label=N'来源单据');
UPDATE yj_field SET place=N'header,detail', seq=170 WHERE panel_code='PU_REQ' AND (label=N'来源单号');
UPDATE yj_field SET place=N'header', seq=170 WHERE panel_code='PU_REQ' AND (label=N'折扣');
UPDATE yj_field SET place=N'header', seq=180 WHERE panel_code='PU_REQ' AND (label=N'总金额');
UPDATE yj_field SET place=N'header', seq=190 WHERE panel_code='PU_REQ' AND (label=N'含税总金额');
UPDATE yj_field SET place=N'header,detail', seq=210 WHERE panel_code='PU_REQ' AND (label=N'备注');
UPDATE yj_field SET place=N'detail', seq=10 WHERE panel_code='PU_REQ' AND (label=N'存货编码');
UPDATE yj_field SET place=N'detail', seq=20 WHERE panel_code='PU_REQ' AND (label=N'存货名称');
UPDATE yj_field SET place=N'detail', seq=30 WHERE panel_code='PU_REQ' AND (label=N'规格型号');
UPDATE yj_field SET place=N'detail', seq=40 WHERE panel_code='PU_REQ' AND (label=N'版本号');
UPDATE yj_field SET place=N'detail', seq=50 WHERE panel_code='PU_REQ' AND (label=N'采购单位');
UPDATE yj_field SET place=N'detail', seq=60 WHERE panel_code='PU_REQ' AND (label=N'数量');
UPDATE yj_field SET place=N'detail', seq=70 WHERE panel_code='PU_REQ' AND (label=N'数量2');
UPDATE yj_field SET place=N'detail', seq=90 WHERE panel_code='PU_REQ' AND (label=N'报价');
UPDATE yj_field SET place=N'detail', seq=100 WHERE panel_code='PU_REQ' AND (label=N'单价');
UPDATE yj_field SET place=N'detail', seq=110 WHERE panel_code='PU_REQ' AND (label=N'含税单价');
UPDATE yj_field SET place=N'detail', seq=120 WHERE panel_code='PU_REQ' AND (label=N'税率%');
UPDATE yj_field SET place=N'detail', seq=130 WHERE panel_code='PU_REQ' AND (label=N'金额');
UPDATE yj_field SET place=N'detail', seq=140 WHERE panel_code='PU_REQ' AND (label=N'含税金额');
UPDATE yj_field SET place=N'detail', seq=180 WHERE panel_code='PU_REQ' AND (label=N'现存量');
UPDATE yj_field SET place=N'detail', seq=190 WHERE panel_code='PU_REQ' AND (label=N'现存量说明');
UPDATE yj_field SET place=N'detail', seq=200 WHERE panel_code='PU_REQ' AND (label=N'是否带票');
-- ---------- PU_ORDER(采购订单) 查询5/表单13/明细14 ----------
DELETE yj_field WHERE panel_code='PU_ORDER' AND col_name=N'供应商编码' AND label=N'供应商编码';
DELETE yj_field WHERE panel_code='PU_ORDER' AND col_name=N'数量2' AND label=N'数量2';
DELETE yj_field WHERE panel_code='PU_ORDER' AND col_name=N'计量单位2' AND label=N'计量单位2';
DELETE yj_field WHERE panel_code='PU_ORDER' AND col_name=N'折扣%' AND label=N'折扣%';
DELETE yj_field WHERE panel_code='PU_ORDER' AND col_name=N'备注' AND label=N'备注';
DELETE yj_field WHERE panel_code='PU_ORDER' AND col_name=N'折扣金额' AND label=N'折扣金额';
-- place/seq 按 PANDA 顺序重排
UPDATE yj_field SET place=N'query,header', seq=10 WHERE panel_code='PU_ORDER' AND (label=N'单据日期');
UPDATE yj_field SET place=N'query,header', seq=20 WHERE panel_code='PU_ORDER' AND (label=N'单据编号');
UPDATE yj_field SET place=N'query,header', seq=30 WHERE panel_code='PU_ORDER' AND (label=N'项目');
UPDATE yj_field SET place=N'query,header', seq=40 WHERE panel_code='PU_ORDER' AND (label=N'供应商');
UPDATE yj_field SET place=N'query,header', seq=50 WHERE panel_code='PU_ORDER' AND (label=N'币种');
UPDATE yj_field SET place=N'header', seq=60 WHERE panel_code='PU_ORDER' AND (label=N'汇率');
UPDATE yj_field SET place=N'header', seq=70 WHERE panel_code='PU_ORDER' AND (label=N'到货地址');
UPDATE yj_field SET place=N'header', seq=80 WHERE panel_code='PU_ORDER' AND (label=N'交货日期');
UPDATE yj_field SET place=N'header', seq=90 WHERE panel_code='PU_ORDER' AND (label=N'发货状态');
UPDATE yj_field SET place=N'header', seq=100 WHERE panel_code='PU_ORDER' AND (label=N'合同号');
UPDATE yj_field SET place=N'header', seq=110 WHERE panel_code='PU_ORDER' AND (label=N'订金金额');
UPDATE yj_field SET place=N'header', seq=120 WHERE panel_code='PU_ORDER' AND (label=N'付款方式');
UPDATE yj_field SET place=N'header', seq=130 WHERE panel_code='PU_ORDER' AND (label=N'数据来源');
UPDATE yj_field SET place=N'detail', seq=10 WHERE panel_code='PU_ORDER' AND (label=N'物料编码');
UPDATE yj_field SET place=N'detail', seq=20 WHERE panel_code='PU_ORDER' AND (label=N'物料名称');
UPDATE yj_field SET place=N'detail', seq=30 WHERE panel_code='PU_ORDER' AND (label=N'规格型号');
UPDATE yj_field SET place=N'detail', seq=40 WHERE panel_code='PU_ORDER' AND (label=N'单位');
UPDATE yj_field SET place=N'detail', seq=50 WHERE panel_code='PU_ORDER' AND (label=N'数量');
UPDATE yj_field SET place=N'detail', seq=60 WHERE panel_code='PU_ORDER' AND (label=N'单价');
UPDATE yj_field SET place=N'detail', seq=70 WHERE panel_code='PU_ORDER' AND (label=N'金额');
UPDATE yj_field SET place=N'detail', seq=80 WHERE panel_code='PU_ORDER' AND (label=N'税率%');
UPDATE yj_field SET place=N'detail', seq=90 WHERE panel_code='PU_ORDER' AND (label=N'含税单价');
UPDATE yj_field SET place=N'detail', seq=100 WHERE panel_code='PU_ORDER' AND (label=N'含税金额');
UPDATE yj_field SET place=N'detail', seq=110 WHERE panel_code='PU_ORDER' AND (label=N'仓库');
UPDATE yj_field SET place=N'detail', seq=120 WHERE panel_code='PU_ORDER' AND (label=N'预计到货日期');
UPDATE yj_field SET place=N'detail', seq=130 WHERE panel_code='PU_ORDER' AND (label=N'现存量');
UPDATE yj_field SET place=N'detail', seq=140 WHERE panel_code='PU_ORDER' AND (label=N'现存量说明');
-- ---------- PURCHASE_IN(采购入库单) 查询16/表单17/明细22 ----------
DELETE yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'备注' AND label=N'备注';
IF COL_LENGTH('bd_purchase_in', N'入库类别') IS NULL ALTER TABLE bd_purchase_in ADD [入库类别] nvarchar(100) NULL;
-- place/seq 按 PANDA 顺序重排
UPDATE yj_field SET place=N'query,header', seq=10 WHERE panel_code='PURCHASE_IN' AND (label=N'单据日期');
UPDATE yj_field SET place=N'query,header', seq=20 WHERE panel_code='PURCHASE_IN' AND (label=N'单据编号');
UPDATE yj_field SET place=N'query,header', seq=30 WHERE panel_code='PURCHASE_IN' AND (label=N'业务类型');
UPDATE yj_field SET place=N'query,header', seq=40 WHERE panel_code='PURCHASE_IN' AND (label=N'入库类别');
UPDATE yj_field SET place=N'query,header', seq=60 WHERE panel_code='PURCHASE_IN' AND (label=N'供应商编码');
UPDATE yj_field SET place=N'query,header', seq=70 WHERE panel_code='PURCHASE_IN' AND (label=N'供应商');
UPDATE yj_field SET place=N'query,header', seq=80 WHERE panel_code='PURCHASE_IN' AND (label=N'供应商简称');
UPDATE yj_field SET place=N'query,header', seq=80 WHERE panel_code='PURCHASE_IN' AND (label=N'匹配来源单号');
UPDATE yj_field SET place=N'query,header', seq=90 WHERE panel_code='PURCHASE_IN' AND (label=N'经手人');
UPDATE yj_field SET place=N'query,header', seq=100 WHERE panel_code='PURCHASE_IN' AND (label=N'验货人');
UPDATE yj_field SET place=N'query,header', seq=100 WHERE panel_code='PURCHASE_IN' AND (label=N'项目');
UPDATE yj_field SET place=N'query,header,detail', seq=10 WHERE panel_code='PURCHASE_IN' AND (label=N'仓库');
UPDATE yj_field SET place=N'query,header', seq=130 WHERE panel_code='PURCHASE_IN' AND (label=N'来源单据');
UPDATE yj_field SET place=N'query,header', seq=120 WHERE panel_code='PURCHASE_IN' AND (label=N'外部单据号');
UPDATE yj_field SET place=N'query,header', seq=150 WHERE panel_code='PURCHASE_IN' AND (label=N'来源单号');
UPDATE yj_field SET place=N'query,header', seq=160 WHERE panel_code='PURCHASE_IN' AND (label=N'销售订单号');
UPDATE yj_field SET place=N'header', seq=40 WHERE panel_code='PURCHASE_IN' AND (label=N'币种');
UPDATE yj_field SET place=N'header', seq=50 WHERE panel_code='PURCHASE_IN' AND (label=N'汇率');
UPDATE yj_field SET place=N'header', seq=130 WHERE panel_code='PURCHASE_IN' AND (label=N'采购订单号');
UPDATE yj_field SET place=N'header', seq=140 WHERE panel_code='PURCHASE_IN' AND (label=N'合同号');
UPDATE yj_field SET place=N'header', seq=150 WHERE panel_code='PURCHASE_IN' AND (label=N'资金批次');
UPDATE yj_field SET place=N'header', seq=160 WHERE panel_code='PURCHASE_IN' AND (label=N'采购类型');
UPDATE yj_field SET place=N'header', seq=170 WHERE panel_code='PURCHASE_IN' AND (label=N'合同号最新');
UPDATE yj_field SET place=N'detail', seq=20 WHERE panel_code='PURCHASE_IN' AND (label=N'存货名称');
UPDATE yj_field SET place=N'detail', seq=30 WHERE panel_code='PURCHASE_IN' AND (label=N'存货图片');
UPDATE yj_field SET place=N'detail', seq=40 WHERE panel_code='PURCHASE_IN' AND (label=N'规格型号');
UPDATE yj_field SET place=N'detail', seq=50 WHERE panel_code='PURCHASE_IN' AND (label=N'实收数量');
UPDATE yj_field SET place=N'detail', seq=60 WHERE panel_code='PURCHASE_IN' AND (label=N'计量单位');
UPDATE yj_field SET place=N'detail', seq=70 WHERE panel_code='PURCHASE_IN' AND (label=N'实收数量2');
UPDATE yj_field SET place=N'detail', seq=80 WHERE panel_code='PURCHASE_IN' AND (label=N'计量单位2');
UPDATE yj_field SET place=N'detail', seq=90 WHERE panel_code='PURCHASE_IN' AND (label=N'计量单位组合');
UPDATE yj_field SET place=N'detail', seq=100 WHERE panel_code='PURCHASE_IN' AND (label=N'换算率');
UPDATE yj_field SET place=N'detail', seq=110 WHERE panel_code='PURCHASE_IN' AND (label=N'单价');
UPDATE yj_field SET place=N'detail', seq=120 WHERE panel_code='PURCHASE_IN' AND (label=N'税率%');
UPDATE yj_field SET place=N'detail', seq=130 WHERE panel_code='PURCHASE_IN' AND (label=N'单价2');
UPDATE yj_field SET place=N'detail', seq=140 WHERE panel_code='PURCHASE_IN' AND (label=N'含税单价2');
UPDATE yj_field SET place=N'detail', seq=150 WHERE panel_code='PURCHASE_IN' AND (label=N'含税单价');
UPDATE yj_field SET place=N'detail', seq=160 WHERE panel_code='PURCHASE_IN' AND (label=N'金额');
UPDATE yj_field SET place=N'detail', seq=170 WHERE panel_code='PURCHASE_IN' AND (label=N'含税金额');
UPDATE yj_field SET place=N'detail', seq=180 WHERE panel_code='PURCHASE_IN' AND (label=N'费用调整');
UPDATE yj_field SET place=N'detail', seq=190 WHERE panel_code='PURCHASE_IN' AND (label=N'费用金额');
UPDATE yj_field SET place=N'detail', seq=200 WHERE panel_code='PURCHASE_IN' AND (label=N'现存量');
UPDATE yj_field SET place=N'detail', seq=210 WHERE panel_code='PURCHASE_IN' AND (label=N'现存量说明');
UPDATE yj_field SET place=N'detail', seq=220 WHERE panel_code='PURCHASE_IN' AND (label=N'产成品图片');
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND label=N'入库类别')
  INSERT INTO yj_field (panel_code,col_name,label,data_type,dict_sql,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN',N'入库类别',N'入库类别',N'下拉框',N'SELECT v FROM (VALUES (N''采购入库''),(N''其他入库'')) AS t(v)',N'query,header',40,110,1,0,0,1);
-- ---------- FINISH_IN(产成品入库单) 查询8/表单12/明细12 ----------
DELETE yj_field WHERE panel_code='FINISH_IN' AND col_name=N'备注' AND label=N'备注';
-- place/seq 按 PANDA 顺序重排
UPDATE yj_field SET place=N'query,header', seq=10 WHERE panel_code='FINISH_IN' AND (label=N'单据日期');
UPDATE yj_field SET place=N'query,header', seq=20 WHERE panel_code='FINISH_IN' AND (label=N'单据编号');
UPDATE yj_field SET place=N'query,header', seq=30 WHERE panel_code='FINISH_IN' AND (label=N'业务类型');
UPDATE yj_field SET place=N'query,header', seq=40 WHERE panel_code='FINISH_IN' AND (label=N'入库类别');
UPDATE yj_field SET place=N'query,header', seq=50 WHERE panel_code='FINISH_IN' AND (label=N'生产车间');
UPDATE yj_field SET place=N'query,header', seq=60 WHERE panel_code='FINISH_IN' AND (label=N'加工单号');
UPDATE yj_field SET place=N'query,header,detail', seq=20 WHERE panel_code='FINISH_IN' AND (label=N'仓库');
UPDATE yj_field SET place=N'query,header', seq=110 WHERE panel_code='FINISH_IN' AND (label=N'匹配来源单号');
UPDATE yj_field SET place=N'header', seq=70 WHERE panel_code='FINISH_IN' AND (label=N'经手人');
UPDATE yj_field SET place=N'header', seq=80 WHERE panel_code='FINISH_IN' AND (label=N'项目');
UPDATE yj_field SET place=N'header', seq=100 WHERE panel_code='FINISH_IN' AND (label=N'销售订单号');
UPDATE yj_field SET place=N'header', seq=120 WHERE panel_code='FINISH_IN' AND (label=N'凭证字号');
UPDATE yj_field SET place=N'detail', seq=10 WHERE panel_code='FINISH_IN' AND (label=N'产品名称');
UPDATE yj_field SET place=N'detail', seq=30 WHERE panel_code='FINISH_IN' AND (label=N'存货图片');
UPDATE yj_field SET place=N'detail', seq=40 WHERE panel_code='FINISH_IN' AND (label=N'规格型号');
UPDATE yj_field SET place=N'detail', seq=50 WHERE panel_code='FINISH_IN' AND (label=N'智能选单');
UPDATE yj_field SET place=N'detail', seq=60 WHERE panel_code='FINISH_IN' AND (label=N'计量单位');
UPDATE yj_field SET place=N'detail', seq=70 WHERE panel_code='FINISH_IN' AND (label=N'金额');
UPDATE yj_field SET place=N'detail', seq=80 WHERE panel_code='FINISH_IN' AND (label=N'单价');
UPDATE yj_field SET place=N'detail', seq=90 WHERE panel_code='FINISH_IN' AND (label=N'实收数量');
UPDATE yj_field SET place=N'detail', seq=100 WHERE panel_code='FINISH_IN' AND (label=N'现存量');
UPDATE yj_field SET place=N'detail', seq=110 WHERE panel_code='FINISH_IN' AND (label=N'现存量说明');
UPDATE yj_field SET place=N'detail', seq=120 WHERE panel_code='FINISH_IN' AND (label=N'图号');
-- ---------- OTHER_IN(其他入库单) 查询7/表单7/明细12 ----------
DELETE yj_field WHERE panel_code='OTHER_IN' AND col_name=N'备注' AND label=N'备注';
-- place/seq 按 PANDA 顺序重排
UPDATE yj_field SET place=N'query,header', seq=10 WHERE panel_code='OTHER_IN' AND (label=N'单据日期');
UPDATE yj_field SET place=N'query,header', seq=20 WHERE panel_code='OTHER_IN' AND (label=N'单据编号');
UPDATE yj_field SET place=N'query,header', seq=30 WHERE panel_code='OTHER_IN' AND (label=N'业务类型');
UPDATE yj_field SET place=N'query,header', seq=40 WHERE panel_code='OTHER_IN' AND (label=N'入库类别');
UPDATE yj_field SET place=N'query,header,detail', seq=10 WHERE panel_code='OTHER_IN' AND (label=N'仓库');
UPDATE yj_field SET place=N'query,header', seq=70 WHERE panel_code='OTHER_IN' AND (label=N'匹配来源单号');
UPDATE yj_field SET place=N'query,header', seq=70 WHERE panel_code='OTHER_IN' AND (label=N'来料客户');
UPDATE yj_field SET place=N'header', seq=40 WHERE panel_code='OTHER_IN' AND (label=N'项目');
UPDATE yj_field SET place=N'header', seq=60 WHERE panel_code='OTHER_IN' AND (label=N'往来单位');
UPDATE yj_field SET place=N'detail', seq=20 WHERE panel_code='OTHER_IN' AND (label=N'存货名称');
UPDATE yj_field SET place=N'detail', seq=30 WHERE panel_code='OTHER_IN' AND (label=N'规格型号');
UPDATE yj_field SET place=N'detail', seq=40 WHERE panel_code='OTHER_IN' AND (label=N'计量单位');
UPDATE yj_field SET place=N'detail', seq=50 WHERE panel_code='OTHER_IN' AND (label=N'数量');
UPDATE yj_field SET place=N'detail', seq=60 WHERE panel_code='OTHER_IN' AND (label=N'智能选单');
UPDATE yj_field SET place=N'detail', seq=70 WHERE panel_code='OTHER_IN' AND (label=N'计量单位2');
UPDATE yj_field SET place=N'detail', seq=80 WHERE panel_code='OTHER_IN' AND (label=N'数量2');
UPDATE yj_field SET place=N'detail', seq=90 WHERE panel_code='OTHER_IN' AND (label=N'单价');
UPDATE yj_field SET place=N'detail', seq=100 WHERE panel_code='OTHER_IN' AND (label=N'金额');
UPDATE yj_field SET place=N'detail', seq=110 WHERE panel_code='OTHER_IN' AND (label=N'现存量');
UPDATE yj_field SET place=N'detail', seq=120 WHERE panel_code='OTHER_IN' AND (label=N'现存量说明');
-- ---------- OUTSOURCE_IN(委外入库单) 查询3/表单10/明细9 ----------
-- place/seq 按 PANDA 顺序重排
UPDATE yj_field SET place=N'query,header', seq=10 WHERE panel_code='OUTSOURCE_IN' AND (label=N'单据日期');
UPDATE yj_field SET place=N'query,header', seq=20 WHERE panel_code='OUTSOURCE_IN' AND (label=N'单据编号');
UPDATE yj_field SET place=N'query,header', seq=30 WHERE panel_code='OUTSOURCE_IN' AND (label=N'业务类型');
UPDATE yj_field SET place=N'header', seq=40 WHERE panel_code='OUTSOURCE_IN' AND (label=N'委外供应商');
UPDATE yj_field SET place=N'header', seq=50 WHERE panel_code='OUTSOURCE_IN' AND (label=N'委外加工单号');
UPDATE yj_field SET place=N'header', seq=60 WHERE panel_code='OUTSOURCE_IN' AND (label=N'仓库');
UPDATE yj_field SET place=N'header', seq=70 WHERE panel_code='OUTSOURCE_IN' AND (label=N'经手人');
UPDATE yj_field SET place=N'header', seq=80 WHERE panel_code='OUTSOURCE_IN' AND (label=N'备注');
UPDATE yj_field SET place=N'header', seq=90 WHERE panel_code='OUTSOURCE_IN' AND (label=N'来源单据');
UPDATE yj_field SET place=N'header', seq=100 WHERE panel_code='OUTSOURCE_IN' AND (label=N'来源单号');
UPDATE yj_field SET place=N'detail', seq=10 WHERE panel_code='OUTSOURCE_IN' AND (label=N'产品编码');
UPDATE yj_field SET place=N'detail', seq=20 WHERE panel_code='OUTSOURCE_IN' AND (label=N'产品名称');
UPDATE yj_field SET place=N'detail', seq=30 WHERE panel_code='OUTSOURCE_IN' AND (label=N'规格型号');
UPDATE yj_field SET place=N'detail', seq=40 WHERE panel_code='OUTSOURCE_IN' AND (label=N'计量单位');
UPDATE yj_field SET place=N'detail', seq=50 WHERE panel_code='OUTSOURCE_IN' AND (label=N'实收数量');
UPDATE yj_field SET place=N'detail', seq=60 WHERE panel_code='OUTSOURCE_IN' AND (label=N'单价');
UPDATE yj_field SET place=N'detail', seq=70 WHERE panel_code='OUTSOURCE_IN' AND (label=N'金额');
UPDATE yj_field SET place=N'detail', seq=80 WHERE panel_code='OUTSOURCE_IN' AND (label=N'现存量');
UPDATE yj_field SET place=N'detail', seq=90 WHERE panel_code='OUTSOURCE_IN' AND (label=N'行中止');
-- ---------- SALE_OUT(销售出库单) 查询9/表单25/明细19 ----------
DELETE yj_field WHERE panel_code='SALE_OUT' AND col_name=N'备注' AND label=N'备注';
-- place/seq 按 PANDA 顺序重排
UPDATE yj_field SET place=N'query,header', seq=10 WHERE panel_code='SALE_OUT' AND (label=N'单据日期');
UPDATE yj_field SET place=N'query,header', seq=20 WHERE panel_code='SALE_OUT' AND (label=N'单据编号');
UPDATE yj_field SET place=N'query,header', seq=30 WHERE panel_code='SALE_OUT' AND (label=N'业务类型');
UPDATE yj_field SET place=N'query,detail', seq=190 WHERE panel_code='SALE_OUT' AND (label=N'退货原因');
UPDATE yj_field SET place=N'query,header', seq=50 WHERE panel_code='SALE_OUT' AND (label=N'客户');
UPDATE yj_field SET place=N'query,header', seq=80 WHERE panel_code='SALE_OUT' AND (label=N'结算客户');
UPDATE yj_field SET place=N'query,header', seq=190 WHERE panel_code='SALE_OUT' AND (label=N'匹配来源单号');
UPDATE yj_field SET place=N'query,header', seq=90 WHERE panel_code='SALE_OUT' AND (label=N'经手人');
UPDATE yj_field SET place=N'query,header,detail', seq=10 WHERE panel_code='SALE_OUT' AND (label=N'仓库');
UPDATE yj_field SET place=N'header', seq=40 WHERE panel_code='SALE_OUT' AND (label=N'出库类别');
UPDATE yj_field SET place=N'header', seq=60 WHERE panel_code='SALE_OUT' AND (label=N'客户编码');
UPDATE yj_field SET place=N'header', seq=70 WHERE panel_code='SALE_OUT' AND (label=N'客户简称');
UPDATE yj_field SET place=N'header', seq=100 WHERE panel_code='SALE_OUT' AND (label=N'验货人');
UPDATE yj_field SET place=N'header', seq=110 WHERE panel_code='SALE_OUT' AND (label=N'项目');
UPDATE yj_field SET place=N'header', seq=130 WHERE panel_code='SALE_OUT' AND (label=N'送货地址');
UPDATE yj_field SET place=N'header', seq=140 WHERE panel_code='SALE_OUT' AND (label=N'发货单号');
UPDATE yj_field SET place=N'header', seq=150 WHERE panel_code='SALE_OUT' AND (label=N'发货日期');
UPDATE yj_field SET place=N'header', seq=160 WHERE panel_code='SALE_OUT' AND (label=N'来源单号');
UPDATE yj_field SET place=N'header', seq=170 WHERE panel_code='SALE_OUT' AND (label=N'部门');
UPDATE yj_field SET place=N'header', seq=180 WHERE panel_code='SALE_OUT' AND (label=N'门店');
UPDATE yj_field SET place=N'header', seq=200 WHERE panel_code='SALE_OUT' AND (label=N'验货日期');
UPDATE yj_field SET place=N'header', seq=210 WHERE panel_code='SALE_OUT' AND (label=N'发货人');
UPDATE yj_field SET place=N'header', seq=220 WHERE panel_code='SALE_OUT' AND (label=N'收货仓库');
UPDATE yj_field SET place=N'header', seq=230 WHERE panel_code='SALE_OUT' AND (label=N'来源单据');
UPDATE yj_field SET place=N'header', seq=240 WHERE panel_code='SALE_OUT' AND (label=N'外部单据号');
UPDATE yj_field SET place=N'header', seq=250 WHERE panel_code='SALE_OUT' AND (label=N'销售订单号');
UPDATE yj_field SET place=N'detail', seq=20 WHERE panel_code='SALE_OUT' AND (label=N'存货名称');
UPDATE yj_field SET place=N'detail', seq=30 WHERE panel_code='SALE_OUT' AND (label=N'存货编码');
UPDATE yj_field SET place=N'detail', seq=40 WHERE panel_code='SALE_OUT' AND (label=N'规格型号');
UPDATE yj_field SET place=N'detail', seq=50 WHERE panel_code='SALE_OUT' AND (label=N'计量单位');
UPDATE yj_field SET place=N'detail', seq=60 WHERE panel_code='SALE_OUT' AND (label=N'数量');
UPDATE yj_field SET place=N'detail', seq=70 WHERE panel_code='SALE_OUT' AND (label=N'智能选单');
UPDATE yj_field SET place=N'detail', seq=80 WHERE panel_code='SALE_OUT' AND (label=N'成本价');
UPDATE yj_field SET place=N'detail', seq=90 WHERE panel_code='SALE_OUT' AND (label=N'税率%');
UPDATE yj_field SET place=N'detail', seq=100 WHERE panel_code='SALE_OUT' AND (label=N'售价');
UPDATE yj_field SET place=N'detail', seq=110 WHERE panel_code='SALE_OUT' AND (label=N'含税售价');
UPDATE yj_field SET place=N'detail', seq=120 WHERE panel_code='SALE_OUT' AND (label=N'销售金额');
UPDATE yj_field SET place=N'detail', seq=130 WHERE panel_code='SALE_OUT' AND (label=N'税额');
UPDATE yj_field SET place=N'detail', seq=140 WHERE panel_code='SALE_OUT' AND (label=N'含税销售金额');
UPDATE yj_field SET place=N'detail', seq=150 WHERE panel_code='SALE_OUT' AND (label=N'折扣金额');
UPDATE yj_field SET place=N'detail', seq=160 WHERE panel_code='SALE_OUT' AND (label=N'现存量');
UPDATE yj_field SET place=N'detail', seq=170 WHERE panel_code='SALE_OUT' AND (label=N'现存量说明');
UPDATE yj_field SET place=N'detail', seq=180 WHERE panel_code='SALE_OUT' AND (label=N'需求令号');
-- ---------- MATERIAL_OUT(材料出库单) 查询10/表单10/明细12 ----------
DELETE yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'备注' AND label=N'备注';
-- place/seq 按 PANDA 顺序重排
UPDATE yj_field SET place=N'query,header', seq=10 WHERE panel_code='MATERIAL_OUT' AND (label=N'单据日期');
UPDATE yj_field SET place=N'query,header', seq=20 WHERE panel_code='MATERIAL_OUT' AND (label=N'单据编号');
UPDATE yj_field SET place=N'query,header', seq=30 WHERE panel_code='MATERIAL_OUT' AND (label=N'业务类型');
UPDATE yj_field SET place=N'query,header', seq=50 WHERE panel_code='MATERIAL_OUT' AND (label=N'出库类别');
UPDATE yj_field SET place=N'query,header', seq=40 WHERE panel_code='MATERIAL_OUT' AND (label=N'生产车间');
UPDATE yj_field SET place=N'query,header', seq=60 WHERE panel_code='MATERIAL_OUT' AND (label=N'领用人');
UPDATE yj_field SET place=N'query,header,detail', seq=10 WHERE panel_code='MATERIAL_OUT' AND (label=N'仓库');
UPDATE yj_field SET place=N'query,header', seq=80 WHERE panel_code='MATERIAL_OUT' AND (label=N'来源单据');
UPDATE yj_field SET place=N'query,header', seq=90 WHERE panel_code='MATERIAL_OUT' AND (label=N'销售订单号');
UPDATE yj_field SET place=N'query,header', seq=100 WHERE panel_code='MATERIAL_OUT' AND (label=N'匹配来源单号');
UPDATE yj_field SET place=N'header', seq=70 WHERE panel_code='MATERIAL_OUT' AND (label=N'项目');
UPDATE yj_field SET place=N'header', seq=90 WHERE panel_code='MATERIAL_OUT' AND (label=N'来源单号');
UPDATE yj_field SET place=N'header,detail', seq=20 WHERE panel_code='MATERIAL_OUT' AND (label=N'加工单号');
UPDATE yj_field SET place=N'detail', seq=30 WHERE panel_code='MATERIAL_OUT' AND (label=N'材料名称');
UPDATE yj_field SET place=N'detail', seq=40 WHERE panel_code='MATERIAL_OUT' AND (label=N'计量单位');
UPDATE yj_field SET place=N'detail', seq=50 WHERE panel_code='MATERIAL_OUT' AND (label=N'数量');
UPDATE yj_field SET place=N'detail', seq=60 WHERE panel_code='MATERIAL_OUT' AND (label=N'单价');
UPDATE yj_field SET place=N'detail', seq=70 WHERE panel_code='MATERIAL_OUT' AND (label=N'金额');
UPDATE yj_field SET place=N'detail', seq=80 WHERE panel_code='MATERIAL_OUT' AND (label=N'规格型号');
UPDATE yj_field SET place=N'detail', seq=90 WHERE panel_code='MATERIAL_OUT' AND (label=N'手工确定成本');
UPDATE yj_field SET place=N'detail', seq=100 WHERE panel_code='MATERIAL_OUT' AND (label=N'明细备注');
UPDATE yj_field SET place=N'detail', seq=110 WHERE panel_code='MATERIAL_OUT' AND (label=N'现存量');
UPDATE yj_field SET place=N'detail', seq=120 WHERE panel_code='MATERIAL_OUT' AND (label=N'现存量说明');
-- ---------- OTHER_OUT(其他出库单) 查询5/表单16/明细9 ----------
DELETE yj_field WHERE panel_code='OTHER_OUT' AND col_name=N'备注' AND label=N'备注';
-- place/seq 按 PANDA 顺序重排
UPDATE yj_field SET place=N'query,header', seq=10 WHERE panel_code='OTHER_OUT' AND (label=N'单据日期');
UPDATE yj_field SET place=N'query,header', seq=20 WHERE panel_code='OTHER_OUT' AND (label=N'单据编号');
UPDATE yj_field SET place=N'query,header', seq=30 WHERE panel_code='OTHER_OUT' AND (label=N'业务类型');
UPDATE yj_field SET place=N'query,detail', seq=10 WHERE panel_code='OTHER_OUT' AND (label=N'仓库');
UPDATE yj_field SET place=N'query,header', seq=50 WHERE panel_code='OTHER_OUT' AND (label=N'来料客户');
UPDATE yj_field SET place=N'header', seq=40 WHERE panel_code='OTHER_OUT' AND (label=N'出库类别');
UPDATE yj_field SET place=N'header', seq=50 WHERE panel_code='OTHER_OUT' AND (label=N'部门');
UPDATE yj_field SET place=N'header', seq=60 WHERE panel_code='OTHER_OUT' AND (label=N'经手人');
UPDATE yj_field SET place=N'header', seq=70 WHERE panel_code='OTHER_OUT' AND (label=N'项目');
UPDATE yj_field SET place=N'header', seq=80 WHERE panel_code='OTHER_OUT' AND (label=N'往来单位');
UPDATE yj_field SET place=N'header', seq=90 WHERE panel_code='OTHER_OUT' AND (label=N'来源单据');
UPDATE yj_field SET place=N'header', seq=100 WHERE panel_code='OTHER_OUT' AND (label=N'外部单据号');
UPDATE yj_field SET place=N'header', seq=110 WHERE panel_code='OTHER_OUT' AND (label=N'来源单号');
UPDATE yj_field SET place=N'header', seq=120 WHERE panel_code='OTHER_OUT' AND (label=N'数据来源');
UPDATE yj_field SET place=N'header', seq=130 WHERE panel_code='OTHER_OUT' AND (label=N'销售订单号');
UPDATE yj_field SET place=N'header', seq=140 WHERE panel_code='OTHER_OUT' AND (label=N'自动生入库单');
UPDATE yj_field SET place=N'header', seq=150 WHERE panel_code='OTHER_OUT' AND (label=N'凭证字号');
UPDATE yj_field SET place=N'header', seq=160 WHERE panel_code='OTHER_OUT' AND (label=N'项目.合同号');
UPDATE yj_field SET place=N'detail', seq=20 WHERE panel_code='OTHER_OUT' AND (label=N'存货名称');
UPDATE yj_field SET place=N'detail', seq=30 WHERE panel_code='OTHER_OUT' AND (label=N'规格型号');
UPDATE yj_field SET place=N'detail', seq=40 WHERE panel_code='OTHER_OUT' AND (label=N'计量单位');
UPDATE yj_field SET place=N'detail', seq=50 WHERE panel_code='OTHER_OUT' AND (label=N'数量');
UPDATE yj_field SET place=N'detail', seq=60 WHERE panel_code='OTHER_OUT' AND (label=N'单价');
UPDATE yj_field SET place=N'detail', seq=70 WHERE panel_code='OTHER_OUT' AND (label=N'金额');
UPDATE yj_field SET place=N'detail', seq=80 WHERE panel_code='OTHER_OUT' AND (label=N'现存量');
UPDATE yj_field SET place=N'detail', seq=90 WHERE panel_code='OTHER_OUT' AND (label=N'现存量说明');
-- ---------- OUTSOURCE_ISSUE(委外发料单) 查询3/表单11/明细9 ----------
-- place/seq 按 PANDA 顺序重排
UPDATE yj_field SET place=N'query,header', seq=10 WHERE panel_code='OUTSOURCE_ISSUE' AND (label=N'单据日期');
UPDATE yj_field SET place=N'query,header', seq=20 WHERE panel_code='OUTSOURCE_ISSUE' AND (label=N'单据编号');
UPDATE yj_field SET place=N'query,header', seq=30 WHERE panel_code='OUTSOURCE_ISSUE' AND (label=N'业务类型');
UPDATE yj_field SET place=N'header', seq=40 WHERE panel_code='OUTSOURCE_ISSUE' AND (label=N'委外供应商');
UPDATE yj_field SET place=N'header', seq=50 WHERE panel_code='OUTSOURCE_ISSUE' AND (label=N'委外加工单号');
UPDATE yj_field SET place=N'header,detail', seq=80 WHERE panel_code='OUTSOURCE_ISSUE' AND (label=N'仓库');
UPDATE yj_field SET place=N'header', seq=70 WHERE panel_code='OUTSOURCE_ISSUE' AND (label=N'部门');
UPDATE yj_field SET place=N'header', seq=80 WHERE panel_code='OUTSOURCE_ISSUE' AND (label=N'经手人');
UPDATE yj_field SET place=N'header', seq=90 WHERE panel_code='OUTSOURCE_ISSUE' AND (label=N'备注');
UPDATE yj_field SET place=N'header', seq=100 WHERE panel_code='OUTSOURCE_ISSUE' AND (label=N'来源单据');
UPDATE yj_field SET place=N'header', seq=110 WHERE panel_code='OUTSOURCE_ISSUE' AND (label=N'来源单号');
UPDATE yj_field SET place=N'detail', seq=10 WHERE panel_code='OUTSOURCE_ISSUE' AND (label=N'材料编码');
UPDATE yj_field SET place=N'detail', seq=20 WHERE panel_code='OUTSOURCE_ISSUE' AND (label=N'材料名称');
UPDATE yj_field SET place=N'detail', seq=30 WHERE panel_code='OUTSOURCE_ISSUE' AND (label=N'规格型号');
UPDATE yj_field SET place=N'detail', seq=40 WHERE panel_code='OUTSOURCE_ISSUE' AND (label=N'计量单位');
UPDATE yj_field SET place=N'detail', seq=50 WHERE panel_code='OUTSOURCE_ISSUE' AND (label=N'数量');
UPDATE yj_field SET place=N'detail', seq=60 WHERE panel_code='OUTSOURCE_ISSUE' AND (label=N'单价');
UPDATE yj_field SET place=N'detail', seq=70 WHERE panel_code='OUTSOURCE_ISSUE' AND (label=N'金额');
UPDATE yj_field SET place=N'detail', seq=90 WHERE panel_code='OUTSOURCE_ISSUE' AND (label=N'行中止');
-- ---------- OUTSOURCE_ORDER(委外加工单) 查询3/表单12/明细9 ----------
-- place/seq 按 PANDA 顺序重排
UPDATE yj_field SET place=N'query,header', seq=10 WHERE panel_code='OUTSOURCE_ORDER' AND (label=N'单据日期');
UPDATE yj_field SET place=N'query,header', seq=20 WHERE panel_code='OUTSOURCE_ORDER' AND (label=N'单据编号');
UPDATE yj_field SET place=N'query,header', seq=30 WHERE panel_code='OUTSOURCE_ORDER' AND (label=N'业务类型');
UPDATE yj_field SET place=N'header', seq=40 WHERE panel_code='OUTSOURCE_ORDER' AND (label=N'委外供应商');
UPDATE yj_field SET place=N'header', seq=50 WHERE panel_code='OUTSOURCE_ORDER' AND (label=N'生产车间');
UPDATE yj_field SET place=N'header', seq=60 WHERE panel_code='OUTSOURCE_ORDER' AND (label=N'部门');
UPDATE yj_field SET place=N'header', seq=70 WHERE panel_code='OUTSOURCE_ORDER' AND (label=N'经手人');
UPDATE yj_field SET place=N'header', seq=80 WHERE panel_code='OUTSOURCE_ORDER' AND (label=N'交货日期');
UPDATE yj_field SET place=N'header', seq=90 WHERE panel_code='OUTSOURCE_ORDER' AND (label=N'预完工日');
UPDATE yj_field SET place=N'header', seq=100 WHERE panel_code='OUTSOURCE_ORDER' AND (label=N'备注');
UPDATE yj_field SET place=N'header', seq=110 WHERE panel_code='OUTSOURCE_ORDER' AND (label=N'来源单据');
UPDATE yj_field SET place=N'header', seq=120 WHERE panel_code='OUTSOURCE_ORDER' AND (label=N'来源单号');
UPDATE yj_field SET place=N'detail', seq=10 WHERE panel_code='OUTSOURCE_ORDER' AND (label=N'产品编码');
UPDATE yj_field SET place=N'detail', seq=20 WHERE panel_code='OUTSOURCE_ORDER' AND (label=N'产品名称');
UPDATE yj_field SET place=N'detail', seq=30 WHERE panel_code='OUTSOURCE_ORDER' AND (label=N'规格型号');
UPDATE yj_field SET place=N'detail', seq=40 WHERE panel_code='OUTSOURCE_ORDER' AND (label=N'计量单位');
UPDATE yj_field SET place=N'detail', seq=50 WHERE panel_code='OUTSOURCE_ORDER' AND (label=N'数量');
UPDATE yj_field SET place=N'detail', seq=60 WHERE panel_code='OUTSOURCE_ORDER' AND (label=N'委外单价');
UPDATE yj_field SET place=N'detail', seq=70 WHERE panel_code='OUTSOURCE_ORDER' AND (label=N'金额');
UPDATE yj_field SET place=N'detail', seq=80 WHERE panel_code='OUTSOURCE_ORDER' AND (label=N'现存量');
UPDATE yj_field SET place=N'detail', seq=90 WHERE panel_code='OUTSOURCE_ORDER' AND (label=N'行中止');
-- ---------- MANU_ORDER(生产加工单) 查询11/表单23/明细21 ----------
DELETE yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'测试程序2' AND label=N'测试程序2';
DELETE yj_field WHERE panel_code='MANU_ORDER' AND col_name=N'备注' AND label=N'备注';
-- place/seq 按 PANDA 顺序重排
UPDATE yj_field SET place=N'query,header', seq=10 WHERE panel_code='MANU_ORDER' AND (label=N'合同号');
UPDATE yj_field SET place=N'query,header', seq=20 WHERE panel_code='MANU_ORDER' AND (label=N'锭号');
UPDATE yj_field SET place=N'query,header', seq=30 WHERE panel_code='MANU_ORDER' AND (label=N'批号');
UPDATE yj_field SET place=N'query,header', seq=40 WHERE panel_code='MANU_ORDER' AND (label=N'生产车间');
UPDATE yj_field SET place=N'query,header', seq=50 WHERE panel_code='MANU_ORDER' AND (label=N'预开工日');
UPDATE yj_field SET place=N'query,header', seq=60 WHERE panel_code='MANU_ORDER' AND (label=N'预完工日');
UPDATE yj_field SET place=N'query,header', seq=70 WHERE panel_code='MANU_ORDER' AND (label=N'销售订单号');
UPDATE yj_field SET place=N'query,header', seq=80 WHERE panel_code='MANU_ORDER' AND (label=N'客户编码');
UPDATE yj_field SET place=N'query,header', seq=90 WHERE panel_code='MANU_ORDER' AND (label=N'客户');
UPDATE yj_field SET place=N'query,header', seq=100 WHERE panel_code='MANU_ORDER' AND (label=N'测试程序');
UPDATE yj_field SET place=N'query,header', seq=110 WHERE panel_code='MANU_ORDER' AND (label=N'生产订单客户');
UPDATE yj_field SET place=N'header', seq=120 WHERE panel_code='MANU_ORDER' AND (label=N'机构');
UPDATE yj_field SET place=N'header', seq=130 WHERE panel_code='MANU_ORDER' AND (label=N'重量');
UPDATE yj_field SET place=N'header', seq=140 WHERE panel_code='MANU_ORDER' AND (label=N'开工日期');
UPDATE yj_field SET place=N'header', seq=150 WHERE panel_code='MANU_ORDER' AND (label=N'完工日期');
UPDATE yj_field SET place=N'header', seq=160 WHERE panel_code='MANU_ORDER' AND (label=N'启用派工');
UPDATE yj_field SET place=N'header', seq=170 WHERE panel_code='MANU_ORDER' AND (label=N'自动转移');
UPDATE yj_field SET place=N'header', seq=180 WHERE panel_code='MANU_ORDER' AND (label=N'产品自动添加到材料');
UPDATE yj_field SET place=N'header', seq=190 WHERE panel_code='MANU_ORDER' AND (label=N'是否手工修改单据编码');
UPDATE yj_field SET place=N'header', seq=200 WHERE panel_code='MANU_ORDER' AND (label=N'外部单据号');
UPDATE yj_field SET place=N'header', seq=210 WHERE panel_code='MANU_ORDER' AND (label=N'负责人');
UPDATE yj_field SET place=N'header', seq=220 WHERE panel_code='MANU_ORDER' AND (label=N'启用领料申请');
UPDATE yj_field SET place=N'header', seq=230 WHERE panel_code='MANU_ORDER' AND (label=N'对方仓库');
UPDATE yj_field SET place=N'detail', seq=10 WHERE panel_code='MANU_ORDER' AND (label=N'生产类型');
UPDATE yj_field SET place=N'detail', seq=20 WHERE panel_code='MANU_ORDER' AND (label=N'产品编码');
UPDATE yj_field SET place=N'detail', seq=30 WHERE panel_code='MANU_ORDER' AND (label=N'存货图片');
UPDATE yj_field SET place=N'detail', seq=40 WHERE panel_code='MANU_ORDER' AND (label=N'产品名称');
UPDATE yj_field SET place=N'detail', seq=50 WHERE panel_code='MANU_ORDER' AND (label=N'规格型号');
UPDATE yj_field SET place=N'detail', seq=60 WHERE panel_code='MANU_ORDER' AND (label=N'型号');
UPDATE yj_field SET place=N'detail', seq=70 WHERE panel_code='MANU_ORDER' AND (label=N'适用BOM');
UPDATE yj_field SET place=N'detail', seq=80 WHERE panel_code='MANU_ORDER' AND (label=N'BOM展开方式');
UPDATE yj_field SET place=N'detail', seq=90 WHERE panel_code='MANU_ORDER' AND (label=N'生产单位');
UPDATE yj_field SET place=N'detail', seq=100 WHERE panel_code='MANU_ORDER' AND (label=N'数量');
UPDATE yj_field SET place=N'detail', seq=110 WHERE panel_code='MANU_ORDER' AND (label=N'齐套数量(主)');
UPDATE yj_field SET place=N'detail', seq=120 WHERE panel_code='MANU_ORDER' AND (label=N'累计汇报套数(工序单位)');
UPDATE yj_field SET place=N'detail', seq=130 WHERE panel_code='MANU_ORDER' AND (label=N'可用量');
UPDATE yj_field SET place=N'detail', seq=140 WHERE panel_code='MANU_ORDER' AND (label=N'可用量说明');
UPDATE yj_field SET place=N'detail', seq=150 WHERE panel_code='MANU_ORDER' AND (label=N'现存量');
UPDATE yj_field SET place=N'detail', seq=160 WHERE panel_code='MANU_ORDER' AND (label=N'现存量说明');
UPDATE yj_field SET place=N'detail', seq=170 WHERE panel_code='MANU_ORDER' AND (label=N'产品字符公用自定义项1');
UPDATE yj_field SET place=N'detail', seq=180 WHERE panel_code='MANU_ORDER' AND (label=N'图号');
UPDATE yj_field SET place=N'detail', seq=190 WHERE panel_code='MANU_ORDER' AND (label=N'单重');
UPDATE yj_field SET place=N'detail', seq=200 WHERE panel_code='MANU_ORDER' AND (label=N'总重');
UPDATE yj_field SET place=N'detail', seq=210 WHERE panel_code='MANU_ORDER' AND (label=N'需求令号');

-- ===== Part 2 明细表:视图重建(PANDA 列名)+ yj_field 重建 =====
-- SALES_ORDER_DETAIL(销售订单明细表):PANDA 24 列
EXEC('CREATE OR ALTER VIEW v_sales_order_detail AS
SELECT ROW_NUMBER() OVER(ORDER BY h.id DESC, l.id) AS id, h.asp_cancel, h.[单据日期], h.[单据编号], CASE WHEN ISNULL(s.canceled,N''N'')=N''Y'' THEN N''已作废'' WHEN ISNULL(s.stopped,N''N'')=N''Y'' THEN N''已中止'' WHEN ISNULL(s.pending,N''N'')=N''Y'' THEN N''审批中'' WHEN s.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END AS [单据状态], h.[客户编码], h.[客户], h.[结算客户], h.[部门], h.[业务员], h.[项目], l.[存货编码], l.[存货名称] AS [存货], l.[规格型号], l.[销售单位] AS [计量单位], l.[数量], l.[单价], l.[税率%], l.[含税单价], l.[金额], l.[含税金额], l.[折扣金额], h.[预计交货日期], l.[现存量], h.asp_user1 AS [制单人], s.shr AS [审核人]
FROM bd_so_order h LEFT JOIN bl_so_order l ON h.[单据编号]=l.[单据编号]
LEFT JOIN yj_doc_status s ON s.panel_code=''SO_ORDER'' AND s.doc_no=h.[单据编号]');
DELETE yj_field WHERE panel_code='SALES_ORDER_DETAIL';
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_DETAIL',N'单据日期',N'单据日期',N'日期',N'query,detail',10,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_DETAIL',N'单据编号',N'单据编号',N'文本',N'query,detail',20,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_DETAIL',N'单据状态',N'单据状态',N'文本',N'query,detail',30,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_DETAIL',N'客户编码',N'客户编码',N'文本',N'detail',40,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_DETAIL',N'客户',N'客户',N'文本',N'query,detail',50,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_DETAIL',N'结算客户',N'结算客户',N'文本',N'detail',60,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_DETAIL',N'部门',N'部门',N'文本',N'detail',70,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_DETAIL',N'业务员',N'业务员',N'文本',N'query,detail',80,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_DETAIL',N'项目',N'项目',N'文本',N'detail',90,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_DETAIL',N'存货编码',N'存货编码',N'文本',N'detail',100,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_DETAIL',N'存货',N'存货',N'文本',N'query,detail',110,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_DETAIL',N'规格型号',N'规格型号',N'文本',N'detail',120,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_DETAIL',N'计量单位',N'计量单位',N'文本',N'detail',130,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_DETAIL',N'数量',N'数量',N'小数',N'detail',140,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_DETAIL',N'单价',N'单价',N'小数',N'detail',150,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_DETAIL',N'税率%',N'税率%',N'小数',N'detail',160,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_DETAIL',N'含税单价',N'含税单价',N'小数',N'detail',170,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_DETAIL',N'金额',N'金额',N'小数',N'detail',180,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_DETAIL',N'含税金额',N'含税金额',N'小数',N'detail',190,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_DETAIL',N'折扣金额',N'折扣金额',N'小数',N'detail',200,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_DETAIL',N'预计交货日期',N'预计交货日期',N'日期',N'detail',210,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_DETAIL',N'现存量',N'现存量',N'文本',N'detail',220,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_DETAIL',N'制单人',N'制单人',N'文本',N'detail',230,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_DETAIL',N'审核人',N'审核人',N'文本',N'detail',240,120,0,0,0,1);
UPDATE yj_field SET place=N'query,detail' WHERE panel_code='SALES_ORDER_DETAIL' AND label=N'单据状态';
-- PURCHASE_IN_DETAIL(采购入库单明细表):PANDA 30 列
EXEC('CREATE OR ALTER VIEW v_purchase_in_detail AS
SELECT ROW_NUMBER() OVER(ORDER BY h.id DESC, l.id) AS id, h.asp_cancel, h.[单据日期], h.asp_time1 AS [创建时间], h.[单据编号], h.[业务类型], NULL AS [仓库编码] /* 无数据源,布局列 */, h.[仓库], h.[入库类别], h.[供应商编码], h.[供应商], NULL AS [部门编码] /* 无数据源,布局列 */, NULL AS [部门] /* 无数据源,布局列 */, NULL AS [经手人编码] /* 无数据源,布局列 */, h.[经手人], h.[备注], h.asp_user1 AS [制单人], s.shr AS [审核人], NULL AS [存货编码] /* 无数据源,布局列 */, l.[存货名称] AS [存货], l.[规格型号], l.[计量单位], l.[实收数量], l.[单价], l.[金额], l.[单价2], l.[计量单位2], l.[实收数量2], NULL AS [入库调整] /* 无数据源,布局列 */, l.[费用调整], NULL AS [总成本] /* 无数据源,布局列 */, l.[费用金额]
FROM bd_purchase_in h LEFT JOIN bl_purchase_in l ON h.[单据编号]=l.[单据编号]
LEFT JOIN yj_doc_status s ON s.panel_code=''PURCHASE_IN'' AND s.doc_no=h.[单据编号]');
DELETE yj_field WHERE panel_code='PURCHASE_IN_DETAIL';
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'单据日期',N'单据日期',N'日期',N'query,detail',10,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'创建时间',N'创建时间',N'日期',N'detail',20,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'单据编号',N'单据编号',N'文本',N'query,detail',30,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'业务类型',N'业务类型',N'文本',N'query,detail',40,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'仓库编码',N'仓库编码',N'文本',N'detail',50,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'仓库',N'仓库',N'文本',N'query,detail',60,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'入库类别',N'入库类别',N'文本',N'detail',70,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'供应商编码',N'供应商编码',N'文本',N'detail',80,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'供应商',N'供应商',N'文本',N'query,detail',90,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'部门编码',N'部门编码',N'文本',N'detail',100,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'部门',N'部门',N'文本',N'detail',110,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'经手人编码',N'经手人编码',N'文本',N'detail',120,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'经手人',N'经手人',N'文本',N'detail',130,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'备注',N'备注',N'文本',N'detail',140,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'制单人',N'制单人',N'文本',N'detail',150,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'审核人',N'审核人',N'文本',N'detail',160,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'存货编码',N'存货编码',N'文本',N'detail',170,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'存货',N'存货',N'文本',N'query,detail',180,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'规格型号',N'规格型号',N'文本',N'detail',190,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'计量单位',N'计量单位',N'文本',N'detail',200,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'实收数量',N'实收数量',N'小数',N'detail',210,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'单价',N'单价',N'小数',N'detail',220,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'金额',N'金额',N'小数',N'detail',230,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'单价2',N'单价2',N'小数',N'detail',240,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'计量单位2',N'计量单位2',N'文本',N'detail',250,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'实收数量2',N'实收数量2',N'小数',N'detail',260,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'入库调整',N'入库调整',N'小数',N'detail',270,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'费用调整',N'费用调整',N'小数',N'detail',280,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'总成本',N'总成本',N'小数',N'detail',290,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_DETAIL',N'费用金额',N'费用金额',N'小数',N'detail',300,120,0,0,0,1);
-- FINISH_IN_DETAIL(产成品入库单明细表):PANDA 23 列
EXEC('CREATE OR ALTER VIEW v_finish_in_detail AS
SELECT ROW_NUMBER() OVER(ORDER BY h.id DESC, l.id) AS id, h.asp_cancel, h.[单据日期], h.asp_time1 AS [创建时间], h.[单据编号], h.[业务类型], NULL AS [仓库编码] /* 无数据源,布局列 */, h.[仓库], h.[入库类别], NULL AS [生产车间编码] /* 无数据源,布局列 */, h.[生产车间], NULL AS [经手人编码] /* 无数据源,布局列 */, h.[经手人], h.[备注], h.asp_user1 AS [制单人], s.shr AS [审核人], NULL AS [存货编码] /* 无数据源,布局列 */, l.[产品名称] AS [存货], l.[规格型号], l.[计量单位], l.[实收数量], l.[单价], l.[金额], NULL AS [计量单位2] /* 无数据源,布局列 */, NULL AS [实收数量2] /* 无数据源,布局列 */
FROM bd_finish_in h LEFT JOIN bl_finish_in l ON h.[单据编号]=l.[单据编号]
LEFT JOIN yj_doc_status s ON s.panel_code=''FINISH_IN'' AND s.doc_no=h.[单据编号]');
DELETE yj_field WHERE panel_code='FINISH_IN_DETAIL';
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_DETAIL',N'单据日期',N'单据日期',N'日期',N'query,detail',10,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_DETAIL',N'创建时间',N'创建时间',N'日期',N'detail',20,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_DETAIL',N'单据编号',N'单据编号',N'文本',N'query,detail',30,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_DETAIL',N'业务类型',N'业务类型',N'文本',N'query,detail',40,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_DETAIL',N'仓库编码',N'仓库编码',N'文本',N'detail',50,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_DETAIL',N'仓库',N'仓库',N'文本',N'query,detail',60,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_DETAIL',N'入库类别',N'入库类别',N'文本',N'detail',70,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_DETAIL',N'生产车间编码',N'生产车间编码',N'文本',N'detail',80,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_DETAIL',N'生产车间',N'生产车间',N'文本',N'query,detail',90,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_DETAIL',N'经手人编码',N'经手人编码',N'文本',N'detail',100,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_DETAIL',N'经手人',N'经手人',N'文本',N'detail',110,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_DETAIL',N'备注',N'备注',N'文本',N'detail',120,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_DETAIL',N'制单人',N'制单人',N'文本',N'detail',130,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_DETAIL',N'审核人',N'审核人',N'文本',N'detail',140,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_DETAIL',N'存货编码',N'存货编码',N'文本',N'detail',150,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_DETAIL',N'存货',N'存货',N'文本',N'query,detail',160,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_DETAIL',N'规格型号',N'规格型号',N'文本',N'detail',170,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_DETAIL',N'计量单位',N'计量单位',N'文本',N'detail',180,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_DETAIL',N'实收数量',N'实收数量',N'小数',N'detail',190,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_DETAIL',N'单价',N'单价',N'小数',N'detail',200,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_DETAIL',N'金额',N'金额',N'小数',N'detail',210,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_DETAIL',N'计量单位2',N'计量单位2',N'文本',N'detail',220,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_DETAIL',N'实收数量2',N'实收数量2',N'小数',N'detail',230,120,0,0,0,1);
-- OTHER_IN_DETAIL(其他入库单明细表):PANDA 23 列
EXEC('CREATE OR ALTER VIEW v_other_in_detail AS
SELECT ROW_NUMBER() OVER(ORDER BY h.id DESC, l.id) AS id, h.asp_cancel, h.[单据日期], h.asp_time1 AS [创建时间], h.[单据编号], h.[业务类型], NULL AS [仓库编码] /* 无数据源,布局列 */, h.[仓库], h.[入库类别], NULL AS [部门编码] /* 无数据源,布局列 */, NULL AS [部门] /* 无数据源,布局列 */, NULL AS [经手人编码] /* 无数据源,布局列 */, NULL AS [经手人] /* 无数据源,布局列 */, h.[备注], h.asp_user1 AS [制单人], s.shr AS [审核人], NULL AS [存货编码] /* 无数据源,布局列 */, l.[存货名称] AS [存货], l.[规格型号], l.[计量单位], l.[数量], l.[单价], l.[金额], l.[计量单位2], l.[数量2]
FROM bd_other_in h LEFT JOIN bl_other_in l ON h.[单据编号]=l.[单据编号]
LEFT JOIN yj_doc_status s ON s.panel_code=''OTHER_IN'' AND s.doc_no=h.[单据编号]');
DELETE yj_field WHERE panel_code='OTHER_IN_DETAIL';
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_DETAIL',N'单据日期',N'单据日期',N'日期',N'query,detail',10,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_DETAIL',N'创建时间',N'创建时间',N'日期',N'detail',20,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_DETAIL',N'单据编号',N'单据编号',N'文本',N'query,detail',30,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_DETAIL',N'业务类型',N'业务类型',N'文本',N'query,detail',40,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_DETAIL',N'仓库编码',N'仓库编码',N'文本',N'detail',50,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_DETAIL',N'仓库',N'仓库',N'文本',N'query,detail',60,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_DETAIL',N'入库类别',N'入库类别',N'文本',N'detail',70,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_DETAIL',N'部门编码',N'部门编码',N'文本',N'detail',80,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_DETAIL',N'部门',N'部门',N'文本',N'detail',90,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_DETAIL',N'经手人编码',N'经手人编码',N'文本',N'detail',100,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_DETAIL',N'经手人',N'经手人',N'文本',N'detail',110,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_DETAIL',N'备注',N'备注',N'文本',N'detail',120,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_DETAIL',N'制单人',N'制单人',N'文本',N'detail',130,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_DETAIL',N'审核人',N'审核人',N'文本',N'detail',140,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_DETAIL',N'存货编码',N'存货编码',N'文本',N'detail',150,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_DETAIL',N'存货',N'存货',N'文本',N'query,detail',160,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_DETAIL',N'规格型号',N'规格型号',N'文本',N'detail',170,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_DETAIL',N'计量单位',N'计量单位',N'文本',N'detail',180,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_DETAIL',N'数量',N'数量',N'小数',N'detail',190,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_DETAIL',N'单价',N'单价',N'小数',N'detail',200,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_DETAIL',N'金额',N'金额',N'小数',N'detail',210,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_DETAIL',N'计量单位2',N'计量单位2',N'文本',N'detail',220,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_DETAIL',N'数量2',N'数量2',N'小数',N'detail',230,120,0,0,0,1);
-- SALE_OUT_DETAIL(销售出库单明细表):PANDA 29 列
EXEC('CREATE OR ALTER VIEW v_sale_out_detail AS
SELECT ROW_NUMBER() OVER(ORDER BY h.id DESC, l.id) AS id, h.asp_cancel, h.[单据日期], h.asp_time1 AS [创建时间], h.[单据编号], h.[业务类型], NULL AS [仓库编码] /* 无数据源,布局列 */, h.[仓库], h.[出库类别], h.[客户编码], h.[客户], NULL AS [部门编码] /* 无数据源,布局列 */, h.[部门], NULL AS [经手人编码] /* 无数据源,布局列 */, h.[经手人], h.asp_user1 AS [制单人], s.shr AS [审核人], l.[存货编码], l.[存货名称] AS [存货], l.[规格型号], l.[计量单位], NULL AS [应发数量] /* 无数据源,布局列 */, l.[数量], NULL AS [计量单位2] /* 无数据源,布局列 */, NULL AS [应发数量2] /* 无数据源,布局列 */, NULL AS [数量2] /* 无数据源,布局列 */, l.[成本价], COALESCE(l.[成本价],0)*COALESCE(l.[数量],0) AS [成本金额], NULL AS [出库调整] /* 无数据源,布局列 */, h.[销售订单号], NULL AS [入库单号] /* 无数据源,布局列 */
FROM bd_sale_out h LEFT JOIN bl_sale_out l ON h.[单据编号]=l.[单据编号]
LEFT JOIN yj_doc_status s ON s.panel_code=''SALE_OUT'' AND s.doc_no=h.[单据编号]');
DELETE yj_field WHERE panel_code='SALE_OUT_DETAIL';
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'单据日期',N'单据日期',N'日期',N'query,detail',10,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'创建时间',N'创建时间',N'日期',N'detail',20,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'单据编号',N'单据编号',N'文本',N'query,detail',30,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'业务类型',N'业务类型',N'文本',N'query,detail',40,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'仓库编码',N'仓库编码',N'文本',N'detail',50,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'仓库',N'仓库',N'文本',N'query,detail',60,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'出库类别',N'出库类别',N'文本',N'detail',70,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'客户编码',N'客户编码',N'文本',N'detail',80,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'客户',N'客户',N'文本',N'query,detail',90,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'部门编码',N'部门编码',N'文本',N'detail',100,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'部门',N'部门',N'文本',N'detail',110,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'经手人编码',N'经手人编码',N'文本',N'detail',120,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'经手人',N'经手人',N'文本',N'detail',130,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'制单人',N'制单人',N'文本',N'detail',140,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'审核人',N'审核人',N'文本',N'detail',150,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'存货编码',N'存货编码',N'文本',N'detail',160,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'存货',N'存货',N'文本',N'query,detail',170,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'规格型号',N'规格型号',N'文本',N'detail',180,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'计量单位',N'计量单位',N'文本',N'detail',190,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'应发数量',N'应发数量',N'小数',N'detail',200,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'数量',N'数量',N'小数',N'detail',210,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'计量单位2',N'计量单位2',N'文本',N'detail',220,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'应发数量2',N'应发数量2',N'小数',N'detail',230,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'数量2',N'数量2',N'小数',N'detail',240,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'成本价',N'成本价',N'小数',N'detail',250,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'成本金额',N'成本金额',N'小数',N'detail',260,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'出库调整',N'出库调整',N'小数',N'detail',270,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'销售订单号',N'销售订单号',N'文本',N'detail',280,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_DETAIL',N'入库单号',N'入库单号',N'文本',N'detail',290,120,0,0,0,1);
-- MATERIAL_OUT_DETAIL(材料出库单明细表):PANDA 28 列
EXEC('CREATE OR ALTER VIEW v_material_out_detail AS
SELECT ROW_NUMBER() OVER(ORDER BY h.id DESC, l.id) AS id, h.asp_cancel, h.[单据日期], h.asp_time1 AS [创建时间], h.[单据编号], h.[业务类型], NULL AS [仓库编码] /* 无数据源,布局列 */, h.[仓库], h.[出库类别], NULL AS [生产车间编码] /* 无数据源,布局列 */, h.[生产车间], NULL AS [领用人编码] /* 无数据源,布局列 */, h.[领用人], h.asp_user1 AS [制单人], s.shr AS [审核人], NULL AS [材料编码] /* 无数据源,布局列 */, l.[材料名称], l.[规格型号] AS [材料规格], NULL AS [明细.生产车间] /* 无数据源,布局列 */, NULL AS [工作中心] /* 无数据源,布局列 */, NULL AS [班组] /* 无数据源,布局列 */, NULL AS [工人] /* 无数据源,布局列 */, NULL AS [设备] /* 无数据源,布局列 */, l.[计量单位], l.[数量], l.[单价], l.[金额], NULL AS [计量单位2] /* 无数据源,布局列 */, NULL AS [数量2] /* 无数据源,布局列 */, NULL AS [出库调整] /* 无数据源,布局列 */
FROM bd_material_out h LEFT JOIN bl_material_out l ON h.[单据编号]=l.[单据编号]
LEFT JOIN yj_doc_status s ON s.panel_code=''MATERIAL_OUT'' AND s.doc_no=h.[单据编号]');
DELETE yj_field WHERE panel_code='MATERIAL_OUT_DETAIL';
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'单据日期',N'单据日期',N'日期',N'query,detail',10,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'创建时间',N'创建时间',N'日期',N'detail',20,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'单据编号',N'单据编号',N'文本',N'query,detail',30,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'业务类型',N'业务类型',N'文本',N'query,detail',40,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'仓库编码',N'仓库编码',N'文本',N'detail',50,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'仓库',N'仓库',N'文本',N'query,detail',60,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'出库类别',N'出库类别',N'文本',N'detail',70,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'生产车间编码',N'生产车间编码',N'文本',N'detail',80,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'生产车间',N'生产车间',N'文本',N'query,detail',90,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'领用人编码',N'领用人编码',N'文本',N'detail',100,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'领用人',N'领用人',N'文本',N'detail',110,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'制单人',N'制单人',N'文本',N'detail',120,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'审核人',N'审核人',N'文本',N'detail',130,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'材料编码',N'材料编码',N'文本',N'detail',140,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'材料名称',N'材料名称',N'文本',N'detail',150,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'材料规格',N'材料规格',N'文本',N'detail',160,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'明细.生产车间',N'明细.生产车间',N'文本',N'detail',170,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'工作中心',N'工作中心',N'文本',N'detail',180,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'班组',N'班组',N'文本',N'detail',190,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'工人',N'工人',N'文本',N'detail',200,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'设备',N'设备',N'文本',N'detail',210,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'计量单位',N'计量单位',N'文本',N'detail',220,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'数量',N'数量',N'小数',N'detail',230,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'单价',N'单价',N'小数',N'detail',240,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'金额',N'金额',N'小数',N'detail',250,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'计量单位2',N'计量单位2',N'文本',N'detail',260,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'数量2',N'数量2',N'小数',N'detail',270,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'出库调整',N'出库调整',N'小数',N'detail',280,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_DETAIL',N'材料名称',N'材料',N'文本',N'query',5,120,0,0,0,0);
-- OTHER_OUT_DETAIL(其他出库单明细表):PANDA 27 列
EXEC('CREATE OR ALTER VIEW v_other_out_detail AS
SELECT ROW_NUMBER() OVER(ORDER BY h.id DESC, l.id) AS id, h.asp_cancel, h.[单据日期], h.asp_time1 AS [创建时间], h.[单据编号], h.[业务类型], NULL AS [仓库编码] /* 无数据源,布局列 */, l.[仓库], h.[出库类别], NULL AS [部门编码] /* 无数据源,布局列 */, h.[部门], NULL AS [经手人编码] /* 无数据源,布局列 */, h.[经手人], h.[备注], h.asp_user1 AS [制单人], s.shr AS [审核人], NULL AS [存货编码] /* 无数据源,布局列 */, l.[存货名称] AS [存货], l.[规格型号], l.[计量单位], l.[数量], l.[单价], l.[金额], NULL AS [计量单位2] /* 无数据源,布局列 */, NULL AS [数量2] /* 无数据源,布局列 */, NULL AS [出库调整] /* 无数据源,布局列 */, NULL AS [累计调拨入库量] /* 无数据源,布局列 */, NULL AS [合理损耗数量] /* 无数据源,布局列 */, NULL AS [入库单号] /* 无数据源,布局列 */
FROM bd_other_out h LEFT JOIN bl_other_out l ON h.[单据编号]=l.[单据编号]
LEFT JOIN yj_doc_status s ON s.panel_code=''OTHER_OUT'' AND s.doc_no=h.[单据编号]');
DELETE yj_field WHERE panel_code='OTHER_OUT_DETAIL';
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_DETAIL',N'单据日期',N'单据日期',N'日期',N'query,detail',10,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_DETAIL',N'创建时间',N'创建时间',N'日期',N'detail',20,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_DETAIL',N'单据编号',N'单据编号',N'文本',N'query,detail',30,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_DETAIL',N'业务类型',N'业务类型',N'文本',N'query,detail',40,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_DETAIL',N'仓库编码',N'仓库编码',N'文本',N'detail',50,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_DETAIL',N'仓库',N'仓库',N'文本',N'query,detail',60,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_DETAIL',N'出库类别',N'出库类别',N'文本',N'detail',70,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_DETAIL',N'部门编码',N'部门编码',N'文本',N'detail',80,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_DETAIL',N'部门',N'部门',N'文本',N'detail',90,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_DETAIL',N'经手人编码',N'经手人编码',N'文本',N'detail',100,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_DETAIL',N'经手人',N'经手人',N'文本',N'detail',110,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_DETAIL',N'备注',N'备注',N'文本',N'detail',120,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_DETAIL',N'制单人',N'制单人',N'文本',N'detail',130,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_DETAIL',N'审核人',N'审核人',N'文本',N'detail',140,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_DETAIL',N'存货编码',N'存货编码',N'文本',N'detail',150,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_DETAIL',N'存货',N'存货',N'文本',N'query,detail',160,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_DETAIL',N'规格型号',N'规格型号',N'文本',N'detail',170,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_DETAIL',N'计量单位',N'计量单位',N'文本',N'detail',180,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_DETAIL',N'数量',N'数量',N'小数',N'detail',190,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_DETAIL',N'单价',N'单价',N'小数',N'detail',200,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_DETAIL',N'金额',N'金额',N'小数',N'detail',210,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_DETAIL',N'计量单位2',N'计量单位2',N'文本',N'detail',220,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_DETAIL',N'数量2',N'数量2',N'小数',N'detail',230,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_DETAIL',N'出库调整',N'出库调整',N'小数',N'detail',240,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_DETAIL',N'累计调拨入库量',N'累计调拨入库量',N'小数',N'detail',250,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_DETAIL',N'合理损耗数量',N'合理损耗数量',N'小数',N'detail',260,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_DETAIL',N'入库单号',N'入库单号',N'文本',N'detail',270,120,0,0,0,1);
-- MANU_ORDER_DETAIL(生产加工单明细表):PANDA 20 列
EXEC('CREATE OR ALTER VIEW v_manu_order_detail AS
SELECT ROW_NUMBER() OVER(ORDER BY h.id DESC, l.id) AS id, h.asp_cancel, h.[合同号] AS [单据编号], CASE WHEN ISNULL(s.canceled,N''N'')=N''Y'' THEN N''已作废'' WHEN ISNULL(s.stopped,N''N'')=N''Y'' THEN N''已中止'' WHEN ISNULL(s.pending,N''N'')=N''Y'' THEN N''审批中'' WHEN s.shr IS NOT NULL THEN N''已审核'' ELSE N''草稿'' END AS [单据状态], h.[生产车间], h.[客户编码], h.[客户], l.[产品编码], l.[产品名称], l.[规格型号], l.[生产单位], l.[数量], l.[齐套数量(主)], l.[累计汇报套数(工序单位)], l.[可用量], l.[现存量], l.[图号], l.[单重], l.[总重], l.[需求令号], h.[预开工日], h.[预完工日]
FROM bd_manu_order h LEFT JOIN bl_manu_order l ON h.[合同号]=l.[合同号]
LEFT JOIN yj_doc_status s ON s.panel_code=''MANU_ORDER'' AND s.doc_no=h.[合同号]');
DELETE yj_field WHERE panel_code='MANU_ORDER_DETAIL';
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_DETAIL',N'单据编号',N'单据编号',N'文本',N'query,detail',10,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_DETAIL',N'单据状态',N'单据状态',N'文本',N'query,detail',20,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_DETAIL',N'生产车间',N'生产车间',N'文本',N'query,detail',30,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_DETAIL',N'客户编码',N'客户编码',N'文本',N'detail',40,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_DETAIL',N'客户',N'客户',N'文本',N'query,detail',50,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_DETAIL',N'产品编码',N'产品编码',N'文本',N'detail',60,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_DETAIL',N'产品名称',N'产品名称',N'文本',N'detail',70,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_DETAIL',N'规格型号',N'规格型号',N'文本',N'detail',80,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_DETAIL',N'生产单位',N'生产单位',N'文本',N'detail',90,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_DETAIL',N'数量',N'数量',N'小数',N'detail',100,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_DETAIL',N'齐套数量(主)',N'齐套数量(主)',N'小数',N'detail',110,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_DETAIL',N'累计汇报套数(工序单位)',N'累计汇报套数(工序单位)',N'文本',N'detail',120,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_DETAIL',N'可用量',N'可用量',N'文本',N'detail',130,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_DETAIL',N'现存量',N'现存量',N'文本',N'detail',140,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_DETAIL',N'图号',N'图号',N'文本',N'detail',150,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_DETAIL',N'单重',N'单重',N'小数',N'detail',160,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_DETAIL',N'总重',N'总重',N'小数',N'detail',170,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_DETAIL',N'需求令号',N'需求令号',N'文本',N'detail',180,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_DETAIL',N'预开工日',N'预开工日',N'文本',N'detail',190,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_DETAIL',N'预完工日',N'预完工日',N'文本',N'detail',200,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_DETAIL',N'产品名称',N'存货',N'文本',N'query',5,120,0,0,0,0);
UPDATE yj_field SET place=N'query,detail' WHERE panel_code='MANU_ORDER_DETAIL' AND label=N'单据状态';

-- ===== Part 3 统计表:视图重建(PANDA 列名+维度聚合)+ yj_field 重建 =====
-- SALES_ORDER_STATS(销售订单统计表):PANDA 15 列
EXEC('CREATE OR ALTER VIEW v_sales_order_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.asp_cancel, h.[客户编码], h.[客户], h.[部门], h.[业务员], l.[存货编码], l.[存货名称] AS [存货], l.[规格型号], l.[销售单位] AS [主单位], COUNT(DISTINCT h.[单据编号]) AS [单据数], SUM(COALESCE(l.[数量],0)) AS [数量(主单位)], SUM(COALESCE(l.[金额],0))/NULLIF(SUM(COALESCE(l.[数量],0)),0) AS [单价], SUM(COALESCE(l.[金额],0)) AS [金额], SUM(COALESCE(l.[含税金额],0)) AS [含税金额], SUM(COALESCE(l.[折扣金额],0)) AS [折扣金额], MIN(l.[预计交货日期]) AS [预计交货日期]
FROM bd_so_order h LEFT JOIN bl_so_order l ON h.[单据编号]=l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code=''SO_ORDER'' AND s.doc_no=h.[单据编号] AND s.canceled=''Y'')
GROUP BY h.asp_cancel, h.[客户编码], h.[客户], h.[部门], h.[业务员], l.[存货编码], l.[存货名称], l.[规格型号], l.[销售单位]');
DELETE yj_field WHERE panel_code='SALES_ORDER_STATS';
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_STATS',N'客户编码',N'客户编码',N'文本',N'detail',10,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_STATS',N'客户',N'客户',N'文本',N'query,detail',20,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_STATS',N'部门',N'部门',N'文本',N'detail',30,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_STATS',N'业务员',N'业务员',N'文本',N'detail',40,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_STATS',N'存货编码',N'存货编码',N'文本',N'detail',50,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_STATS',N'存货',N'存货',N'文本',N'query,detail',60,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_STATS',N'规格型号',N'规格型号',N'文本',N'detail',70,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_STATS',N'主单位',N'主单位',N'文本',N'detail',80,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_STATS',N'单据数',N'单据数',N'文本',N'detail',90,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_STATS',N'数量(主单位)',N'数量(主单位)',N'文本',N'detail',100,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_STATS',N'单价',N'单价',N'小数',N'detail',110,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_STATS',N'金额',N'金额',N'小数',N'detail',120,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_STATS',N'含税金额',N'含税金额',N'小数',N'detail',130,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_STATS',N'折扣金额',N'折扣金额',N'小数',N'detail',140,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALES_ORDER_STATS',N'预计交货日期',N'预计交货日期',N'日期',N'detail',150,120,0,0,0,1);
-- PURCHASE_IN_STATS(采购入库单统计表):PANDA 17 列
EXEC('CREATE OR ALTER VIEW v_purchase_in_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.asp_cancel, NULL AS [仓库编码], h.[仓库], h.[供应商编码], h.[供应商], NULL AS [存货编码], l.[存货名称] AS [存货], l.[规格型号], l.[计量单位] AS [主单位], l.[计量单位2] AS [辅单位], SUM(COALESCE(l.[实收数量],0)) AS [实收数量(主单位)], SUM(COALESCE(l.[金额],0))/NULLIF(SUM(COALESCE(l.[实收数量],0)),0) AS [单价(主单位)], SUM(COALESCE(l.[金额],0)) AS [金额], NULL AS [单价(辅单位)], NULL AS [入库调整], SUM(COALESCE(l.[费用调整],0)) AS [费用调整], SUM(COALESCE(l.[金额],0)+COALESCE(l.[费用调整],0)+COALESCE(l.[费用金额],0)) AS [总成本], SUM(COALESCE(l.[费用金额],0)) AS [费用金额]
FROM bd_purchase_in h LEFT JOIN bl_purchase_in l ON h.[单据编号]=l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code=''PURCHASE_IN'' AND s.doc_no=h.[单据编号] AND s.canceled=''Y'')
GROUP BY h.asp_cancel, h.[仓库], h.[供应商编码], h.[供应商], l.[存货名称], l.[规格型号], l.[计量单位], l.[计量单位2]');
DELETE yj_field WHERE panel_code='PURCHASE_IN_STATS';
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_STATS',N'仓库编码',N'仓库编码',N'文本',N'detail',10,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_STATS',N'仓库',N'仓库',N'文本',N'query,detail',20,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_STATS',N'供应商编码',N'供应商编码',N'文本',N'detail',30,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_STATS',N'供应商',N'供应商',N'文本',N'query,detail',40,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_STATS',N'存货编码',N'存货编码',N'文本',N'detail',50,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_STATS',N'存货',N'存货',N'文本',N'query,detail',60,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_STATS',N'规格型号',N'规格型号',N'文本',N'detail',70,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_STATS',N'主单位',N'主单位',N'文本',N'detail',80,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_STATS',N'辅单位',N'辅单位',N'文本',N'detail',90,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_STATS',N'实收数量(主单位)',N'实收数量(主单位)',N'文本',N'detail',100,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_STATS',N'单价(主单位)',N'单价(主单位)',N'文本',N'detail',110,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_STATS',N'金额',N'金额',N'小数',N'detail',120,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_STATS',N'单价(辅单位)',N'单价(辅单位)',N'文本',N'detail',130,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_STATS',N'入库调整',N'入库调整',N'小数',N'detail',140,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_STATS',N'费用调整',N'费用调整',N'小数',N'detail',150,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_STATS',N'总成本',N'总成本',N'小数',N'detail',160,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('PURCHASE_IN_STATS',N'费用金额',N'费用金额',N'小数',N'detail',170,120,0,0,0,1);
-- FINISH_IN_STATS(产成品入库单统计表):PANDA 12 列
EXEC('CREATE OR ALTER VIEW v_finish_in_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.asp_cancel, h.[单据日期], h.[项目], NULL AS [存货编码], l.[产品名称] AS [存货], l.[规格型号], l.[计量单位], NULL AS [辅单位], SUM(COALESCE(l.[实收数量],0)) AS [实收数量(主单位)], SUM(COALESCE(l.[金额],0))/NULLIF(SUM(COALESCE(l.[实收数量],0)),0) AS [单价], SUM(COALESCE(l.[金额],0)) AS [金额], NULL AS [实收数量(辅单位)], NULL AS [单价(辅单位)]
FROM bd_finish_in h LEFT JOIN bl_finish_in l ON h.[单据编号]=l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code=''FINISH_IN'' AND s.doc_no=h.[单据编号] AND s.canceled=''Y'')
GROUP BY h.asp_cancel, h.[单据日期], h.[项目], l.[产品名称], l.[规格型号], l.[计量单位]');
DELETE yj_field WHERE panel_code='FINISH_IN_STATS';
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_STATS',N'单据日期',N'单据日期',N'日期',N'query,detail',10,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_STATS',N'项目',N'项目',N'文本',N'detail',20,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_STATS',N'存货编码',N'存货编码',N'文本',N'detail',30,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_STATS',N'存货',N'存货',N'文本',N'query,detail',40,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_STATS',N'规格型号',N'规格型号',N'文本',N'detail',50,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_STATS',N'计量单位',N'计量单位',N'文本',N'detail',60,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_STATS',N'辅单位',N'辅单位',N'文本',N'detail',70,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_STATS',N'实收数量(主单位)',N'实收数量(主单位)',N'文本',N'detail',80,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_STATS',N'单价',N'单价',N'小数',N'detail',90,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_STATS',N'金额',N'金额',N'小数',N'detail',100,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_STATS',N'实收数量(辅单位)',N'实收数量(辅单位)',N'文本',N'detail',110,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('FINISH_IN_STATS',N'单价(辅单位)',N'单价(辅单位)',N'文本',N'detail',120,120,0,0,0,1);
-- OTHER_IN_STATS(其他入库单统计表):PANDA 12 列
EXEC('CREATE OR ALTER VIEW v_other_in_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.asp_cancel, NULL AS [仓库编码], h.[仓库], NULL AS [存货编码], l.[存货名称] AS [存货], l.[规格型号], l.[计量单位] AS [主单位], l.[计量单位2] AS [辅单位], SUM(COALESCE(l.[数量],0)) AS [数量(主单位)], SUM(COALESCE(l.[金额],0))/NULLIF(SUM(COALESCE(l.[数量],0)),0) AS [单价], SUM(COALESCE(l.[金额],0)) AS [金额], SUM(COALESCE(l.[数量2],0)) AS [数量(辅单位)], NULL AS [单价(辅单位)]
FROM bd_other_in h LEFT JOIN bl_other_in l ON h.[单据编号]=l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code=''OTHER_IN'' AND s.doc_no=h.[单据编号] AND s.canceled=''Y'')
GROUP BY h.asp_cancel, h.[仓库], l.[存货名称], l.[规格型号], l.[计量单位], l.[计量单位2]');
DELETE yj_field WHERE panel_code='OTHER_IN_STATS';
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_STATS',N'仓库编码',N'仓库编码',N'文本',N'detail',10,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_STATS',N'仓库',N'仓库',N'文本',N'query,detail',20,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_STATS',N'存货编码',N'存货编码',N'文本',N'detail',30,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_STATS',N'存货',N'存货',N'文本',N'query,detail',40,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_STATS',N'规格型号',N'规格型号',N'文本',N'detail',50,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_STATS',N'主单位',N'主单位',N'文本',N'detail',60,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_STATS',N'辅单位',N'辅单位',N'文本',N'detail',70,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_STATS',N'数量(主单位)',N'数量(主单位)',N'文本',N'detail',80,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_STATS',N'单价',N'单价',N'小数',N'detail',90,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_STATS',N'金额',N'金额',N'小数',N'detail',100,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_STATS',N'数量(辅单位)',N'数量(辅单位)',N'文本',N'detail',110,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_IN_STATS',N'单价(辅单位)',N'单价(辅单位)',N'文本',N'detail',120,120,0,0,0,1);
-- SALE_OUT_STATS(销售出库单统计表):PANDA 12 列
EXEC('CREATE OR ALTER VIEW v_sale_out_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.asp_cancel, h.[单据日期] AS [单据日期（周）], l.[存货编码], l.[存货名称] AS [存货], l.[规格型号], l.[计量单位] AS [主单位], NULL AS [辅单位], SUM(COALESCE(l.[数量],0)) AS [数量(主单位)], SUM(COALESCE(l.[成本价],0)*COALESCE(l.[数量],0))/NULLIF(SUM(COALESCE(l.[数量],0)),0) AS [成本价(主单位)], NULL AS [数量(辅单位)], NULL AS [成本价(辅单位)], SUM(COALESCE(l.[成本价],0)*COALESCE(l.[数量],0)) AS [成本金额], NULL AS [出库调整]
FROM bd_sale_out h LEFT JOIN bl_sale_out l ON h.[单据编号]=l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code=''SALE_OUT'' AND s.doc_no=h.[单据编号] AND s.canceled=''Y'')
GROUP BY h.asp_cancel, h.[单据日期], l.[存货编码], l.[存货名称], l.[规格型号], l.[计量单位]');
DELETE yj_field WHERE panel_code='SALE_OUT_STATS';
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_STATS',N'单据日期（周）',N'单据日期（周）',N'日期',N'detail',10,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_STATS',N'存货编码',N'存货编码',N'文本',N'detail',20,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_STATS',N'存货',N'存货',N'文本',N'query,detail',30,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_STATS',N'规格型号',N'规格型号',N'文本',N'detail',40,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_STATS',N'主单位',N'主单位',N'文本',N'detail',50,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_STATS',N'辅单位',N'辅单位',N'文本',N'detail',60,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_STATS',N'数量(主单位)',N'数量(主单位)',N'文本',N'detail',70,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_STATS',N'成本价(主单位)',N'成本价(主单位)',N'文本',N'detail',80,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_STATS',N'数量(辅单位)',N'数量(辅单位)',N'文本',N'detail',90,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_STATS',N'成本价(辅单位)',N'成本价(辅单位)',N'文本',N'detail',100,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_STATS',N'成本金额',N'成本金额',N'小数',N'detail',110,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('SALE_OUT_STATS',N'出库调整',N'出库调整',N'小数',N'detail',120,120,0,0,0,1);
-- MATERIAL_OUT_STATS(材料出库单统计表):PANDA 13 列
EXEC('CREATE OR ALTER VIEW v_material_out_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.asp_cancel, NULL AS [仓库编码], l.[仓库], NULL AS [材料编码], l.[材料名称], l.[规格型号] AS [材料规格], l.[计量单位] AS [主单位], NULL AS [计量单位(辅单位)], SUM(COALESCE(l.[数量],0)) AS [数量(主单位)], SUM(COALESCE(l.[金额],0))/NULLIF(SUM(COALESCE(l.[数量],0)),0) AS [单价(主单位)], SUM(COALESCE(l.[金额],0)) AS [金额], NULL AS [数量(辅单位)], NULL AS [单价(辅单位)], NULL AS [出库调整]
FROM bd_material_out h LEFT JOIN bl_material_out l ON h.[单据编号]=l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code=''MATERIAL_OUT'' AND s.doc_no=h.[单据编号] AND s.canceled=''Y'')
GROUP BY h.asp_cancel, l.[仓库], l.[材料名称], l.[规格型号], l.[计量单位]');
DELETE yj_field WHERE panel_code='MATERIAL_OUT_STATS';
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_STATS',N'仓库编码',N'仓库编码',N'文本',N'detail',10,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_STATS',N'仓库',N'仓库',N'文本',N'query,detail',20,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_STATS',N'材料编码',N'材料编码',N'文本',N'detail',30,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_STATS',N'材料名称',N'材料名称',N'文本',N'detail',40,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_STATS',N'材料规格',N'材料规格',N'文本',N'detail',50,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_STATS',N'主单位',N'主单位',N'文本',N'detail',60,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_STATS',N'计量单位(辅单位)',N'计量单位(辅单位)',N'文本',N'detail',70,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_STATS',N'数量(主单位)',N'数量(主单位)',N'文本',N'detail',80,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_STATS',N'单价(主单位)',N'单价(主单位)',N'文本',N'detail',90,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_STATS',N'金额',N'金额',N'小数',N'detail',100,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_STATS',N'数量(辅单位)',N'数量(辅单位)',N'文本',N'detail',110,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_STATS',N'单价(辅单位)',N'单价(辅单位)',N'文本',N'detail',120,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_STATS',N'出库调整',N'出库调整',N'小数',N'detail',130,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MATERIAL_OUT_STATS',N'材料名称',N'材料',N'文本',N'query',5,120,0,0,0,0);
-- OTHER_OUT_STATS(其他出库单统计表):PANDA 14 列
EXEC('CREATE OR ALTER VIEW v_other_out_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.asp_cancel, NULL AS [仓库编码], l.[仓库], NULL AS [存货编码], l.[存货名称] AS [存货], l.[规格型号], l.[计量单位] AS [主单位], SUM(COALESCE(l.[数量],0)) AS [数量(主单位)], SUM(COALESCE(l.[金额],0))/NULLIF(SUM(COALESCE(l.[数量],0)),0) AS [单价(主单位)], NULL AS [数量(辅单位)], NULL AS [单价(辅单位)], SUM(COALESCE(l.[金额],0)) AS [金额], NULL AS [出库调整], NULL AS [累计调拨入库量(主单位)], NULL AS [合理损耗数量(主单位)]
FROM bd_other_out h LEFT JOIN bl_other_out l ON h.[单据编号]=l.[单据编号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code=''OTHER_OUT'' AND s.doc_no=h.[单据编号] AND s.canceled=''Y'')
GROUP BY h.asp_cancel, l.[仓库], l.[存货名称], l.[规格型号], l.[计量单位]');
DELETE yj_field WHERE panel_code='OTHER_OUT_STATS';
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_STATS',N'仓库编码',N'仓库编码',N'文本',N'detail',10,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_STATS',N'仓库',N'仓库',N'文本',N'query,detail',20,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_STATS',N'存货编码',N'存货编码',N'文本',N'detail',30,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_STATS',N'存货',N'存货',N'文本',N'query,detail',40,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_STATS',N'规格型号',N'规格型号',N'文本',N'detail',50,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_STATS',N'主单位',N'主单位',N'文本',N'detail',60,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_STATS',N'数量(主单位)',N'数量(主单位)',N'文本',N'detail',70,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_STATS',N'单价(主单位)',N'单价(主单位)',N'文本',N'detail',80,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_STATS',N'数量(辅单位)',N'数量(辅单位)',N'文本',N'detail',90,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_STATS',N'单价(辅单位)',N'单价(辅单位)',N'文本',N'detail',100,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_STATS',N'金额',N'金额',N'小数',N'detail',110,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_STATS',N'出库调整',N'出库调整',N'小数',N'detail',120,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_STATS',N'累计调拨入库量(主单位)',N'累计调拨入库量(主单位)',N'文本',N'detail',130,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('OTHER_OUT_STATS',N'合理损耗数量(主单位)',N'合理损耗数量(主单位)',N'文本',N'detail',140,120,0,0,0,1);
-- MANU_ORDER_STATS(生产加工单统计表):PANDA 9 列
EXEC('CREATE OR ALTER VIEW v_manu_order_stats AS
SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, h.asp_cancel, l.[产品编码], l.[产品名称], l.[规格型号], l.[生产单位], COUNT(DISTINCT h.[合同号]) AS [加工单数], SUM(COALESCE(l.[数量],0)) AS [计划数量], SUM(COALESCE(l.[累计汇报套数(工序单位)],0)) AS [累计汇报数量], SUM(CASE WHEN h.[完工日期] IS NOT NULL THEN COALESCE(l.[数量],0) ELSE 0 END) AS [完工数量], CAST(ISNULL(100.0*SUM(COALESCE(l.[累计汇报套数(工序单位)],0))/NULLIF(SUM(COALESCE(l.[数量],0)),0),0) AS decimal(18,2)) AS [生产进度%]
FROM bd_manu_order h LEFT JOIN bl_manu_order l ON h.[合同号]=l.[合同号]
WHERE NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code=''MANU_ORDER'' AND s.doc_no=h.[合同号] AND s.canceled=''Y'')
GROUP BY h.asp_cancel, l.[产品编码], l.[产品名称], l.[规格型号], l.[生产单位]');
DELETE yj_field WHERE panel_code='MANU_ORDER_STATS';
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_STATS',N'产品编码',N'产品编码',N'文本',N'detail',10,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_STATS',N'产品名称',N'产品名称',N'文本',N'detail',20,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_STATS',N'规格型号',N'规格型号',N'文本',N'detail',30,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_STATS',N'生产单位',N'生产单位',N'文本',N'detail',40,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_STATS',N'加工单数',N'加工单数',N'文本',N'detail',50,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_STATS',N'计划数量',N'计划数量',N'小数',N'detail',60,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_STATS',N'累计汇报数量',N'累计汇报数量',N'小数',N'detail',70,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_STATS',N'完工数量',N'完工数量',N'小数',N'detail',80,120,0,0,0,1);
INSERT INTO yj_field (panel_code,col_name,label,data_type,place,seq,width,editable,required,hidden,visible) VALUES ('MANU_ORDER_STATS',N'生产进度%',N'生产进度%',N'小数',N'detail',90,120,0,0,0,1);

-- ===== 校验 =====
SELECT panel_code, COUNT(*) n FROM yj_field WHERE panel_code IN ('SO_ORDER','PU_REQ','PU_ORDER','PURCHASE_IN','FINISH_IN','OTHER_IN','OUTSOURCE_IN','SALE_OUT','MATERIAL_OUT','OTHER_OUT','OUTSOURCE_ISSUE','OUTSOURCE_ORDER','MANU_ORDER','SALES_ORDER_DETAIL','PURCHASE_IN_DETAIL','FINISH_IN_DETAIL','OTHER_IN_DETAIL','SALE_OUT_DETAIL','MATERIAL_OUT_DETAIL','OTHER_OUT_DETAIL','OUTSOURCE_IN_DETAIL','OUTSOURCE_ISSUE_DETAIL','MANU_ORDER_DETAIL','SALES_ORDER_STATS','PURCHASE_IN_STATS','FINISH_IN_STATS','OTHER_IN_STATS','SALE_OUT_STATS','MATERIAL_OUT_STATS','OTHER_OUT_STATS','MANU_ORDER_STATS') GROUP BY panel_code ORDER BY panel_code;
PRINT N'replica 迁移完成';
