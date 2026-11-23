SELECT ISNULL(检验内容,N'(空)') AS cat, COUNT(*) AS n FROM rd_insp_plan_detail WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 检验内容 ORDER BY n DESC;
GO
SELECT ISNULL(检验类别,N'(空)') AS cls, COUNT(*) AS n FROM rd_insp_plan_detail WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 检验类别;
GO
SELECT h.产品编号, COUNT(*) AS rows_, MIN(h.单据编号) AS plan FROM rd_insp_plan_head h JOIN rd_insp_plan_detail d ON d.单据编号=h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y' WHERE ISNULL(h.asp_cancel,'N')<>'Y' GROUP BY h.产品编号;
