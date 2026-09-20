-- migrate-query-ref-links.sql — 七张单据「查询」弹窗字段与基础资料建立关联(参照)
-- 2026-09-20 用户需求:采购订单 / 送料暂收单 / 暂收退回单 / 来料检验单 / 采购入库单 / 销售订单 /
--   销售出库单 的「查询」按钮弹窗里,凡对应基础资料的字段都要能点选档案(而不是手打文本)。
--
-- 现状与问题(实测 2026-09-20,基于 HSDZ_MES 真实数据):
--   ① 该弹窗按表头非隐藏字段渲染(前端 headerEditFields);data_type 不是「参照」就不弹选择框。
--   ② QC_INSP/QC_RETURN 的「供应商」还是文本;SL_RECV「供应商/供应商代码」还指着 PARTNER(往来单位);
--      QC_INSP「暂收单号」指着 QC_RECV(空面板),而 MES 实际暂收单在 SL_RECV。
--   ③ SO_ORDER「客户」ref=KHDA.dm(存编码),但库里存的是客户名称(32/32 命中 KHDA.mc);
--      「部门/业务员/客户编码/结算客户/币种」仍是硬编码下拉框(选项与真实数据不符:库里部门=销售部,
--      下拉只有 销售一部/二部/三部)。
--   ④ PURCHASE_IN/SALE_OUT「仓库」ref=WH.仓库编码,但库里存仓库名称;SO_ORDER 同名字段已是 仓库名称。
--   ⑤ 各单明细的「计量单位/单位/物料名称」是文本,基础资料 UOM/INV 里都有对应值(实测 2/2、210/210 命中)。
--
-- 口径(沿用 2026-09-17 的 migrate-sl-supplier-ref / migrate-supplier-ref-v2):
--   供应商/客户等"名称列" ref=mc(存名称);"编码列" ref=dm、display=mc(存编码,按名称挑);
--   仓库 ref=仓库名称;计量单位 ref=计量单位名称;物料 ref=存货编码/存货名称;部门 ref=部门名称;
--   业务员/经手人/检验员 ref=EMP.员工名称;币种 ref=CUR.名称。
--   改「参照」时清掉遗留硬编码 dict_sql,避免两套选项并存。
-- 幂等可重跑。
SET NOCOUNT ON;
GO

-- ══ 1) 采购订单 PU_ORDER ══
-- 币种:硬编码下拉(仅"人民币")→ 币别档案;供应商编码:文本 → 供应商档案编码
UPDATE yj_field SET data_type = N'参照', ref_panel = 'CUR', ref_field = N'名称', display_field = N'名称', dict_sql = NULL
WHERE panel_code = 'PU_ORDER' AND label = N'币种' AND (ISNULL(ref_panel, '') <> 'CUR' OR data_type <> N'参照');
UPDATE yj_field SET data_type = N'参照', ref_panel = 'GFDA', ref_field = 'dm', display_field = 'mc'
WHERE panel_code = 'PU_ORDER' AND label = N'供应商编码' AND (ISNULL(ref_panel, '') <> 'GFDA' OR data_type <> N'参照');
GO

-- ══ 2) 送料暂收单 SL_RECV ══
-- 业务员(文本) → 职员档案
UPDATE yj_field SET data_type = N'参照', ref_panel = 'EMP', ref_field = N'员工名称', display_field = N'员工名称'
WHERE panel_code = 'SL_RECV' AND label = N'业务员' AND (ISNULL(ref_panel, '') <> 'EMP' OR data_type <> N'参照');
-- 供应商代码/供应商:PARTNER(往来单位) → GFDA(供应商档案);名称列 ref=mc,编码列 ref=dm
UPDATE yj_field SET data_type = N'参照', ref_panel = 'GFDA', ref_field = 'dm', display_field = 'mc'
WHERE panel_code = 'SL_RECV' AND label = N'供应商代码' AND (ISNULL(ref_panel, '') <> 'GFDA' OR ref_field <> 'dm');
UPDATE yj_field SET data_type = N'参照', ref_panel = 'GFDA', ref_field = 'mc', display_field = 'mc'
WHERE panel_code = 'SL_RECV' AND label = N'供应商' AND (ISNULL(ref_panel, '') <> 'GFDA' OR ref_field <> 'mc');
-- 明细:物料编码 选中后显示存货名称;计量单位(文本) → 计量单位档案
UPDATE yj_field SET display_field = N'存货名称'
WHERE panel_code = 'SL_RECV' AND label = N'物料编码' AND data_type = N'参照' AND ISNULL(display_field, '') <> N'存货名称';
UPDATE yj_field SET data_type = N'参照', ref_panel = 'UOM', ref_field = N'计量单位名称', display_field = N'计量单位名称'
WHERE panel_code = 'SL_RECV' AND label = N'计量单位' AND (ISNULL(ref_panel, '') <> 'UOM' OR data_type <> N'参照');
UPDATE yj_field SET data_type = N'参照', ref_panel = 'INV', ref_field = N'存货名称', display_field = N'存货名称'
WHERE panel_code = 'SL_RECV' AND label = N'物料名称' AND (ISNULL(ref_panel, '') <> 'INV' OR data_type <> N'参照');
GO

