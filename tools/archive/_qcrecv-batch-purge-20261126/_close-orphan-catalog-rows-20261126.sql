-- 关闭 10 行「孤儿」待检验目录行（2026-11-26 暂收单/检验单批量清理的收尾）
--
-- 背景：这批造数的 8 张来料检验单已作废（yj_doc_status.canceled='Y'）+ 对应 10 张检验数据记录也已作废，
-- 但 qc_catalog_detail 里那 10 行仍指着已作废的检验单号 —— 界面上属于「单据没了、引用还在」。
--
-- 为什么必须用 SQL：面板上的「删除记录」走 QcCatalogService.assertNoLinkedDocs，它用
--   countAlive("qc_insp", 检验单号) = `SELECT COUNT(*) FROM qc_insp WHERE 单据编号=? AND asp_cancel<>'Y'`
-- 判定挂靠单据还活着；而作废走的是 yj_doc_status.canceled（物理行 asp_cancel 仍是 NULL）
--   ⇒ 守卫永远认为检验单还在，按钮永远删不掉。这是守卫口径的缺陷（应同时认 canceled），
--     修代码 + 部署本次做不到（服务器 5985/1433 从开发机均不可达），故按下面这段直接落软删标记。
--
-- 效果与面板按钮完全一致：UPDATE qc_catalog_detail SET asp_cancel='Y', asp_user2, asp_time2
-- （见 QcCatalogService.deleteRow）。
--
-- 幂等：重复执行命中 0 行不报错。守卫：只处理这 10 个 id，且要求其检验单确为「已作废」，否则 RAISERROR 中止。
-- 执行：服务器本机 sqlcmd（1433 对外不通）
--   sqlcmd -S localhost -E -d HSDZ_MES -b -I -f 65001 -i _close-orphan-catalog-rows-20261126.sql

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @ids TABLE (id int PRIMARY KEY);
INSERT INTO @ids (id) VALUES (54),(55),(56),(57),(58),(59),(60),(61),(62),(63);

-- 守住边界：这 10 行必须仍然挂在「已作废」的检验单上；任何一行不符合就整批不动
IF EXISTS (
    SELECT 1
      FROM qc_catalog_detail d
      JOIN @ids i ON i.id = d.id
     WHERE ISNULL(d.asp_cancel, 'N') <> 'Y'
       AND NOT EXISTS (SELECT 1 FROM yj_doc_status s
                        WHERE s.panel_code = 'QC_INSP'
                          AND s.doc_no = d.检验单号
                          AND ISNULL(s.canceled, 'N') = 'Y')
)
BEGIN
    RAISERROR(N'[中止] 有目录行挂靠的检验单并非「已作废」，与本清理口径不符，未做任何修改。', 16, 1);
    RETURN;
END

PRINT N'处理前：目标行中未作废的有 ' + CAST((
    SELECT COUNT(*) FROM qc_catalog_detail d JOIN @ids i ON i.id = d.id
     WHERE ISNULL(d.asp_cancel, 'N') <> 'Y') AS nvarchar(10)) + N' 行';

BEGIN TRAN;

UPDATE d
   SET d.asp_cancel = 'Y',
       d.asp_user2 = N'admin(批量清理:暂收单作废收尾)',
       d.asp_time2 = GETDATE()
  FROM qc_catalog_detail d
  JOIN @ids i ON i.id = d.id
 WHERE ISNULL(d.asp_cancel, 'N') <> 'Y';

IF @@ROWCOUNT NOT IN (0, 10)
BEGIN
    RAISERROR(N'[回滚] 本次更新行数不是 0 或 10，与预期不符。', 16, 1);
    ROLLBACK;
    RETURN;
END

COMMIT;

PRINT N'处理后：目标行中未作废的有 ' + CAST((
    SELECT COUNT(*) FROM qc_catalog_detail d JOIN @ids i ON i.id = d.id
     WHERE ISNULL(d.asp_cancel, 'N') <> 'Y') AS nvarchar(10)) + N' 行（应为 0）';

-- 复核：这 10 行对应的检验单必须都已作废
SELECT d.id, d.检验单号, d.检验数据记录单号, d.物料编码, d.批次号, d.检验状态,
       ISNULL(s.canceled, 'N') AS 检验单已作废
  FROM qc_catalog_detail d
  JOIN @ids i ON i.id = d.id
  LEFT JOIN yj_doc_status s ON s.panel_code = 'QC_INSP' AND s.doc_no = d.检验单号
 ORDER BY d.id;
