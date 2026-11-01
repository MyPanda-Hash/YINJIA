/* ============================================================
   fix-pick-qty-generated-20261101.sql — 把「生单时误填的数量」归 0

   ⚠ 两个账套都执行;幂等。

   ------------------------------------------------------------
   ★ 背景(用户 2026-11-01 报障)
   ------------------------------------------------------------
   「刚生成的领料单,就已经显示领料了」—— 明细一落地就是 10/10、进度 3/3,
   但其实**一根料都没扫**。

   根因:上一版生单时把「需求(BOM单件用量 × 工单数量)」直接写进了 `数量` 列,
   而 `数量` 在本流程里代表「**实领**」—— 领料进度、提交闸门、"已领/需求"显示全按它算。
   两列混一列的后果不只是显示错:
     · 没扫码就满足"每行都有数量" ⇒ 提交闸门等同失效;
     · 提交即按这个数量过账扣库存 ⇒ **凭空扣料**。

   代码已改回「生单写 0」;本脚本负责**补救已经生成错的单据**。

   ------------------------------------------------------------
   ★ 精确判据(必须是生单填的,不能误伤真扫过码的行)
   ------------------------------------------------------------
   同时满足才归 0:
     ① 备注里有「(需求 」            —— 本流程生成的明细;
     ② 备注里**没有**「领料批次」    —— 扫过码的会写入批次串(见 writeQty/mergeNote),
                                        没有 = 从未扫码;
     ③ 单据状态 = 未完成             —— 已完成/已过账的不动;
     ④ 数量 > 0。
   只清这四条同时成立的,其余一律不碰。
   ============================================================ */
SET NOCOUNT ON;
GO

DECLARE @dbNow sysname = DB_NAME();
PRINT N'[库] ' + @dbNow;

/* ---------- ① 先看清有多少行会被清 ---------- */
DECLARE @preview TABLE (单据编号 nvarchar(60), 行号 nvarchar(20), 材料编码 nvarchar(120),
                        数量 decimal(18,4), 明细备注 nvarchar(500));

INSERT INTO @preview (单据编号, 行号, 材料编码, 数量, 明细备注)
SELECT l.单据编号, l.行号, l.材料编码, l.数量, l.明细备注
  FROM dbo.bl_material_out l
  JOIN dbo.bd_material_out h ON h.单据编号 = l.单据编号
  JOIN dbo.wo_pick_doc d ON d.领料单号 = l.单据编号
 WHERE ISNULL(l.asp_cancel,'N') <> 'Y'
   AND ISNULL(l.数量,0) > 0
   AND ISNULL(l.明细备注,'') LIKE N'%需求 %'
   AND ISNULL(l.明细备注,'') NOT LIKE N'%领料批次%'
   AND d.状态 = N'未完成';

-- ⚠ PRINT 里不能直接写子查询(会报语法错),先赋给变量
DECLARE @previewCnt int = (SELECT COUNT(*) FROM @preview);
PRINT N'[预览] 待归零明细 ' + CAST(@previewCnt AS nvarchar(10)) + N' 行';

/* ---------- ② 归零 ---------- */
UPDATE l
   SET 数量 = 0
  FROM dbo.bl_material_out l
  JOIN dbo.bd_material_out h ON h.单据编号 = l.单据编号
  JOIN dbo.wo_pick_doc d ON d.领料单号 = l.单据编号
 WHERE ISNULL(l.asp_cancel,'N') <> 'Y'
   AND ISNULL(l.数量,0) > 0
   AND ISNULL(l.明细备注,'') LIKE N'%需求 %'
   AND ISNULL(l.明细备注,'') NOT LIKE N'%领料批次%'
   AND d.状态 = N'未完成';

DECLARE @fixed int = @@ROWCOUNT;
PRINT N'[归零] 已处理 ' + CAST(@fixed AS nvarchar(10)) + N' 行';

/* ---------- ③ 同步台账的「已领项数」 ---------- */
UPDATE d
   SET d.已领项数 = ISNULL(x.cnt, 0)
  FROM dbo.wo_pick_doc d
  OUTER APPLY (
      SELECT COUNT(*) AS cnt FROM dbo.bl_material_out l
       WHERE l.单据编号 = d.领料单号 AND ISNULL(l.asp_cancel,'N') <> 'Y' AND ISNULL(l.数量,0) > 0
  ) x
 WHERE d.状态 = N'未完成'
   AND ISNULL(d.已领项数, 0) <> ISNULL(x.cnt, 0);

PRINT N'[台账] 已领项数已按明细重算 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 张';
GO

/* ---------- ④ 自检:未完成单据不应再有"有数量但没批次"的行 ---------- */
DECLARE @left int;
SELECT @left = COUNT(*)
  FROM dbo.bl_material_out l
  JOIN dbo.wo_pick_doc d ON d.领料单号 = l.单据编号
 WHERE ISNULL(l.asp_cancel,'N') <> 'Y'
   AND ISNULL(l.数量,0) > 0
   AND ISNULL(l.明细备注,'') LIKE N'%需求 %'
   AND ISNULL(l.明细备注,'') NOT LIKE N'%领料批次%'
   AND d.状态 = N'未完成';

IF @left > 0
   PRINT N'[WARN] 仍有 ' + CAST(@left AS nvarchar(10)) + N' 行未清理';
ELSE
   PRINT N'[PASS] 未完成单据里已无"生单填量"的残留';
GO

/* ---------- ⑤ 结果:未完成单据的进度分布 ---------- */
SELECT d.状态, d.已领项数, d.物料项数, COUNT(*) AS 张数
  FROM dbo.wo_pick_doc d
 WHERE d.工单号 LIKE N'GD-%'
 GROUP BY d.状态, d.已领项数, d.物料项数
 ORDER BY d.状态, d.已领项数;
GO
