SET NOCOUNT ON;
SELECT r.单据编号, r.物料编码, r.来料数量,
       (SELECT COUNT(*) FROM qc_insp_rec_detail d WHERE d.单据编号 = r.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y') AS 明细行
  FROM qc_insp_rec r WHERE 单据编号 IN (N'JYSJ-2026-11-0010',N'JYSJ-2026-11-0011',N'JYSJ-2026-11-0012') ORDER BY 1;
PRINT N'=== 这 3 张单的明细(若已带入) ===';
SELECT d.单据编号, d.检验项, d.检测标准, d.检验方法, d.单项判定
  FROM qc_insp_rec_detail d
 WHERE d.单据编号 IN (N'JYSJ-2026-11-0010',N'JYSJ-2026-11-0011',N'JYSJ-2026-11-0012') AND ISNULL(d.asp_cancel,'N')<>'Y'
 ORDER BY d.单据编号, d.id;
PRINT N'=== 最近 6 张检验数据记录 ===';
SELECT TOP 6 单据编号, 单据日期, 物料名称, 物料编码, 来料数量 FROM qc_insp_rec WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
