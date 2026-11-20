SET NOCOUNT ON;
SELECT t.name AS table_name, c.name AS col
FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
WHERE t.name IN ('qc_proc_insp_head','qc_asm_insp_head')
  AND c.name IN (N'单据编号',N'工单号',N'工单行号',N'客户名称',N'产品编码',N'产品名称',N'规格型号',N'总结论',N'检验数量',N'抽检总量',N'批次号',N'生产线',N'生产车间',N'不良数量',N'内部批次清单')
ORDER BY t.name, c.name;
