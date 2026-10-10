-- migrate-wh-kingdee-only-20261008.sql
-- 用户口径(2026-10-08):「现在只保留金蝶有的仓库」。
--
-- 事实(2026-10-08 实测,凭据 tools/archive/_kingdee-stores.out.txt):
--   金蝶**真实账套**(deploy/config.json:clientId=359797 + outerInstanceId=580147507460444160,
--   沙箱 579046204055359488 未被使用)仓库档案 /jdy/v2/bd/store 共 6 个,全部启用:
--     YJ-08 车间仓 / CP-02 成品B仓 / CK00003 成品不良品区 / YCL-01 恒亿仓 /
--     CK00006 华北工控仓 / CK00005 原料不良品仓
--   本库 bs_wh 11 行 = 上述 6 行(jdy-sync 同步,带 外部数据ID,id 与金蝶一一对上)
--     + 5 行本地手建(asp_user1='migration'、无 外部数据ID ⇒ 金蝶账套里根本不存在):
--       CK01 原料仓 / CK02 辅料仓 / CK03 成品仓 / CK04 半成品仓 / CK05 不良品仓
--
-- 处置(用户 2026-10-08 选定):
--   ① **软删**这 5 行:asp_cancel='Y' + 停用=1 + 状态='停用'(不物理 DELETE,可回滚);
--      QueryService 全部列表/参照查询都带 ISNULL(asp_cancel,'N')<>'Y' ⇒ 面板与参照下拉立即只剩金蝶 6 仓。
--   ② 引用这 5 个仓的存量**演示/历史导入单据**(TCGRK-*/TXSCK-*/TEST-*/BTN-TEST-*/FLOW-TEST-*,
--     涉及 bl_purchase_in 107 行 / bl_sale_out 108 行 / inh 106 行 / outh 108 行 / kucun 212 行)
--      本次**不动** —— 用户口径「只改仓档,演示数据先不动」。代价:这些老单若再弃审/重审,
--      StockLedgerService.resolveWh 会报「仓库档案不存在:[…]」,属既定取舍,不是脚本缺陷。
--   ③ CK00001 正品仓(金蝶无、bs_wh 也无,仅演示单据/流水引用)与 KingdeePushService 第 373 行
--      「无仓默认推 CK00001」本次**不动**(用户口径:先只处理仓库档案)。
--
-- 只动本地自建行:WHERE 带 外部数据ID IS NULL 窄条件 —— 金蝶同步行不受影响,金蝶日后新增的仓
--   (必带 外部数据ID)同样不会被本脚本误杀。
-- 幂等:条件含 asp_cancel<>'Y',重跑影响 0 行。
-- 两个账套都执行(正式 HSDZ_MES + 测试 HSDZ_MES_TEST;后者为快照,行数一致)。
SET NOCOUNT ON;

DECLARE @codes TABLE (code nvarchar(50) PRIMARY KEY);
INSERT INTO @codes (code) VALUES (N'CK01'), (N'CK02'), (N'CK03'), (N'CK04'), (N'CK05');

-- 改前:待软删行数(应 = 5;已软删过则 0)
DECLARE @before int = (
    SELECT COUNT(*) FROM dbo.bs_wh w
    WHERE ISNULL(w.asp_cancel, N'N') <> N'Y'
      AND ISNULL(w.[外部数据ID], N'') = N''
      AND EXISTS (SELECT 1 FROM @codes c WHERE c.code = RTRIM(w.[仓库编码])));
PRINT N'[' + DB_NAME() + N'] 改前待软删的本地自建仓行数:' + CAST(@before AS nvarchar(10));

UPDATE w SET
       w.asp_cancel = N'Y',
       w.asp_user2  = N'wh-kingdee-only',
       w.asp_time2  = SYSDATETIME(),
       w.[停用]     = 1,
       w.[状态]     = N'停用'
FROM dbo.bs_wh w
WHERE ISNULL(w.asp_cancel, N'N') <> N'Y'
  AND ISNULL(w.[外部数据ID], N'') = N''
  AND EXISTS (SELECT 1 FROM @codes c WHERE c.code = RTRIM(w.[仓库编码]));
DECLARE @upd int = @@ROWCOUNT;
PRINT N'[' + DB_NAME() + N'] 本次软删行数:' + CAST(@upd AS nvarchar(10));

-- 自检 ①:启用中的仓库里不得再有「非金蝶来源」的行(越界数必须 = 0)
DECLARE @extra int = (
    SELECT COUNT(*) FROM dbo.bs_wh w
    WHERE ISNULL(w.asp_cancel, N'N') <> N'Y'
      AND ISNULL(w.[外部数据ID], N'') = N'');
PRINT N'[' + DB_NAME() + N'] 自检① 启用中非金蝶来源仓(应为 0):' + CAST(@extra AS nvarchar(10));

-- 自检 ②:金蝶那 6 个仓必须仍在册且未作废(越界数 = 0)
DECLARE @kdMissing int = (
    SELECT COUNT(*) FROM (VALUES
        (N'YJ-08'), (N'CP-02'), (N'CK00003'), (N'YCL-01'), (N'CK00006'), (N'CK00005')) v(code)
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.bs_wh w
        WHERE RTRIM(w.[仓库编码]) = v.code AND ISNULL(w.asp_cancel, N'N') <> N'Y'));
PRINT N'[' + DB_NAME() + N'] 自检② 金蝶仓缺失/被误删数(应为 0):' + CAST(@kdMissing AS nvarchar(10));

-- 现状:启用中的仓库清单(应恰为金蝶 6 个)
SELECT RTRIM([仓库编码]) AS 仓库编码, RTRIM([仓库名称]) AS 仓库名称,
       ISNULL([外部数据ID], N'') AS 外部数据ID, [状态], [停用], ISNULL(asp_cancel, N'N') AS 作废
FROM dbo.bs_wh
WHERE ISNULL(asp_cancel, N'N') <> N'Y'
ORDER BY [仓库编码];

IF @extra <> 0 RAISERROR(N'仍有非金蝶来源的启用仓:仓库档案未对齐金蝶账套', 16, 1);
IF @kdMissing <> 0 RAISERROR(N'金蝶仓缺失或已被误作废:仓库档案未对齐金蝶账套', 16, 1);
PRINT N'[' + DB_NAME() + N'] 仓库档案对齐金蝶真实账套完成(软删 ' + CAST(@upd AS nvarchar(10)) + N' 行)';
GO
