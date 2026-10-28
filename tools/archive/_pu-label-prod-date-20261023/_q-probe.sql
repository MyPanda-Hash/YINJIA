DECLARE @doc nvarchar(40) = N'TMP-PROD-DATE-PROBE';
DELETE FROM bd_pu_label WHERE 单据编号 = @doc;
INSERT INTO bd_pu_label ([单据编号],[单据日期],[采购订单号],[供应商编码],[批次号],[生产日期],[打印人],[打印时间],[打印次数],asp_user1,asp_time1,asp_cancel)
VALUES (@doc, CAST(GETDATE() AS date), N'PROBE', N'YJ-X', N'20261028', '2026-10-20', 'probe', SYSDATETIME(), 1, 'probe', SYSDATETIME(), 'N');
SELECT 单据编号 AS d, 批次号 AS b, ISNULL(CONVERT(varchar(10), 生产日期, 120), N'(NULL)') AS prod FROM bd_pu_label WHERE 单据编号 = @doc;
