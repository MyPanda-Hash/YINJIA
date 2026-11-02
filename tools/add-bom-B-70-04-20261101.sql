/* ============================================================
   add-bom-B-70-04-20261101.sql — 新增 B-70-04 的组装 BOM

   两个账套都执行(幂等)。单号各库各自递增,不写死。

   ------------------------------------------------------------
   用料依据(不是编的)
   ------------------------------------------------------------
   全库原本**一张 BOM 都没有**(正式库 0 行),没有可参照的同系列 BOM,
   也没有 B-70-04 的领料历史(plang 有 4 张工单,但 ll_no 全空 = 从未领过料)。

   唯一可用的真实凭据:金蝶导出的领料明细
   `tools/archive/_dump-out/kingdee-data-1014/bl_material_out.csv` 里有 8 行
   「金橙客供盖 YJ-KG-JC-B02 / 规格 **B-70-04/05** / 单位 套」,
   数量与同期工单量基本 1:1(2000/3900/2500/1400/5400/2600/1000/1880)。

   ⇒ 本 BOM 只放这一项(1 套/支),**没有凭据的物料一律不塞**。
      BOM 是生产资料,凭猜测补料会直接把错料领到产线上。

   ★ 还需要补什么(待生产/工艺确认后再加行)
     一个完整的「X烧结PP复合阻垢碳棒/滤芯」通常还会有:炭棒本体、
     包装袋(热缩袋/OPP袋)、标签。库里查不到它们与 B-70-04 的对应关系,
     所以留空 —— 需要补时直接在本 BOM 的「组装BOM表」页签加行即可。
   ============================================================ */
SET NOCOUNT ON;
GO

DECLARE @dbName sysname = DB_NAME();
PRINT N'[库] ' + @dbName;

/* ---------- ① 已存在就不重复建(幂等) ---------- */
IF EXISTS (SELECT 1 FROM dbo.rd_asm_proc_head
            WHERE 产品编号 = N'B-70-04' AND ISNULL(asp_cancel,'N') <> 'Y')
BEGIN
    PRINT N'[SKIP] B-70-04 已经有组装工艺清单,本脚本不再新增';
    SELECT h.单据编号, h.产品编号, h.产品名称,
           (SELECT COUNT(*) FROM dbo.rd_asm_proc_detail d
             WHERE d.单据编号 = h.单据编号 AND d.表区 = N'物料清单'
               AND ISNULL(d.asp_cancel,'N') <> 'Y') AS 用料项数
      FROM dbo.rd_asm_proc_head h
     WHERE h.产品编号 = N'B-70-04' AND ISNULL(h.asp_cancel,'N') <> 'Y';
    RETURN;
END

/* ---------- ② 取下一个 AP-YYYY-MM-NNNN 单号(各库各自递增) ---------- */
DECLARE @ym nvarchar(7) = CONVERT(char(7), GETDATE(), 120);   -- 2026-11
DECLARE @prefix nvarchar(20) = N'AP-' + @ym + N'-';
DECLARE @seq int = 0;

SELECT @seq = MAX(CAST(SUBSTRING(单据编号, LEN(@prefix) + 1, 4) AS int))
  FROM dbo.rd_asm_proc_head
 WHERE 单据编号 LIKE @prefix + N'%'
   AND ISNUMERIC(SUBSTRING(单据编号, LEN(@prefix) + 1, 4)) = 1;
SET @seq = ISNULL(@seq, 0) + 1;

DECLARE @no nvarchar(60) = @prefix + RIGHT(N'0000' + CAST(@seq AS nvarchar(4)), 4);
-- 版本号与界面新建时一致:`V{日期}-{两位序号}`(如 V2026-11-01-01)
DECLARE @ver nvarchar(40) = N'V' + CONVERT(char(10), GETDATE(), 120) + N'-'
                          + RIGHT(N'00' + CAST(@seq AS nvarchar(2)), 2);
PRINT N'[单号] ' + @no + N'   版本 ' + @ver;

/* ---------- ③ 产品档案(名称/规格从 bs_inv 取,不硬编) ---------- */
DECLARE @pname nvarchar(400), @pspec nvarchar(200);
SELECT @pname = 存货名称, @pspec = 规格型号
  FROM dbo.bs_inv WHERE 存货编码 = N'B-70-04' AND ISNULL(asp_cancel,'N') <> 'Y';
IF @pname IS NULL
BEGIN
    RAISERROR(N'[FAIL] 存货档案里没有 B-70-04,无法建 BOM', 16, 1);
    RETURN;
END
PRINT N'[产品] B-70-04 ' + @pname + N'  ' + ISNULL(@pspec, N'');

/* ---------- ④ 表头 ---------- */
INSERT INTO dbo.rd_asm_proc_head
    (单据编号, 单据日期, 产品编号, 产品名称, 整体规格外径, 版本号, 备注,
     asp_user1, asp_time1, asp_cancel)
VALUES
    (@no, CONVERT(char(10), GETDATE(), 120), N'B-70-04', @pname, @pspec, @ver,
     N'按金蝶领料明细(B-70-04/05 金橙客供盖 1 套/支)建的首版 BOM',
     N'admin', SYSDATETIME(), 'N');

/* ---------- ⑤ 明细:组装BOM表页签(表区必须写「物料清单」) ----------
   ⚠ rd_asm_proc_detail 由三张逻辑表共用(修订记录/物料清单/关键控制清单),
     表区写错会被别的页签抢走显示。
   ⚠ 用量 = **每 1 个成品**的用量;领料单数量 = 用量 × 工单数量。 */
INSERT INTO dbo.rd_asm_proc_detail
    (单据编号, 表区, 序号, 物料编号, 物料名, 物料规格, 用量,
     asp_user1, asp_time1, asp_cancel)
VALUES
    (@no, N'物料清单', N'1', N'YJ-KG-JC-B02', N'金橙客供盖', N'B-70-04/05', N'1',
     N'admin', SYSDATETIME(), 'N');
GO

/* ---------- ⑥ 结果 ---------- */
SELECT h.单据编号, h.产品编号, h.产品名称, h.版本号,
       d.序号, d.物料编号, d.物料名, d.物料规格, d.用量
  FROM dbo.rd_asm_proc_head h
  JOIN dbo.rd_asm_proc_detail d
    ON d.单据编号 = h.单据编号 AND d.表区 = N'物料清单' AND ISNULL(d.asp_cancel,'N') <> 'Y'
 WHERE h.产品编号 = N'B-70-04' AND ISNULL(h.asp_cancel,'N') <> 'Y';
GO
