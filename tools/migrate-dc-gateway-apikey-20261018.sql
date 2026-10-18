/* ============================================================
   migrate-dc-gateway-apikey-20261018.sql
   数采网关接入密钥(bs_dc_gateway.api_key)

   为什么需要：硬件(电子秤/扫码枪/看板)的采集数据由网关经
   POST /api/dc/ingest 与 POST /api/dc/heartbeat 推上来，这两条路径
   不能在 SecurityConfig 里挂登录态(设备没有账号)，走 permitAll +
   网关密钥校验：请求头 X-DC-Key 必须等于该设备所绑定网关的 api_key。

   口径：
   - 列名 api_key(nvarchar(64))，中文注明「接入密钥」；
   - 未绑定网关 / api_key 为空的设备，ingest 一律拒绝(400 + 明确提示)，
     这与「设备配置管理」里的「绑定网关」检查项同一条口径；
   - 幂等：列不存在才 ADD，扩展属性判存在。
   ============================================================ */
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

IF COL_LENGTH('dbo.bs_dc_gateway', 'api_key') IS NULL
  ALTER TABLE dbo.bs_dc_gateway ADD api_key nvarchar(64) NULL;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.extended_properties
  WHERE major_id = OBJECT_ID('dbo.bs_dc_gateway') AND minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.bs_dc_gateway'), 'api_key', 'ColumnId')
    AND name = 'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description', N'接入密钥：硬件网关调用 /api/dc/ingest、/api/dc/heartbeat 时放在请求头 X-DC-Key；为空表示该网关尚未启用接入',
       'SCHEMA', N'dbo', 'TABLE', N'bs_dc_gateway', 'COLUMN', N'api_key';
GO

PRINT N'[dc-gateway-apikey] bs_dc_gateway.api_key 就绪（缺列数应为 0）';
GO
