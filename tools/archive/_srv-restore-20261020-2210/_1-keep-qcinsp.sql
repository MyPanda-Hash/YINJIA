/* _1-keep-qcinsp.sql — 覆盖服务器备份前,把本地「来料检验单」整条链快照到独立库 HSDZ_MES_KEEPQC
   (2026-10-20 用户口径:RESTORE 覆盖本地,但**不要覆盖当前的来料检验单的库**)
   快照范围:qc_insp / qc_insp_detail / yj_doc_status(QC_INSP) / yj_form_approval(QC_INSP)
             + 引用了这些单号的 qc_insp_rec / qc_tc_in / form_flow_link
   用法(在 tools 目录):
     docker cp ... mssql2019:/tmp/
     docker exec mssql2019 bash -c "/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P *** -d HSDZ_MES -C -b -f 65001 -i /tmp/_1-keep-qcinsp.sql"
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_ID('HSDZ_MES_KEEPQC') IS NOT NULL
BEGIN
  ALTER DATABASE [HSDZ_MES_KEEPQC] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
  DROP DATABASE [HSDZ_MES_KEEPQC];
END
CREATE DATABASE [HSDZ_MES_KEEPQC];
GO

SET NOCOUNT ON;
SELECT * INTO HSDZ_MES_KEEPQC.dbo.k_qc_insp
  FROM dbo.qc_insp;

SELECT * INTO HSDZ_MES_KEEPQC.dbo.k_qc_insp_detail
  FROM dbo.qc_insp_detail;

SELECT * INTO HSDZ_MES_KEEPQC.dbo.k_doc_status
  FROM dbo.yj_doc_status WHERE panel_code = 'QC_INSP';

SELECT * INTO HSDZ_MES_KEEPQC.dbo.k_form_approval
  FROM dbo.yj_form_approval WHERE panel_code = 'QC_INSP';

SELECT * INTO HSDZ_MES_KEEPQC.dbo.k_qc_insp_rec
  FROM dbo.qc_insp_rec WHERE 来料检验单号 IN (SELECT 单据编号 FROM dbo.qc_insp);

SELECT * INTO HSDZ_MES_KEEPQC.dbo.k_qc_tc_in
  FROM dbo.qc_tc_in
 WHERE 检验单号 IN (SELECT 单据编号 FROM dbo.qc_insp)
    OR 检验数据记录单号 IN (SELECT 单据编号 FROM dbo.qc_insp_rec WHERE 来料检验单号 IN (SELECT 单据编号 FROM dbo.qc_insp));

SELECT * INTO HSDZ_MES_KEEPQC.dbo.k_form_flow_link
  FROM dbo.form_flow_link
 WHERE (source_panel_code = 'QC_INSP' AND source_form_no IN (SELECT 单据编号 FROM dbo.qc_insp))
    OR (target_panel_code = 'QC_INSP' AND target_form_no IN (SELECT 单据编号 FROM dbo.qc_insp));

SELECT 'k_qc_insp' AS k, COUNT(*) AS n FROM HSDZ_MES_KEEPQC.dbo.k_qc_insp
UNION ALL SELECT 'k_qc_insp_detail', COUNT(*) FROM HSDZ_MES_KEEPQC.dbo.k_qc_insp_detail
UNION ALL SELECT 'k_doc_status', COUNT(*) FROM HSDZ_MES_KEEPQC.dbo.k_doc_status
UNION ALL SELECT 'k_form_approval', COUNT(*) FROM HSDZ_MES_KEEPQC.dbo.k_form_approval
UNION ALL SELECT 'k_qc_insp_rec', COUNT(*) FROM HSDZ_MES_KEEPQC.dbo.k_qc_insp_rec
UNION ALL SELECT 'k_qc_tc_in', COUNT(*) FROM HSDZ_MES_KEEPQC.dbo.k_qc_tc_in
UNION ALL SELECT 'k_form_flow_link', COUNT(*) FROM HSDZ_MES_KEEPQC.dbo.k_form_flow_link;
