SET NOCOUNT ON;
SELECT TOP 5 'N|' + i.存货编码 + '|' + ISNULL(i.存货名称,N'') + '|' + ISNULL(i.计量单位,N'')
FROM bs_inv i WHERE NOT EXISTS (SELECT 1 FROM kucun k WHERE k.wzdm = i.存货编码 AND ISNULL(k.yl,0) > 0);
SELECT TOP 3 'W|' + ISNULL(仓库编码,N'') + '|' + ISNULL(仓库名称,N'') FROM bs_wh;
