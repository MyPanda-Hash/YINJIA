-- r-02:9.18 打印类需求相关面板 —— 面板是否存在 + 是否挂报表模板
SET NOCOUNT ON;
GO
PRINT '=== [1] 采购/暂收/检验/特采/退回/标签 相关面板 ===';
SELECT panel_code, panel_name, category, mode, head_table, line_table, module_group,
       CASE WHEN config IS NULL THEN 0 ELSE LEN(config) END AS config_len
FROM yj_panel
WHERE panel_name LIKE N'%采购%' OR panel_name LIKE N'%暂收%' OR panel_name LIKE N'%检验%'
   OR panel_name LIKE N'%特采%' OR panel_name LIKE N'%退回%' OR panel_name LIKE N'%标签%'
   OR panel_name LIKE N'%标识%' OR panel_code LIKE '%PURCH%' OR panel_code LIKE '%QC%'
   OR panel_code LIKE '%RECV%' OR panel_code LIKE '%LABEL%' OR panel_code LIKE '%RPT%'
ORDER BY panel_code;
GO
PRINT '=== [2] 面板 config 中带 report/reportCodes 的面板(报表挂载证据) ===';
SELECT panel_code, panel_name,
       CASE WHEN config LIKE '%"report"%' THEN 'Y' ELSE 'N' END AS has_report_key,
       CASE WHEN config LIKE '%reportCode%' THEN 'Y' ELSE 'N' END AS has_reportCode,
       CASE WHEN config LIKE '%打印%' THEN 'Y' ELSE 'N' END AS has_print_word,
       CASE WHEN config LIKE '%二维码%' THEN 'Y' ELSE 'N' END AS has_qr_word,
       CASE WHEN config LIKE '%导出%' THEN 'Y' ELSE 'N' END AS has_export_word,
       LEN(config) AS config_len
FROM yj_panel
WHERE config IS NOT NULL
  AND (config LIKE '%"report"%' OR config LIKE '%reportCode%' OR config LIKE '%打印%'
       OR config LIKE '%二维码%' OR config LIKE '%导出%')
ORDER BY panel_code;
GO
PRINT '=== [3] 面板 config 全文(仅 9.18 直接相关面板) ===';
SELECT panel_code, CONVERT(nvarchar(max), config) AS config
FROM yj_panel
WHERE panel_code IN ('PURCH_ORDER','PURCHASE_ORDER','PO_ORDER','PURCH_IN','PURCHASE_IN',
                     'SL_RECV','QC_IN','QC_INSPECT','QC_ORDER','QC_RETURN','SPECIAL_PICK','SPECIAL_ACCEPT',
                     'INV','BS_INV','OTHER_IN','OTHER_OUT')
ORDER BY panel_code;
GO
