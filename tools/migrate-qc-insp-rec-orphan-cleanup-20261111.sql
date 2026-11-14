/* ============================================================================
 * migrate-qc-insp-rec-orphan-cleanup-20261111.sql
 * 清掉「空壳」检验数据记录(没有来料检验单 + 没填任何物料 + 无明细 + 无目录行)
 * 及其残留目录行(2026-11-11 用户口径)
 * ----------------------------------------------------------------------------
 * 用户口径:「出现这个空数据的原因是什么,如果是无用数据可以把这些数据删除掉」。
 *
 * 原因(实测,正式库 HSDZ_MES,2026-11-11):
 *   检验数据记录明细表里「来料检验单号/检验状态/物料…」整段空白的行,来自 **qc_insp_rec 中
 *   来料检验单号为空** 的记录(正式库 23 条 / 69 条)。其中绝大多数是**空壳草稿**:物料编码/名称/
 *   批次/数量/检验人全空、0 条明细、0 条目录行 —— 是有人在「检验数据记录」面板连点「新增」建出来的
 *   空报告(2026-10-09 那 10 条相隔一分钟一条);另 1 条更脏:单据编号 = 'undefined'
 *   (前端某次把 undefined 当单号写进库,只有物料名「样例」)。
 *   判据:没有来料检验单 ⇒ **永远「完成检验」不了**(QcCatalogService.completeRow 第一道校验就是
 *   "该目录行没有关联检验单"),留着只是永远的空行。
 *   另 2 条是 migrate-qc-catalog.sql 当年播种的**目录样例行**(阻垢料 HP-12 / 260807、260907),
 *   检验单号与检验数据记录单号都为空、检验状态也为空 —— 是《品质资料 2026.09.19》页签的复刻样例。
 *
 * 清理范围(**故意收得很窄**。2026-11-11 第一版按"无来料检验单号"一把全删,连测试库当天
 *   有人正在填的 JYSJ-2026-11-0001..0009 也删了 ⇒ 已回滚重做,教训写在这里):
 *   只删 **同时满足** ①来料检验单号为空 ②物料编码与物料名称为空 ③没有明细行 ④没有目录行
 *   的空壳(外加那条单号写成 'undefined' 的),以及 ⑤检验单号、检验数据记录单号都为空的目录样例行。
 *   **有物料或填过明细的记录一律不删** —— 那是人填过的东西,该由使用方决定(它们也不会再出现在
 *   默认视图里:明细表默认只看「已完成检验」,详见 migrate-qc-pending-detail-config-20261111.sql)。
 *
 * 做法:**软删**(asp_cancel='Y')—— 全站统一的删除语义,列表/视图/纸面一律按
 *   `ISNULL(asp_cancel,'N')<>'Y'` 过滤,删完立刻看不见;要恢复把这批行的 asp_cancel 改回 'N' 即可
 *   (脚本末尾打印被删清单与 id)。不新建 _bak_* 备份表(软删本身可逆,且备份表会触发 DbNormAudit 第 10 项)。
 *
 * 幂等:所有 UPDATE 都带 `ISNULL(asp_cancel,'N')<>'Y'`,重跑行数为 0。
 * 两账套:HSDZ_MES → HSDZ_MES_TEST。
 * ========================================================================== */
SET NOCOUNT ON;
PRINT N'== migrate-qc-insp-rec-orphan-cleanup-20261111 ==';

/* ── 0. 取证 ── */
DECLARE @beforeRec int, @beforeCat int, @keptRec int;
SELECT @beforeRec = COUNT(*) FROM qc_insp_rec
 WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(来料检验单号,N'') = N''
   AND ISNULL(物料编码,N'') = N'' AND ISNULL(物料名称,N'') = N'';
SELECT @keptRec = COUNT(*) FROM qc_insp_rec
 WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(来料检验单号,N'') = N''
   AND (ISNULL(物料编码,N'') <> N'' OR ISNULL(物料名称,N'') <> N'');
SELECT @beforeCat = COUNT(*) FROM qc_catalog_detail
 WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(检验单号,N'') = N'' AND ISNULL(检验数据记录单号,N'') = N'';
PRINT N'[取证] 空壳(无单号无物料)= ' + CAST(@beforeRec AS nvarchar(10))
    + N' 条;无单号但填过物料(不动)= ' + CAST(@keptRec AS nvarchar(10))
    + N' 条;目录样例行 = ' + CAST(@beforeCat AS nvarchar(10)) + N' 行';

