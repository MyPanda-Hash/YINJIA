/* migrate-stock-detail-hide-zero.sql — 库存明细隐藏「现存量合计 = 0」的行(替代"删 kucun 行")
 *
 * 【为什么改口径】第十三条按用户要求「月结后数量为 0 就删除这个批次号」时,实现成**物理删除 kucun 行**。
 *   2026-10-15 第十七轮真实测试暴露回归:弃审一张历史出库单直接报
 *   `冲回失败:台账无该行(物料 X 批 Y)` —— 冲回要先查 kucun 那一行,行被删了就冲不掉。
 * 【新口径】kucun **一行不删**(它是流水缓存 + 弃审冲回的凭据),改由报表侧过滤:
 *   v_stock_kucun 只输出「SUM(现存量) <> 0」的 (仓库,存货) —— 界面上"数量 0 的批次号"照样看不见,
 *   但弃审/重新审核能正常冲回。两账套都执行。
 */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO
CREATE OR ALTER VIEW dbo.v_stock_kucun AS
SELECT ROW_NUMBER() OVER (ORDER BY m.仓库编码, m.存货编码) AS id,
       m.仓库编码, m.仓库名称, m.存货编码, m.存货名称, m.规格型号,
       m.累计入库量, m.累计出库量, m.现存量, m.更新时间,
       CAST('N' AS nvarchar(1)) AS asp_cancel
FROM (
  SELECT k.ckdm AS 仓库编码, ISNULL(w.仓库名称, N'') AS 仓库名称, k.wzdm AS 存货编码,
         ISNULL(i.存货名称, N'') AS 存货名称, ISNULL(i.规格型号, N'') AS 规格型号,
         CAST(SUM(ISNULL(k.rkl, 0)) AS decimal(18,4)) AS 累计入库量,
         CAST(SUM(ISNULL(k.ckl, 0)) AS decimal(18,4)) AS 累计出库量,
         CAST(SUM(ISNULL(k.yl, 0)) AS decimal(18,4)) AS 现存量,
         MAX(k.update_date) AS 更新时间
  FROM dbo.kucun k
  OUTER APPLY (SELECT TOP 1 x.仓库名称 FROM dbo.bs_wh x WHERE x.仓库编码 = k.ckdm ORDER BY x.id) w
  OUTER APPLY (SELECT TOP 1 x.存货名称, x.规格型号 FROM dbo.bs_inv x WHERE x.存货编码 = k.wzdm) i
  WHERE ISNULL(k.asp_cancel, 'N') <> 'Y'
  GROUP BY k.ckdm, k.wzdm, w.仓库名称, i.存货名称, i.规格型号
  HAVING CAST(SUM(ISNULL(k.yl, 0)) AS decimal(18,4)) <> 0
) m;
GO
DECLARE @v int = (SELECT COUNT(*) FROM dbo.v_stock_kucun);
DECLARE @z int = (SELECT COUNT(*) FROM (SELECT wzdm, ckdm FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y'
                   GROUP BY wzdm, ckdm HAVING SUM(ISNULL(yl,0)) = 0) t);
DECLARE @dbn sysname = DB_NAME();
DECLARE @krows int = (SELECT COUNT(*) FROM kucun);
RAISERROR(N'[自检] %s:v_stock_kucun %d 行;被隐藏的零余额 (物料,仓库) %d 组;kucun 行 %d 个(不删)', 10, 1,
          @dbn, @v, @z, @krows);
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.v_stock_kucun') AND name = N'现存量')
  RAISERROR(N'[FAIL] 视图缺 现存量 列', 16, 1);
ELSE RAISERROR(N'[OK] 库存明细已改为"隐藏零余额行"(kucun 不再删行,弃审可正常冲回)', 10, 1);
GO