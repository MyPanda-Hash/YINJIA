/* 2026-10-18 测试库数据修正:同料同日同「日期型」批号 → 按项目批号规范补 3 位流水。
 *
 * 背景:migrate-barcode-batch-by-date-20261018.sql 在 HSDZ_MES_TEST 自检失败 ——
 *   物料 A-32-01 在 2026-10-09 有 20 张采购入库单,原始批号**全是 20261009**(日期型),
 *   脚本口径是「日期型原批号原样保留」⇒ 20 行码内容(编码|批号)完全相同,码唯一性自检不通过。
 *   正式库 HSDZ_MES 无此情况,该脚本已正常跑过。
 *
 * 口径:项目既有批号规范 = 「入库日期 + 3 位流水」⇒ 这里把 20 行改成 20261009 + 001..020,
 *   按 单据编号 升序编号(可重复执行:只用批号仍等于 20261009 的行参与)。
 *
 * ⚠ 只允许在测试账套执行(脚本自带库名硬闸门)。正式库一行不动。
 */
SET NOCOUNT ON;

DECLARE @db_name sysname = DB_NAME();
IF @db_name <> N'HSDZ_MES_TEST'
BEGIN
  RAISERROR(N'[SKIP] 只允许在 HSDZ_MES_TEST 执行(当前 %s)', 16, 1, @db_name);
  RETURN;
END

DECLARE @n int = (SELECT COUNT(*) FROM bl_purchase_in d JOIN bd_purchase_in h ON h.单据编号 = d.单据编号
                   WHERE d.存货编码 = N'A-32-01' AND d.批号 = N'20261009'
                     AND ISNULL(d.asp_cancel, 'N') <> 'Y' AND h.单据日期 = '2026-10-09');
RAISERROR(N'[待改] 测试库 A-32-01 / 2026-10-09 / 批号 20261009 = %d 行(期望 20)', 10, 1, @n);

BEGIN TRANSACTION;
;WITH x AS (
  SELECT d.id, ROW_NUMBER() OVER (ORDER BY d.单据编号, d.id) AS rn
    FROM bl_purchase_in d JOIN bd_purchase_in h ON h.单据编号 = d.单据编号
   WHERE d.存货编码 = N'A-32-01' AND d.批号 = N'20261009'
     AND ISNULL(d.asp_cancel, 'N') <> 'Y' AND h.单据日期 = '2026-10-09'
)
UPDATE d SET d.批号 = N'20261009' + RIGHT(N'00' + CAST(x.rn AS nvarchar(3)), 3)
  FROM bl_purchase_in d JOIN x ON x.id = d.id;
DECLARE @changed int = @@ROWCOUNT;

/* 自检:该组批号已互不相同,且仍是日期型(8 位日期开头) */
DECLARE @dup int = (SELECT COUNT(*) FROM (SELECT d.批号 FROM bl_purchase_in d JOIN bd_purchase_in h ON h.单据编号=d.单据编号
                    WHERE d.存货编码=N'A-32-01' AND h.单据日期='2026-10-09' AND ISNULL(d.asp_cancel,'N')<>'Y'
                      AND d.批号 LIKE N'20261009%' GROUP BY d.批号 HAVING COUNT(*)>1) z);
IF @dup > 0
BEGIN
  ROLLBACK TRANSACTION;
  RAISERROR(N'[FAIL] 仍有 %d 个重复批号,已回滚', 16, 1, @dup);
  RETURN;
END
COMMIT TRANSACTION;
RAISERROR(N'[OK] 测试库 A-32-01 同日批号补流水 %d 行(20261009 → 20261009001..)', 10, 1, @changed);
GO

SELECT TOP 5 单据编号, 存货编码, 批号 FROM bl_purchase_in WHERE 存货编码 = N'A-32-01' AND 批号 LIKE N'20261009%' ORDER BY 批号;
GO
