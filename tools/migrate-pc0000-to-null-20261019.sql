/* =============================================================================
   migrate-pc0000-to-null-20261019.sql
   PC0000(金蝶默认占位批号)统一归一为「无批号」(NULL)

   【用户口径 2026-10-19】「pc0000全部改为无批号,出库也可以对有批次号的出库,
   验收阶段先不管批次号」

   【为什么要归一】
   金蝶对「未启用批次管理」的商品,在单据与库存接口里统一填默认批号 `PC0000`,
   并不留空。MES 把这个占位值当成**真实批号**参与 kucun 三键 (物料,仓库,批号) 分账,
   于是出现大量「PC0000 行只出不进 → 结存为负」的假负数(实测归一前 534 行批次负结存)。

   归一后:PC0000 ≡ 无批号 ≡ `lot_no IS NULL`,与金蝶语义一致
   —— 金蝶里「空批号」与「PC0000」本就是一回事。

   【范围】只动**数据值**,不改表结构、不改视图定义:
     · kucun.lot_no      = 'PC0000'  → NULL
     · inh.批号           = 'PC0000'  → NULL
     · outh.批号          = 'PC0000'  → NULL

   【会不会丢数】不会。只是把一个占位字符串换成 NULL:
     · 按 (物料, 仓库) 汇总的余量**逐分不变**(见自检 ①);
     · kucun 行数会减少 —— PC0000 行与原本就无批号的行合并(预期 2,453 → 2,283);
     · 若归一后同一 (物料,仓库) 出现多行(原本 PC0000 与 NULL 各一行),**必须合并成一行**,
       否则 kucun 三键重复会让出库匹配到任意一行,余额失真。

   【幂等】`RTRIM(x) = N'PC0000'` 命中不到 NULL,重复执行天然 no-op。
   【执行】两账套都要跑(先 HSDZ_MES,后 HSDZ_MES_TEST):
     cd tools
     java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run migrate-pc0000-to-null-20261019.sql
     YINJIA_SQL_DB=HSDZ_MES_TEST java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run migrate-pc0000-to-null-20261019.sql

   ⚠ 与《上线前必验-库存批次追溯.md》的关系:本脚本是**验收期的口径统一**,
     不改变"上线当天必须恢复按批次核销"的结论。

   ╔═══════════════════════════════════════════════════════════════════════╗
   ║ 🔴 本条**推翻了 2026-10-15 的** migrate-lot-normalize-blank-to-pc0000.sql ║
   ╚═══════════════════════════════════════════════════════════════════════╝
   那个脚本的方向是「空批号 → PC0000」(为了把"空"与"PC0000"两族合并);
   本次用户口径是**反过来的**「PC0000 → 空批号」—— 因为 PC0000 是金蝶的**占位值**,
   不是真实批号,把它当成真实批次参与分账正是负库存的根源。
   ⇒ **不要**再把本脚本倒回去,也不要重跑 migrate-lot-normalize-blank-to-pc0000.sql
     (重跑会把本脚本的成果直接抵消)。两者方向相反,这是有意的口径变更,不是遗漏。
   ============================================================================= */
SET NOCOUNT ON;

/* ═══════════════════ ① 备份(归一前的 PC0000 行)═══════════════════ */
DECLARE @bak nvarchar(200) = N'dbo._bak_pc0000_' + CONVERT(nvarchar(8), GETDATE(), 112);
PRINT N'[备份] 归一前 PC0000 行备份到 ' + @bak + N'_(kucun/inh/outh)(若已存在则跳过建表)';

IF OBJECT_ID(@bak + N'_kucun', 'U') IS NULL
  EXEC(N'SELECT * INTO ' + @bak + N'_kucun FROM kucun WHERE RTRIM(ISNULL(lot_no,N'''')) = N''PC0000''');
IF OBJECT_ID(@bak + N'_inh', 'U') IS NULL
  EXEC(N'SELECT * INTO ' + @bak + N'_inh FROM inh WHERE RTRIM(ISNULL(批号,N'''')) = N''PC0000''');
IF OBJECT_ID(@bak + N'_outh', 'U') IS NULL
  EXEC(N'SELECT * INTO ' + @bak + N'_outh FROM outh WHERE RTRIM(ISNULL(批号,N'''')) = N''PC0000''');
GO

/* ═══════════════════ ② 记录归一前基线(供自检比对,落永久表跨批次存活)═══════════════════ */
-- ⚠ 不用 #临时表:它在 GO 之后不跨批次存活,自检段会取不到(2026-10-19 实测报"列名 yl 无效")。
IF OBJECT_ID('dbo._bak_pc0000_baseline', 'U') IS NULL
  SELECT CAST(COUNT(*) AS int) AS 行数,
         CAST(ISNULL(SUM(yl),0) AS decimal(18,4)) AS 余量
    INTO dbo._bak_pc0000_baseline
    FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y';
GO

