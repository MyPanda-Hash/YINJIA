-- migrate-rd-panel-register.sql — 研发管理面板主行补注册(yj_panel)
-- 背景:RD 系列 脚本对 yj_panel 只有 UPDATE 无 INSERT(远程库行早已存在,本地库从未生成),
--       导致 PanelRegistry 报「面板不存在」、前端「页面不存在」。字段行(yj_field)已由各脚本补齐,
--       本脚本只补 yj_panel 主行;panel_name_en 从 yj_translation(scope='panel')现取,缺省为 NULL。
-- 幂等:IF NOT EXISTS 判断,可反复执行。
-- ═════════════ 数据记录表(7) ═════════════
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_FILTER_EFF')
INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
SELECT 'RD_FILTER_EFF', N'功能性滤效', (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'功能性滤效' AND locale='en'), N'单据', 'doc', N'rd_filter_eff_detail', N'rd_filter_eff_head', N'单据编号', N'id', N'单据编号', N'FE', N'单据日期', 20, 'items', N'研发管理'
WHERE NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_FILTER_EFF');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_ALKALINE')
INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
SELECT 'RD_ALKALINE', N'碱性', (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'碱性' AND locale='en'), N'单据', 'doc', N'rd_alkaline_detail', N'rd_alkaline_head', N'单据编号', N'id', N'单据编号', N'PH', N'单据日期', 20, 'items', N'研发管理'
WHERE NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_ALKALINE');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_MINERAL')
INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
SELECT 'RD_MINERAL', N'矿化', (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'矿化' AND locale='en'), N'单据', 'doc', N'rd_mineral_detail', N'rd_mineral_head', N'单据编号', N'id', N'单据编号', N'MI', N'单据日期', 20, 'items', N'研发管理'
WHERE NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_MINERAL');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_ANTIBACT')
INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
SELECT 'RD_ANTIBACT', N'抑菌', (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'抑菌' AND locale='en'), N'单据', 'doc', N'rd_antibact_detail', N'rd_antibact_head', N'单据编号', N'id', N'单据编号', N'AB', N'单据日期', 20, 'items', N'研发管理'
WHERE NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_ANTIBACT');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_SCALE')
INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
SELECT 'RD_SCALE', N'阻垢性能', (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'阻垢性能' AND locale='en'), N'单据', 'doc', N'rd_scale_detail', N'rd_scale_head', N'单据编号', N'id', N'单据编号', N'SC', N'单据日期', 20, 'items', N'研发管理'
WHERE NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_SCALE');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_RO_PROTECT')
INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
SELECT 'RD_RO_PROTECT', N'RO保护', (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'RO保护' AND locale='en'), N'单据', 'doc', N'rd_ro_protect_detail', N'rd_ro_protect_head', N'单据编号', N'id', N'单据编号', N'RO', N'单据日期', 20, 'items', N'研发管理'
WHERE NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_RO_PROTECT');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_SOAK')
INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
SELECT 'RD_SOAK', N'浸泡安全', (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'浸泡安全' AND locale='en'), N'单据', 'doc', N'rd_soak_detail', N'rd_soak_head', N'单据编号', N'id', N'单据编号', N'SK', N'单据日期', 20, 'items', N'研发管理'
WHERE NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_SOAK');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_DROP_PREC')
INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
SELECT 'RD_DROP_PREC', N'压降、精度', (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'压降、精度' AND locale='en'), N'单据', 'doc', N'rd_drop_prec_detail', N'rd_drop_prec_head', N'单据编号', N'id', N'单据编号', N'DP', N'单据日期', 20, 'items', N'研发管理'
WHERE NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_DROP_PREC');
-- ═════════════ 实验室使用记录表(4) ═════════════
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_SPIKE_WATER')
INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
SELECT 'RD_SPIKE_WATER', N'加标水配置记录表', (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'加标水配置记录表' AND locale='en'), N'单据', 'doc', N'rd_spike_water_detail', N'rd_spike_water_head', N'单据编号', N'id', N'单据编号', N'SW', N'单据日期', 20, 'items', N'研发管理'
WHERE NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_SPIKE_WATER');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_DOM_TEST')
INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
SELECT 'RD_DOM_TEST', N'内部委托测试申请单', (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'内部委托测试申请单' AND locale='en'), N'单据', 'doc', N'rd_dom_test_detail', N'rd_dom_test_head', N'单据编号', N'id', N'单据编号', N'DT', N'单据日期', 20, 'items', N'研发管理'
WHERE NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_DOM_TEST');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_EQUIP_USE')
INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
SELECT 'RD_EQUIP_USE', N'设备使用登记表', (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'设备使用登记表' AND locale='en'), N'单据', 'doc', N'rd_equip_use_detail', N'rd_equip_use_head', N'单据编号', N'id', N'单据编号', N'EU', N'单据日期', 20, 'items', N'研发管理'
WHERE NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_EQUIP_USE');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_INSTR_USE')
INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
SELECT 'RD_INSTR_USE', N'仪器使用记录表', (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'仪器使用记录表' AND locale='en'), N'单据', 'doc', N'rd_instr_use_detail', N'rd_instr_use_head', N'单据编号', N'id', N'单据编号', N'IU', N'单据日期', 20, 'items', N'研发管理'
WHERE NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_INSTR_USE');
-- ═════════════ 产品文件(6+1) ═════════════
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_MOLD_PROC')
INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
SELECT 'RD_MOLD_PROC', N'成型工艺清单', (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'成型工艺清单' AND locale='en'), N'单据', 'doc', N'rd_mold_proc_detail', N'rd_mold_proc_head', N'单据编号', N'id', N'单据编号', N'MP', N'单据日期', 20, 'items', N'研发管理'
WHERE NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_MOLD_PROC');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_MOLD_FORMULA')
INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
SELECT 'RD_MOLD_FORMULA', N'成型配方', (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'成型配方' AND locale='en'), N'单据', 'doc', N'rd_mold_formula_detail', N'rd_mold_formula_head', N'单据编号', N'id', N'单据编号', N'MF', N'单据日期', 20, 'items', N'研发管理'
WHERE NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_MOLD_FORMULA');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_ASM_BOM')
INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
SELECT 'RD_ASM_BOM', N'组装BOM表', (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'组装BOM表' AND locale='en'), N'单据', 'doc', N'rd_asm_bom_detail', N'rd_asm_bom_head', N'单据编号', N'id', N'单据编号', N'AB2', N'单据日期', 20, 'items', N'研发管理'
WHERE NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_ASM_BOM');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_ASM_PROC')
INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
SELECT 'RD_ASM_PROC', N'组装工艺清单', (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'组装工艺清单' AND locale='en'), N'单据', 'doc', N'rd_asm_proc_detail', N'rd_asm_proc_head', N'单据编号', N'id', N'单据编号', N'AP', N'单据日期', 20, 'items', N'研发管理'
WHERE NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_ASM_PROC');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_SPEC_DOC')
INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
SELECT 'RD_SPEC_DOC', N'规格书', (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'规格书' AND locale='en'), N'单据', 'doc', N'rd_spec_doc_detail', N'rd_spec_doc_head', N'单据编号', N'id', N'单据编号', N'SD', N'单据日期', 20, 'items', N'研发管理'
WHERE NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_SPEC_DOC');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_INSP_PLAN')
INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
SELECT 'RD_INSP_PLAN', N'出货检验计划表', (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'出货检验计划表' AND locale='en'), N'单据', 'doc', N'rd_insp_plan_detail', N'rd_insp_plan_head', N'单据编号', N'id', N'单据编号', N'IP', N'单据日期', 20, 'items', N'研发管理'
WHERE NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_INSP_PLAN');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_PROD_INFO')
INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group)
SELECT 'RD_PROD_INFO', N'产品信息表', (SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'产品信息表' AND locale='en'), N'单据', 'doc', N'rd_prod_info_detail', N'rd_prod_info_head', N'单据编号', N'id', N'单据编号', N'PI', N'单据日期', 20, 'items', N'研发管理'
WHERE NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_PROD_INFO');

PRINT N'研发管理面板主行补注册完成';
GO
