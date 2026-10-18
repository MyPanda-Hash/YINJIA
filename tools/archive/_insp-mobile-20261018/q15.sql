SET NOCOUNT ON;
PRINT '--- first insp detail (SJ-0063) ---';
SELECT TOP 8 单据编号, 行号, 行类型, 样品序号, 检验列, 标准, 项目分组, 检验项目 FROM dbo.qc_first_insp_detail WHERE 单据编号=N'SJ-2026-10-0063' ORDER BY id;
GO
PRINT '--- asm insp detail (ZJ-0017) ---';
SELECT TOP 10 单据编号, 行号, 检验类型, 检验项目, 检验要求, 检验方法, 检查频率 FROM dbo.qc_asm_insp_detail WHERE 单据编号=N'ZJ-2026-10-0017' ORDER BY id;
GO
PRINT '--- flow links ---';
SELECT source_panel_code, source_form_no, source_line_key, target_panel_code, target_form_no, link_status FROM dbo.form_flow_link WHERE create_time >= '2026-10-18' ORDER BY id DESC;
GO
