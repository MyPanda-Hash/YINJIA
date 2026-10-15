-- 两账套通用:找「既有组装成品检验单、又有出货检验计划」的同一产品编号(UI 取证用)
SELECT N'qc_asm_insp_head' AS 表, h.[单据编号], h.[产品编码] AS 产品, h.[单据状态]
FROM dbo.qc_asm_insp_head h WHERE ISNULL(h.asp_cancel,'N')<>'Y' AND h.[产品编码] IS NOT NULL
ORDER BY h.id DESC;

SELECT N'rd_insp_plan' AS 表, h.[单据编号] AS 计划单号, h.[产品编号] AS 产品,
       (SELECT COUNT(*) FROM dbo.rd_insp_plan_detail d
         WHERE d.[单据编号]=h.[单据编号] AND ISNULL(d.asp_cancel,'N')<>'Y') AS 计划行
FROM dbo.rd_insp_plan_head h WHERE ISNULL(h.asp_cancel,'N')<>'Y'
ORDER BY h.id DESC;

-- 交集:同一产品既有检验单又有计划
SELECT DISTINCT h.[产品编码] AS 交集产品
FROM dbo.qc_asm_insp_head h
JOIN dbo.rd_insp_plan_head p ON p.[产品编号] = h.[产品编码] AND ISNULL(p.asp_cancel,'N')<>'Y'
WHERE ISNULL(h.asp_cancel,'N')<>'Y' AND h.[产品编码] IS NOT NULL;
