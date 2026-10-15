/* migrate-rd-prod-info-od-before-id-20261016.sql
 * 产品信息表(RD_PROD_INFO)表头:「炭棒外径」应排在「炭棒内径」之前。
 *
 * 【用户口径 2026-10-16】
 *   「把研发管理里面的产品信息表的内径跟外径两个位置换一下,一般都是外径*内径*长度来表示;
 *     其他的面板有这种错误的也一起改了」。
 *
 * 【现状(两账套一致实测)】place=header,按 (seq,id) 排序:
 *   2407 产品整体尺寸 seq=70 → 2408 客户料号 80 → 2409 炭棒尺寸 90(hidden)
 *   → 5311 炭棒内径 seq=92  → 5312 炭棒外径 seq=94  → 5313 炭棒长度 seq=96
 *   即三元组读作「内径·外径·长度」,与惯例「外径*内径*长度」相反 ⇒ 本脚本把两者的 seq 对调。
 *
 * 【全库排查结论(只此一处,carpet 扫描证据)】
 *   扫描 yj_field 里 label/col_name/alias/label_en 含「径」的全部 18 行,共 6 个面板:
 *     · RD_PROD_INFO  内径92 → 外径94                                    ← 违反,本脚本修
 *     · RD_MOLD_PROC  外径mm320 → 外径公差330 → 内径mm340 → 内径公差350    ✅ 外径在前
 *     · RD_SINTER_TOL 炭棒外径50 → 外径公差60 → 炭棒内径70 → 内径公差80   ✅
 *     · QC_INSP_REQ   外径90 → 内径100(核心对已正确)                     ✅
 *     · RD_ASM_BOM / RD_ASM_PROC 只有「整体规格（外径）」「整体规格（长度）」,无内径 ✅
 *   ⚠ QC_INSP_REQ 里 seq=240/250/270 的「外径1 / 外径2 / 外径（+密封圈）」排在「内径100」之后,
 *     但它们是**另三个变体属性**而非核心外径,把它们提到内径之前反而会拆散「外径→内径」的相邻关系,
 *     故**不动**(机械按关键字重排会做错)。
 *
 * 【改什么/不改什么】只对调这两行的 seq(92↔94);label、col_name、ref_panel/ref_field、
 *   可见性(hidden/visible)、宽度、译名一律不动。**不碰**采购链四单(本面板不在四单基线范围内)。
 *
 * 【幂等】仅当「内径仍在 外径之前」时才交换 ⇒ 重跑是空操作;
 *   末尾自检:交换后必须是 外径(seq,id) 严格先于 内径,否则 RAISERROR(DbSync 计为失败)。
 *
 * 【执行】两账套各跑一遍(先 HSDZ_MES 后 HSDZ_MES_TEST),跑到「执行 0、失败 0」。
 */
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @innerId int, @outerId int, @innerSeq int, @outerSeq int;
SELECT @innerId = id, @innerSeq = seq FROM yj_field WHERE panel_code = 'RD_PROD_INFO' AND label = N'炭棒内径';
SELECT @outerId = id, @outerSeq = seq FROM yj_field WHERE panel_code = 'RD_PROD_INFO' AND label = N'炭棒外径';

IF @innerId IS NULL OR @outerId IS NULL
BEGIN
  PRINT N'   [跳过] RD_PROD_INFO 的 炭棒内径/炭棒外径 有缺失,不做改动';
END
ELSE IF (@innerSeq > @outerSeq) OR (@innerSeq = @outerSeq AND @innerId > @outerId)
BEGIN
  PRINT N'   [跳过] 外径已经在内径之前(seq ' + CAST(@outerSeq AS nvarchar(10)) + N' < ' + CAST(@innerSeq AS nvarchar(10)) + N'),无需交换';
END
ELSE
BEGIN
  -- 单条 UPDATE 内对调(不会被约束中途拦住;本表除 id 主键外无唯一约束,实测两账套一致)
  UPDATE yj_field
     SET seq = CASE id WHEN @innerId THEN @outerSeq WHEN @outerId THEN @innerSeq END
   WHERE id IN (@innerId, @outerId);
  PRINT N'   [已交换] 炭棒外径 seq ' + CAST(@outerSeq AS nvarchar(10)) + N' ← ' + CAST(@innerSeq AS nvarchar(10))
      + N';炭棒内径 seq ' + CAST(@innerSeq AS nvarchar(10)) + N' ← ' + CAST(@outerSeq AS nvarchar(10));
END
GO

PRINT N'== 自检:产品信息表表头里 外径 必须严格先于 内径 ==';
IF EXISTS (
  SELECT 1
  FROM yj_field i
  JOIN yj_field o ON o.panel_code = i.panel_code AND o.place = i.place
  WHERE i.panel_code = 'RD_PROD_INFO' AND i.label = N'炭棒内径' AND o.label = N'炭棒外径'
    AND (i.seq < o.seq OR (i.seq = o.seq AND i.id < o.id)))
BEGIN
  RAISERROR(N'[自检] 炭棒内径仍排在炭棒外径之前', 16, 1);
END
ELSE
BEGIN
  PRINT N'   [OK] 外径在内径之前';
END
GO

PRINT N'== 当前顺序(place=header 且 seq 在 88..98 之间)==';
SELECT id, label, seq, place, hidden FROM yj_field
 WHERE panel_code = 'RD_PROD_INFO' AND place = 'header' AND seq BETWEEN 88 AND 98
 ORDER BY seq, id;
GO
