SELECT d.[单据编号],d.[序号],d.[检验类别],d.[表区],d.[控制项目],d.[检验内容],d.[控制标准及要求],d.[检验],d.[控制方法],d.[检测仪器],d.[检测频率],d.[取样方式],d.[不合格应对措施],d.[备注]
FROM rd_insp_plan_detail d WHERE d.[单据编号]='IP-2026-10-0009' ORDER BY d.id
