-- migrate-sale-out-order-cols2-20261015.sql
-- 销售出库单「销售订单号/行号」二轮收口(2026-10-15 用户三口径之二、之三)
--
-- 用户口径:
--   ② 「把明细中的源订单编号改成销售订单号或者删除。」
--   ③ 左栏要有 销售订单号 与 ERP单(材料出库同样要 ERP单)—— 左栏列配在**前端** DOC_RAIL_PANELS,
--      不在本脚本;本脚本只保证「销售订单号」列在面板/行数据里**取得到**(它上轮已登记,见
--      migrate-sale-out-order-cols-20261015.sql),此处不重复动它。
--
-- 本脚本只做一件事:把上一轮放开的**明细「源单编号」列撤下**(hidden=1 / visible=0)。
--
-- 为什么删而不是改名(用户二选一,取「删除」):
--   · 「源单编号」与新的表头「销售订单号」是**同一信息的两处显示**(内容 = 来源销售订单号);
--   · 行级的「哪一行对应订单哪一行」已由「销售订单行号」表达,来源单号在明细里是冗余;
--   · 与采购链口径一致:PURCHASE_IN.detail.源单编号 一直就是 hidden=1(订单号只在表头显示)。
--   ⇒ 撤下可见性即可,**物理列/bl_sale_out 结构一律不动**(转ERP 挂源单仍要读该列,见 KingdeePushService),
--     也**不删 yj_field 行** —— 删行会让「同一物理列再次登记」时体检项 07 视角变化,且转ERP 按列名直读不受影响。
--
-- 幂等(UPDATE 窄条件 + 末尾自检);两账套均执行(先 HSDZ_MES 正式,后 HSDZ_MES_TEST 测试)。
SET NOCOUNT ON;
GO

-- ① 明细「源单编号」撤下可见(保留 yj_field 行与物理列)
UPDATE yj_field SET hidden = 1, visible = 0
WHERE panel_code = N'SALE_OUT' AND col_name = N'源单编号' AND (hidden = 0 OR visible = 1);
PRINT N'[OK] SALE_OUT 明细「源单编号」已撤下,影响 ' + CAST(@@ROWCOUNT AS nvarchar(4)) + N' 行';
GO

-- ② 自检:三个口径各就各位
DECLARE @h int = (SELECT COUNT(*) FROM yj_field
                   WHERE panel_code = N'SALE_OUT' AND col_name = N'销售订单号'
                     AND place LIKE N'%header%' AND hidden = 0 AND visible = 1);
DECLARE @l int = (SELECT COUNT(*) FROM yj_field
                   WHERE panel_code = N'SALE_OUT' AND col_name = N'源单行号'
                     AND label = N'销售订单行号' AND hidden = 0 AND visible = 1);
DECLARE @d int = (SELECT COUNT(*) FROM yj_field
                   WHERE panel_code = N'SALE_OUT' AND col_name = N'源单编号'
                     AND hidden = 1 AND visible = 0);
-- 物理列仍需在:转ERP 挂源单要读 源单编号/源单行号
DECLARE @c1 int = COL_LENGTH(N'bl_sale_out', N'源单编号');
DECLARE @c2 int = COL_LENGTH(N'bl_sale_out', N'源单行号');
IF @h = 1 AND @l = 1 AND @d = 1 AND @c1 IS NOT NULL AND @c2 IS NOT NULL
  RAISERROR(N'SELFCHECK OK  销售订单号 表头可见 / 销售订单行号 明细可见 / 源单编号 已撤下 / 物理列俱在(转ERP 仍可读)', 10, 1) WITH NOWAIT;
ELSE
  RAISERROR(N'SELFCHECK FAIL 表头=%d 行号=%d 源单编号撤下=%d 物理列1=%d 物理列2=%d', 16, 1, @h, @l, @d, @c1, @c2);
GO

PRINT N'migrate-sale-out-order-cols2-20261015 完成';
GO
