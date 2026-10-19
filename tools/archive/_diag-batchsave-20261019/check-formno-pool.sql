/* =============================================================================
   check-formno-pool.sql — 号池回登体检(只读,不改任何数据)

   【为什么要查】FormNoService.next() 算号只看号池自己:
       seq = MAX(RIGHT(dh,4)) FROM s_allno WHERE lb=前缀 AND ny=yyyy-MM AND dh LIKE 前缀-ny-%
   exists() 也只查 s_allno + inh。所以只要业务表里有**没进号池**的单号
   (导库 / 直接写库 / 备份恢复没带 s_allno / 外部系统写入),
   下一次「新增 / 生单」就会把这个已存在的号再发一次。

   【症状】重发到的那张单若已审核,保存时被状态门禁拦下:
       ButtonService.saveDoc(): yj_doc_status.shr 非空 ⇒ 抛
       「已审核单据不可保存，请先弃审」(IllegalStateException → HTTP 409 409)
   注意 clearStaleDocStatus() 只清"业务表里查不到这个号"的孤儿状态行;
   撞到**真实存在**的单号时状态行照旧有效 ⇒ 门禁照旧拦,于是报文看起来
   跟「我正在生成一张新单」自相矛盾。

   【用法】只读;不要登记进 tools/db-migrations.txt(体检脚本)。
     cd tools
     java "-Dstdout.encoding=UTF-8" -cp lib\mssql-jdbc.jar DbSync.java  …(不适用,会登记)
     用一次性探针跑(见同目录 _Q.java):java …_Q.java archive\_diag-batchsave-20261019\check-formno-pool.sql

   【修法】tools\archive\_kingdee-reimport-20261016\backfill-formno-pool-imported.sql
           (逐表补登缺号,只增不删,幂等,末尾自带 PASS/FAIL 自检)。
   ============================================================================= */
SET NOCOUNT ON;
DECLARE @t TABLE (tbl sysname, col sysname);
INSERT INTO @t (tbl, col) VALUES
  ('bd_pu_order', N'单据编号'), ('bd_so_order', N'单据编号'),
  ('bd_purchase_in', N'单据编号'), ('bd_sale_out', N'单据编号'),
  ('bd_material_out', N'单据编号'), ('bd_finish_in', N'单据编号'),
  ('bd_other_in', N'单据编号'), ('bd_other_out', N'单据编号'),
  ('sl_recv', N'单据编号'), ('qc_insp', N'单据编号'), ('qc_insp_rec', N'单据编号'),
  ('plang', N'pl_no');
IF OBJECT_ID('tempdb..#r') IS NOT NULL DROP TABLE #r;
CREATE TABLE #r (tbl sysname, lb nvarchar(20), 库末号 nvarchar(60), 号池末号 nvarchar(60), 未回登张数 int);
DECLARE @tbl sysname, @col sysname, @sql nvarchar(max);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col FROM @t;
OPEN cur FETCH NEXT FROM cur INTO @tbl, @col;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF OBJECT_ID(@tbl) IS NOT NULL AND COL_LENGTH(@tbl, @col) IS NOT NULL
  BEGIN
    SET @sql = N'
      INSERT INTO #r (tbl, lb, 库末号, 号池末号, 未回登张数)
      SELECT ''' + @tbl + N''', x.lb, x.maxno,
             (SELECT MAX(h.dh) FROM s_allno h WHERE h.lb = x.lb), x.miss
      FROM (SELECT LEFT(h.[' + @col + N'], CHARINDEX(''-'', h.[' + @col + N']) - 1) AS lb,
                   MAX(h.[' + @col + N']) AS maxno,
                   SUM(CASE WHEN s.dh IS NULL THEN 1 ELSE 0 END) AS miss
            FROM [' + @tbl + N'] h
            LEFT JOIN s_allno s ON s.dh = h.[' + @col + N']
            WHERE h.[' + @col + N'] LIKE ''[A-Z]%-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9]''
            GROUP BY LEFT(h.[' + @col + N'], CHARINDEX(''-'', h.[' + @col + N']) - 1)) x;';
    EXEC sp_executesql @sql;
  END
  FETCH NEXT FROM cur INTO @tbl, @col;
END
CLOSE cur DEALLOCATE cur;
SELECT tbl AS 表, lb AS 前缀, 库末号, 号池末号, 未回登张数,
       CASE WHEN 未回登张数 = 0 THEN N'OK' ELSE N'缺号(下次新增会重发)' END AS 判定
FROM #r ORDER BY CASE WHEN 未回登张数 = 0 THEN 1 ELSE 0 END, tbl;
SELECT SUM(未回登张数) AS 总缺号张数 FROM #r;
DROP TABLE #r;
