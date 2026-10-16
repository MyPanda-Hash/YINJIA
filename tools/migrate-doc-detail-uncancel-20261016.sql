/* migrate-doc-detail-uncancel-20261016.sql — 全库扫描并复效「单头有效、明细却全部作废」的单据明细
 *
 * 【背景】用户报:来料检验单 IJ-2026-10-0011 起明细"为空"——实查是明细行被批量置 `asp_cancel='Y'`,
 *   面板/取数一律过滤作废行 ⇒ 界面看起来空(单头本身没作废)。随后用户补充:送料暂收单同样如此,
 *   并要求**检查有没有别的单据也这样**。
 *
 * 【实查(正式库)】
 *   · 来料检验单:IJ-2026-10-0011~0020(10 单 12 行)全部作废(作废时间 2026-10-15 11:23:14~17);
 *   · 送料暂收单:SL-2026-10-0111~0119(单据日期 2026-10-12,共 9 单 17 行)**全部作废**;
 *   · 其余区间(更早/更晚)都正常 ⇒ 是两批"只作废明细"的操作留下的半成品。
 *
 * 【本脚本】对下面成对列出的 表(单头, 明细) 逐对处理:
 *   把「单头未作废 且 该单明细行全部处于作废态」的明细**复效**(asp_cancel='N'),
 *   打标 `asp_user2='restore:20261016'` 便于回退(`UPDATE … SET asp_cancel='Y' WHERE asp_user2='restore:20261016'`)。
 *   只动"整单明细全废"的单,不碰部分作废(那通常是有意的行级操作)。
 * 【幂等】第二次执行影响 0 行。两账套都执行。
 */
SET NOCOUNT ON;

DECLARE @pairs TABLE (head sysname, line sysname);
INSERT INTO @pairs (head, line) VALUES
  -- 采购链四单
  ('sl_recv', 'sl_recv_detail'), ('qc_insp', 'qc_insp_detail'),
  ('qc_return', 'qc_return_detail'), ('bd_purchase_in', 'bl_purchase_in'),
  -- 库存出入库
  ('bd_material_out', 'bl_material_out'), ('bd_other_out', 'bl_other_out'),
  ('bd_other_in', 'bl_other_in'), ('bd_finish_in', 'bl_finish_in'),
  ('bd_sale_out', 'bl_sale_out'), ('bd_pu_order', 'bl_pu_order'), ('bd_so_order', 'bl_so_order'),
  -- 品质一族
  ('qc_tc_in', 'qc_tc_in_detail'), ('qc_bhg', 'qc_bhg_detail'), ('qc_bhc', 'qc_bhc_detail'),
  ('qc_bhz', 'qc_bhz_detail'), ('qc_jjf', 'qc_jjf_detail'), ('qc_scp', 'qc_scp_detail'),
  ('qc_lyb', 'qc_lyb_detail'), ('qc_scy', 'qc_scy_detail'), ('qc_asm_insp', 'qc_asm_insp_detail'),
  ('qc_mold_insp', 'qc_mold_insp_detail'), ('qc_cut_insp', 'qc_cut_insp_detail'),
  ('qc_insp_rec', 'qc_insp_rec_detail');

DECLARE @head sysname, @line sysname, @sql nvarchar(max), @n int, @total int = 0, @bad int = 0;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT head, line FROM @pairs
   WHERE OBJECT_ID(head) IS NOT NULL AND OBJECT_ID(line) IS NOT NULL
     AND COL_LENGTH(head, '单据编号') IS NOT NULL AND COL_LENGTH(line, '单据编号') IS NOT NULL
     AND COL_LENGTH(line, 'asp_cancel') IS NOT NULL;
OPEN cur FETCH NEXT FROM cur INTO @head, @line;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @sql = N'
    UPDATE d SET d.asp_cancel = ''N'', d.asp_user2 = N''restore:20261016'', d.asp_time2 = GETDATE()
    FROM [' + @line + N'] d
    WHERE ISNULL(d.asp_cancel, ''N'') = ''Y''
      AND EXISTS (SELECT 1 FROM [' + @head + N'] h WHERE h.单据编号 = d.单据编号 AND ISNULL(h.asp_cancel, ''N'') <> ''Y'')
      AND NOT EXISTS (SELECT 1 FROM [' + @line + N'] e
                       WHERE e.单据编号 = d.单据编号 AND ISNULL(e.asp_cancel, ''N'') <> ''Y'')';
  EXEC sp_executesql @sql;
  SET @n = @@ROWCOUNT;
  IF @n > 0 BEGIN
    SET @total = @total + @n;
    PRINT N'[复效] ' + @head + N' / ' + @line + N' : ' + CAST(@n AS nvarchar(10)) + N' 行';
  END
  FETCH NEXT FROM cur INTO @head, @line;
END
CLOSE cur DEALLOCATE cur;
PRINT N'[合计] 本次复效明细 ' + CAST(@total AS nvarchar(10)) + N' 行';
GO

/* ═══ 复扫:还有没有"单头有效、明细全废"的单(应 0) ═══ */
DECLARE @pairs2 TABLE (head sysname, line sysname);
INSERT INTO @pairs2 (head, line) VALUES
  ('sl_recv','sl_recv_detail'),('qc_insp','qc_insp_detail'),('qc_return','qc_return_detail'),
  ('bd_purchase_in','bl_purchase_in'),('bd_material_out','bl_material_out'),('bd_other_out','bl_other_out'),
  ('bd_other_in','bl_other_in'),('bd_finish_in','bl_finish_in'),('bd_sale_out','bl_sale_out'),
  ('bd_pu_order','bl_pu_order'),('bd_so_order','bl_so_order');
DECLARE @h2 sysname, @l2 sysname, @sql2 nvarchar(max), @left int = 0, @c int;
DECLARE cur2 CURSOR LOCAL FAST_FORWARD FOR
  SELECT head, line FROM @pairs2 WHERE OBJECT_ID(head) IS NOT NULL AND OBJECT_ID(line) IS NOT NULL
    AND COL_LENGTH(line,'asp_cancel') IS NOT NULL;
OPEN cur2 FETCH NEXT FROM cur2 INTO @h2, @l2;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @sql2 = N'SELECT @c = COUNT(*) FROM [' + @h2 + N'] h
                WHERE ISNULL(h.asp_cancel, ''N'') <> ''Y''
                  AND EXISTS (SELECT 1 FROM [' + @l2 + N'] d WHERE d.单据编号 = h.单据编号)
                  AND NOT EXISTS (SELECT 1 FROM [' + @l2 + N'] d WHERE d.单据编号 = h.单据编号 AND ISNULL(d.asp_cancel,''N'') <> ''Y'')';
  EXEC sp_executesql @sql2, N'@c int OUTPUT', @c = @c OUTPUT;
  IF @c > 0 BEGIN SET @left = @left + @c; PRINT N'[残留] ' + @h2 + N' : ' + CAST(@c AS nvarchar(10)) + N' 张'; END
  FETCH NEXT FROM cur2 INTO @h2, @l2;
END
CLOSE cur2 DEALLOCATE cur2;
DECLARE @dbn sysname = DB_NAME();
RAISERROR(N'[自检] %s:复扫残留「明细全废」单据 %d 张(应 0)', 10, 1, @dbn, @left);
IF @left = 0 RAISERROR(N'[OK] 全部单据的明细均已恢复', 10, 1);
ELSE RAISERROR(N'[FAIL] 仍有残留,见上面 [残留] 行', 16, 1);
GO
