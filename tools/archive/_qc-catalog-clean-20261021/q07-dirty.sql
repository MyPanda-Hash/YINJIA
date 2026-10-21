SET NOCOUNT ON;
-- A. catalog rows whose insp missing
SELECT 'A_catalog_orphan_insp' k, COUNT(*) n FROM qc_catalog_detail d
WHERE ISNULL(d.asp_cancel,'N')<>'Y' AND ISNULL(d.检验单号,'')<>'' AND NOT EXISTS(SELECT 1 FROM qc_insp h WHERE h.单据编号=d.检验单号 AND ISNULL(h.asp_cancel,'N')<>'Y');
-- B. catalog rows whose rec missing
SELECT 'B_catalog_orphan_rec' k, COUNT(*) n FROM qc_catalog_detail d
WHERE ISNULL(d.asp_cancel,'N')<>'Y' AND ISNULL(d.检验数据记录单号,'')<>'' AND NOT EXISTS(SELECT 1 FROM qc_insp_rec r WHERE r.单据编号=d.检验数据记录单号 AND ISNULL(r.asp_cancel,'N')<>'Y');
-- C. catalog rows with neither insp nor rec
SELECT 'C_catalog_no_links' k, COUNT(*) n FROM qc_catalog_detail d
WHERE ISNULL(d.asp_cancel,'N')<>'Y' AND ISNULL(d.检验单号,'')='' AND ISNULL(d.检验数据记录单号,'')='';
-- D. catalog duplicate (insp,material)
SELECT 'D_catalog_dup' k, COUNT(*) n FROM (SELECT 检验单号,物料编码 FROM qc_catalog_detail WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(检验单号,'')<>'' GROUP BY 检验单号,物料编码 HAVING COUNT(*)>1) x;
-- E. rec orphan insp
SELECT 'E_rec_orphan_insp' k, COUNT(*) n FROM qc_insp_rec r
WHERE ISNULL(r.asp_cancel,'N')<>'Y' AND ISNULL(r.来料检验单号,'')<>'' AND NOT EXISTS(SELECT 1 FROM qc_insp h WHERE h.单据编号=r.来料检验单号 AND ISNULL(h.asp_cancel,'N')<>'Y');
-- F. rec no insp link
SELECT 'F_rec_no_insp' k, COUNT(*) n FROM qc_insp_rec r WHERE ISNULL(r.asp_cancel,'N')<>'Y' AND ISNULL(r.来料检验单号,'')='';
-- G. rec duplicate docno
SELECT 'G_rec_dup_docno' k, COUNT(*) n FROM (SELECT 单据编号 FROM qc_insp_rec WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 单据编号 HAVING COUNT(*)>1) x;
-- H. rec blank
SELECT 'H_rec_blank' k, COUNT(*) n FROM qc_insp_rec WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(物料编码,'')='' AND ISNULL(物料名称,'')='' AND ISNULL(来料数量,'')='';
-- I. current insp docs missing catalog rows
SELECT 'I_insp_without_catalog' k, COUNT(*) n FROM qc_insp h
WHERE ISNULL(h.asp_cancel,'N')<>'Y' AND EXISTS(SELECT 1 FROM qc_insp_detail dt WHERE dt.单据编号=h.单据编号 AND ISNULL(dt.asp_cancel,'N')<>'Y')
AND NOT EXISTS(SELECT 1 FROM qc_catalog_detail d WHERE d.检验单号=h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y');
-- J. insp detail lines missing catalog rows
SELECT 'J_detail_without_catalog' k, COUNT(*) n FROM qc_insp_detail dt JOIN qc_insp h ON h.单据编号=dt.单据编号 AND ISNULL(h.asp_cancel,'N')<>'Y'
WHERE ISNULL(dt.asp_cancel,'N')<>'Y' AND NOT EXISTS(SELECT 1 FROM qc_catalog_detail d WHERE d.检验单号=dt.单据编号 AND d.物料编码=dt.物料编码 AND ISNULL(d.asp_cancel,'N')<>'Y');
-- K. catalog rows linked insp alive but material not in detail
SELECT 'K_catalog_material_mismatch' k, COUNT(*) n FROM qc_catalog_detail d JOIN qc_insp h ON h.单据编号=d.检验单号 AND ISNULL(h.asp_cancel,'N')<>'Y'
WHERE ISNULL(d.asp_cancel,'N')<>'Y' AND NOT EXISTS(SELECT 1 FROM qc_insp_detail dt WHERE dt.单据编号=d.检验单号 AND dt.物料编码=d.物料编码 AND ISNULL(dt.asp_cancel,'N')<>'Y');
