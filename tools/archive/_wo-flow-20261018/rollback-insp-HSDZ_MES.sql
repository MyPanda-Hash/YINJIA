/* rollback-insp-HSDZ_MES.sql —— 回滚 wo-insp-20261018 首件/制程检验单补数 */
SET NOCOUNT ON;
DELETE FROM dbo.yj_doc_status WHERE panel_code IN (N'QC_FIRST_INSP',N'QC_PROC_INSP') AND doc_no IN (SELECT [单据编号] FROM dbo.qc_first_insp_head WHERE asp_user1=N'wo-insp-20261018'  UNION ALL SELECT [单据编号] FROM dbo.qc_proc_insp_head WHERE asp_user1=N'wo-insp-20261018');
DELETE FROM dbo.qc_first_insp_detail WHERE asp_user1=N'wo-insp-20261018';
DELETE FROM dbo.qc_first_insp_head WHERE asp_user1=N'wo-insp-20261018';
DELETE FROM dbo.qc_proc_insp_detail WHERE asp_user1=N'wo-insp-20261018';
DELETE FROM dbo.qc_proc_insp_head WHERE asp_user1=N'wo-insp-20261018';
DELETE FROM dbo.s_allno WHERE asp_user1=N'wo-insp-20261018';
GO
