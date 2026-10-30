/* ============================================================
   fix-mobile-pick-note-20261030.sql — 补回被覆盖的「BOM 需求」备注

   ⚠ 只处理「手机扫码·生产领料」产生的单据(由工单的组装工艺清单可反查),
     不碰其它来源的材料出库单。

   ------------------------------------------------------------
   ★ 事故
   ------------------------------------------------------------
   `writeQty` 写领料数量时用了 `SET 明细备注 = '领料批次:…'` —— **整块覆盖**,
   把生单时写入的「…(需求 3)」冲掉了。而前端默认领用数量正是从备注里解析「(需求 N)」,
   解析不到就退化成**库存上限**(实测:需求 3 的 OPP袋,扫码后数量框默认 12000)。

   代码已修(改为追加 + mergeNote),本脚本负责**补救已经写坏的数据**。

   ------------------------------------------------------------
   ★ 怎么补
   ------------------------------------------------------------
   对每一行缺「(需求 N)」的领料明细:
     1. 找到它所属的工单(加工单号 + 工单行号);
     2. 按工单行的产品编号找**最新一张**组装工艺清单(rd_asm_proc_head);
     3. 从该清单「物料清单」表区里取同一物料的 `用量`;
     4. 把「生产领料·组装工艺清单 <单号>(需求 N)」**拼在现有备注前面**,原批次串保留。
   找不到对应 BOM 行的(物料已从 BOM 移除等)跳过并计数,不硬编一个数字。

   幂等:只处理"备注里没有 (需求 N)"的行,重复执行不会叠加。
   两账套都执行,已登记 tools/db-migrations.txt。
   ============================================================ */
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

DECLARE @fixed int = 0, @skip int = 0;

DECLARE @rows TABLE (
    rid     int PRIMARY KEY,   -- bl_material_out.id
    no      nvarchar(60),
    line    nvarchar(20),
    code    nvarchar(120),
    note    nvarchar(500),
    usageN  nvarchar(50),
    bomNo   nvarchar(120)
);

INSERT INTO @rows (rid, no, line, code, note)
SELECT l.id, l.单据编号, l.行号, l.材料编码, ISNULL(l.明细备注, N'')
  FROM dbo.bl_material_out l
  JOIN dbo.bd_material_out h ON h.单据编号 = l.单据编号
 WHERE ISNULL(l.asp_cancel,'N') <> 'Y'
   AND ISNULL(h.加工单号, N'') LIKE N'GD-%'
   AND ISNULL(l.明细备注,'') NOT LIKE N'%(需求 %'
   AND ISNULL(l.明细备注,'') LIKE N'%领料批次%';

-- 反查:工单行 → 产品 → 最新组装工艺清单 → 同物料用量
UPDATE r
   SET r.usageN = d.用量,
       r.bomNo  = d.单据编号
  FROM @rows r
  OUTER APPLY (
      SELECT TOP 1 dd.单据编号, dd.用量
        FROM dbo.bd_material_out h
        JOIN dbo.plang p ON p.pl_no = h.加工单号 AND p.pl_xc = h.工单行号
        JOIN dbo.rd_asm_proc_head ph
             ON ph.产品编号 = p.dm AND ISNULL(ph.asp_cancel,'N') <> 'Y'
        JOIN dbo.rd_asm_proc_detail dd
             ON dd.单据编号 = ph.单据编号 AND dd.表区 = N'物料清单'
            AND ISNULL(dd.asp_cancel,'N') <> 'Y' AND dd.物料编号 = r.code
       WHERE h.单据编号 = r.no
       ORDER BY ISNULL(ph.单据日期,'') DESC, ph.id DESC, dd.id
  ) d;

-- 拼回:原备注前面补上需求段;原来只有批次串的,保留不动
UPDATE dbo.bl_material_out
   SET 明细备注 = N'生产领料·组装工艺清单 ' + r.bomNo + N'(需求 ' + r.usageN + N'); ' + r.note
  FROM dbo.bl_material_out l
  JOIN @rows r ON r.rid = l.id
 WHERE r.usageN IS NOT NULL
   AND ISNULL(r.usageN, N'') <> N'';
SET @fixed = @@ROWCOUNT;

SELECT @skip = COUNT(*) FROM @rows WHERE usageN IS NULL OR ISNULL(usageN, N'') = N'';

PRINT N'[修复] 补回需求备注 ' + CAST(@fixed AS nvarchar(10))
    + N' 行;找不到对应 BOM 用量而跳过 ' + CAST(@skip AS nvarchar(10)) + N' 行';
GO

/* ---------- 自检 ---------- */
DECLARE @left int;
SELECT @left = COUNT(*)
  FROM dbo.bl_material_out l
  JOIN dbo.bd_material_out h ON h.单据编号 = l.单据编号
 WHERE ISNULL(l.asp_cancel,'N') <> 'Y'
   AND ISNULL(h.加工单号, N'') LIKE N'GD-%'
   AND ISNULL(l.明细备注,'') NOT LIKE N'%(需求 %'
   AND ISNULL(l.明细备注,'') LIKE N'%领料批次%';

IF @left > 0
   PRINT N'[NOTE] 仍有 ' + CAST(@left AS nvarchar(10)) + N' 行没补到需求(该物料已不在当前 BOM 里),可人工核对';
ELSE
   PRINT N'[PASS] 所有带批次备注的领料行都已补回 (需求 N)';
GO
