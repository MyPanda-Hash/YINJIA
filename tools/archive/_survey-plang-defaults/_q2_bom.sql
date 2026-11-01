SET NOCOUNT ON;
-- I. bs_inv 工艺路线绑定填充率 + 是否自制
SELECT COUNT(*) total,
 SUM(CASE WHEN [工艺路线] IS NOT NULL AND LTRIM(RTRIM([工艺路线]))<>N'' THEN 1 ELSE 0 END) route_filled,
 SUM(CASE WHEN ISNULL([是否自制],0)=1 THEN 1 ELSE 0 END) self_made
FROM bs_inv WHERE ISNULL(asp_cancel,'N')<>'Y';
-- I2. bs_inv 按所属类别分布(找成品类,定命中率分母)
SELECT [所属类别], COUNT(*) cnt,
 SUM(CASE WHEN [工艺路线] IS NOT NULL AND LTRIM(RTRIM([工艺路线]))<>N'' THEN 1 ELSE 0 END) route_filled
FROM bs_inv WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY [所属类别] ORDER BY cnt DESC;
-- J. 有排产历史(pc)/工单历史(plang)的物料按类别分布
SELECT i.[所属类别], COUNT(DISTINCT pc.dm) pc_dm
FROM plang_pc pc JOIN bs_inv i ON i.存货编码=pc.dm AND ISNULL(i.asp_cancel,'N')<>'Y'
GROUP BY i.[所属类别] ORDER BY pc_dm DESC;
-- K. 自制件口径:该类总数 vs 其中有排产历史数(真实命中率)
SELECT i.[所属类别], COUNT(DISTINCT i.存货编码) inv_cnt, COUNT(DISTINCT pc.dm) pc_dm
FROM bs_inv i LEFT JOIN plang_pc pc ON pc.dm=i.存货编码
WHERE ISNULL(i.asp_cancel,'N')<>'Y' AND ISNULL(i.[是否自制],0)=1
GROUP BY i.[所属类别] ORDER BY inv_cnt DESC;
