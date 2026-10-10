SET NOCOUNT ON;
-- ============================================================================
-- _q-3out-rail-1015.sql — 三出库面板左栏「单据选择」中间列选型的取证 SQL
--   任务:为 成品(FINISH_IN)/销售(SALE_OUT)/材料(MATERIAL_OUT)出库单
--         配置与销售订单(SO_ORDER)一样的左侧「单据选择」列
--   口径:左栏中间列写在**前端** PanelxList.vue 的 DOC_RAIL_PANELS(不是 yj_field 的 place),
--         本脚本只回答一个问题 —— 「该用哪个字段做中间列?」= 挑**实测有值**的字段
--         (空列等于没配,列名对齐但数据对不齐)。
--   两个账套都可跑(只读 SELECT,不写任何数据)。
-- ============================================================================

-- ① 候选中间列的有值率:三出库单 + 销售订单对照(挑 nz/total 最高且语义贴切者)
SELECT 'FINISH_IN' AS panel, N'加工单号' AS col, COUNT(*) AS total,
       SUM(CASE WHEN ISNULL(加工单号, N'') <> N'' THEN 1 ELSE 0 END) AS nz FROM bd_finish_in
UNION ALL SELECT 'FINISH_IN', N'生产车间', COUNT(*), SUM(CASE WHEN ISNULL(生产车间, N'') <> N'' THEN 1 ELSE 0 END) FROM bd_finish_in
UNION ALL SELECT 'FINISH_IN', N'业务类型', COUNT(*), SUM(CASE WHEN ISNULL(业务类型, N'') <> N'' THEN 1 ELSE 0 END) FROM bd_finish_in
UNION ALL SELECT 'MATERIAL_OUT', N'生产车间', COUNT(*), SUM(CASE WHEN ISNULL(生产车间, N'') <> N'' THEN 1 ELSE 0 END) FROM bd_material_out
UNION ALL SELECT 'MATERIAL_OUT', N'加工单号', COUNT(*), SUM(CASE WHEN ISNULL(加工单号, N'') <> N'' THEN 1 ELSE 0 END) FROM bd_material_out
UNION ALL SELECT 'SALE_OUT', N'客户', COUNT(*), SUM(CASE WHEN ISNULL(客户, N'') <> N'' THEN 1 ELSE 0 END) FROM bd_sale_out
UNION ALL SELECT 'SO_ORDER(基线)', N'客户', COUNT(*), SUM(CASE WHEN ISNULL(客户, N'') <> N'' THEN 1 ELSE 0 END) FROM bd_so_order
ORDER BY panel, nz DESC;

-- ② 三面板是否登记过「客户」字段(证明 SALE_OUT 之外两张单没有客户,只能按自身语义配)
SELECT panel_code, col_name, label, data_type, ref_panel, ref_field
FROM yj_field
WHERE panel_code IN ('FINISH_IN', 'SALE_OUT', 'MATERIAL_OUT')
  AND (label LIKE N'%客户%' OR label LIKE N'%生产车间%' OR label LIKE N'%加工单号%')
ORDER BY panel_code, seq;

-- ③ 中间列三个标签的多语言覆盖(AGENTS.md 强制:新 UI 功能必须有目标语言词条)
--    期望:加工单号/客户/生产车间 至少 en 有 manual 译名
SELECT ref_key, locale, text, source
FROM yj_translation
WHERE scope = 'field' AND ref_key IN (N'加工单号', N'客户', N'生产车间')
ORDER BY ref_key, locale;
