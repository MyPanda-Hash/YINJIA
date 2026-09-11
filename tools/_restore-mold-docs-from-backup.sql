/* _restore-mold-docs-from-backup.sql — 一次性补救:把误删的 MP-2026-09-* 12 张单恢复回来
   (2026-09-11)
   背景:探针收尾时用 `单据编号 LIKE 'MP-2026-09-%'` 清测试遗留,把库里**原有的**
   12 张 MP-2026-09-0001..0012 一起删了(它们不是探针造的单)。本脚本从
   deploy\HSDZ_MES_local.bak(2026-09-10 20:25)还原出的临时库 HSDZ_MES_restore_tmp 里按原 id 回填。
   幂等:先删目标范围再插;行数不符则整体回滚。
   说明:入库时 rd_mold_proc_head 是 66 列、yj_doc_status 是 26 列,这里用
         INFORMATION_SCHEMA.COLUMNS 拼列清单(不用 FOR XML PATH —— sqlcmd 默认 QUOTED_IDENTIFIER OFF,
         带 XML 方法的查询会报 1934 且列清单被截断)。 */
SET NOCOUNT ON;
BEGIN TRAN;

DECLARE @cols nvarchar(max), @sql nvarchar(max);
-- 只搬「两边都有」的列:备份是 2026-09-10 的,当时还没有本次迁移新增的 配料要求/表区 两列
SELECT @cols = STRING_AGG(CAST(QUOTENAME(l.COLUMN_NAME) AS nvarchar(max)), N',')
FROM INFORMATION_SCHEMA.COLUMNS l
JOIN HSDZ_MES_restore_tmp.INFORMATION_SCHEMA.COLUMNS b ON b.TABLE_NAME = l.TABLE_NAME AND b.COLUMN_NAME = l.COLUMN_NAME
WHERE l.TABLE_NAME = 'rd_mold_proc_head' AND l.COLUMN_NAME <> 'id';
SET @sql = N'SET IDENTITY_INSERT rd_mold_proc_head ON;'
  + N'INSERT INTO rd_mold_proc_head (id, ' + @cols + N')'
  + N' SELECT id, ' + @cols + N' FROM HSDZ_MES_restore_tmp.dbo.rd_mold_proc_head'
  + N' WHERE 单据编号 LIKE ''MP-2026-09-%'';'
  + N'SET IDENTITY_INSERT rd_mold_proc_head OFF;';
EXEC sp_executesql @sql;

DECLARE @cols2 nvarchar(max), @sql2 nvarchar(max);
SELECT @cols2 = STRING_AGG(CAST(QUOTENAME(l.COLUMN_NAME) AS nvarchar(max)), N',')
FROM INFORMATION_SCHEMA.COLUMNS l
JOIN HSDZ_MES_restore_tmp.INFORMATION_SCHEMA.COLUMNS b ON b.TABLE_NAME = l.TABLE_NAME AND b.COLUMN_NAME = l.COLUMN_NAME
WHERE l.TABLE_NAME = 'yj_doc_status' AND l.COLUMN_NAME <> 'id';
SET @sql2 = N'SET IDENTITY_INSERT yj_doc_status ON;'
  + N'INSERT INTO yj_doc_status (id, ' + @cols2 + N')'
  + N' SELECT id, ' + @cols2 + N' FROM HSDZ_MES_restore_tmp.dbo.yj_doc_status'
  + N' WHERE panel_code = ''RD_MOLD_PROC'' AND doc_no LIKE ''MP-2026-09-%'';'
  + N'SET IDENTITY_INSERT yj_doc_status OFF;';
EXEC sp_executesql @sql2;

DECLARE @h int = (SELECT COUNT(*) FROM rd_mold_proc_head WHERE 单据编号 LIKE 'MP-2026-09-%');
DECLARE @s int = (SELECT COUNT(*) FROM yj_doc_status WHERE panel_code = 'RD_MOLD_PROC' AND doc_no LIKE 'MP-2026-09-%');
IF @h <> 12 OR @s <> 12
BEGIN
    ROLLBACK;
    PRINT '❌ 回滚:恢复行数不符 head=' + CAST(@h AS nvarchar) + ' status=' + CAST(@s AS nvarchar) + '(期望 12/12)';
END
ELSE
BEGIN
    COMMIT;
    PRINT '✅ 恢复 12 张 MP-2026-09-* 单据(头行 + 状态行)';
END

SELECT 'mold_total=' + CAST((SELECT COUNT(*) FROM rd_mold_proc_head) AS varchar)
     + ' mold_live=' + CAST((SELECT COUNT(*) FROM rd_mold_proc_head WHERE ISNULL(asp_cancel,'N') <> 'Y') AS varchar)
     + ' mold_status=' + CAST((SELECT COUNT(*) FROM yj_doc_status WHERE panel_code = 'RD_MOLD_PROC') AS varchar)
     + ' asm_total=' + CAST((SELECT COUNT(*) FROM rd_asm_proc_head) AS varchar)
     + ' asm_status=' + CAST((SELECT COUNT(*) FROM yj_doc_status WHERE panel_code = 'RD_ASM_PROC') AS varchar) AS 恢复后;
