/* migrate-merge-gen-20261113.sql 的前置兼容补列(2026-11-15 本机合并远端迁移时用)。
 *
 * 为什么需要:该脚本整文件**没有一个 GO 批次**,`② 清理` 段里直接 SELECT bl_purchase_in.[采购单号],
 * 而 ① 段的 ALTER ADD 与这些引用在同一批次 ⇒ 本机(列还不存在)会在**编译期**报
 * 「Invalid column name '采购单号'」,即使 IF 分支本意是 skip(作者机器上这些列当时已存在,所以没暴露)。
 *
 * 做法:先把三列按脚本最终形态建出来(脚本 ① 段会走 exists/skip),脚本跑完后:
 *   · qc_insp_detail / qc_return_detail.采购单号 → 保留(脚本 ③ 会补中文注明);
 *   · bl_purchase_in.采购单号 → 脚本 ② 会删掉(全空 + 与 源单编号 语义重复),最终不留。
 * 幂等:IF COL_LENGTH IS NULL。
 */
IF COL_LENGTH('qc_insp_detail', '采购单号') IS NULL
    ALTER TABLE qc_insp_detail ADD [采购单号] nvarchar(200) NULL;
IF COL_LENGTH('qc_return_detail', '采购单号') IS NULL
    ALTER TABLE qc_return_detail ADD [采购单号] nvarchar(200) NULL;
IF COL_LENGTH('bl_purchase_in', '采购单号') IS NULL
    ALTER TABLE bl_purchase_in ADD [采购单号] nvarchar(200) NULL;
GO
