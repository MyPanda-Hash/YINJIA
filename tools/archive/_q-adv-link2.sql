SET NOCOUNT ON;
GO
PRINT '== 仓库选项:档案∩有流水(台账视图) ==';
SELECT DISTINCT RTRIM(仓库) AS 仓库 FROM v_stock_ledger WHERE 仓库 IS NOT NULL AND RTRIM(仓库) <> ''
 AND 仓库 NOT LIKE N'(未填%'
 AND EXISTS (SELECT 1 FROM bs_wh w WHERE RTRIM(w.仓库名称) = RTRIM(v_stock_ledger.仓库) AND ISNULL(w.asp_cancel,'N') <> 'Y')
 ORDER BY 1;
GO
PRINT '== 存货选项:给定仓库=华北工控仓 的 档案∩有流水 ==';
SELECT DISTINCT RTRIM(存货) AS 存货 FROM v_stock_ledger WHERE 存货 IS NOT NULL AND RTRIM(存货) <> ''
 AND 仓库 IS NOT NULL AND RTRIM(仓库) <> '' AND 仓库 NOT LIKE N'(未填%'
 AND RTRIM(仓库) = N'华北工控仓'
 AND EXISTS (SELECT 1 FROM bs_inv i WHERE RTRIM(i.存货名称) = RTRIM(v_stock_ledger.存货) AND ISNULL(i.asp_cancel,'N') <> 'Y')
 ORDER BY 1;
GO
PRINT '== 仓库选项:给定存货=端盖 ==';
SELECT DISTINCT RTRIM(仓库) AS 仓库 FROM v_stock_ledger WHERE 仓库 IS NOT NULL AND RTRIM(仓库) <> ''
 AND 仓库 NOT LIKE N'(未填%' AND RTRIM(存货) = N'端盖'
 AND EXISTS (SELECT 1 FROM bs_wh w WHERE RTRIM(w.仓库名称) = RTRIM(v_stock_ledger.仓库) AND ISNULL(w.asp_cancel,'N') <> 'Y')
 ORDER BY 1;
GO
PRINT '== 状况表同口径 ==';
SELECT DISTINCT RTRIM(仓库) AS 仓库 FROM v_stock_balance WHERE 仓库 IS NOT NULL AND RTRIM(仓库) <> ''
 AND 仓库 NOT LIKE N'(未填%'
 AND EXISTS (SELECT 1 FROM bs_wh w WHERE RTRIM(w.仓库名称) = RTRIM(v_stock_balance.仓库) AND ISNULL(w.asp_cancel,'N') <> 'Y')
 ORDER BY 1;
GO
