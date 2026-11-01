/* seed.sql —— 质量单据关联单号 UI 取证用最小造数(2026-11-01)
 *
 * 只在测试账套 HSDZ_MES_TEST 执行(硬闸门:库名不等于测试账套即 RAISERROR 16 停手)。
 * 造三张草稿单:
 *   · QC_PROC_INSP 制程检验单 ZC-TEST-0001(工序/规格型号/客户名称/产品名称/单据日期 → 供「带入数据」验证)
 *   · QC_BHG 不合格报告 BHG-TEST-0001(客户/产品/不合格数量/异常描述/异常产品规格/文档编号 YJ-QR-11
 *     → 供「不合格品处理单 → 不合格报告」带入验证,同时它自己也要能挂 ZC-TEST-0001)
 *   · QC_BHC 不合格品处理单(制程) BHC-TEST-0001(空草稿,供验证「不合格报告单号」参照格)
 * 幂等:先按单号删本次造的行(连同 yj_doc_status),再插。
 */
SET NOCOUNT ON;
IF DB_NAME() <> N'HSDZ_MES_TEST'
BEGIN
    DECLARE @db sysname = DB_NAME();
    RAISERROR(N'[FATAL] seed.sql 只允许在测试账套 HSDZ_MES_TEST 执行,当前库=%s', 16, 1, @db);
    RETURN;
END

DELETE FROM dbo.yj_doc_status WHERE doc_no IN (N'ZC-TEST-0001', N'BHG-TEST-0001', N'BHC-TEST-0001');
DELETE FROM dbo.qc_proc_insp_head WHERE 单据编号 = N'ZC-TEST-0001';
DELETE FROM dbo.qc_bhg            WHERE 单据编号 = N'BHG-TEST-0001';
DELETE FROM dbo.qc_bhc            WHERE 单据编号 = N'BHC-TEST-0001';
GO

INSERT INTO dbo.qc_proc_insp_head
    (单据编号, 单据日期, 检验时间, 检验类别, 工单号, 工单行号, 报工单号, 工序, 批次号,
     客户名称, 产品编码, 产品名称, 规格型号, 生产线, 生产车间, 报工数量, 抽检总量, 检验数量,
     检验员, 检验日期, 总结论, 单据状态, asp_user1, asp_time1)
VALUES
    (N'ZC-TEST-0001', '2026-11-01', N'2026-11-01 09:30', N'制程检验', N'GD-TEST-0001', 1, N'BG-TEST-0001',
     N'成型', N'20261101', N'测试客户甲', N'CP-TEST-01', N'测试产品甲', N'33*12*110', N'一号线', N'成型车间',
     120, 10, 10, N'品质测试员', N'2026-11-01', N'不合格', NULL, N'admin', SYSDATETIME());
GO

INSERT INTO dbo.qc_bhg
    (单据编号, 单据日期, 文档编号, 客户名称, 产品名称, 检验工站, 异常产品规格, 异常时间,
     不合格品数量, 异常描述, 原因分析, 填写部门, 填写人, 单据状态, asp_user1, asp_time1)
VALUES
    (N'BHG-TEST-0001', '2026-11-01', N'YJ-QR-11', N'测试客户甲', N'测试产品甲', N'成型', N'33*12*110', '2026-11-01',
     3, N'测试异常描述:外观不良', N'测试原因分析:模具温度偏高', N'品质部', N'admin', N'草稿', N'admin', SYSDATETIME());
GO

INSERT INTO dbo.qc_bhc
    (单据编号, 单据日期, 文档编号, 单据状态, asp_user1, asp_time1)
VALUES
    (N'BHC-TEST-0001', '2026-11-01', N'YJ-QR-59', N'草稿', N'admin', SYSDATETIME());
GO

/* 自检 */
IF EXISTS (SELECT 1 FROM dbo.qc_proc_insp_head WHERE 单据编号 = N'ZC-TEST-0001')
   AND EXISTS (SELECT 1 FROM dbo.qc_bhg WHERE 单据编号 = N'BHG-TEST-0001')
   AND EXISTS (SELECT 1 FROM dbo.qc_bhc WHERE 单据编号 = N'BHC-TEST-0001')
    RAISERROR(N'[PASS] 测试账套造数就绪:ZC-TEST-0001 / BHG-TEST-0001 / BHC-TEST-0001', 10, 1);
ELSE
    RAISERROR(N'[FAIL] 测试账套造数未就绪', 16, 1);
GO
