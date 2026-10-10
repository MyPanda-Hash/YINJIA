SET NOCOUNT ON;
-- 品质管理菜单下全部 18 张面板:操作留痕 + 单据量(单头表行数)
SELECT p.panel_code, p.panel_name, p.mode,
       (SELECT COUNT(*) FROM dbo.yj_usage_log u WHERE u.panel_name = p.panel_name) AS 操作留痕,
       (SELECT COUNT(*) FROM dbo.yj_doc_status s WHERE s.panel_code = p.panel_code) AS 单据状态行
FROM yj_panel p
WHERE p.panel_code IN ('QC_INSP','QC_TC_IN','QC_CATALOG','QC_INSP_REC','QC_INSP_REQ','QC_INSP_REQ_SERIES',
 'QC_OP','QC_RECORD','QC_DISPOSAL','ROD_RETURN','LOT_TRACE',
 'QC_BHG','QC_BHC','QC_BHZ','QC_JJF','QC_SCP','QC_LYB','QC_SCY')
ORDER BY 操作留痕 DESC, p.panel_code;
