SET NOCOUNT ON;
SELECT COUNT(*) no_alive_detail FROM qc_insp h WHERE ISNULL(h.asp_cancel,'N')<>'Y'
AND NOT EXISTS(SELECT 1 FROM qc_insp_detail d WHERE d.单据编号=h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y');
GO
SELECT COUNT(*) no_detail_any FROM qc_insp h WHERE ISNULL(h.asp_cancel,'N')<>'Y'
AND NOT EXISTS(SELECT 1 FROM qc_insp_detail d WHERE d.单据编号=h.单据编号);
