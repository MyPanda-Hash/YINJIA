-- 【只读】测试账套现状:组装成品检验单 + 出货检验计划(UI 取证选夹具用)
SELECT h.[单据编号], h.[产品编码], h.[单据状态],
       (SELECT COUNT(*) FROM dbo.qc_asm_insp_detail d
         WHERE d.[单据编号]=h.[单据编号] AND ISNULL(d.asp_cancel,'N')<>'Y') AS 明细行
FROM dbo.qc_asm_insp_head h
WHERE ISNULL(h.asp_cancel,'N')<>'Y' ORDER BY h.id DESC;

SELECT s.doc_no, s.status FROM dbo.yj_doc_status s WHERE s.panel_code=N'QC_ASM_INSP' ORDER BY s.doc_no;

SELECT h.[单据编号], h.[产品编号], h.[版本号] FROM dbo.rd_insp_plan_head h
WHERE ISNULL(h.asp_cancel,'N')<>'Y' ORDER BY h.id DESC;
