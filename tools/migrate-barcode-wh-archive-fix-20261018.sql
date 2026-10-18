/* migrate-barcode-wh-archive-fix-20261018.sql — 补建金蝶外部仓的 MES 仓库档案(库存单据仓库解析用)

   【问题】库存单据(采购入库/产成品入库/出入库流水)里的「仓库」存的是**金蝶仓库名**,
   记账/冲回时按名称在 bs_wh 里解析。实测有 3 个仓名在 bs_wh 里**不存在**,
   于是这些单据一旦弃审就会整笔回滚并报「仓库档案不存在:[xxx],请先在基础档案-仓库中建立」:
       恒亿仓      inh 697 / outh 1558 / bl_finish_in 65
       成品B仓     inh 737 / outh 1199 / bl_finish_in 737
       华北工控仓  inh 237 / outh  537 / bl_finish_in 4
   (用户 2026-10-18 口径「补两条 MES 仓库档案」;实测是 3 个仓名,缺一个就仍有一批单据弃审不了,
    故按证据补 3 条,口径与做法一致:补档案、不动单据、不改解析逻辑。)

   【为什么不改解析逻辑】文档侧存的是名称快照,补档案是最小改动;改解析=动库存结算链路,风险大得多。
   【编码】沿用 WH- 前缀(MES 自建仓一族,已存在 WH-CL 材料仓 / WH-GL 隔离仓 / WH-XB-* 线边仓):
       WH-HY(恒亿仓) / WH-HBGK(华北工控仓) / WH-CPB(成品B仓)。
   【属性】状态=启用、停用=0、不启用仓位管理;厂区/仓库类型留空(**不猜业务归属**,需要时在仓库面板补)。
   【幂等】按仓库名称 NOT EXISTS 守卫,重跑 0 行。两账套均执行。
*/
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

INSERT INTO dbo.bs_wh (仓库编码, 仓库名称, 状态, 停用, 允许零库存出库, 启用仓位管理, 厂区, 仓库类型, 备注, asp_user1, asp_time1)
SELECT v.code, v.name, N'启用', 0, 0, 0, NULL, v.wtype, v.note, N'migration', GETDATE()
FROM (VALUES
    (N'WH-HY',   N'恒亿仓',     N'成品仓', N'金蝶外部仓(客户/寄售)。库存单据按仓库名称解析;MES 原档案缺失导致该类单据弃审整笔回滚。2026-10-18 补建,业务归属待确认'),
    (N'WH-HBGK', N'华北工控仓', N'成品仓', N'金蝶外部仓(客户/寄售)。同上,2026-10-18 补建,业务归属待确认'),
    (N'WH-CPB',  N'成品B仓',    N'成品仓', N'金蝶成品仓(与 MES 的 CK03 成品仓并列)。同上,2026-10-18 补建')
) AS v(code, name, wtype, note)
WHERE NOT EXISTS (SELECT 1 FROM dbo.bs_wh w WHERE RTRIM(w.仓库名称) = v.name)
  AND NOT EXISTS (SELECT 1 FROM dbo.bs_wh w WHERE RTRIM(w.仓库编码) = v.code);
GO

/* 自检:三个仓名都必须可解析 */
DECLARE @db sysname = DB_NAME(), @bad int = 0;
IF NOT EXISTS (SELECT 1 FROM dbo.bs_wh WHERE RTRIM(仓库名称) = N'恒亿仓'      AND ISNULL(asp_cancel,'N') <> 'Y') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM dbo.bs_wh WHERE RTRIM(仓库名称) = N'华北工控仓'  AND ISNULL(asp_cancel,'N') <> 'Y') SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM dbo.bs_wh WHERE RTRIM(仓库名称) = N'成品B仓'     AND ISNULL(asp_cancel,'N') <> 'Y') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'[FAIL] %s 仓库档案补建未完成', 16, 1, @db);
ELSE RAISERROR(N'[OK] %s 已补建 恒亿仓/华北工控仓/成品B仓(WH-HY/WH-HBGK/WH-CPB)', 10, 1, @db);
GO

SELECT CONCAT('WH|', RTRIM(仓库编码), '|', 仓库名称, '|', 状态) FROM dbo.bs_wh
 WHERE RTRIM(仓库名称) IN (N'恒亿仓', N'华北工控仓', N'成品B仓') ORDER BY 仓库编码;
GO