/* ═══════════════════ ③ kucun:先合并重复键,再归一 ═══════════════════ */
-- 3.1 同一 (物料,仓库) 同时存在 PC0000 行与无批号行时,把 PC0000 的数并入无批号那行
--     (保留 id 小的那行做"无批号行";rkl/ckl 一并累加,保证明细口径自洽)
--     ⚠ PRINT 不能直接跟在 WITH ... 之后(语法错误),故计数与 UPDATE 分开两个批次。
DECLARE @dupPairs int;
;WITH dup AS (
  SELECT wzdm, ckdm
    FROM kucun
   WHERE ISNULL(asp_cancel,'N') <> 'Y'
   GROUP BY wzdm, ckdm
  HAVING SUM(CASE WHEN RTRIM(ISNULL(lot_no,'')) = N'' THEN 1 ELSE 0 END) > 0
     AND SUM(CASE WHEN RTRIM(ISNULL(lot_no,'')) = N'PC0000' THEN 1 ELSE 0 END) > 0
)
SELECT @dupPairs = COUNT(*) FROM dup;
PRINT N'[合并] 同时有 PC0000 行与无批号行的 (物料,仓库) 组合数 = ' + CAST(@dupPairs AS nvarchar(10));
GO

-- 把 PC0000 行的 rkl/ckl/yl 累加到该 (物料,仓库) 的**无批号行**(保留 id 最小的那行),
-- 然后删掉被合并的 PC0000 行。
-- ⚠ 踩坑记录(2026-10-19,连错三次):
--   · `SET k.yl = ...` 带别名前缀 ⇒ 报「列名 'yl' 无效」—— **SET 子句里不能带表别名**;
--   · `PRINT (SELECT ...)` ⇒ 报「在此上下文中不允许使用子查询」;
--   · `#临时表` 在 GO 之后不跨批次存活 ⇒ 自检段取不到。
--   故:聚合落**永久表**、SET 不带前缀、计数先取到变量再 PRINT。
IF OBJECT_ID('dbo._bak_pc0000_merge', 'U') IS NOT NULL DROP TABLE dbo._bak_pc0000_merge;
SELECT wzdm, ckdm,
       CAST(MIN(id) AS int) AS 保留id,
       CAST(SUM(ISNULL(rkl,0)) AS float) AS m_rkl,
       CAST(SUM(ISNULL(ckl,0)) AS float) AS m_ckl,
       CAST(SUM(ISNULL(yl,0)) AS float) AS m_yl
  INTO dbo._bak_pc0000_merge
  FROM kucun
 WHERE ISNULL(asp_cancel,'N') <> 'Y'
   AND (RTRIM(ISNULL(lot_no,'')) = N'' OR RTRIM(ISNULL(lot_no,'')) = N'PC0000')
 GROUP BY wzdm, ckdm
HAVING SUM(CASE WHEN RTRIM(ISNULL(lot_no,'')) = N'' THEN 1 ELSE 0 END) > 0
   AND SUM(CASE WHEN RTRIM(ISNULL(lot_no,'')) = N'PC0000' THEN 1 ELSE 0 END) > 0;
DECLARE @mCnt int = @@ROWCOUNT;
PRINT N'  待合并的 (物料,仓库) 组合:' + CAST(@mCnt AS nvarchar(10)) + N' 组';

DECLARE @u1 int = 0;
UPDATE k
   SET rkl = m.m_rkl, ckl = m.m_ckl, yl = m.m_yl,
       update_date = GETDATE(), asp_user2 = N'migrate-pc0000', asp_time2 = GETDATE()
  FROM kucun k JOIN dbo._bak_pc0000_merge m ON m.保留id = k.id;
SET @u1 = @@ROWCOUNT;
PRINT N'  已把 PC0000 行的量并入无批号行:' + CAST(@u1 AS nvarchar(10)) + N' 行';

DECLARE @u2 int = 0;
DELETE k
  FROM kucun k JOIN dbo._bak_pc0000_merge m ON m.wzdm = k.wzdm AND m.ckdm = k.ckdm
 WHERE k.id <> m.保留id AND RTRIM(ISNULL(k.lot_no,'')) = N'PC0000';
SET @u2 = @@ROWCOUNT;
PRINT N'  已删除被合并的 PC0000 行:' + CAST(@u2 AS nvarchar(10)) + N' 行';
GO

-- 3.2 剩余 PC0000 行直接置 NULL
UPDATE kucun SET lot_no = NULL, update_date = GETDATE(),
                 asp_user2 = N'migrate-pc0000', asp_time2 = GETDATE()
 WHERE RTRIM(ISNULL(lot_no,'')) = N'PC0000';
PRINT N'[归一] kucun.lot_no PC0000 → NULL:' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

/* ═══════════════════ ④ inh / outh:批号归一 ═══════════════════ */
UPDATE inh SET 批号 = NULL WHERE RTRIM(ISNULL(批号,'')) = N'PC0000';
PRINT N'[归一] inh.批号 PC0000 → NULL:' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
UPDATE outh SET 批号 = NULL WHERE RTRIM(ISNULL(批号,'')) = N'PC0000';
PRINT N'[归一] outh.批号 PC0000 → NULL:' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

