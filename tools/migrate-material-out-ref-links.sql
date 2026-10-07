-- migrate-material-out-ref-links.sql — 材料出库单(MATERIAL_OUT)字段关联基础资料(参照)
-- ═════════════════════════════════════════════════════════════════════════════════
-- 用户口径:「把这个表格的字段关联做好」。
-- 沿项目既有口径 —— 2026-09-20 的 migrate-query-ref-links.sql
-- (「七单据查询弹窗字段关联基础资料」:采购订单/送料暂收单/暂收退回单/来料检验单/采购入库单/
--  销售订单/销售出库单),**材料出库单正是当时漏掉的那一张**,且本次刚补进来的接口字段
--  (部门编码/经手人编码/仓库编码)同为文本无关联 ⇒ 本次按同款口径补齐。
--
-- 改前实测(HSDZ_MES,2026-09-28):
--   ① 明细「计量单位」是**硬编码下拉**(只有 件/kg/套/升),而真实单位是 个/支/张/PCS/卷/条…
--      → 界面选不出真实单位,单位落不了规范值;转ERP 要按名称到金蝶单位档案换 unit_id,直接受影响。
--   ② 表头「生产车间」是**硬编码下拉**(熔铸/轧制/精整/测试车间),与部门档案不符 → 转ERP 推 dept_number
--      (按 生产车间 查 bs_dept 换编码)会解析不到。
--   ③ 本次新加的 部门编码 / 经手人编码 / 仓库编码 / 单位编码 / 基本单位编码·名称 全是文本,无关联。
--   ④ 已关联好的(不动):仓库→WH.仓库名称、领用人→EMP.员工名称、材料编码→INV.存货编码、
--      材料名称→INV.存货名称、项目→PROJ。
--
-- 档案命中率实测(改参照的前置条件,不命中就成了"选不出来"):
--   · 计量单位:bs_uom 有 个/支/支（成型前）/kg/件/套/张/PCS/卷/条/g/盒/份/米/桶/升/只/片/瓶…
--     —— 商品档案在用单位 **全部命中**;材料出库行 现有 kg/件 命中;采购入库行 11 种全命中。
--   · 生产车间:现有值 精整车间 命中 bs_dept(档案另有 烧结车间/原料车间/组装车间/X烧结车间/
--     材料自制车间/1号车间)。
--   · 仓库:材料出库行现用 原料仓/辅料仓 命中 bs_wh。
--
-- 口径(与 migrate-query-ref-links.sql 逐条一致):
--   「名称列」ref=名称列本身、display=名称列;「编码列」ref=编码列、display=名称列(存编码、按名称挑);
--   计量单位 ref=UOM.计量单位名称;部门 ref=DEPT.部门名称;职员 ref=EMP.员工名称;
--   改「参照」时清掉遗留硬编码 dict_sql,避免两套选项并存。
-- 幂等可重跑(先判后改);末尾断言「应为参照却仍非参照」的行数必须为 0。
SET NOCOUNT ON;
GO

-- ══ 1) 明细位 ══
-- 计量单位:硬编码下拉(件/kg/套/升)→ 计量单位档案(真实单位 个/支/张/PCS 等都在档案里)
UPDATE yj_field SET data_type = N'参照', ref_panel = 'UOM', ref_field = N'计量单位名称',
       display_field = N'计量单位名称', dict_sql = NULL
WHERE panel_code = 'MATERIAL_OUT' AND col_name = N'计量单位'
  AND (data_type <> N'参照' OR ISNULL(ref_panel,'') <> 'UOM' OR ISNULL(ref_field,'') <> N'计量单位名称');

-- 仓库编码:文本 → 仓库档案编码列(存编码、按仓库名称挑)——与 PURCHASE_IN.仓库编码 同款
UPDATE yj_field SET data_type = N'参照', ref_panel = 'WH', ref_field = N'仓库编码', display_field = N'仓库名称'
WHERE panel_code = 'MATERIAL_OUT' AND col_name = N'仓库编码'
  AND (data_type <> N'参照' OR ISNULL(ref_panel,'') <> 'WH' OR ISNULL(ref_field,'') <> N'仓库编码');

