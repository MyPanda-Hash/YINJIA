SET NOCOUNT ON;
DECLARE @db sysname = DB_NAME();

/* ① 有没有面板把 inh/outh 当载体表 */
SELECT @db AS 库, panel_code, panel_name, mode, head_table, line_table
FROM dbo.yj_panel
WHERE head_table IN (N'inh', N'outh') OR line_table IN (N'inh', N'outh');

/* ② 这些面板登记了多少字段 */
SELECT @db AS 库, f.panel_code, COUNT(*) AS 字段数
FROM dbo.yj_field f JOIN dbo.yj_panel p ON p.panel_code = f.panel_code
WHERE p.head_table IN (N'inh', N'outh') OR p.line_table IN (N'inh', N'outh')
GROUP BY f.panel_code;

/* ③ 报表模板正文里提到 inh/outh 或工单追溯列的 */
SELECT @db AS 库, template_code, panel_code, name,
       CASE WHEN jrxml_text LIKE N'%工单项次%' OR jrxml_text LIKE N'%工单ID%' THEN N'★提追溯列' ELSE N'' END AS 追溯列
FROM dbo.yj_report_template
WHERE jrxml_text LIKE N'%inh%' OR jrxml_text LIKE N'%outh%'
   OR jrxml_text LIKE N'%工单项次%' OR jrxml_text LIKE N'%工单ID%';

/* ④ yj_panel.config 里提到追溯列的 */
SELECT @db AS 库, panel_code, panel_name FROM dbo.yj_panel
WHERE config LIKE N'%工单项次%' OR config LIKE N'%工单ID%' OR config LIKE N'%工单号%';
