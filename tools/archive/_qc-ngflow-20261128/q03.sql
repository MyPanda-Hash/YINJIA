SELECT label, col_name, data_type, dict_sql, place, seq, visible, hidden
FROM yj_field WHERE panel_code = N'QC_TC_IN' AND label IN (N'最终处理结果', N'严重程度', N'不合格品比例', N'不合格品数量')
ORDER BY seq;
GO
SELECT TOP 40 * FROM yj_std_lib WHERE item_code LIKE N'qc%' ORDER BY item_code;
GO
SELECT panel_code, label, data_type, dict_sql, place FROM yj_field WHERE panel_code = N'PURCHASE_IN' AND label = N'特采';
GO
SELECT * FROM yj_translation WHERE scope = N'panel' AND ref_key IN (N'特采单', N'不合格品处理单（来料）');
