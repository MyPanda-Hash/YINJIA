SELECT h.[产品编号], d.[序号], d.[控制项目], d.[控制方法], d.[检测频率], LEFT(d.[控制标准及要求],30) AS req30
FROM rd_insp_plan_detail d JOIN rd_insp_plan_head h ON h.[单据编号]=d.[单据编号]
WHERE d.[单据编号] IN ('IP-2026-11-0021','IP-2026-11-0022','IP-2026-11-0023') AND d.[表区]='检验项目'
ORDER BY h.[产品编号], TRY_CAST(d.[序号] AS int)