/* ═══════════════════ ⑤ 自检 ═══════════════════ */
DECLARE @left int = 0;
SELECT @left = (SELECT COUNT(*) FROM kucun WHERE RTRIM(ISNULL(lot_no,'')) = N'PC0000')
             + (SELECT COUNT(*) FROM inh WHERE RTRIM(ISNULL(批号,'')) = N'PC0000')
             + (SELECT COUNT(*) FROM outh WHERE RTRIM(ISNULL(批号,'')) = N'PC0000');
PRINT CASE WHEN @left = 0 THEN N'[OK] ① 三张表已无 PC0000'
           ELSE N'[FAIL] ① 仍有 ' + CAST(@left AS nvarchar(10)) + N' 行 PC0000' END;

-- ② kucun 行数 / 余量(基线取自 ② 落的永久表)
DECLARE @an int, @aq decimal(18,4), @bn int, @bq decimal(18,4);
SELECT @an = 行数, @aq = 余量 FROM dbo._bak_pc0000_baseline;
SELECT @bn = COUNT(*), @bq = CAST(ISNULL(SUM(yl),0) AS decimal(18,4)) FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y';
PRINT N'② kucun 行数 ' + CAST(@an AS nvarchar(10)) + N' → ' + CAST(@bn AS nvarchar(10))
    + N';余量 ' + CAST(@aq AS nvarchar(30)) + N' → ' + CAST(@bq AS nvarchar(30));
PRINT CASE WHEN ABS(@aq - @bq) < 0.01 THEN N'[OK] ② 余量合计未变(归一不丢数)'
           ELSE N'[FAIL] ② 余量合计变了 ' + CAST(@aq - @bq AS nvarchar(30)) END;

-- ③ 结存 == Σ流水(含期初;排除月结结转)
DECLARE @bad int;
SELECT @bad = COUNT(*) FROM (
  SELECT ISNULL(a.k, b.k) AS k, ISNULL(a.net,0) AS net, ISNULL(b.yl,0) AS yl FROM
  (SELECT CONCAT(物料编码,N'|',ISNULL(RTRIM(仓库编码),N''),N'|',ISNULL(RTRIM(批号),N'')) AS k, SUM(数量) AS net
     FROM (SELECT 物料编码,仓库编码,批号,数量 FROM inh
            WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,N'')<>N'月结结转'
           UNION ALL
           SELECT 物料编码,仓库编码,批号,-数量 FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y') s
    GROUP BY CONCAT(物料编码,N'|',ISNULL(RTRIM(仓库编码),N''),N'|',ISNULL(RTRIM(批号),N''))) a
  FULL OUTER JOIN
  (SELECT CONCAT(wzdm,N'|',ISNULL(RTRIM(ckdm),N''),N'|',ISNULL(RTRIM(lot_no),N'')) AS k, SUM(yl) AS yl
     FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y'
    GROUP BY CONCAT(wzdm,N'|',ISNULL(RTRIM(ckdm),N''),N'|',ISNULL(RTRIM(lot_no),N''))) b
    ON a.k = b.k
  WHERE ABS(ISNULL(a.net,0) - ISNULL(b.yl,0)) > 0.0001
) x;
PRINT CASE WHEN @bad = 0 THEN N'[OK] ③ 结存 == Σ流水(0 个键不一致)'
           ELSE N'[FAIL] ③ 结存与流水不一致 ' + CAST(@bad AS nvarchar(10)) + N' 个键' END;

-- ④ kucun 三键唯一性(归一并合并后不允许重复)
DECLARE @dup int;
SELECT @dup = COUNT(*) FROM (
  SELECT wzdm, ckdm, RTRIM(ISNULL(lot_no,'')) AS l FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y'
  GROUP BY wzdm, ckdm, RTRIM(ISNULL(lot_no,'')) HAVING COUNT(*) > 1) t;
PRINT CASE WHEN @dup = 0 THEN N'[OK] ④ kucun 三键无重复'
           ELSE N'[FAIL] ④ kucun 三键重复 ' + CAST(@dup AS nvarchar(10)) + N' 组' END;

-- ⑤ 负结存分布
DECLARE @neg int = (SELECT COUNT(*) FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(yl,0) < 0);
DECLARE @negMat int;
SELECT @negMat = COUNT(*) FROM (
  SELECT wzdm, ckdm, SUM(yl) AS s FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y'
   GROUP BY wzdm, ckdm HAVING SUM(yl) < -0.0001) t;
PRINT N'⑤ 批次负结存 ' + CAST(@neg AS nvarchar(10)) + N' 行;按(物料,仓库)汇总为负的真缺货 ' + CAST(@negMat AS nvarchar(10)) + N' 组';
GO
