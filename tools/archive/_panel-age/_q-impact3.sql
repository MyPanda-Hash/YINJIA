SET NOCOUNT ON;
-- ① 视图/过程定义里提到候选表或面板编码的对象(比 sys.sql_expression_dependencies 可靠)
SELECT o.type_desc AS 类型, o.name AS 对象名
FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
WHERE m.definition LIKE N'%other_in%' OR m.definition LIKE N'%other_out%'
   OR m.definition LIKE N'%outsource_in%' OR m.definition LIKE N'%outsource_issue%'
   OR m.definition LIKE N'%pu_req%'
ORDER BY o.type_desc, o.name;
GO
-- ② 生单链路里与候选面板有关的行
SELECT source_panel_code, target_panel_code, COUNT(*) AS n
FROM dbo.form_flow_link
WHERE source_panel_code IN ('PU_REQ','PU_ORDER','OTHER_IN','OTHER_OUT','OUTSOURCE_IN','OUTSOURCE_ISSUE','PURCHASE_IN','MATERIAL_OUT','QC_INSP','QC_RECV','FINISH_IN','SALE_OUT')
   OR target_panel_code IN ('PU_REQ','PU_ORDER','OTHER_IN','OTHER_OUT','OUTSOURCE_IN','OUTSOURCE_ISSUE','PURCHASE_IN','MATERIAL_OUT','QC_INSP','QC_RECV','FINISH_IN','SALE_OUT')
GROUP BY source_panel_code, target_panel_code ORDER BY source_panel_code, target_panel_code;
GO
-- ③ 库存流水/台账表里按单据类型分布的实绩(证明这些单据真的没发生过业务)
SELECT ISNULL(单据类型, N'(空)') AS 单据类型, COUNT(*) AS 流水行数
FROM dbo.inh GROUP BY 单据类型
UNION ALL
SELECT N'OUT:' + ISNULL(单据类型, N'(空)'), COUNT(*) FROM dbo.outh GROUP BY 单据类型
ORDER BY 1;
