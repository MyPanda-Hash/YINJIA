SET NOCOUNT ON;
PRINT '=== RD_INSP_PLAN 参照字段的引用目标 ===';
SELECT seq, label, col_name, ref_panel, ref_field, display_field FROM yj_field
WHERE panel_code = N'RD_INSP_PLAN' AND data_type = N'参照' ORDER BY seq;

PRINT '=== §2.5 产品信息表(RD_PROD_INFO)是否也新建了 客户项目名称 ===';
SELECT seq, label, col_name, data_type, place, ref_panel, alias FROM yj_field
WHERE panel_code = N'RD_PROD_INFO' AND (label LIKE N'%客户%' OR col_name LIKE N'%客户%' OR label = N'产品功能类别')
ORDER BY place, seq;

PRINT '=== RD_PROD_INFO 的 产品类别 类字段(自动填充的取值源) ===';
SELECT seq, label, col_name, data_type, dict_sql FROM yj_field
WHERE panel_code = N'RD_PROD_INFO' AND (label LIKE N'%类别%' OR label LIKE N'%产品名称%') ORDER BY seq;
