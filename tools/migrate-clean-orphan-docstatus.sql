/* ============================================================
   migrate-clean-orphan-docstatus.sql
   ------------------------------------------------------------
   问题:单号被"释放"后会重新发放(删除单据/一次性清理脚本删了单据行),
        但 yj_doc_status 里的状态行没跟着删 -> 成为"孤儿状态行"。
        下次同一个单号被重新发放时,新单会**继承旧行的 archived/canceled/pending**,
        表现就是:新增一张单据,它一出生就是「已归档」(或已作废),填不了数据。
        2026-09-10 实测:RD_APPROVAL 10 条、RD_PLAN 5 条孤儿,新增即归档。

   本脚本:按 yj_panel 里所有 mode='doc' 的面板,逐个删除
          "单据表已无对应行" 的状态行(只删孤儿,不动任何在册单据的状态)。

   幂等:重复执行无副作用(孤儿删完就没了)。
   执行:sqlcmd -S localhost -d HSDZ_MES -E -f i:65001,o:65001 -i migrate-clean-orphan-docstatus.sql
   ============================================================ */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;

DECLARE @pc sysname, @tb sysname, @gc sysname, @sql nvarchar(max), @total int = 0, @n int;

DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT panel_code, head_table, group_col
      FROM yj_panel
     WHERE mode = 'doc' AND head_table IS NOT NULL AND group_col IS NOT NULL;

OPEN cur;
FETCH NEXT FROM cur INTO @pc, @tb, @gc;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID(@tb) IS NOT NULL
    BEGIN
        SET @sql = N'DELETE s FROM yj_doc_status s WHERE s.panel_code = @p AND NOT EXISTS ('
                 + N'SELECT 1 FROM [' + @tb + N'] t WHERE t.[' + @gc + N'] = s.doc_no)';
        BEGIN TRY
            EXEC sp_executesql @sql, N'@p sysname', @p = @pc;
            SET @n = @@ROWCOUNT;
            IF @n > 0
            BEGIN
                SET @total = @total + @n;
                PRINT N'  ' + @pc + N' 清理孤儿状态行 ' + CAST(@n AS nvarchar(10)) + N' 条';
            END
        END TRY
        BEGIN CATCH
            PRINT N'  [跳过] ' + @pc + N' : ' + ERROR_MESSAGE();
        END CATCH
    END
    FETCH NEXT FROM cur INTO @pc, @tb, @gc;
END
CLOSE cur; DEALLOCATE cur;

PRINT N'=== migrate-clean-orphan-docstatus 完成:共清理 ' + CAST(@total AS nvarchar(10)) + N' 条孤儿状态行 ===';

-- 复查:应无输出
SELECT s.panel_code, s.doc_no, s.archived, s.canceled
  FROM yj_doc_status s
 WHERE s.panel_code = 'RD_APPROVAL'
   AND NOT EXISTS (SELECT 1 FROM rd_approval p WHERE p.单据编号 = s.doc_no);
GO
