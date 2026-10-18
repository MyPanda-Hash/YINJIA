-- migrate-proc-process-refs-20261018.sql — 「生产过程」10 张单据补齐字段关联(参照/下拉)
--
-- 【用户口径】2026-10-18「完善一下生产过程里面的单据…有一些功能也不完善」
--   体检实测(tools/archive/_prod-process-audit/_FieldGap.java):这 10 张面板的字段
--   **几乎全是裸输入框** —— 工单号、产品编码/名称、物料编码/名称、工序、生产线、人员
--   全要人手打字,和工单/存货/工序档案零关联,打错也不报错。这就是「功能不完善」的主因。
--
-- 【做法】只改 yj_field 的三列配置,不动表结构、不动业务数据:
--   ref_panel + ref_field + display_field ⇒ 前端渲染成参照弹窗(点开选档案,自动带回描述列);
--   dict_sql                             ⇒ 前端渲染成下拉(固定候选)。
--   ⚠ ref_field / display_field 存的是**目标面板的字段名(label)**,不是物理列名
--     (见 AGENTS.md 采购链 §5;PanelConfigService 用 refLabelOf() 转回列名)。
--
-- 【目标面板依据】
--   工序   → OP        工序编码 / display 工序名称   (先例:DISPATCH.工序编码 已是这么配的)
--   生产线 → PROD_LINE 生产线
--   产品/物料 → INV    存货编码 / 存货名称           (先例:DISPATCH.产品名称 → INV.存货名称)
--   人员   → EMP       员工名称                       (先例:审核人 → EMP.员工名称)
--
-- 【工单号为什么用 dict_sql 而不是 ref_panel】
--   工单在 plang 表,界面上是页面级列表 WORK_ORDER_LIST —— 它**不是 yj_panel 面板**,
--   而参照解析走 PanelConfigService→registry.panel(refPanel),只认 yj_panel。
--   所以工单号用 dict_sql 从 plang 直接取(至少不手打、不会拼错)。
--   同时**修正** PROD_ABN.工单号 的错误配置:原来 ref_panel=MANU_ORDER / ref_field=合同号,
--   而 MANU_ORDER 底表 bd_manu_order 在单轨改造后是 **0 行** ⇒ 那个下拉永远是空的。
--
-- 幂等:纯 UPDATE,重复执行结果相同;守卫见 §2/§3。两个账套都要跑。

SET NOCOUNT ON;

