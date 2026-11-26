-- 关闭「孤儿」待检验目录行（2026-11-26 暂收单/检验单批量清理的收尾 · 幂等）
--
-- 背景：这批造数的 8 张来料检验单（IJ-2026-10-0205~0212）已作废（yj_doc_status.canceled='Y'），
-- 对应 10 张检验数据记录也已作废，但 qc_catalog_detail 里那 10 行仍指着这些已作废的检验单号 ——
-- 属于「单据没了、引用还在」。面板按钮删不掉：QcCatalogService.assertNoLinkedDocs 用
--   `SELECT COUNT(*) FROM qc_insp WHERE 单据编号=? AND asp_cancel<>'Y'`
-- 判"挂靠单据还活着"，而作废写的是 yj_doc_status.canceled（物理行 asp_cancel 仍 NULL）⇒ 守卫恒判活着。
--
-- 本脚本做的事与面板「删除记录」按钮完全一致（见 QcCatalogService.deleteRow）：
--   UPDATE qc_catalog_detail SET asp_cancel='Y', asp_user2=?, asp_time2=GETDATE()
--
-- 安全边界（任何一条不满足就不动）：
--   ① 只认那 8 个检验单号 —— 与 id 无关，换库/重建也不会误伤别的行；
--   ② 只处理「该检验单在本库确为已作废」的行（测试库若还没做这轮清理，这里自然 0 行 = 空跑通过）；
--   ③ 整笔事务 + 行数断言，失败回滚并 RAISERROR（sqlcmd -b 会以非 0 退出）。
--
-- 幂等：重复执行命中 0 行，[PASS] 通过。两账套均可执行。

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @insp TABLE (no nvarchar(64) PRIMARY KEY);
INSERT INTO @insp (no) VALUES
 (N'IJ-2026-10-0205'), (N'IJ-2026-10-0206'), (N'IJ-2026-10-0207'), (N'IJ-2026-10-0208'),
 (N'IJ-2026-10-0209'), (N'IJ-2026-10-0210'), (N'IJ-2026-10-0211'), (N'IJ-2026-10-0212');

DECLARE @before int, @n int;

SELECT @before = COUNT(*)
  FROM qc_catalog_detail d
  JOIN @insp i ON i.no = d.检验单号
 WHERE ISNULL(d.asp_cancel, 'N') <> 'Y'
   AND EXISTS (SELECT 1 FROM yj_doc_status s
                WHERE s.panel_code = 'QC_INSP' AND s.doc_no = d.检验单号
                  AND ISNULL(s.canceled, 'N') = 'Y');

PRINT N'待关闭的孤儿目录行 = ' + CAST(@before AS nvarchar(10));

BEGIN TRAN;

UPDATE d
   SET d.asp_cancel = 'Y',
       d.asp_user2 = N'migration:qc-catalog-orphan-close-20261126',
       d.asp_time2 = GETDATE()
  FROM qc_catalog_detail d
  JOIN @insp i ON i.no = d.检验单号
 WHERE ISNULL(d.asp_cancel, 'N') <> 'Y'
   AND EXISTS (SELECT 1 FROM yj_doc_status s
                WHERE s.panel_code = 'QC_INSP' AND s.doc_no = d.检验单号
                  AND ISNULL(s.canceled, 'N') = 'Y');

SET @n = @@ROWCOUNT;

IF @n <> @before
BEGIN
    ROLLBACK;
    RAISERROR(N'[FAIL] qc-catalog-orphan-close: 更新行数 %d 与预期 %d 不一致，已回滚', 16, 1, @n, @before);
END
ELSE
BEGIN
    COMMIT;
    PRINT N'[PASS] qc-catalog-orphan-close: 关闭 ' + CAST(@n AS nvarchar(10)) + N' 行（应为 0 或 10）';
END

-- 复核：这 8 张检验单在目录里应已没有"活着"的行
SELECT d.检验单号, COUNT(*) AS 仍存活行数
  FROM qc_catalog_detail d
  JOIN @insp i ON i.no = d.检验单号
 WHERE ISNULL(d.asp_cancel, 'N') <> 'Y'
 GROUP BY d.检验单号;
