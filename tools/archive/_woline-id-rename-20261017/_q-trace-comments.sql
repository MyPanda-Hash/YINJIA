SET NOCOUNT ON;
/* inh/outh 追溯列的中文注明现状(本地正式库 + 服务器快照) */
SELECT DB_NAME() AS 库, t.name AS 表, c.name AS 列, CAST(ep.value AS nvarchar(400)) AS 注明
FROM sys.tables t
JOIN sys.columns c ON c.object_id = t.object_id
LEFT JOIN sys.extended_properties ep ON ep.class = 1 AND ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = N'MS_Description'
WHERE t.name IN (N'inh', N'outh') AND c.name IN (N'工单项次', N'工单号', N'订单号', N'审核', N'asp_user3', N'asp_time3')
ORDER BY t.name, c.column_id;
