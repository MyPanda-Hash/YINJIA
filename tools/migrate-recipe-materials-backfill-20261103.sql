/* ============================================================================
   migrate-recipe-materials-backfill-20261103.sql —— 84 种配方物料含水率**补数**
   ============================================================================
   ⚠ 本文件由 tools/gen/gen-recipe-materials.cjs 从设计源自动生成,不要手改。
     重新生成:node tools/gen/gen-recipe-materials.cjs
     设计源:《20267月22日-最新烧结配方模板-1.xlsx》sheet「物料清单」(A1:D85,84 行)

   ── 为什么需要这一条 ───────────────────────────────────────────────────────
   migrate-recipe-materials.sql 是**幂等"按需播种"**:编码已存在就只走
   `ELSE UPDATE ... AND 水分含量 IS NULL`。但它在服务器上是走 **baseline(只登记、不执行)**
   进 yj_schema_log 的(`applied_at = 2026-11-02 12:29:38`,同批 692 条一起;
   见 tools/archive/_deploy-20261102/steps.md §3:to-run 只有 6 条,其余全 baseline)。
   于是:列建了、yj_field 登记了、译名写了,**唯独 UPDATE 一次都没跑**。

   后果(2026-11-03 实测 HSDZ_MES):bs_inv 3961 行金蝶商品水分含量**全为 NULL**,
   只有 GF-001 / FRT 两个"库里本来没有、由那条 INSERT 新建"的编码带值
   ⇒ 配方计算器 powder_avg 恒为 0 ⇒ 单据「理论水分」永远 0.00%。

   ── 本脚本的口径 ───────────────────────────────────────────────────────────
   把设计源的含水率**按存货编码**写进 bs_inv,**不按数据来源收窄** ——
   同一编码可能既有金蝶同步行又有种子行,而含水率是物料的固有属性,与来源无关。
   仍然**不覆盖人工维护过的值**:只写 `水分含量 IS NULL` 的行。
   与旧脚本的差别只有一处:旧脚本的 UPDATE 藏在 ELSE 分支里(编码存在才走到),
   本脚本独立成文,可单独进 to-run **强制执行**。

   幂等:可重复执行(第二遍 0 行受影响)。
   两账套都要跑:先 HSDZ_MES、后 HSDZ_MES_TEST。
   ============================================================================ */

SET NOCOUNT ON;
GO

PRINT N'=== migrate-recipe-materials-backfill-20261103:补 41 种配方物料含水率 ===';
GO

/* ── 前置:列不存在就没得补(防御性告警,不静默跳过) ── */
IF COL_LENGTH('bs_inv', N'水分含量') IS NULL
BEGIN
    RAISERROR(N'bs_inv.水分含量 列不存在 —— 请先执行 migrate-recipe-materials.sql', 16, 1);
END
GO

/* ── 主体:逐个编码补空(只碰 NULL,绝不动已人工维护的值) ── */
UPDATE bs_inv SET [水分含量] = 0.06 WHERE RTRIM([存货编码]) = N'YJ-XH-001' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'YJ-XH-002' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.04 WHERE RTRIM([存货编码]) = N'XH-SX80250SX' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.08 WHERE RTRIM([存货编码]) = N'YJ-YPS-002' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'YJ-YPS-003' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.08 WHERE RTRIM([存货编码]) = N'YJ-YPS-004' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'YJ-YPS-006' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'YJ-YKRS-012' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.04 WHERE RTRIM([存货编码]) = N'YJ-YKRS-008' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.04 WHERE RTRIM([存货编码]) = N'YJ-044' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.04 WHERE RTRIM([存货编码]) = N'YJ-HG-009-1' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.04 WHERE RTRIM([存货编码]) = N'YJ-HG-009-2' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'YJ-HG-009-3' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.055 WHERE RTRIM([存货编码]) = N'YJ-TJHZ-001' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.055 WHERE RTRIM([存货编码]) = N'YJ-TJHZ-004' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.08 WHERE RTRIM([存货编码]) = N'YJ-TJHZ-006' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.1 WHERE RTRIM([存货编码]) = N'YJ-YKB-002' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.15 WHERE RTRIM([存货编码]) = N'YJ-YKB-001' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'YJ-HKK-005' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'YJ-WXR-001' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.04 WHERE RTRIM([存货编码]) = N'HY-AC325+' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.08 WHERE RTRIM([存货编码]) = N'YJ-HKB-001' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'BK1' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'BK2-A' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'BK2-B' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'BK1-D/10' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'BK1-DS02/10' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'BK1-DS10/06' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'PMC-80325' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'AGC-80250' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.1 WHERE RTRIM([存货编码]) = N'GF-001' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'FRT' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'HKK-CQ' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'HKK-CJ' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'HKK-CF' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'GS10' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.07 WHERE RTRIM([存货编码]) = N'PS-2' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.07 WHERE RTRIM([存货编码]) = N'PS-3' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'YJ-YKRS-007' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'YJ-YPS-007' AND [水分含量] IS NULL;
UPDATE bs_inv SET [水分含量] = 0.05 WHERE RTRIM([存货编码]) = N'YJ-YKRS-014' AND [水分含量] IS NULL;
GO

/* ── 核验:这 41 个编码里还有几个是空的(应 = 0 才算补齐) ── */
SELECT COUNT(*) AS 仍为空的编码数
FROM bs_inv
WHERE RTRIM([存货编码]) IN (N'YJ-XH-001',
    N'YJ-XH-002',
    N'XH-SX80250SX',
    N'YJ-YPS-002',
    N'YJ-YPS-003',
    N'YJ-YPS-004',
    N'YJ-YPS-006',
    N'YJ-YKRS-012',
    N'YJ-YKRS-008',
    N'YJ-044',
    N'YJ-HG-009-1',
    N'YJ-HG-009-2',
    N'YJ-HG-009-3',
    N'YJ-TJHZ-001',
    N'YJ-TJHZ-004',
    N'YJ-TJHZ-006',
    N'YJ-YKB-002',
    N'YJ-YKB-001',
    N'YJ-HKK-005',
    N'YJ-WXR-001',
    N'HY-AC325+',
    N'YJ-HKB-001',
    N'BK1',
    N'BK2-A',
    N'BK2-B',
    N'BK1-D/10',
    N'BK1-DS02/10',
    N'BK1-DS10/06',
    N'PMC-80325',
    N'AGC-80250',
    N'GF-001',
    N'FRT',
    N'HKK-CQ',
    N'HKK-CJ',
    N'HKK-CF',
    N'GS10',
    N'PS-2',
    N'PS-3',
    N'YJ-YKRS-007',
    N'YJ-YPS-007',
    N'YJ-YKRS-014')
  AND [水分含量] IS NULL;
GO

/* ── 核验:金蝶同步行里补到值的条数(按来源看修复面) ── */
SELECT ISNULL([数据来源], N'<NULL>') AS 来源,
       COUNT(*) AS 总行数,
       SUM(CASE WHEN [水分含量] IS NOT NULL THEN 1 ELSE 0 END) AS 有含水率
FROM bs_inv
GROUP BY ISNULL([数据来源], N'<NULL>')
ORDER BY 总行数 DESC;
GO
