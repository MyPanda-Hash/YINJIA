SET NOCOUNT ON;
DECLARE @panel sysname = N'WO_MIXING_LIST';
DECLARE @line sysname = (SELECT line_table FROM dbo.yj_panel WHERE panel_code=@panel);
DECLARE @cols nvarchar(max) = STUFF((SELECT N', t.[' + col_name + N'] AS [' + label + N']'
    FROM dbo.yj_field WHERE panel_code = @panel ORDER BY seq, id FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, N'');
SELECT LEN(@cols) AS len, LEFT(@cols, 120) AS head, RIGHT(@cols, 120) AS tail;
DECLARE @sql nvarchar(max) = N'SELECT TOP 1 t.id AS __id' + @cols + N' FROM dbo.' + QUOTENAME(@line) + N' t ORDER BY t.id DESC';
SELECT LEFT(@sql, 200) AS sqlhead;
