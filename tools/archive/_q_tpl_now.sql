SET NOCOUNT ON;
PRINT '== 库内模板行 ==';
SELECT id, template_code, panel_code, name, enabled, LEN(jrxml_text) AS xml_chars, update_by,
       CONVERT(nvarchar(23), update_at, 121) AS update_at,
       SUBSTRING(jrxml_text, 1, 60) AS head60
FROM dbo.yj_report_template WHERE template_code = N'qc_proc_insp';

PRINT '== 关键片段(新版式才有的) ==';
SELECT CASE WHEN jrxml_text LIKE N'%检验人员%' THEN N'有检验人员' ELSE N'无' END AS a,
       CASE WHEN jrxml_text LIKE N'%产线常规功能性结果%' THEN N'有产线常规功能性结果' ELSE N'无' END AS b,
       CASE WHEN jrxml_text LIKE N'%以下检验项目对应出货检验计划的检查频率%' THEN N'有旧黄底提示(旧版式)' ELSE N'无旧黄底提示' END AS c;
GO