-- 材料编码:编码入口选中后显示存货名称(与七单据「物料编码」同款;库内存编码,列表看名称更直观)
UPDATE yj_field SET display_field = N'存货名称'
WHERE panel_code = 'MATERIAL_OUT' AND col_name = N'材料编码' AND data_type = N'参照'
  AND ISNULL(display_field,'') <> N'存货名称';
GO

-- ══ 2) 表头/查询位 ══
-- 生产车间:硬编码下拉(熔铸/轧制/精整/测试车间)→ 部门档案(转ERP 按它换 dept_number)
UPDATE yj_field SET data_type = N'参照', ref_panel = 'DEPT', ref_field = N'部门名称',
       display_field = N'部门名称', dict_sql = NULL
WHERE panel_code = 'MATERIAL_OUT' AND col_name = N'生产车间'
  AND (data_type <> N'参照' OR ISNULL(ref_panel,'') <> 'DEPT');

-- 部门编码(本次新加):文本 → 部门档案编码列
UPDATE yj_field SET data_type = N'参照', ref_panel = 'DEPT', ref_field = N'部门编码', display_field = N'部门名称'
WHERE panel_code = 'MATERIAL_OUT' AND col_name = N'部门编码'
  AND (data_type <> N'参照' OR ISNULL(ref_panel,'') <> 'DEPT');

-- 经手人编码(本次新加):文本 → 职员档案编码列(转ERP 推 emp_number)
UPDATE yj_field SET data_type = N'参照', ref_panel = 'EMP', ref_field = N'员工编码', display_field = N'员工名称'
WHERE panel_code = 'MATERIAL_OUT' AND col_name = N'经手人编码'
  AND (data_type <> N'参照' OR ISNULL(ref_panel,'') <> 'EMP');
GO

-- ══ 3) 自检 ══
-- 3.1 断言:应为参照却仍非参照的行数必须为 0
DECLARE @bad int = (
  SELECT COUNT(*) FROM yj_field
  WHERE panel_code = 'MATERIAL_OUT'
    AND col_name IN (N'计量单位', N'仓库编码', N'生产车间', N'部门编码', N'经手人编码')
    AND data_type <> N'参照'
);
IF @bad <> 0 RAISERROR(N'[matout-ref] 自检失败:%d 个字段仍非参照(应 0)', 16, 1, @bad);

-- 3.2 断言:指向的档案必须正确(改错档案比不改更糟)
DECLARE @wrong int = (
  SELECT COUNT(*) FROM yj_field
  WHERE panel_code = 'MATERIAL_OUT'
    AND ((col_name = N'计量单位' AND ISNULL(ref_panel,'') <> 'UOM')
      OR (col_name IN (N'仓库编码') AND ISNULL(ref_panel,'') <> 'WH')
      OR (col_name IN (N'生产车间', N'部门编码') AND ISNULL(ref_panel,'') <> 'DEPT')
      OR (col_name = N'经手人编码' AND ISNULL(ref_panel,'') <> 'EMP'))
);
IF @wrong <> 0 RAISERROR(N'[matout-ref] 自检失败:%d 个字段指向了错误档案(应 0)', 16, 1, @wrong);

-- 3.3 断言:改参照后不应再留硬编码 dict_sql(两套选项并存的旧坑)
DECLARE @dict int = (
  SELECT COUNT(*) FROM yj_field
  WHERE panel_code = 'MATERIAL_OUT' AND col_name IN (N'计量单位', N'生产车间')
    AND ISNULL(dict_sql, N'') <> N''
);
IF @dict <> 0 RAISERROR(N'[matout-ref] 自检失败:%d 个参照字段仍挂着硬编码 dict_sql(应 0)', 16, 1, @dict);

IF @bad = 0 AND @wrong = 0 AND @dict = 0
  PRINT N'[matout-ref] 自检通过:材料出库单 5 个字段已关联基础资料(计量单位→UOM/仓库编码→WH/生产车间·部门编码→DEPT/经手人编码→EMP)';
GO

-- 3.4 报告:材料出库单全部「参照」字段一览(含本来就好的)
SELECT col_name, label, place, seq, ref_panel, ref_field, display_field, hidden
FROM yj_field
WHERE panel_code = 'MATERIAL_OUT' AND data_type = N'参照'
ORDER BY place, seq;
GO
