SET NOCOUNT ON;
GO
SELECT N'S1-10: yj_panel.config 含 受控/履历/文件编码/审核/状态流/control' AS sec,
       panel_code, panel_name,
       CASE WHEN config LIKE N'%受控%' THEN 1 ELSE 0 END AS c_受控,
       CASE WHEN config LIKE N'%履历%' THEN 1 ELSE 0 END AS c_履历,
       CASE WHEN config LIKE N'%文件编码%' THEN 1 ELSE 0 END AS c_文件编码,
       CASE WHEN config LIKE N'%审核%' THEN 1 ELSE 0 END AS c_审核,
       CASE WHEN config LIKE N'%control%' THEN 1 ELSE 0 END AS c_control,
       CASE WHEN config LIKE N'%approve%' THEN 1 ELSE 0 END AS c_approve,
       CASE WHEN config LIKE N'%stamp%' OR config LIKE N'%章%' THEN 1 ELSE 0 END AS c_章
FROM yj_panel
WHERE config LIKE N'%受控%' OR config LIKE N'%履历%' OR config LIKE N'%文件编码%'
   OR config LIKE N'%审核%' OR config LIKE N'%control%' OR config LIKE N'%approve%'
   OR config LIKE N'%stamp%' OR config LIKE N'%章%'
ORDER BY panel_code;
GO
SELECT N'S1-11: 有 config 的 RD 面板 + config 长度' AS sec, panel_code, panel_name, LEN(config) AS config_len
FROM yj_panel WHERE panel_code LIKE 'RD%' AND config IS NOT NULL AND LEN(config) > 2
ORDER BY panel_code;
GO
SELECT N'S1-12: RD_SPEC_DOC / RD_ASM_PROC / RD_INSP_PLAN / RD_ASM_BOM config 全文' AS sec,
       panel_code, CONVERT(NVARCHAR(4000), config) AS config_txt
FROM yj_panel
WHERE panel_code IN ('RD_SPEC_DOC','RD_ASM_PROC','RD_INSP_PLAN','RD_ASM_BOM','RD_ASM_PROC');
GO
