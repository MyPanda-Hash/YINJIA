-- ============================================================================
-- 存货/仓库字段统一转「参照弹窗」(2026-09-01):
--   病根:部分面板的 存货名称/材料名称/存货编码/仓库 字段被定义为 下拉框(静态 VALUES)或 文本,
--   明细单元格因此渲染成 el-select 死选项,且没有 refMap 带回(计量单位/存货名称/规格型号 漏填)。
--   转为 参照 INV/WH 后:单元格点击/双击弹参照弹窗(既有机制),带回同名字段+同义词
--   (存货编码→材料/产品/物料编码, 计量单位→单位/采购/销售/生产单位, 参考成本→单价)。
--   表头字段转参照后按双模渲染(≤20 下拉搜索 / >20 弹窗)——用户约定:双模仅表头。
-- 全部幂等,可重复执行。
-- ============================================================================
USE HSDZ_MES;
SET NOCOUNT ON;

-- ===== A. 明细/表头的 存货类字段:下拉框/文本 → 参照 INV =====
-- 存货名称 → 参照(存货名称):回填 存货编码/规格型号/计量单位系
UPDATE yj_field SET data_type = N'参照', ref_panel = 'INV', ref_field = N'存货名称', display_field = N'存货名称', dict_sql = NULL
WHERE panel_code IN ('PURCHASE_IN', 'OTHER_IN', 'OTHER_OUT') AND label = N'存货名称' AND data_type <> N'参照';
-- 材料名称(材料出库) → 参照:回填 材料编码(同义词)/规格型号/计量单位
UPDATE yj_field SET data_type = N'参照', ref_panel = 'INV', ref_field = N'存货名称', display_field = N'存货名称', dict_sql = NULL
WHERE panel_code = 'MATERIAL_OUT' AND label = N'材料名称' AND data_type <> N'参照';
-- 存货编码(销售订单明细,原静态下拉) → 参照(存货编码,显示存货名称)
UPDATE yj_field SET data_type = N'参照', ref_panel = 'INV', ref_field = N'存货编码', display_field = N'存货名称', dict_sql = NULL
WHERE panel_code = 'SO_ORDER' AND label = N'存货编码' AND data_type <> N'参照';
-- 产品名称(生产加工单明细/派工表头,原文手填) → 参照:回填 产品编码/规格型号/生产单位
UPDATE yj_field SET data_type = N'参照', ref_panel = 'INV', ref_field = N'存货名称', display_field = N'存货名称', dict_sql = NULL
WHERE panel_code IN ('MANU_ORDER', 'DISPATCH') AND label = N'产品名称' AND data_type <> N'参照';

-- ===== B. 仓库:下拉框 → 参照 WH(其他出库的行仓库;其余面板已是参照) =====
UPDATE yj_field SET data_type = N'参照', ref_panel = 'WH', ref_field = N'仓库名称', display_field = N'仓库名称', dict_sql = NULL
WHERE label = N'仓库' AND data_type = N'下拉框';

-- ===== C. 校验:目标面板不应再有 存货/仓库 类下拉框 =====
SELECT panel_code, place, label, data_type, ref_panel FROM yj_field
WHERE panel_code IN ('SO_ORDER','PU_REQ','PU_ORDER','PURCHASE_IN','FINISH_IN','OTHER_IN','OUTSOURCE_IN',
                     'SALE_OUT','MATERIAL_OUT','OTHER_OUT','OUTSOURCE_ISSUE','OUTSOURCE_ORDER','MANU_ORDER','DISPATCH')
  AND (label IN (N'存货名称', N'材料名称', N'产品名称', N'存货编码', N'仓库'))
  AND data_type <> N'参照';

PRINT N'ref-dialog 迁移完成';
