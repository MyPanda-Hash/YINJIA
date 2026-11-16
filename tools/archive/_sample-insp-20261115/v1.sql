SELECT 'panel' AS k, panel_code, panel_name, mode, line_table, head_table, prefix, detail_key FROM yj_panel WHERE panel_code IN (N'SAMPLE_REG', N'INSP_COMMISSION');
SELECT 'fields' AS k, panel_code, place, COUNT(*) AS n FROM yj_field WHERE panel_code IN (N'SAMPLE_REG', N'INSP_COMMISSION') GROUP BY panel_code, place;
SELECT 'seed' AS k, COUNT(*) AS n, MIN(序号) AS mn, MAX(序号) AS mx, SUM(CASE WHEN 收费 IS NULL THEN 1 ELSE 0 END) AS fee_null FROM qc_sample_reg;
SELECT 'roles' AS k, panel_code, COUNT(*) AS n, SUM(CASE WHEN can_approve=N'Y' THEN 1 ELSE 0 END) AS approvers FROM yj_role_panel WHERE panel_code IN (N'SAMPLE_REG', N'INSP_COMMISSION') GROUP BY panel_code;
SELECT 'trans' AS k, scope, ref_key, text FROM yj_translation WHERE (scope=N'panel' AND ref_key IN (N'送样登记表', N'检验委托单')) OR (scope=N'field' AND ref_key IN (N'检验类别', N'收费（一个样/元）', N'联系电话（手机）', N'样品型号/规格')) ORDER BY scope, ref_key;
SELECT 'catalog-sample' AS k, 序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注 FROM qc_sample_reg ORDER BY id;
