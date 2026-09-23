SET NOCOUNT ON;
DELETE FROM yj_doc_status WHERE doc_no IN (SELECT 单据编号 FROM rd_mold_proc_head WHERE 产品编号 = N'PROBE-CHGP-119983');
DELETE FROM rd_mold_proc_detail WHERE 单据编号 IN (SELECT 单据编号 FROM rd_mold_proc_head WHERE 产品编号 = N'PROBE-CHGP-119983');
DELETE FROM rd_mold_proc_head WHERE 产品编号 = N'PROBE-CHGP-119983';
DELETE FROM rd_dev_task WHERE 产品编号 = N'PROBE-CHGP-119983';
INSERT INTO rd_dev_task (产品编号, 产品名称, 源单据号, 目标面板, 下发人, 下发时间, 负责人, asp_user1, asp_time1)
VALUES (N'PROBE-CHGP-119983', N'探针变更产品', N'PROBE', 'RD_MOLD_PROC', 'admin', GETDATE(), 'glm53', 'admin', GETDATE()),
       (N'PROBE-CHGP-119983', N'探针变更产品', N'PROBE', 'RD_ASM_PROC',  'admin', GETDATE(), 'cp',    'admin', GETDATE());
SELECT N'rd_dev_task', CAST(COUNT(*) AS nvarchar(10)) FROM rd_dev_task WHERE 产品编号 = N'PROBE-CHGP-119983';