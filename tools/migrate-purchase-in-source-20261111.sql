/* ============================================================================
 * migrate-purchase-in-source-20261111.sql
 * 采购入库单:表头最末尾加「来源」+「来源单号」(显示对应单据编号)
 * ----------------------------------------------------------------------------
 * 用户口径(2026-11-11):
 *   「采购入库单在表头最末尾,加一个来源(可能是直接暂收来的,可能是检验单来的,
 *     也可能是特采来的)和显示对应的单据编号」
 *
 * 现状与现状判断:
 *   yj_field 里其实**已有**两行:`来源单据`(seq=170) 与 `来源单号`(seq=190),
 *   但 2026-09-21 用户口径「入库单用采购订单号就够了」把两行都 hidden=1 下线了
 *   (见 ButtonService.tcInApprovedGenerate 的旧注释),界面上看不见、也没人再写它。
 *   本次不是新造字段,而是把这两行**正名 + 复活 + 挪到表头最末尾**:
 *     ① `来源单据` 标签正名为 `来源`(物理列仍是 来源单据,不动 DDL);
 *        —— 数据键(label)就是 API 的 dataName,正名后写入口径统一为「来源」;
 *     ② 两行都 place='header'(退出查询条)、visible=1、hidden=0、editable=0(自动带出,只读);
 *     ③ seq 挪到表头末尾(现最大 840 ⇒ 900 / 910),与界面上"红框在最后"一致;
 *     ④ 历史数据回填:按 form_flow_link 的来源面板回填 来源 / 来源单号
 *        (2026-11-11 之前 375 张入库单里有 373 张 来源单据 为空,不填就是一片空白)。
 *
 * 三条来源链路(值 = 来源面板名,与 yj_panel.panel_name 一致):
 *   送料暂收单 QC_RECV → 暂收后判免检直达入库
 *   来料检验单 QC_INSP → 检验合格入库
 *   特采单     QC_TC_IN → 特采审批通过入库
 *   (存量另有极少数 PU_ORDER 直连入库的老单,回填按 yj_panel.panel_name 原样登记)
 *
 * 幂等:窄条件 UPDATE(带行数守卫)+ 回填只填空值 + 译名仅空库播;两账套各跑一遍。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---- ① 来源单据 → 来源(正名 + 显示 + 挪到表头末尾) ---- */
DECLARE @srcCnt int;
SELECT @srcCnt = COUNT(*) FROM yj_field
 WHERE panel_code = N'PURCHASE_IN' AND col_name = N'来源单据' AND label IN (N'来源单据', N'来源');
IF @srcCnt <> 1
    RAISERROR(N'[来源] PURCHASE_IN 的「来源单据/来源」字段行数为 %d,预期 1 行,已中止', 16, 1, @srcCnt);

IF EXISTS (SELECT 1 FROM yj_field
            WHERE panel_code = N'PURCHASE_IN' AND col_name = N'来源单据' AND label = N'来源单据')
BEGIN
    UPDATE yj_field
       SET label = N'来源', label_en = N'Source', place = N'header', seq = 900,
           visible = 1, hidden = 0, editable = 0, required = 0, width = 130
     WHERE panel_code = N'PURCHASE_IN' AND col_name = N'来源单据' AND label = N'来源单据';
    PRINT N'[字段] PURCHASE_IN.来源单据 → 来源(表头末尾 seq=900,只读可见)';
END
ELSE
BEGIN
    -- 已正名过:只校正位置/可见性,保证重跑幂等
    UPDATE yj_field
       SET label_en = N'Source', place = N'header', seq = 900,
           visible = 1, hidden = 0, editable = 0, required = 0, width = 130
     WHERE panel_code = N'PURCHASE_IN' AND col_name = N'来源单据' AND label = N'来源';
    PRINT N'[字段] PURCHASE_IN.来源 已是正名态,仅校正位置/可见性';
END
GO

/* ---- ② 来源单号:显示 + 挪到来源之后 ---- */
DECLARE @noCnt int;
SELECT @noCnt = COUNT(*) FROM yj_field
 WHERE panel_code = N'PURCHASE_IN' AND col_name = N'来源单号';
IF @noCnt <> 1
    RAISERROR(N'[来源单号] PURCHASE_IN 的「来源单号」字段行数为 %d,预期 1 行,已中止', 16, 1, @noCnt);

UPDATE yj_field
   SET place = N'header', seq = 910, visible = 1, hidden = 0, editable = 0, required = 0, width = 150
 WHERE panel_code = N'PURCHASE_IN' AND col_name = N'来源单号';