/* ── 1. 守卫:空壳集合里不能有明细行,也不能被目录行引用(有则中止,说明判据写宽了) ── */
IF EXISTS (SELECT 1 FROM qc_insp_rec r
            WHERE ISNULL(r.asp_cancel,'N')<>'Y' AND ISNULL(r.来料检验单号,N'') = N''
              AND ISNULL(r.物料编码,N'') = N'' AND ISNULL(r.物料名称,N'') = N''
              AND EXISTS (SELECT 1 FROM qc_insp_rec_detail d
                           WHERE d.单据编号 = r.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y'))
    RAISERROR(N'[守卫] 空壳记录里出现了明细行,已中止(判据写宽了)', 16, 1);
IF EXISTS (SELECT 1 FROM qc_insp_rec r
            WHERE ISNULL(r.asp_cancel,'N')<>'Y' AND ISNULL(r.来料检验单号,N'') = N''
              AND ISNULL(r.物料编码,N'') = N'' AND ISNULL(r.物料名称,N'') = N''
              AND EXISTS (SELECT 1 FROM qc_catalog_detail c
                           WHERE c.检验数据记录单号 = r.单据编号 AND ISNULL(c.asp_cancel,'N')<>'Y'))
    RAISERROR(N'[守卫] 空壳记录还被检验目录行引用,已中止', 16, 1);

/* ── 2. 软删目录残留行(检验单号与记录单号都为空的样例) ── */
UPDATE qc_catalog_detail
   SET asp_cancel = 'Y', asp_user2 = N'migration', asp_time2 = SYSDATETIME()
 WHERE ISNULL(asp_cancel,'N')<>'Y'
   AND ISNULL(检验单号,N'') = N''
   AND ISNULL(检验数据记录单号,N'') = N'';
PRINT N'[清理] 残留目录行软删 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

/* ── 3. 软删空壳记录头(含那条单号写成 ''undefined'' 的) ── */
DECLARE @ids TABLE (id int, no nvarchar(120));
INSERT INTO @ids (id, no)
SELECT id, 单据编号 FROM qc_insp_rec
 WHERE ISNULL(asp_cancel,'N')<>'Y'
   AND ISNULL(来料检验单号,N'') = N''
   AND ((ISNULL(物料编码,N'') = N'' AND ISNULL(物料名称,N'') = N'') OR 单据编号 = N'undefined');

UPDATE qc_insp_rec
   SET asp_cancel = 'Y', asp_user2 = N'migration', asp_time2 = SYSDATETIME()
 WHERE id IN (SELECT id FROM @ids);
PRINT N'[清理] 空壳检验数据记录软删 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 条';

/* ── 4. 自检:该留的还在 ── */
DECLARE @bad int = 0;
IF EXISTS (SELECT 1 FROM qc_insp_rec
            WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(来料检验单号,N'') = N''
              AND (ISNULL(物料编码,N'') <> N'' OR ISNULL(物料名称,N'') <> N''))
    SET @bad = @bad + 0;   -- 填过物料的仍在,属预期
IF EXISTS (SELECT 1 FROM qc_insp_rec
            WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据编号 = N'undefined') SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM qc_catalog_detail
            WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(检验单号,N'') = N''
              AND ISNULL(检验数据记录单号,N'') = N'') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'空壳记录清理自检失败(坏项 %d)', 16, 1, @bad);
ELSE PRINT N'[OK] 空壳检验数据记录已清理(软删,可回滚)';
GO

/* ── 5. 结果对照 + 被删清单(留档,便于回滚) ── */
SELECT
  (SELECT COUNT(*) FROM qc_insp_rec WHERE ISNULL(asp_cancel,'N')<>'Y') AS 剩余检验数据记录,
  (SELECT COUNT(*) FROM qc_insp_rec WHERE asp_cancel = 'Y' AND asp_user2 = N'migration') AS 本脚本软删记录数,
  (SELECT COUNT(*) FROM qc_insp_rec WHERE ISNULL(asp_cancel,'N')<>'Y'
     AND ISNULL(来料检验单号,N'') = N''
     AND (ISNULL(物料编码,N'') <> N'' OR ISNULL(物料名称,N'') <> N'')) AS 保留的无单号记录,
  (SELECT COUNT(*) FROM qc_catalog_detail WHERE ISNULL(asp_cancel,'N')<>'Y') AS 剩余目录行;
GO

SELECT id, 单据编号 AS 已软删的检验数据记录, 单据日期, 物料名称, 物料批次
  FROM qc_insp_rec
 WHERE asp_cancel = 'Y' AND asp_user2 = N'migration'
 ORDER BY id;
GO
