SET NOCOUNT ON;
-- 这张单的物料在 kucun 里的那一行:谁把它清成 0 的
SELECT wzdm, ckdm, lot_no = ISNULL(lot_no,'<NULL>'), rkl, ckl, yl, price,
       asp_user1, asp_user2, asp_time1, asp_time2, 预警数量
FROM kucun WHERE wzdm = 'YJ-YCYX-055';

-- 这张单的流水(确认它确实过账了)
SELECT src, rid, 单据编号, 单据日期, 仓库编码, 批号, 数量, asp_user1, asp_time1
FROM inh WHERE 单据编号 = 'CGRK-20261011-03389';

-- v_stock_kucun 里有没有这个 (仓库, 存货)
SELECT * FROM v_stock_kucun WHERE 存货编码 = 'YJ-YCYX-055';

-- 该仓库里还有哪些物料被清成 0 却不显示(零行总数)
SELECT 仓库 = ckdm, 零行 = COUNT(*) FROM kucun WHERE yl = 0 GROUP BY ckdm ORDER BY 零行 DESC;
