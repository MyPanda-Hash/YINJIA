SET NOCOUNT ON;
SELECT 单据编号, 单据日期, 物料名称, 物料编码, 物料批次, 来料数量, 检验日期, 文件编码, 检验依据,
       (SELECT COUNT(*) FROM qc_insp_rec_detail d WHERE d.单据编号 = r.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y') AS 明细行
  FROM qc_insp_rec r
 WHERE 单据编号 IN (N'JYSJ-2026-11-0010', N'JYSJ-2026-11-0011', N'JYSJ-2026-11-0012')
 ORDER BY 单据编号;
