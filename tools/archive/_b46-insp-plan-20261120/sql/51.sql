SELECT id,[单据编号],[序号],[表区],[检验类别],[控制项目],[控制标准及要求],[控制方法],[检测频率],[备注],LEFT([不合格应对措施],20) AS msr
FROM rd_insp_plan_detail WHERE [单据编号]='IP-2026-11-0018' ORDER BY id
