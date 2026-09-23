SET NOCOUNT ON;
PRINT '== ① bl_purchase_in 仓库类物理列 ==';
SELECT c.name, t.name AS typ, c.max_length FROM sys.columns c
  JOIN sys.types t ON t.user_type_id = c.user_type_id
 WHERE c.object_id = OBJECT_ID('bl_purchase_in') AND c.name LIKE N'%仓库%'
 ORDER BY c.column_id;
GO
PRINT '== ② yj_field 注册(PURCHASE_IN 仓库类) ==';
SELECT col_name, label, place, data_type, ref_panel, ref_field, editable, hidden, visible
  FROM yj_field WHERE panel_code = 'PURCHASE_IN' AND col_name LIKE N'%仓库%' ORDER BY place, seq;
GO
PRINT '== ③ 实际数据分布(272 行) ==';
SELECT COUNT(*) AS 总行,
  SUM(CASE WHEN [仓库] IS NOT NULL AND [仓库]<>'' THEN 1 ELSE 0 END) AS 有仓库,
  SUM(CASE WHEN [仓库名称] IS NOT NULL AND [仓库名称]<>'' THEN 1 ELSE 0 END) AS 有仓库名称,
  SUM(CASE WHEN [仓库编码] IS NOT NULL AND [仓库编码]<>'' THEN 1 ELSE 0 END) AS 有仓库编码,
  SUM(CASE WHEN ([仓库] IS NOT NULL AND [仓库]<>'') AND ([仓库名称] IS NOT NULL AND [仓库名称]<>'') THEN 1 ELSE 0 END) AS 两者都有
  FROM bl_purchase_in;
GO
PRINT '== ④ 两列值样例 ==';
SELECT TOP 5 [仓库], [仓库名称], [仓库编码] FROM bl_purchase_in
 WHERE ([仓库] IS NOT NULL AND [仓库]<>'') OR ([仓库名称] IS NOT NULL AND [仓库名称]<>'');
GO
