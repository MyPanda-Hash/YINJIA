SET NOCOUNT ON;
PRINT '=== RD_PROD_INFO header fields ===';
SELECT seq, col_name, label, alias, data_type, ref_panel, ref_field,
       LEFT(ISNULL(dict_sql,''), 80) AS dict_sql, place, hidden, editable
FROM yj_field WHERE panel_code='RD_PROD_INFO' AND place LIKE '%header%'
ORDER BY seq, id;

PRINT '=== RD_MOLD_PROC 配料要求 in yj_field? ===';
SELECT COUNT(*) AS cnt FROM yj_field WHERE panel_code='RD_MOLD_PROC' AND col_name LIKE N'%配料%';

PRINT '=== mold.* lib counts ===';
SELECT lib_code, COUNT(*) AS n FROM yj_std_lib WHERE asp_cancel='N' AND enabled=1 GROUP BY lib_code ORDER BY lib_code;

PRINT '=== 标准库 field list ===';
SELECT panel_code, col_name, label, LEFT(dict_sql,40) AS lib FROM yj_field
WHERE data_type=N'标准库' ORDER BY panel_code, seq;

PRINT '=== rd_mold_proc_head columns with 配料 ===';
SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('rd_mold_proc_head') AND name LIKE N'%配料%';

PRINT '=== RD_PROD_INFO 产品管控等级/产品形态 dict ===';
SELECT col_name, label, alias, LEFT(ISNULL(dict_sql,''),120) AS dict_sql
FROM yj_field WHERE panel_code='RD_PROD_INFO' AND (col_name LIKE N'%管控%' OR col_name LIKE N'%形态%' OR col_name LIKE N'%功能类别%');
