SELECT h.[单据编号], d.[序号], d.[检验类别], d.[表区], d.[控制项目], d.[检验内容], d.[控制标准及要求], d.[检验], d.[控制方法], d.[检测仪器], d.[检测频率], d.[取样方式]
FROM rd_insp_plan_head h JOIN rd_insp_plan_detail d ON d.[单据编号]=h.[单据编号]
WHERE h.id IN (SELECT TOP 3 id FROM rd_insp_plan_head WHERE [产品编号] IS NOT NULL ORDER BY asp_time1 DESC)
ORDER BY h.id DESC, d.id
