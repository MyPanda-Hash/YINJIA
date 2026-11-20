/* 证据造数:样品检验汇总表勾选导出(仅测试账套 HSDZ_MES_TEST)
   第二张检验委托单 WT-2026-11-9010(2026-11-17,本周),一条检测项目。
   用途:页面上会有 2 张单,勾选其中 1 张 → 导出的 xlsx 只能有 1 行(验证"只导所选")。
   验证后用 cleanup 段删干净。 */
SET NOCOUNT ON;
GO
DECLARE @dbn sysname = DB_NAME();
IF @dbn <> N'HSDZ_MES_TEST'
BEGIN
  RAISERROR(N'[拒绝] 本脚本只允许在测试账套 HSDZ_MES_TEST 执行(当前 %s)', 16, 1, @dbn);
  RETURN;
END
GO
DELETE FROM dbo.qc_insp_commission_detail WHERE [单据编号] = N'WT-2026-11-9010';
DELETE FROM dbo.qc_insp_commission_head   WHERE [单据编号] = N'WT-2026-11-9010';
GO
INSERT INTO dbo.qc_insp_commission_head
  ([单据编号], [单据日期], [委托单位], [联系人], [样品名称], [样品数量], [检验类别],
   [合计收费], [备注], [单据状态], asp_user1, asp_time1, asp_cancel)
VALUES
  (N'WT-2026-11-9010', '2026-11-17', N'测试委托单位', N'张三', N'测试样品A', N'2', N'委托检测',
   100, N'勾选导出证据用', N'草稿', N'admin', SYSDATETIME(), N'N');
GO
INSERT INTO dbo.qc_insp_commission_detail
  ([单据编号], [行号], [检测元素], [测试方法], [收费], asp_user1, asp_time1, asp_cancel)
VALUES (N'WT-2026-11-9010', 1, N'铅', N'ICP-MS', 100, N'admin', SYSDATETIME(), N'N');
GO
SELECT COUNT(*) AS heads FROM dbo.qc_insp_commission_head WHERE [单据编号] IN (N'WT-2026-11-9009', N'WT-2026-11-9010');
GO
