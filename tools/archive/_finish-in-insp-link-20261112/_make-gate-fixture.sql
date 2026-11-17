-- 测试账套:造一张最小产成品入库单草稿,用于验证「关联两张检验单」门禁(验完即删)
IF NOT EXISTS (SELECT 1 FROM bd_finish_in WHERE 单据编号 = N'FI-LINKTEST-01')
BEGIN
    INSERT INTO bd_finish_in (单据编号, 单据日期, 业务类型, 加工单号, 工单行号, 批次号, 仓库, 备注)
    VALUES (N'FI-LINKTEST-01', CONVERT(date, GETDATE()), N'产成品入库', N'GD-2026-10-0221', 1, N'20261017', N'成品仓', N'门禁验证用,验完删除');
    PRINT N'[OK] inserted FI-LINKTEST-01';
END
ELSE PRINT N'[SKIP] exists';
SELECT 单据编号, 单据状态_无状态行 AS x FROM (SELECT 单据编号, N'' AS 单据状态_无状态行 FROM bd_finish_in WHERE 单据编号=N'FI-LINKTEST-01') t;
