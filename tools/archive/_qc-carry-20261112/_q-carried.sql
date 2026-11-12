SET NOCOUNT ON;
PRINT N'=== 3 张单的明细(带入结果落库) ===';
SELECT d.单据编号, d.检验项, d.检测标准, d.检验方法, d.单项判定, d.结果1
  FROM qc_insp_rec_detail d
 WHERE d.单据编号 IN (N'JYSJ-2026-11-0010',N'JYSJ-2026-11-0011',N'JYSJ-2026-11-0012') AND ISNULL(d.asp_cancel,'N')<>'Y'
 ORDER BY d.单据编号, d.id;
PRINT N'=== 抬头(文件编码/检验依据 也按物料带入) ===';
SELECT 单据编号, 物料名称, 物料编码, 物料批次, 来料数量, 文件编码, 检验依据, 检验日期
  FROM qc_insp_rec WHERE 单据编号 IN (N'JYSJ-2026-11-0010',N'JYSJ-2026-11-0011',N'JYSJ-2026-11-0012') ORDER BY 单据编号;
