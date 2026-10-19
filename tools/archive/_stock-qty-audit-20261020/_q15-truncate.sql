SET NOCOUNT ON;
PRINT N'== 1. 鐜板瓨閲忔彁鍙栧彛寰勫绠?鍓嶇鍙彇 STOCK_STATUS 鍓?500 琛?id DESC) ==';
WITH top500 AS (
  SELECT TOP 500 id, wzdm, ckdm, yl FROM dbo.kucun ORDER BY id DESC
), allrows AS (
  SELECT wzdm, ckdm, SUM(ISNULL(yl,0)) AS yl FROM dbo.kucun GROUP BY wzdm, ckdm
), t500 AS (
  SELECT wzdm, ckdm, SUM(ISNULL(yl,0)) AS yl FROM top500 GROUP BY wzdm, ckdm
)
SELECT (SELECT COUNT(DISTINCT wzdm) FROM dbo.kucun) AS 鍏ㄩ儴瀛樿揣鏁?
       (SELECT COUNT(DISTINCT wzdm) FROM top500) AS 鍓?00琛岃鐩栧瓨璐ф暟,
       (SELECT COUNT(*) FROM allrows) AS 鍏ㄩ儴(瀛樿揣,浠撳簱)閿?
       (SELECT COUNT(*) FROM t500) AS 鍓?00琛岃鐩栭敭,
       (SELECT COUNT(*) FROM allrows a LEFT JOIN t500 t ON t.wzdm=a.wzdm AND t.ckdm=a.ckdm WHERE t.wzdm IS NULL AND a.yl<>0) AS 瀹屽叏鍙栦笉鍒扮殑閿?
       (SELECT COUNT(*) FROM allrows a JOIN t500 t ON t.wzdm=a.wzdm AND t.ckdm=a.ckdm WHERE ABS(a.yl-t.yl)>0.0001) AS 鍙栧埌浣嗘暟閲忎笉鍏ㄧ殑閿?

PRINT N'== 2. 绀轰緥:鍑犱釜琚?鎴柇"鐨勫瓨璐?鐪熷疄缁撳瓨 vs 鍓?00琛屽悎璁? ==';
WITH top500 AS (SELECT TOP 500 id, wzdm, ckdm, yl FROM dbo.kucun ORDER BY id DESC),
allrows AS (SELECT wzdm, ckdm, SUM(ISNULL(yl,0)) AS yl FROM dbo.kucun GROUP BY wzdm, ckdm),
t500 AS (SELECT wzdm, ckdm, SUM(ISNULL(yl,0)) AS yl FROM top500 GROUP BY wzdm, ckdm)
SELECT TOP 10 a.wzdm AS 瀛樿揣缂栫爜, a.ckdm AS 浠撳簱,
       CAST(a.yl AS decimal(18,4)) AS 鐪熷疄缁撳瓨,
       CAST(ISNULL(t.yl,0) AS decimal(18,4)) AS 鍥炲～浼氭樉绀?FROM allrows a LEFT JOIN t500 t ON t.wzdm=a.wzdm AND t.ckdm=a.ckdm
WHERE a.yl > 0 AND ISNULL(t.yl,0) = 0
ORDER BY a.yl DESC;

PRINT N'== 3. 鍗曟嵁琛?鐜板瓨閲?涓鸿礋鐨勬牱鏈?bl_pu_order / bl_sale_out) ==';
SELECT TOP 8 'bl_pu_order' AS 琛? 鍗曟嵁缂栧彿, 鐗╂枡缂栫爜 AS 瀛樿揣, 浠撳簱, 鏁伴噺, 鐜板瓨閲? asp_user1, asp_time1
FROM dbo.bl_pu_order WHERE 鐜板瓨閲?< -0.0001 ORDER BY 鐜板瓨閲?
SELECT TOP 8 'bl_sale_out' AS 琛? 鍗曟嵁缂栧彿, 瀛樿揣缂栫爜 AS 瀛樿揣, 鏁伴噺, 鐜板瓨閲? asp_user1, asp_time1
FROM dbo.bl_sale_out WHERE 鐜板瓨閲?< -0.0001 ORDER BY 鐜板瓨閲?

