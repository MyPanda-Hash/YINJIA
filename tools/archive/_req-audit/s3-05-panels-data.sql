SET NOCOUNT ON;
GO
SELECT N'=== A. bs_dict 字典类别 全集 ===' AS hdr;
GO
SELECT [字典类别] AS dict_type, COUNT(*) AS cnt FROM bs_dict GROUP BY [字典类别] ORDER BY dict_type;
GO
SELECT N'=== A2. bs_dict 含级/等级/定级 的字典行 ===' AS hdr;
GO
SELECT * FROM bs_dict WHERE [字典类别] LIKE N'%级%' OR [名称] LIKE N'%级%' OR [字典类别] LIKE N'%定级%';
GO
SELECT N'=== B. RD_* 业务表行数(测试记录是否真有数据) ===' AS hdr;
GO
SELECT N'rd_plan' AS t, COUNT(*) AS c FROM rd_plan
UNION ALL SELECT N'rd_progress', COUNT(*) FROM rd_progress
UNION ALL SELECT N'rd_approval', COUNT(*) FROM rd_approval
UNION ALL SELECT N'rd_dom_test_head', COUNT(*) FROM rd_dom_test_head
UNION ALL SELECT N'rd_alkaline_head', COUNT(*) FROM rd_alkaline_head
UNION ALL SELECT N'rd_antibact_head', COUNT(*) FROM rd_antibact_head
UNION ALL SELECT N'rd_mineral_head', COUNT(*) FROM rd_mineral_head
UNION ALL SELECT N'rd_scale_head', COUNT(*) FROM rd_scale_head
UNION ALL SELECT N'rd_soak_head', COUNT(*) FROM rd_soak_head
UNION ALL SELECT N'rd_drop_prec_head', COUNT(*) FROM rd_drop_prec_head
UNION ALL SELECT N'rd_filter_eff_head', COUNT(*) FROM rd_filter_eff_head
UNION ALL SELECT N'rd_ro_protect_head', COUNT(*) FROM rd_ro_protect_head
UNION ALL SELECT N'rd_spike_water_head', COUNT(*) FROM rd_spike_water_head
UNION ALL SELECT N'rd_equip_use_head', COUNT(*) FROM rd_equip_use_head
UNION ALL SELECT N'rd_instr_use_head', COUNT(*) FROM rd_instr_use_head
UNION ALL SELECT N'rd_prod_info_head', COUNT(*) FROM rd_prod_info_head
UNION ALL SELECT N'rd_spec_doc_head', COUNT(*) FROM rd_spec_doc_head
UNION ALL SELECT N'rd_mold_proc_head', COUNT(*) FROM rd_mold_proc_head
UNION ALL SELECT N'rd_asm_proc_head', COUNT(*) FROM rd_asm_proc_head
UNION ALL SELECT N'rd_insp_plan_head', COUNT(*) FROM rd_insp_plan_head;
GO
SELECT N'=== C. yj_panel 中 RD_* 的 config 全文 ===' AS hdr;
GO
SELECT panel_code, config FROM yj_panel WHERE panel_code LIKE 'RD%' ORDER BY panel_code;
GO
SELECT N'=== D. RD_PROGRESS 真实业务表列(rd_progress) ===' AS hdr;
GO
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH AS len
FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='rd_progress' ORDER BY ORDINAL_POSITION;
GO
SELECT N'=== D2. RD_PROGRESS 数据行 ===' AS hdr;
GO
SELECT * FROM rd_progress;
GO
SELECT N'=== D3. rd_progress_detail 列 ===' AS hdr;
GO
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='rd_progress_detail' ORDER BY ORDINAL_POSITION;
GO
SELECT N'=== E. rd_plan 真实列 ===' AS hdr;
GO
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH AS len
FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='rd_plan' ORDER BY ORDINAL_POSITION;
GO
SELECT N'=== E2. rd_plan 数据(含项目定级取值) ===' AS hdr;
GO
SELECT * FROM rd_plan;
GO
