/* 证据造数:仪器使用汇总表(仅测试账套 HSDZ_MES_TEST)
   把 4 条使用记录挂到既有草稿 IU-2026-11-0001 上(该单原本 0 条明细):
   3 条在本周(11-18 ~ 11-20)+ 1 条在 11-10(用于验证"本周/全部"区间筛选)。
   验证结束后用 cleanup 段删干净。 */
SET NOCOUNT ON;
GO
DECLARE @dbn sysname = DB_NAME();
IF @dbn <> N'HSDZ_MES_TEST'
BEGIN
  RAISERROR(N'[拒绝] 本脚本只允许在测试账套 HSDZ_MES_TEST 执行(当前 %s)', 16, 1, @dbn);
  RETURN;
END
GO
DELETE FROM dbo.rd_instr_use_detail WHERE [单据编号] = N'IU-2026-11-0001';
GO
INSERT INTO dbo.rd_instr_use_detail
  ([单据编号], [使用日期], [起止时间], [仪器状态], [是否内校], [项目名称/内容], [用途],
   [样品数量], [使用人], [备注], [仪器名称/型号], asp_cancel, asp_user1, asp_time1)
VALUES
  (N'IU-2026-11-0001', N'2026-11-20', N'09:00-10:30', N'√', N'√', N'水质重金属检测', N'检测',
   N'5', N'张三', N'正常', N'ICPMS-01', N'N', N'admin', SYSDATETIME()),
  (N'IU-2026-11-0001', N'2026-11-19', N'10:00-11:00', N'√', N'√', N'色度检测', N'检测',
   N'3', N'王五', N'复核', N'分光光度计', N'N', N'admin', SYSDATETIME()),
  (N'IU-2026-11-0001', N'2026-11-18', N'14:00-15:30', N'√', N'-', N'pH测定', N'检测',
   N'2', N'李四', N'', N'ICPMS-01', N'N', N'admin', SYSDATETIME()),
  (N'IU-2026-11-0001', N'2026-11-10', N'08:00-09:00', N'√', N'-', N'灰分测定', N'检测',
   N'1', N'赵六', N'上周记录', N'马弗炉', N'N', N'admin', SYSDATETIME());
GO
SELECT COUNT(*) AS detail_n FROM dbo.rd_instr_use_detail WHERE [单据编号] = N'IU-2026-11-0001';
GO
