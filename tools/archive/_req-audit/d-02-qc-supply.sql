SET NOCOUNT ON;
-- d-02 品质/采购链全面板(核对 C4/C5/C6/C7/C8/C9/C10)
SELECT panel_code, panel_name, module_group, mode, head_table, line_table, prefix
FROM yj_panel
WHERE module_group LIKE N'%品质%' OR module_group LIKE N'%供应链%' OR module_group LIKE N'%仓库%'
   OR panel_code LIKE N'QC[_]%' OR panel_code LIKE N'SL[_]%' OR panel_code LIKE N'PR[_]%'
   OR panel_code IN (N'PU_ORDER',N'PURCHASE_IN',N'QC_RECV',N'QC_INSP',N'QC_RETURN',N'OTHER_IN',N'OTHER_OUT',N'INV')
ORDER BY module_group, panel_code;
GO
-- d-02b 检验结果类下拉字典现状(C7 要求 合格/不合格/特采)
SELECT panel_code, col_name, label, data_type, place, dict_sql
FROM yj_field
WHERE dict_sql LIKE N'%合格%' OR dict_sql LIKE N'%特采%' OR dict_sql LIKE N'%让步%'
ORDER BY panel_code, col_name;
GO
-- d-02c 相关表清单
SELECT name FROM sys.tables WHERE name LIKE N'%other%' OR name LIKE N'%pu_order%' OR name LIKE N'%purchase%' ORDER BY name;
GO
-- d-02c2 特采/让步类单据行数(C8)
SELECT N'qc_tc' AS 表, COUNT(*) AS 行数 FROM qc_tc
UNION ALL SELECT N'qc_tc_detail', COUNT(*) FROM qc_tc_detail
UNION ALL SELECT N'qc_jjf', COUNT(*) FROM qc_jjf
UNION ALL SELECT N'qc_recv(空壳表)', COUNT(*) FROM qc_recv
UNION ALL SELECT N'sl_recv', COUNT(*) FROM sl_recv
UNION ALL SELECT N'qc_insp', COUNT(*) FROM qc_insp
UNION ALL SELECT N'qc_return', COUNT(*) FROM qc_return
UNION ALL SELECT N'bd_purchase_in', COUNT(*) FROM bd_purchase_in
UNION ALL SELECT N'bd_other_in', COUNT(*) FROM bd_other_in
UNION ALL SELECT N'bd_other_out', COUNT(*) FROM bd_other_out
UNION ALL SELECT N'bd_pu_order', COUNT(*) FROM bd_pu_order;
GO
-- d-02d 采购单二维码/标签相关字段(C2/C10)
SELECT panel_code, col_name, label, data_type, place, dict_sql, ref_panel
FROM yj_field
WHERE label LIKE N'%条码%' OR label LIKE N'%二维码%' OR col_name LIKE N'%条码%' OR col_name LIKE N'%二维码%'
   OR label LIKE N'%单箱%' OR label LIKE N'%箱数%' OR label LIKE N'%标识卡%' OR label LIKE N'%标签%'
ORDER BY panel_code, seq;
GO
-- d-02e 打印规则(C9):报表模板与打印相关面板配置
SELECT id, username, dept_id, role_id, enabled, is_admin, locale FROM yj_user ORDER BY id;
GO
SELECT * FROM yj_report_template;
GO
