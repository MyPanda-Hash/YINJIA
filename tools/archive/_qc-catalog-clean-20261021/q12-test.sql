SET NOCOUNT ON;
SELECT 'qc_catalog' t, COUNT(*) n FROM qc_catalog UNION ALL SELECT 'qc_catalog_detail',COUNT(*) FROM qc_catalog_detail
UNION ALL SELECT 'qc_insp',COUNT(*) FROM qc_insp UNION ALL SELECT 'qc_insp_detail',COUNT(*) FROM qc_insp_detail
UNION ALL SELECT 'qc_insp_rec',COUNT(*) FROM qc_insp_rec UNION ALL SELECT 'qc_insp_rec_detail',COUNT(*) FROM qc_insp_rec_detail;
GO
SELECT TOP 10 id,单据编号,检验单号,检验数据记录单号,物料编码,数量 FROM qc_catalog_detail ORDER BY id;
GO
SELECT TOP 10 id,单据编号,来料检验单号,物料编码,来料数量,单据日期 FROM qc_insp_rec ORDER BY id;
GO
SELECT ISNULL(asp_cancel,'N') c, COUNT(*) n FROM qc_insp GROUP BY ISNULL(asp_cancel,'N');
SELECT ISNULL(asp_cancel,'N') c, COUNT(*) n FROM qc_insp_detail GROUP BY ISNULL(asp_cancel,'N');