-- ═══ 1. 白名单:38 个字段的期望配置(只碰这 38 个,别的一律不动) ═══
DECLARE @want TABLE (
    panel_code    nvarchar(64),
    label         nvarchar(128),
    col_name      nvarchar(128),
    ref_panel     nvarchar(64)  NULL,
    ref_field     nvarchar(128) NULL,
    display_field nvarchar(128) NULL,
    dict_sql      nvarchar(2000) NULL,
    PRIMARY KEY (panel_code, label, col_name)
);
INSERT INTO @want (panel_code, label, col_name, ref_panel, ref_field, display_field) VALUES
  -- ① 工序 → OP(3 张)
  (N'WO_REPORT',          N'工序',   N'gxdm',     N'OP',        N'工序编码', N'工序名称'),
  (N'WO_REPORT_LIST',     N'工序',   N'gxdm',     N'OP',        N'工序编码', N'工序名称'),
  (N'WO_COMPLETION_LIST', N'工序',   N'gxdm',     N'OP',        N'工序编码', N'工序名称'),
  -- ② 生产线 → PROD_LINE(3 张)
  (N'WO_REPORT',          N'生产线', N'scx',      N'PROD_LINE', N'生产线',   N'生产线'),
  (N'WO_REPORT_LIST',     N'生产线', N'scx',      N'PROD_LINE', N'生产线',   N'生产线'),
  (N'WO_COMPLETION_LIST', N'生产线', N'scx',      N'PROD_LINE', N'生产线',   N'生产线'),
  -- ③ 产品 → INV(7 张字段)
  (N'WO_COMPLETION_LIST', N'产品编码', N'wzdm',       N'INV', N'存货编码', N'存货名称'),
  (N'WO_COMPLETION_LIST', N'产品名称', N'mc',         N'INV', N'存货名称', N'存货名称'),
  (N'PROD_ABN',           N'产品编码', N'产品编码',   N'INV', N'存货编码', N'存货名称'),
  (N'DAY_REPORT',         N'产品编码', N'产品编码',   N'INV', N'存货编码', N'存货名称'),
  (N'DAY_REPORT',         N'产品名称', N'产品名称',   N'INV', N'存货名称', N'存货名称'),
  (N'WH_RECORD',          N'产品编号', N'产品编号',   N'INV', N'存货编码', N'存货名称'),
  (N'PACK_CONFIRM',       N'产品编号', N'产品编号',   N'INV', N'存货编码', N'存货名称'),
  -- ④ 物料 → INV(4 张字段)
  (N'FEED_CONFIRM',       N'物料名称', N'物料名称',   N'INV', N'存货名称', N'存货名称'),
  (N'MIX_RECORD',         N'物料编码', N'物料编码',   N'INV', N'存货编码', N'存货名称'),
  (N'MIX_RECORD',         N'物料名称', N'物料名称',   N'INV', N'存货名称', N'存货名称'),
  (N'GRAN_RECORD',        N'物料名称', N'物料名称',   N'INV', N'存货名称', N'存货名称'),
  -- ⑤ 人员 → EMP(16 个字段)
  (N'WO_REPORT',          N'报工人',     N'ywman',      N'EMP', N'员工名称', N'员工名称'),
  (N'WO_REPORT_LIST',     N'报工人',     N'ywman',      N'EMP', N'员工名称', N'员工名称'),
  (N'WO_COMPLETION_LIST', N'报工人',     N'ywman',      N'EMP', N'员工名称', N'员工名称'),
  (N'FEED_CONFIRM',       N'投料人',     N'投料人',     N'EMP', N'员工名称', N'员工名称'),
  (N'FEED_CONFIRM',       N'确认人',     N'确认人',     N'EMP', N'员工名称', N'员工名称'),
  (N'MIX_RECORD',         N'操作人',     N'操作人',     N'EMP', N'员工名称', N'员工名称'),
  (N'MIX_RECORD',         N'核对人',     N'核对人',     N'EMP', N'员工名称', N'员工名称'),
  (N'GRAN_RECORD',        N'取样测试人', N'取样测试人', N'EMP', N'员工名称', N'员工名称'),
  (N'GRAN_RECORD',        N'操作员',     N'操作员',     N'EMP', N'员工名称', N'员工名称'),
  (N'PACK_CONFIRM',       N'装箱人',     N'装箱人',     N'EMP', N'员工名称', N'员工名称'),
  (N'PACK_CONFIRM',       N'确认人',     N'确认人',     N'EMP', N'员工名称', N'员工名称'),
  (N'PACK_CONFIRM',       N'主管签名',   N'主管签名',   N'EMP', N'员工名称', N'员工名称'),
  (N'DAY_REPORT',         N'填表人',     N'填表人',     N'EMP', N'员工名称', N'员工名称'),
  (N'PROD_ABN',           N'提出人',     N'提出人',     N'EMP', N'员工名称', N'员工名称'),
  (N'PROD_ABN',           N'处理人',     N'处理人',     N'EMP', N'员工名称', N'员工名称'),
  (N'PROD_ABN',           N'结案人',     N'结案人',     N'EMP', N'员工名称', N'员工名称');

-- ⑥ 工单号 → dict_sql 从 plang 取(4 张;PROD_ABN 那条同时修正掉失效的 MANU_ORDER 参照)
DECLARE @woSql nvarchar(2000) =
    N'SELECT pl_no FROM plang WHERE ISNULL(asp_cancel,''N'')<>''Y'' ORDER BY pl_no DESC';
INSERT INTO @want (panel_code, label, col_name, ref_panel, ref_field, display_field, dict_sql) VALUES
  (N'WO_REPORT',          N'工单号', N'gldh',   NULL, NULL, NULL, @woSql),
  (N'WO_REPORT_LIST',     N'工单号', N'gldh',   NULL, NULL, NULL, @woSql),
  (N'WO_COMPLETION_LIST', N'工单号', N'gldh',   NULL, NULL, NULL, @woSql),
  (N'PROD_ABN',           N'工单号', N'工单号', NULL, NULL, NULL, @woSql);

