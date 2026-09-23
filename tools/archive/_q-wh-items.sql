SET NOCOUNT ON;
GO
PRINT '== (仓库, 存货) 对:档案仓 ∩ 有流水 ==';
SELECT RTRIM(l.仓库) AS 仓库, RTRIM(l.存货) AS 存货, COUNT(*) AS 行数,
       '[' + RTRIM(l.仓库) + ']' AS 仓库原样
  FROM v_stock_ledger l
 WHERE EXISTS (SELECT 1 FROM bs_wh w WHERE RTRIM(w.仓库名称) = RTRIM(l.仓库) AND ISNULL(w.asp_cancel,'N')<>'Y')
   AND EXISTS (SELECT 1 FROM bs_inv i WHERE RTRIM(i.存货名称) = RTRIM(l.存货) AND ISNULL(i.asp_cancel,'N')<>'Y')
 GROUP BY RTRIM(l.仓库), RTRIM(l.存货)
 ORDER BY 1, 2;
GO
PRINT '== 006项目/功能炭棒滤芯 的流水仓库(原样,看有无隐藏空格) ==';
SELECT '[' + 仓库 + ']' AS 仓库原样, LEN(仓库) AS 长度, COUNT(*) AS 行数 FROM v_stock_ledger
 WHERE RTRIM(存货) = N'006项目/功能炭棒滤芯' GROUP BY 仓库;
GO
PRINT '== 切削液 的流水仓库 ==';
SELECT '[' + 仓库 + ']' AS 仓库原样, LEN(仓库) AS 长度, COUNT(*) AS 行数 FROM v_stock_ledger
 WHERE RTRIM(存货) = N'切削液' GROUP BY 仓库;
GO
