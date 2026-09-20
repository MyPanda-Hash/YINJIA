-- migrate-erp-close-state.sql — 金蝶关闭状态口径(方案 A,2026-09-20 用户定口径)
-- ════════════════════════════════════════════════════════════════════════════
-- 背景:金蝶采购订单的「关闭状态」bill_close_state 有两种:
--   'S' 已关闭   = 下游单据全部执行完(全部入库)后**系统自动关单** → 业务语义是"做完了"
--   'H' 手动关闭 = 人工在金蝶点关闭(不再执行)                  → 业务语义是"终止"
-- 改造前:sync-core 把两者**一律**写成 yj_doc_status.stopped='Y' → MES 显示「已中止」,
--   且该 MERGE 会把 MES 用户自己点的「中止」在下次同步时洗回(N 覆盖),数据上表现为
--   1755 张已中止单的 stop_by 全为空(实测)。
--
-- 方案 A 口径:
--   ① 新增 yj_doc_status.erp_close_state 存金蝶关闭状态原值(S/H,NULL);
--   ② 状态推导:已作废 > 已中止(stopped='Y' MES 用户中止 **或** erp_close_state='H' 金蝶手关)
--      > … > 已归档 > **已完成(erp_close_state='S')** > 已审核 > 草稿;
--   ③ 同步只写 erp_close_state,**不再写 stopped** → MES 侧「中止」不再被同步覆盖。
--
-- 幂等:可重复执行。
-- ════════════════════════════════════════════════════════════════════════════
SET NOCOUNT ON;

-- ══════════ 1) 新增列 ══════════
IF COL_LENGTH('yj_doc_status', 'erp_close_state') IS NULL
    ALTER TABLE yj_doc_status ADD erp_close_state nvarchar(1) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID(N'dbo.yj_doc_status')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.yj_doc_status'), N'erp_close_state', 'ColumnId')
                 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
        N'金蝶关闭状态原值(S=已关闭/自动,S 对应"已完成";H=手动关闭,对应"已中止";NULL=未关闭)',
        N'SCHEMA', N'dbo', N'TABLE', N'yj_doc_status', N'COLUMN', N'erp_close_state';
GO

-- ══════════ 2) 存量纠正:同步曾置的"假中止"还原 ══════════
-- 判据:stopped='Y' 且 stop_by 为空 ⇒ 不是 MES 用户点的,而是同步按关闭状态写的。
-- 先还原 stopped,并按"已关闭"预置 erp_close_state='S'(真正的 H 会由下一次同步按原值纠正)。
UPDATE yj_doc_status
SET stopped = 'N', erp_close_state = 'S', update_at = GETDATE()
WHERE panel_code IN ('PU_ORDER', 'SO_ORDER')
  AND ISNULL(stopped, 'N') = 'Y'
  AND stop_by IS NULL;
GO
PRINT N'已还原同步置的中止行数:';
SELECT @@ROWCOUNT AS n;
GO

-- ══════════ 3) 自检 ══════════
PRINT N'── 采购/销售订单:按 erp_close_state 分布 ──';
SELECT panel_code,
       ISNULL(erp_close_state, '(未关闭)') AS 金蝶关闭状态,
       COUNT(*) AS 单数,
       SUM(CASE WHEN ISNULL(stopped,'N')='Y' THEN 1 ELSE 0 END) AS MES中止
FROM yj_doc_status
WHERE panel_code IN ('PU_ORDER', 'SO_ORDER')
GROUP BY panel_code, ISNULL(erp_close_state, '(未关闭)')
ORDER BY panel_code, 金蝶关闭状态;
GO
PRINT N'── 仍为 MES 用户中止(stop_by 有留痕,同步不再覆盖)──';
SELECT panel_code, COUNT(*) AS 单数 FROM yj_doc_status
WHERE ISNULL(stopped,'N')='Y' AND stop_by IS NOT NULL GROUP BY panel_code;
GO
PRINT N'migrate-erp-close-state 完成:金蝶关闭状态改为独立列,MES「中止」与同步解耦';
GO
