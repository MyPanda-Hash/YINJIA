/* ============================================================================
 * migrate-clean-blank-prodinfo-and-dept-20261104.sql
 *
 * 目的(用户 2026-11-04「检查烧结工艺清单录单流程」时确认的 F 项:清掉脏数据)
 *   ① 产品信息表(RD_PROD_INFO)里的**空单**:产品编号与产品名称都为空的行。
 *      这些行是探针/误点「新增」留下的,却会排在参照弹窗最前面 —— 选产品编号时
 *      一勾就勾到空单,一个值都带不过来(实测事故:2026-11-04 实机复验)。
 *   ② 部门档案 bs_dept 的**重复行**:D01..D10 每条都有两份(id 1-10 与 11-20),
 *      两份的编码/名称完全相同、都来自 migration,只是两次导入时间不同
 *      (2026-08-31 与 2026-09-10)。参照弹窗因此每个部门出现两次。
 *
 * 口径
 *   · 只删**确证为空**的产品信息表单据:产品编号、产品名称都空,且没有明细行;
 *     这类单据没有业务留痕,删 yj_doc_status + 表头即可。凡有明细的一律不动。
 *   · 部门只删**同名同码的重复份**,每码保留 id 最小的那一行(先到先得)。
 *   · 幂等:重复执行第二次命中 0 行,不报错。
 *   · 两个账套都要执行(先正式 HSDZ_MES,后测试 HSDZ_MES_TEST)。
 *
 * 执行
 *   cd tools
 *   YINJIA_SQL_PASS='Yinjia@2026' java -cp lib/mssql-jdbc.jar DbSync.java run migrate-clean-blank-prodinfo-and-dept-20261104.sql
 *   YINJIA_SQL_DB=HSDZ_MES_TEST YINJIA_SQL_PASS='Yinjia@2026' java -cp lib/mssql-jdbc.jar DbSync.java run migrate-clean-blank-prodinfo-and-dept-20261104.sql
 * ========================================================================= */
SET NOCOUNT ON;

/* ── ① 空的产品信息表单据 ───────────────────────────────────────────────── */
DECLARE @blank TABLE (no nvarchar(100) PRIMARY KEY);

INSERT INTO @blank (no)
SELECT h.单据编号
FROM rd_prod_info_head h
WHERE ISNULL(h.产品编号, N'') = N''
  AND ISNULL(h.产品名称, N'') = N''
  -- 有明细的绝不动(空单才删)
  AND NOT EXISTS (SELECT 1 FROM rd_prod_info_detail d WHERE d.单据编号 = h.单据编号);

DECLARE @nBlank int = (SELECT COUNT(*) FROM @blank);
PRINT N'[clean-blank] 待删空产品信息表单据: ' + CAST(@nBlank AS nvarchar(10));

IF @nBlank > 0
BEGIN
    DELETE s FROM yj_doc_status s WHERE s.doc_no IN (SELECT no FROM @blank);
    PRINT N'[clean-blank] yj_doc_status 删除: ' + CAST(@@ROWCOUNT AS nvarchar(10));

    DELETE h FROM rd_prod_info_head h WHERE h.单据编号 IN (SELECT no FROM @blank);
    PRINT N'[clean-blank] rd_prod_info_head 删除: ' + CAST(@@ROWCOUNT AS nvarchar(10));
END

/* ── ② 部门档案去重(每码留 id 最小的一行) ──────────────────────────────── */
DECLARE @dup TABLE (id int PRIMARY KEY);

INSERT INTO @dup (id)
SELECT d.id
FROM bs_dept d
JOIN (
    SELECT 部门编码, 部门名称, MIN(id) AS keep_id
    FROM bs_dept
    GROUP BY 部门编码, 部门名称
    HAVING COUNT(*) > 1
) k ON k.部门编码 = d.部门编码 AND k.部门名称 = d.部门名称
WHERE d.id <> k.keep_id;

DECLARE @nDup int = (SELECT COUNT(*) FROM @dup);
PRINT N'[clean-blank] 待删重复部门: ' + CAST(@nDup AS nvarchar(10));

IF @nDup > 0
BEGIN
    DELETE d FROM bs_dept d WHERE d.id IN (SELECT id FROM @dup);
    PRINT N'[clean-blank] bs_dept 删除: ' + CAST(@@ROWCOUNT AS nvarchar(10));
END

/* ── 自检 ───────────────────────────────────────────────────────────────── */
DECLARE @leftBlank int = (
    SELECT COUNT(*) FROM rd_prod_info_head h
    WHERE ISNULL(h.产品编号, N'') = N'' AND ISNULL(h.产品名称, N'') = N''
      AND NOT EXISTS (SELECT 1 FROM rd_prod_info_detail d WHERE d.单据编号 = h.单据编号)
);
DECLARE @leftDup int = (
    SELECT COUNT(*) FROM (
        SELECT 部门编码, 部门名称 FROM bs_dept GROUP BY 部门编码, 部门名称 HAVING COUNT(*) > 1
    ) x
);

IF @leftBlank <> 0 OR @leftDup <> 0
BEGIN
    RAISERROR(N'自检失败:仍有空产品信息表单据 %d 行、重复部门 %d 组', 16, 1, @leftBlank, @leftDup);
    RETURN;
END

PRINT N'[clean-blank] OK(空单据=0, 重复部门=0)';