-- ══ 3) 暂收退回单 QC_RETURN ══
UPDATE yj_field SET data_type = N'参照', ref_panel = 'GFDA', ref_field = 'mc', display_field = 'mc'
WHERE panel_code = 'QC_RETURN' AND label = N'供应商' AND (ISNULL(ref_panel, '') <> 'GFDA' OR data_type <> N'参照');
UPDATE yj_field SET data_type = N'参照', ref_panel = 'EMP', ref_field = N'员工名称', display_field = N'员工名称'
WHERE panel_code = 'QC_RETURN' AND label = N'经手人' AND (ISNULL(ref_panel, '') <> 'EMP' OR data_type <> N'参照');
UPDATE yj_field SET display_field = N'存货名称'
WHERE panel_code = 'QC_RETURN' AND label = N'物料编码' AND data_type = N'参照' AND ISNULL(display_field, '') <> N'存货名称';
UPDATE yj_field SET data_type = N'参照', ref_panel = 'INV', ref_field = N'存货名称', display_field = N'存货名称'
WHERE panel_code = 'QC_RETURN' AND label = N'物料名称' AND (ISNULL(ref_panel, '') <> 'INV' OR data_type <> N'参照');
UPDATE yj_field SET data_type = N'参照', ref_panel = 'UOM', ref_field = N'计量单位名称', display_field = N'计量单位名称'
WHERE panel_code = 'QC_RETURN' AND label IN (N'计量单位', N'单位') AND (ISNULL(ref_panel, '') <> 'UOM' OR data_type <> N'参照');
GO

-- ══ 4) 来料检验单 QC_INSP ══
UPDATE yj_field SET data_type = N'参照', ref_panel = 'GFDA', ref_field = 'mc', display_field = 'mc'
WHERE panel_code = 'QC_INSP' AND label = N'供应商' AND (ISNULL(ref_panel, '') <> 'GFDA' OR data_type <> N'参照');
UPDATE yj_field SET data_type = N'参照', ref_panel = 'EMP', ref_field = N'员工名称', display_field = N'员工名称'
WHERE panel_code = 'QC_INSP' AND label = N'检验员' AND (ISNULL(ref_panel, '') <> 'EMP' OR data_type <> N'参照');
-- 暂收单号:MES 实际暂收单是 SL_RECV(原指 QC_RECV 为空面板,选择框永远没数据)
UPDATE yj_field SET ref_panel = 'SL_RECV', ref_field = N'单据编号', display_field = N'单据编号'
WHERE panel_code = 'QC_INSP' AND label = N'暂收单号' AND ISNULL(ref_panel, '') <> 'SL_RECV';
UPDATE yj_field SET display_field = N'存货名称'
WHERE panel_code = 'QC_INSP' AND label = N'物料编码' AND data_type = N'参照' AND ISNULL(display_field, '') <> N'存货名称';
UPDATE yj_field SET data_type = N'参照', ref_panel = 'INV', ref_field = N'存货名称', display_field = N'存货名称'
WHERE panel_code = 'QC_INSP' AND label = N'物料名称' AND (ISNULL(ref_panel, '') <> 'INV' OR data_type <> N'参照');
UPDATE yj_field SET data_type = N'参照', ref_panel = 'UOM', ref_field = N'计量单位名称', display_field = N'计量单位名称'
WHERE panel_code = 'QC_INSP' AND label IN (N'计量单位', N'单位') AND (ISNULL(ref_panel, '') <> 'UOM' OR data_type <> N'参照');
UPDATE yj_field SET data_type = N'参照', ref_panel = 'DEPT', ref_field = N'部门名称', display_field = N'部门名称'
WHERE panel_code = 'QC_INSP' AND label = N'部门' AND (ISNULL(ref_panel, '') <> 'DEPT' OR data_type <> N'参照');
GO

-- ══ 5) 采购入库单 PURCHASE_IN ══
-- 部门/部门编码:文本 → 部门档案(库里值 采购部 / BM00002 均可命中)
UPDATE yj_field SET data_type = N'参照', ref_panel = 'DEPT', ref_field = N'部门名称', display_field = N'部门名称'
WHERE panel_code = 'PURCHASE_IN' AND label = N'部门' AND (ISNULL(ref_panel, '') <> 'DEPT' OR data_type <> N'参照');
UPDATE yj_field SET data_type = N'参照', ref_panel = 'DEPT', ref_field = N'部门编码', display_field = N'部门名称'
WHERE panel_code = 'PURCHASE_IN' AND label = N'部门编码' AND (ISNULL(ref_panel, '') <> 'DEPT' OR data_type <> N'参照');
-- 仓库列存的是仓库名称(同 仓库名称 明细列),ref 由 仓库编码 改 仓库名称;隐藏的 仓库编码 列补参照
UPDATE yj_field SET ref_field = N'仓库名称', display_field = N'仓库名称'
WHERE panel_code = 'PURCHASE_IN' AND label = N'仓库' AND data_type = N'参照'
  AND (ISNULL(ref_field, '') <> N'仓库名称' OR ISNULL(display_field, '') <> N'仓库名称');
