SET NOCOUNT ON;
IF NOT EXISTS (SELECT 1 FROM bs_dict WHERE 字典类别=N'WH_ZONE' AND 代码=N'ZONE99')
  INSERT INTO bs_dict (字典类别, 代码, 名称, 状态, 排序, 停用) VALUES (N'WH_ZONE', N'ZONE99', N'测试泡沫区', N'启用', 99, 0);
SELECT N'WH_ZONE 字典行数' AS 项, CAST(COUNT(*) AS nvarchar(6)) AS 值 FROM bs_dict WHERE 字典类别=N'WH_ZONE';
GO