-- ═══ 2. 前置守卫:面板与字段必须都在(避免在陈旧库上瞎改/写错 label 空跑) ═══
DECLARE @badPanel int = (SELECT COUNT(DISTINCT w.panel_code) FROM @want w
                          WHERE NOT EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_code = w.panel_code));
IF @badPanel > 0
BEGIN
    RAISERROR(N'[FAIL] 有 %d 张目标面板在 yj_panel 里不存在,先确认库结构', 16, 1, @badPanel);
    RETURN;
END
DECLARE @badField int = (SELECT COUNT(1) FROM @want w
                          WHERE NOT EXISTS (SELECT 1 FROM yj_field f
                                             WHERE f.panel_code = w.panel_code AND f.label = w.label AND f.col_name = w.col_name));
IF @badField > 0
BEGIN
    RAISERROR(N'[FAIL] 白名单里有 %d 个字段在 yj_field 里找不到(panel_code/label/col_name 不匹配)', 16, 1, @badField);
    RETURN;
END

-- ═══ 3. 更新(只按三元组精确命中) ═══
-- ⚠ data_type 必须跟着改:前端只在 `data_type='参照'` 时才渲染参照弹窗(PanelRegistry.FieldDef.isRef()
--   就是 `"参照".equals(dataType)`),只在 `data_type='下拉框'` 时才把 dict_sql 变成下拉选项。
--   第一版漏了这一步,配置写进库但界面一点变化都没有(2026-10-18 实测)。
DECLARE @wrongType int = (SELECT COUNT(1)
                            FROM @want w JOIN yj_field f
                              ON f.panel_code = w.panel_code AND f.label = w.label AND f.col_name = w.col_name
                           WHERE (w.ref_panel IS NOT NULL AND f.data_type <> N'文本')
                              -- dict 字段允许原值是「参照」:PROD_ABN.工单号 此前被错配成
                              -- ref_panel=MANU_ORDER(底表 0 行,下拉永远空),本次改回 dict 下拉,原类型就是参照
                              OR (w.dict_sql  IS NOT NULL AND f.data_type NOT IN (N'文本', N'下拉框', N'参照')));
IF @wrongType > 0
BEGIN
    RAISERROR(N'[FAIL] 有 %d 个目标字段的 data_type 不是「文本」,拒绝改成参照/下拉(避免把小数/日期字段改坏)', 16, 1, @wrongType);
    RETURN;
END

UPDATE f
   SET f.ref_panel     = w.ref_panel,
       f.ref_field     = w.ref_field,
       f.display_field = w.display_field,
       f.dict_sql      = COALESCE(w.dict_sql, f.dict_sql),
       f.data_type     = CASE WHEN w.ref_panel IS NOT NULL THEN N'参照' ELSE N'下拉框' END
  FROM yj_field f
  JOIN @want w ON f.panel_code = w.panel_code AND f.label = w.label AND f.col_name = w.col_name;
DECLARE @hit int = @@ROWCOUNT;

-- ═══ 4. 回写后自检:38 个字段全部等于期望值,越界 0 ═══
DECLARE @wrong int = (SELECT COUNT(1)
                        FROM @want w
                        JOIN yj_field f ON f.panel_code = w.panel_code AND f.label = w.label AND f.col_name = w.col_name
                       WHERE ISNULL(f.ref_panel, N'')     <> ISNULL(w.ref_panel, N'')
                          OR ISNULL(f.ref_field, N'')     <> ISNULL(w.ref_field, N'')
                          OR ISNULL(f.display_field, N'') <> ISNULL(w.display_field, N'')
                          OR f.data_type <> CASE WHEN w.ref_panel IS NOT NULL THEN N'参照' ELSE N'下拉框' END);
IF @wrong > 0
BEGIN
    RAISERROR(N'[FAIL] 回写后有 %d 个字段的配置与期望不一致', 16, 1, @wrong);
    RETURN;
END

PRINT N'[OK] 生产过程字段关联已配好 ' + CAST(@hit AS nvarchar(10)) + N' 个字段(白名单 38),越界 0';
PRINT N'     工序→OP / 生产线→PROD_LINE / 产品·物料→INV / 人员→EMP / 工单号→plang 下拉';