UPDATE yj_field SET data_type = N'参照', ref_panel = 'WH', ref_field = N'仓库编码', display_field = N'仓库名称'
WHERE panel_code = 'PURCHASE_IN' AND label = N'仓库编码' AND (ISNULL(ref_panel, '') <> 'WH' OR data_type <> N'参照');
GO

-- ══ 6) 销售订单 SO_ORDER ══
-- 客户:ref=dm(编码)→ mc(库里存客户名称,实测 32/32 命中 mc、0 命中 dm)
UPDATE yj_field SET ref_field = 'mc', display_field = 'mc'
WHERE panel_code = 'SO_ORDER' AND label = N'客户' AND data_type = N'参照' AND ISNULL(ref_field, '') <> 'mc';
-- 客户编码(编码列,库里 A-32…命中 32/32)、结算客户(库里存编码)→ 客户档案;部门/业务员/币种 硬编码下拉 → 档案
UPDATE yj_field SET data_type = N'参照', ref_panel = 'KHDA', ref_field = 'dm', display_field = 'mc', dict_sql = NULL
WHERE panel_code = 'SO_ORDER' AND label IN (N'客户编码', N'结算客户') AND (ISNULL(ref_panel, '') <> 'KHDA' OR ref_field <> 'dm' OR data_type <> N'参照');
UPDATE yj_field SET data_type = N'参照', ref_panel = 'DEPT', ref_field = N'部门名称', display_field = N'部门名称', dict_sql = NULL
WHERE panel_code = 'SO_ORDER' AND label = N'部门' AND (ISNULL(ref_panel, '') <> 'DEPT' OR data_type <> N'参照');
UPDATE yj_field SET data_type = N'参照', ref_panel = 'EMP', ref_field = N'员工名称', display_field = N'员工名称', dict_sql = NULL
WHERE panel_code = 'SO_ORDER' AND label = N'业务员' AND (ISNULL(ref_panel, '') <> 'EMP' OR data_type <> N'参照');
GO

-- ══ 7) 销售出库单 SALE_OUT ══
-- 客户:ref=dm → mc(库里存客户名称);结算客户(金蝶同源字段,存编码)→ dm;仓库列存名称 → ref 仓库名称
UPDATE yj_field SET ref_field = 'mc', display_field = 'mc'
WHERE panel_code = 'SALE_OUT' AND label = N'客户' AND data_type = N'参照' AND ISNULL(ref_field, '') <> 'mc';
UPDATE yj_field SET data_type = N'参照', ref_panel = 'KHDA', ref_field = 'dm', display_field = 'mc', dict_sql = NULL
WHERE panel_code = 'SALE_OUT' AND label = N'结算客户' AND (ISNULL(ref_panel, '') <> 'KHDA' OR ref_field <> 'dm');
UPDATE yj_field SET ref_field = N'仓库名称', display_field = N'仓库名称'
WHERE panel_code = 'SALE_OUT' AND label = N'仓库' AND data_type = N'参照'
  AND (ISNULL(ref_field, '') <> N'仓库名称' OR ISNULL(display_field, '') <> N'仓库名称');
GO

-- ══ 自检:七面板基础资料类字段应全部为「参照」且指向正确档案 ══
SELECT panel_code, label, data_type, ref_panel, ref_field, display_field, place, hidden
FROM yj_field
WHERE panel_code IN ('PU_ORDER','SL_RECV','QC_RETURN','QC_INSP','PURCHASE_IN','SO_ORDER','SALE_OUT')
  AND label IN (N'供应商',N'供应商代码',N'供应商编码',N'客户',N'客户编码',N'结算客户',N'仓库',N'仓库编码',
                N'物料编码',N'物料名称',N'存货编码',N'存货名称',N'部门',N'部门编码',N'业务员',N'经手人',N'检验员',
                N'币种',N'计量单位',N'单位',N'暂收单号')
  AND seq < 900
ORDER BY panel_code, seq, label;
GO

-- 断言:以下任一"应为参照却仍非参照"的行数必须为 0
SELECT COUNT(*) AS 仍非参照行数
FROM yj_field
WHERE ((panel_code='PU_ORDER' AND label IN (N'币种',N'供应商编码'))
   OR (panel_code='SL_RECV' AND label IN (N'业务员',N'供应商代码',N'供应商',N'计量单位'))
   OR (panel_code='QC_RETURN' AND label IN (N'供应商',N'经手人',N'物料名称',N'计量单位',N'单位'))
   OR (panel_code='QC_INSP' AND label IN (N'供应商',N'检验员',N'物料名称',N'计量单位',N'单位',N'部门'))
   OR (panel_code='PURCHASE_IN' AND label IN (N'部门',N'部门编码',N'仓库编码'))
   OR (panel_code='SO_ORDER' AND label IN (N'客户',N'客户编码',N'结算客户',N'部门',N'业务员'))
   OR (panel_code='SALE_OUT' AND label IN (N'客户',N'结算客户',N'仓库')))
  AND data_type <> N'参照';
GO
PRINT N'migrate-query-ref-links 完成';
GO
