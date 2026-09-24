SET NOCOUNT ON;
SELECT '字段行' AS k, COUNT(*) AS n FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'计量单位' AND place LIKE '%detail%'
UNION ALL SELECT 'SL-0189单位', COUNT(*) FROM sl_recv_detail WHERE 单据编号=N'SL-2026-09-0189' AND ISNULL(计量单位,'')<>''
UNION ALL SELECT 'SL-0190单位', COUNT(*) FROM sl_recv_detail WHERE 单据编号=N'SL-2026-09-0190' AND ISNULL(计量单位,'')<>''
UNION ALL SELECT 'IJ-0152单位', COUNT(*) FROM qc_insp_detail WHERE 单据编号=N'IJ-2026-09-0152' AND ISNULL(计量单位,'')<>''
UNION ALL SELECT 'IJ-0153单位', COUNT(*) FROM qc_insp_detail WHERE 单据编号=N'IJ-2026-09-0153' AND ISNULL(计量单位,'')<>''
UNION ALL SELECT 'PI-0146单位', COUNT(*) FROM bl_purchase_in WHERE 单据编号=N'PI-2026-09-0146' AND ISNULL(计量单位,'')<>''
UNION ALL SELECT 'PI-0147单位', COUNT(*) FROM bl_purchase_in WHERE 单据编号=N'PI-2026-09-0147' AND ISNULL(计量单位,'')<>''
UNION ALL SELECT '暂收剩余空', COUNT(*) FROM sl_recv_detail WHERE ISNULL(计量单位,'')=''
UNION ALL SELECT '检验剩余空', COUNT(*) FROM qc_insp_detail WHERE ISNULL(计量单位,'')=''
UNION ALL SELECT '入库剩余空', COUNT(*) FROM bl_purchase_in WHERE ISNULL(计量单位,'')='';
GO
