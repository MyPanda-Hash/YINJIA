/* 删 QC_TC 后的终态核对(只读):
   ① 表已不存在 ② 号池无 TC 残留 ③ 共用面板译名仍在 ④ 保留的 QC_TC_IN 面板未受影响。 */
SET NOCOUNT ON;
SELECT
  OBJECT_ID('qc_tc')        AS qc_tc表应NULL,
  OBJECT_ID('qc_tc_detail') AS qc_tc_detail表应NULL,
  (SELECT COUNT(*) FROM s_allno WHERE lb = 'TC')                                        AS 号池TC行应0,
  (SELECT COUNT(*) FROM yj_translation WHERE scope='panel' AND ref_key=N'特采申请单')    AS 共用译名应1,
  (SELECT COUNT(*) FROM yj_panel WHERE panel_code = 'QC_TC_IN')                          AS QC_TC_IN面板应1,
  (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'QC_TC_IN')                          AS QC_TC_IN字段应23,
  (SELECT COUNT(*) FROM yj_panel WHERE panel_name = N'特采申请单')                        AS 名为特采申请单的面板应0;

-- 保留面板的英文名仍取自那条共用译名(不应为 NULL)
SELECT p.panel_code, p.panel_name, p.panel_name_en, p.prefix, p.head_table, p.line_table
FROM yj_panel p WHERE p.panel_code = 'QC_TC_IN';

-- 质量单据组现在应只剩七个 QC_* 面板(QC_BHG/BHC/BHZ/JJF/SCP/LYB/SCY)
SELECT panel_code, panel_name FROM yj_panel
WHERE module_group = N'品质管理' ORDER BY panel_code;
