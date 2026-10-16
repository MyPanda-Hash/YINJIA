-- 组装成品检验单现有单据:产品编码 ↔ 出货检验计划能否对上
SELECT TOP 15 h.[单据编号], h.[产品编码], h.[单据状态], h.[客户名称],
       (SELECT COUNT(*) FROM dbo.qc_asm_insp_detail d
         WHERE d.[单据编号]=h.[单据编号] AND ISNULL(d.asp_cancel,'N')<>'Y') AS 明细行
FROM dbo.qc_asm_insp_head h WHERE ISNULL(h.asp_cancel,'N')<>'Y' ORDER BY h.id DESC;

-- 计划表:有明细的产品编号
SELECT h.[单据编号] AS 计划单号, h.[产品编号], h.[版本号],
       (SELECT COUNT(*) FROM dbo.rd_insp_plan_detail d
         WHERE d.[单据编号]=h.[单据编号] AND ISNULL(d.asp_cancel,'N')<>'N') AS 计划行
FROM dbo.rd_insp_plan_head h WHERE ISNULL(h.asp_cancel,'N')<>'Y' ORDER BY h.id DESC;
