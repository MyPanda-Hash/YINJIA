/* 证据造数(仅测试账套 HSDZ_MES_TEST):第二轮「按送样人也能勾选」
   给「系统管理员」再造一张委托单,使该送样人 = 2 张单;另造「张三」1 张单(不同送样人)。
   验证后 cleanup 段删干净。 */
SET NOCOUNT ON;
GO
DECLARE @dbn sysname = DB_NAME();
IF @dbn <> N'HSDZ_MES_TEST'
BEGIN
  RAISERROR(N'[拒绝] 本脚本只允许在测试账套 HSDZ_MES_TEST 执行(当前 %s)', 16, 1, @dbn);
  RETURN;
END
GO
DELETE FROM dbo.qc_insp_commission_detail WHERE [单据编号] IN (N'WT-2026-11-9010', N'WT-2026-11-9011');
DELETE FROM dbo.qc_insp_commission_head   WHERE [单据编号] IN (N'WT-2026-11-9010', N'WT-2026-11-9011');
GO
INSERT INTO dbo.qc_insp_commission_head
  ([单据编号],[单据日期],[委托单位],[联系人],[样品名称],[样品数量],[检验类别],[合计收费],[备注],[单据状态],asp_user1,asp_time1,asp_cancel)
VALUES
  (N'WT-2026-11-9010','2026-11-17',N'测试委托单位',N'系统管理员',N'测试样品A',N'2',N'委托检测',100,N'勾选导出证据',N'草稿',N'admin',SYSDATETIME(),N'N'),
  (N'WT-2026-11-9011','2026-11-18',N'另一委托单位',N'张三',N'测试样品B',N'1',N'委托检测',50,N'按送样人勾选证据',N'草稿',N'admin',SYSDATETIME(),N'N');
GO
INSERT INTO dbo.qc_insp_commission_detail ([单据编号],[行号],[检测元素],[测试方法],[收费],asp_user1,asp_time1,asp_cancel)
VALUES (N'WT-2026-11-9010',1,N'铅',N'ICP-MS',100,N'admin',SYSDATETIME(),N'N'),
       (N'WT-2026-11-9011',1,N'砷',N'ICP-MS',50,N'admin',SYSDATETIME(),N'N');
GO
SELECT d.[送样人] AS sender, COUNT(*) AS docs FROM (
  SELECT h.[单据编号], ISNULL(NULLIF(LTRIM(RTRIM(h.[联系人])),N''),N'未填送样人') AS [送样人]
    FROM dbo.qc_insp_commission_head h WHERE h.[单据编号] IN (N'WT-2026-11-9009',N'WT-2026-11-9010',N'WT-2026-11-9011')
) d GROUP BY d.[送样人];
GO
