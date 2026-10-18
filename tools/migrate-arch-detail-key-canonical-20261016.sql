/* migrate-arch-detail-key-canonical-20261016.sql — 档案面板明细键对齐规范(本地两账套)

【背景】2026-10-16 服务器对差发现:本地 32 个档案面板的 yj_panel.detail_key 是旧别名
  (items / depts / employees / stores / uoms / workcenters / accounts / operations / projects / …),
  而**服务器是规范键**:migrate-arch-single-doc.sql 定的口径 `mode='archive' ⇒ detail_key = LOWER(panel_code)`
  (INV→inv、WH→wh、EMP→emp…;该脚本已登记,不再重跑,故单列本条对齐)。
  这正是「配方计算候选恒空」那类 bug 的温床:任何写死键的代码都会在一边好、一边坏。
【做什么】把下面**点名列出的 29 个档案面板**的 detail_key 置为 LOWER(panel_code) ——
  这 29 个正是 2026-10-16 服务器对差里「本地与服务器不一致」的全部(`_q-drift-server-vs-local.mjs` 实测),
  服务器侧已经是规范键,本地是旧别名 ⇒ 把本地对齐到服务器。
  ⚠ **不**做成"所有 mode='archive' 一律刷规范键":两边都已是 `items` 的面板(如 QC_INSP_REQ)
    本来就是**两边一致**的,刷了反而制造新的本地/服务器漂移。
【幂等】只更新与规范键不同的行;第二次执行更新 0 行。
【两账套】先 HSDZ_MES 后 HSDZ_MES_TEST(DbSync 自动排队)。
*/
SET NOCOUNT ON;

DECLARE @t TABLE (pc sysname PRIMARY KEY);
INSERT INTO @t (pc) VALUES
 (N'CUR'),(N'CUSGRP'),(N'DEPT'),(N'EMP'),(N'EQUIP'),(N'ERPLG'),(N'FIN_ACC'),(N'FIN_EXP'),(N'FIN_TAX'),
 (N'INV'),(N'INV_PRICE'),(N'MATGRP'),(N'OP'),(N'OP_TIME'),(N'PARTNER'),(N'PROD_ABN'),(N'PROD_LINE'),
 (N'PROJ'),(N'QC_ITEM'),(N'QC_PLAN'),(N'RD_SHARE_FILE'),(N'REGION'),(N'REJECT'),(N'SETTLE'),
 (N'SUPGRP'),(N'TEAM'),(N'UOM'),(N'WC'),(N'WH');

DECLARE @dbn sysname = DB_NAME();
DECLARE @before int = (SELECT COUNT(*) FROM yj_panel p JOIN @t AS t ON p.panel_code = t.pc WHERE ISNULL(p.detail_key, N'') <> LOWER(p.panel_code));
RAISERROR(N'[待改] %s:目标面板中 detail_key 非规范键 %d 个', 10, 1, @dbn, @before);

BEGIN TRANSACTION;
UPDATE p SET p.detail_key = LOWER(p.panel_code)
  FROM yj_panel p JOIN @t AS t ON p.panel_code = t.pc
 WHERE ISNULL(p.detail_key, N'') <> LOWER(p.panel_code);
DECLARE @n int = @@ROWCOUNT;

/* 自检:① 目标 29 个全部规范 ② 名单外的档案面板一个没被碰(same as before) */
DECLARE @bad int = (SELECT COUNT(*) FROM yj_panel p JOIN @t AS t ON p.panel_code = t.pc WHERE ISNULL(p.detail_key, N'') <> LOWER(p.panel_code));
DECLARE @target int = (SELECT COUNT(*) FROM yj_panel p JOIN @t AS t ON p.panel_code = t.pc);
IF @bad <> 0 OR @target <> 29
BEGIN
  ROLLBACK TRANSACTION;
  RAISERROR(N'[FAIL] 自检未过(不规范 %d / 命中面板 %d),已整段回滚', 16, 1, @bad, @target);
  RETURN;
END
COMMIT TRANSACTION;
RAISERROR(N'[OK] %s:对齐 %d 个档案面板的明细键为 LOWER(面板编码)(命中 29 个)', 10, 1, @dbn, @n);
GO

SELECT p.panel_code, p.detail_key FROM yj_panel p WHERE p.panel_code IN
 (N'CUR',N'CUSGRP',N'DEPT',N'EMP',N'EQUIP',N'ERPLG',N'FIN_ACC',N'FIN_EXP',N'FIN_TAX',N'INV',N'INV_PRICE',N'MATGRP',N'OP',N'OP_TIME',N'PARTNER',N'PROD_ABN',N'PROD_LINE',N'PROJ',N'QC_ITEM',N'QC_PLAN',N'RD_SHARE_FILE',N'REGION',N'REJECT',N'SETTLE',N'SUPGRP',N'TEAM',N'UOM',N'WC',N'WH')
 ORDER BY p.panel_code;
GO
