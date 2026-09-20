-- _q_pi_five.sql — 采购入库单五个候选字段在 MES 库中的现状(面板注册/物理列)
SET NOCOUNT ON;
PRINT '── 1) yj_field:名字含 订单/行号/客户/来料检验 且属采购链面板 ──';
SELECT panel_code, col_name, data_type, ref_panel, place, seq, editable, hidden, visible
FROM yj_field
WHERE panel_code IN ('PURCHASE_IN','PU_ORDER','SL_RECV','QC_INSP')
  AND (col_name LIKE N'%订单%' OR col_name LIKE N'%行号%' OR col_name LIKE N'%客户%' OR col_name LIKE N'%来料检验%' OR col_name LIKE N'%源单%')
ORDER BY panel_code, place, seq;
GO

PRINT '── 2) 采购入库头/行物理列:含 订单/行号/客户/检验 ──';
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('bd_purchase_in','bl_purchase_in')
  AND (COLUMN_NAME LIKE N'%订单%' OR COLUMN_NAME LIKE N'%行号%' OR COLUMN_NAME LIKE N'%客户%'
       OR COLUMN_NAME LIKE N'%检验%' OR COLUMN_NAME LIKE N'%源单%')
ORDER BY TABLE_NAME, COLUMN_NAME;
GO

PRINT '── 3) 采购入库头行全列(bd/bl)──';
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('bd_purchase_in','bl_purchase_in') ORDER BY TABLE_NAME, ORDINAL_POSITION;
GO

PRINT '── 4) 采购订单行表 bl_pu_order 里 订单基本数量类列(对照金蝶 pur_order) ──';
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('bl_pu_order','bd_pu_order')
  AND (COLUMN_NAME LIKE N'%基本%' OR COLUMN_NAME LIKE N'%行号%' OR COLUMN_NAME LIKE N'%客户%' OR COLUMN_NAME LIKE N'%源单%')
ORDER BY TABLE_NAME, COLUMN_NAME;
GO