PRINT N'[字段] PURCHASE_IN.来源单号 → 表头末尾 seq=910,只读可见';
GO

/* ---- ③ 历史回填(只填空值;来源面板名取 yj_panel.panel_name) ---- */
DECLARE @filled int = 0;

;WITH src AS (
    SELECT l.target_form_no, l.source_panel_code, l.source_form_no,
           ROW_NUMBER() OVER (PARTITION BY l.target_form_no ORDER BY l.id) AS rn
      FROM form_flow_link l
     WHERE l.target_panel_code = N'PURCHASE_IN'
       AND l.link_status = 'ACTIVE'
)
UPDATE pi
   SET pi.来源单据 = p.panel_name,
       pi.来源单号 = src.source_form_no,
       pi.asp_user2 = N'migration',
       pi.asp_time2 = GETDATE()
  FROM bd_purchase_in pi
  JOIN src ON src.target_form_no = pi.单据编号 AND src.rn = 1
  JOIN yj_panel p ON p.panel_code = src.source_panel_code
 WHERE ISNULL(RTRIM(pi.来源单据), '') = '';

SET @filled = @@ROWCOUNT;
PRINT N'[回填] 按 form_flow_link 回填 来源/来源单号:' + CAST(@filled AS nvarchar(20)) + N' 张';
GO

/* ---- ④ 多语言(AGENTS 强制:新增/改名标签必须有 en 等译名;已有 en 的只补缺) ---- */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'来源' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'来源', 'en', N'Source', 'manual');

;WITH want(locale, text) AS (
    SELECT 'de', N'Quelle'        UNION ALL
    SELECT 'ja', N'由来'          UNION ALL
    SELECT 'ko', N'출처'          UNION ALL
    SELECT 'es', N'Origen'        UNION ALL
    SELECT 'fr', N'Origine'       UNION ALL
    SELECT 'ru', N'Источник'      UNION ALL
    SELECT 'vi', N'Nguồn'         UNION ALL
    SELECT 'th', N'แหล่งที่มา'
)
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', N'来源', w.locale, w.text, 'manual'
  FROM want w
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                    WHERE t.scope = 'field' AND t.ref_key = N'来源' AND t.locale = w.locale);
GO

/* ---- ⑤ 自检 ---- */
IF (SELECT COUNT(*) FROM yj_field
     WHERE panel_code = N'PURCHASE_IN' AND label = N'来源' AND col_name = N'来源单据'
       AND place = N'header' AND visible = 1 AND hidden = 0 AND editable = 0 AND seq = 900) <> 1
    RAISERROR(N'[自检失败] PURCHASE_IN.来源 未落到表头末尾/仍隐藏', 16, 1);

IF (SELECT COUNT(*) FROM yj_field
     WHERE panel_code = N'PURCHASE_IN' AND label = N'来源单号'
       AND place = N'header' AND visible = 1 AND hidden = 0 AND editable = 0 AND seq = 910) <> 1
    RAISERROR(N'[自检失败] PURCHASE_IN.来源单号 未落到表头末尾/仍隐藏', 16, 1);

-- 越界守卫:除这两行外,PURCHASE_IN 不得再出现别的 来源*/来源单号 字段行
IF (SELECT COUNT(*) FROM yj_field
     WHERE panel_code = N'PURCHASE_IN' AND (label LIKE N'来源%' OR col_name LIKE N'来源%')) <> 2
    RAISERROR(N'[自检失败] PURCHASE_IN 来源类字段行数 <> 2', 16, 1);

IF (SELECT COUNT(*) FROM yj_translation WHERE scope = 'field' AND ref_key = N'来源' AND locale = 'en') < 1
    RAISERROR(N'[自检失败] 缺「来源」en 译名', 16, 1);
GO

/* ---- ⑥ 取证输出 ---- */
SELECT f.id, f.label, f.col_name, f.place, f.seq, f.visible, f.hidden, f.editable, f.width, f.label_en
  FROM yj_field f
 WHERE f.panel_code = N'PURCHASE_IN' AND f.col_name IN (N'来源单据', N'来源单号')
 ORDER BY f.seq, f.id;

SELECT ISNULL(RTRIM(来源单据), N'(空)') AS 来源, COUNT(*) AS 张数
  FROM bd_purchase_in
 GROUP BY 来源单据
 ORDER BY 张数 DESC;
GO
