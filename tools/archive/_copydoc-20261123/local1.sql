SET NOCOUNT ON;
SELECT panel_code+N'|'+panel_name+N'|'+ISNULL(head_table,N'-')+N'|'+ISNULL(line_table,N'-')+N'|'+ISNULL(group_col,N'-')+N'|'+ISNULL(prefix,N'-') AS r
FROM yj_panel WHERE panel_code IN (N'RD_APPROVAL',N'RD_PROD_INFO',N'RD_SAMPLE_EXT',N'RD_SAMPLE_ND');
GO
SELECT CAST(COUNT(*) AS varchar(10)) AS approval_rows FROM rd_approval;
GO
SELECT TOP 3 单据编号 FROM rd_approval ORDER BY id;
GO
