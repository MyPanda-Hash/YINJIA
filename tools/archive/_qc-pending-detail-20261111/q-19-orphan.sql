SET NOCOUNT ON;
PRINT N'=== A. 来料检验单号为空的检验数据记录(正式库) ===';
SELECT r.id, r.单据编号, r.单据日期, r.物料编码, r.物料名称, r.物料批次, r.来料数量,
       r.检验人, ISNULL(r.来料检验单号,N'(空)') AS 检验单号,
       (SELECT COUNT(*) FROM qc_insp_rec_detail d WHERE d.单据编号 = r.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y') AS 明细行数,
       (SELECT COUNT(*) FROM qc_catalog_detail c WHERE c.检验数据记录单号 = r.单据编号 AND ISNULL(c.asp_cancel,'N')<>'Y') AS 目录行数,
       ISNULL(r.asp_user1,N'') AS 建单人, r.asp_time1
  FROM qc_insp_rec r
 WHERE ISNULL(r.asp_cancel,'N')<>'Y' AND ISNULL(r.来料检验单号,N'') = N''
 ORDER BY r.id;

PRINT N'=== B. 这些记录是否有同名批次的检验单(可能是单号没写/被清空) ===';
SELECT r.单据编号 AS rec_no, r.物料编码, r.物料批次,
       (SELECT COUNT(*) FROM qc_insp i WHERE i.批次号 = r.物料批次 AND ISNULL(i.asp_cancel,'N')<>'Y') AS 同批次检验单数
  FROM qc_insp_rec r
 WHERE ISNULL(r.asp_cancel,'N')<>'Y' AND ISNULL(r.来料检验单号,N'') = N'';

PRINT N'=== C. 总量对照 ===';
SELECT
  (SELECT COUNT(*) FROM qc_insp_rec WHERE ISNULL(asp_cancel,'N')<>'Y') AS 记录总数,
  (SELECT COUNT(*) FROM qc_insp_rec WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(来料检验单号,N'')=N'') AS 无检验单号,
  (SELECT COUNT(*) FROM qc_insp WHERE ISNULL(asp_cancel,'N')<>'Y') AS 检验单总数;
