/* =============================================================================
   backfill-formno-pool-imported.sql — 把「导库进来的单据编号」回登号池 s_allno

   【为什么必须做】FormNoService.next() 是这么算号的:
       seq = MAX(CAST(RIGHT(dh,4) AS int)) FROM s_allno WHERE lb=前缀 AND ny=yyyy-MM AND dh LIKE 前缀-ny-%
     即**只看号池自己**;exists() 也只查 s_allno + inh。而本次 DATA 导入是直接写库、没走应用的取号,
     于是号池停在被导数据之前 ⇒ 新单会**发出库里已存在的号**。
   【实测(2026-10-16)】本地 IJ 池末号 IJ-2026-10-0010,而库里已有 IJ-2026-10-0011~0020 ——
     造检验单时「新增」连发 10 个重号,被脚本的防重闸门拦下(见 _gen-qc-insp-20261016.mjs 的 freeNo)。
     同类风险覆盖本次导入的全部单据类型(采购入库 CGRK / 销售出库 XSCK / 材料出库 SCLL / 产成品 CPRK /
     其他出入库 QTRK·QTCK / 暂收 SL / 检验 IJ / 检验记录 JYSJ / 采购订单 YJ / 销售订单 ZL·LZW / 工单 GD)。

   【做法】与 migrate-formno-style.sql 的「历史横杠单号回登号池」同一口径:
     逐张单据头表取 `单据编号 LIKE '前缀-yyyy-MM-四位数字'` 的行,凡号池里没有的**补登一行**
     (comm='0'、lb=前缀段、ny=yyyy-MM、asp_user1='import-backfill')。只增不删。
   ⚠ 号池只增不删是项目铁律(删了会重发号,见 archive/_cleanup-probe-junk-20260911.sql)。
   【幂等】按 dh 不存在才插;可重复跑。两账套都执行(先 HSDZ_MES 后 HSDZ_MES_TEST)。
   【执行】cd tools
     java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run archive\_kingdee-reimport-20261016\backfill-formno-pool-imported.sql
   ⚠ 不要登记进 tools/db-migrations.txt。
   ============================================================================= */
SET NOCOUNT ON;

DECLARE @t TABLE (tbl sysname, col sysname);
INSERT INTO @t (tbl, col) VALUES
  -- 本次导入的 8 类单据头 + 暂收/检验链路(列名统一是「单据编号」)
  ('bd_pu_order', N'单据编号'), ('bd_so_order', N'单据编号'),
  ('bd_purchase_in', N'单据编号'), ('bd_sale_out', N'单据编号'),
  ('bd_material_out', N'单据编号'), ('bd_finish_in', N'单据编号'),
  ('bd_other_in', N'单据编号'), ('bd_other_out', N'单据编号'),
  ('sl_recv', N'单据编号'), ('qc_insp', N'单据编号'), ('qc_insp_rec', N'单据编号'),
  -- 生产工单(plang 用 pl_no,格式同为 GD-yyyy-MM-nnnn)
  ('plang', N'pl_no');

DECLARE @tbl sysname, @col sysname, @sql nvarchar(max), @n int, @total int = 0;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col FROM @t;
OPEN cur FETCH NEXT FROM cur INTO @tbl, @col;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF OBJECT_ID(@tbl) IS NOT NULL AND COL_LENGTH(@tbl, @col) IS NOT NULL
  BEGIN
    SET @sql = N'
      INSERT INTO s_allno (comm, dh, lb, ny, asp_user1, asp_time1, asp_cancel)
      SELECT ''0'', h.[' + @col + N'],
             LEFT(h.[' + @col + N'], CHARINDEX(''-'', h.[' + @col + N']) - 1),
             SUBSTRING(h.[' + @col + N'], CHARINDEX(''-'', h.[' + @col + N']) + 1, 7),
             ''import-backfill'', GETDATE(), ''N''
      FROM [' + @tbl + N'] h
      WHERE h.[' + @col + N'] LIKE ''[A-Z]%-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9]''
        AND NOT EXISTS (SELECT 1 FROM s_allno s WHERE s.dh = h.[' + @col + N']);';
    EXEC sp_executesql @sql;
    SET @n = @@ROWCOUNT;
    IF @n > 0 BEGIN SET @total = @total + @n; PRINT N'[回登] ' + @tbl + N' : ' + CAST(@n AS nvarchar(10)) + N' 个号'; END
  END
  FETCH NEXT FROM cur INTO @tbl, @col;
END
CLOSE cur DEALLOCATE cur;
PRINT N'[合计] 回登号池 ' + CAST(@total AS nvarchar(10)) + N' 个单据编号';

/* 自检:各前缀「库里最大号」是否已进入号池(缺一个就报 FAIL) */
DECLARE @miss TABLE (lb sysname, dh nvarchar(50));
INSERT INTO @miss (lb, dh)
SELECT LEFT(h.单据编号, CHARINDEX('-', h.单据编号) - 1), MAX(h.单据编号)
FROM (
  SELECT 单据编号 FROM bd_purchase_in UNION ALL SELECT 单据编号 FROM bd_sale_out
  UNION ALL SELECT 单据编号 FROM bd_material_out UNION ALL SELECT 单据编号 FROM bd_finish_in
  UNION ALL SELECT 单据编号 FROM bd_other_in UNION ALL SELECT 单据编号 FROM bd_other_out
  UNION ALL SELECT 单据编号 FROM bd_pu_order UNION ALL SELECT 单据编号 FROM bd_so_order
  UNION ALL SELECT 单据编号 FROM sl_recv UNION ALL SELECT 单据编号 FROM qc_insp
) h
WHERE h.单据编号 LIKE '[A-Z]%-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9]'
GROUP BY LEFT(h.单据编号, CHARINDEX('-', h.单据编号) - 1);
SELECT m.lb AS 前缀, m.dh AS 库里最大号, CASE WHEN EXISTS (SELECT 1 FROM s_allno s WHERE s.dh = m.dh) THEN N'OK' ELSE N'缺失' END AS 号池
FROM @miss m ORDER BY m.lb;
DECLARE @bad int = (SELECT COUNT(*) FROM @miss m WHERE NOT EXISTS (SELECT 1 FROM s_allno s WHERE s.dh = m.dh));
DECLARE @dbn sysname = DB_NAME();
IF @bad = 0
  RAISERROR(N'[OK] %s:各前缀最大号均已进入号池(续号不会重发)', 10, 1, @dbn);
ELSE
  RAISERROR(N'[FAIL] %s:仍有 %d 个前缀的最大号不在号池', 16, 1, @dbn, @bad);
GO
