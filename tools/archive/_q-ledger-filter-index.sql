/* 探针:复核 v_stock_ledger 当前分区(与验证脚本 ② 对照) */
SELECT COUNT(DISTINCT 仓库编码 + N'|' + 存货编码) AS 编码分区数,
       COUNT(DISTINCT RTRIM(仓库) + N'|' + RTRIM(存货)) AS 名称分区数,
       COUNT(DISTINCT 存货编码) AS 存货码数,
       COUNT(*) AS 总行数
FROM v_stock_ledger
WHERE 仓库编码 IS NOT NULL AND RTRIM(仓库编码) <> '';

SELECT RTRIM(仓库编码) AS 仓库编码, RTRIM(存货编码) AS 存货编码, RTRIM(存货) AS 存货名, COUNT(*) AS n
FROM v_stock_ledger
WHERE RTRIM(仓库编码) = 'YCL-01'
GROUP BY RTRIM(仓库编码), RTRIM(存货编码), RTRIM(存货)
ORDER BY 存货编码;
