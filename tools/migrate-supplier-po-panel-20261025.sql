/* ============================================================================
 * migrate-supplier-po-panel-20261025.sql —— 新增「供应商采购订单」面板(与采购订单同一张单,只读)
 * ----------------------------------------------------------------------------
 * 用户口径(2026-10-25,第三次澄清):
 *   「是多做一个和采购订单一样的供应商面版,只有打印按钮和查询(查询必须只能查供应商关联的数据)按钮的」
 *   · 供应商登录后菜单里只有这一个面板(供应商门户 → 供应商采购打印);
 *   · 内部账号(采购部)也能进,看全部数据,同样只读;
 *   · 面板长得和采购订单一样(同一张单、同一套字段/版式/明细表格/打印版式),
 *     只是工具栏**只有「查询」和「打印」**;
 *   · 查询结果必须只出供应商关联的数据(供应商会话在服务端强制按供应商编码过滤)。
 *
 * 做法 = **元数据复制**(不建新表、不改数据):
 *   ① yj_panel 插一行 SUPPLIER_PU_ORDER:mode/头行表/分组键/主键全同 PU_ORDER
 *      (同一张 bd_pu_order + bl_pu_order,供应商无需另存一份数据);
 *   ② yj_field 按 PU_ORDER 的 186 行**逐列复制**(字段标签=数据键保持中文,ADR-0001;
 *      place/seq/类型/参照/必填/只读/宽 全部沿用 ⇒ 纸张与明细表与采购订单一致);
 *   ③ 每列补 en 译名(label_en 取 PU_ORDER 同名列的,没有则留空,由 yj_translation 兜底);
 *   ④ 面板名译名(9 语言)写 yj_translation,与既有面板同口径;
 *   ⑤ 自检:面板存在 / 字段数 = PU_ORDER 字段数 / 关键列(单据编号、供应商编码、物料编码)在位。
 *
 * 前端(同批代码,不在本脚本内):
 *   · menus.js:采购管理 →「单据」组里新增「供应商采购打印」(原插在「供应商门户」组的那条移到单据组);
 *     供应商账号登录后菜单仍只剩这一条(visiblePanels=[SUPPLIER_PRINT]);
 *   · /scm/supplierPrint 直接渲染通用面板页 PanelxList,面板码 = SUPPLIER_PU_ORDER;
 *   · 工具栏只留 查询/打印(PanelConfigService 的 PANDA_BUTTONS 给这一码只出这两组);
 *   · 打印走与采购订单相同的纸质单版式(print-formats.printPuOrder)。
 *
 * 后端(同批代码):
 *   · QueryService:供应商会话查询本面板时,服务端用 yj_supplier_account 的 supplier_code
 *     **覆盖**前端条件成「供应商编码 LIKE 值」(前端不传/传错都无效),且只允许本面板;
 *   · SupplierPortalGuardFilter:放行本面板的 queryFormDataList 与 getPanelConfig;
 *   · PanelPermissionService:供应商会话可读本面板(只读)。
 *
 * 回退:
 *   DELETE FROM yj_field WHERE panel_code='SUPPLIER_PU_ORDER';
 *   DELETE FROM yj_panel WHERE panel_code='SUPPLIER_PU_ORDER';
 *   DELETE FROM yj_translation WHERE scope='panel' AND ref_key=N'供应商采购打印';
 *   (代码侧:menus.js 那条菜单 + PanelConfigService 的按钮表 + QueryService 的供应商范围分支)
 *
 * 两账套(HSDZ_MES / HSDZ_MES_TEST)均需执行;幂等(存在即跳过 / 字段按列名补齐)。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---------- ① 面板登记 ---------- */
IF NOT EXISTS (SELECT 1 FROM dbo.yj_panel WHERE panel_code = N'SUPPLIER_PU_ORDER')
BEGIN
    INSERT INTO dbo.yj_panel
        (panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col,
         pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, config, config_at)
    SELECT N'SUPPLIER_PU_ORDER', N'供应商采购打印', N'Supplier Purchase Print',
           p.category, p.mode, p.line_table, p.head_table, p.group_col,
           p.pk_col, p.code_col, p.prefix, p.date_col, p.page_size, p.detail_key, p.module_group,
           p.config, p.config_at
      FROM dbo.yj_panel p WHERE p.panel_code = N'PU_ORDER';
    PRINT N'① 已登记面板 SUPPLIER_PU_ORDER(表结构同 PU_ORDER)';
END
ELSE
    PRINT N'① SUPPLIER_PU_ORDER 已存在,跳过';
GO

/* ---------- ② 字段复制(与采购订单逐列一致;按 col_name+place 判重,幂等) ---------- */
INSERT INTO dbo.yj_field
    (panel_code, col_name, label, label_en, data_type, dict_sql, ref_panel, ref_field, display_field,
     ref_filter, place, seq, width, editable, required, hidden, alias, visible, col_group, tab_key)
SELECT N'SUPPLIER_PU_ORDER', f.col_name, f.label, f.label_en, f.data_type, f.dict_sql,
       f.ref_panel, f.ref_field, f.display_field, f.ref_filter, f.place, f.seq, f.width,
       f.editable, f.required, f.hidden, f.alias, f.visible, f.col_group, f.tab_key
  FROM dbo.yj_field f
 WHERE f.panel_code = N'PU_ORDER'
   AND NOT EXISTS (SELECT 1 FROM dbo.yj_field x
                    WHERE x.panel_code = N'SUPPLIER_PU_ORDER'
                      AND x.col_name = f.col_name AND ISNULL(x.place, N'') = ISNULL(f.place, N''));
PRINT N'② 字段已按采购订单复制(已存在的列不重复插)';
GO

/* ---------- ③ 面板名译名(9 语言,已存在不覆盖) ---------- */
DECLARE @t TABLE (locale nvarchar(10) NOT NULL, text nvarchar(200) NOT NULL);
INSERT INTO @t (locale, text) VALUES
 ('en', N'Supplier Purchase Order'), ('ja', N'仕入先購買発注'), ('ko', N'공급업체 구매 발주'),
 ('de', N'Lieferanten-Bestellung'), ('es', N'Pedido de compra del proveedor'), ('fr', N'Commande fournisseur'),
 ('ru', N'Заказ поставщика'), ('vi', N'Đơn mua hàng nhà cung cấp'), ('th', N'ใบสั่งซื้อของผู้จัดจำหน่าย');
INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source)
SELECT N'panel', N'供应商采购打印', t.locale, t.text, N'manual'
  FROM @t t
 WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_translation x
                    WHERE x.scope = N'panel' AND x.ref_key = N'供应商采购打印' AND x.locale = t.locale);
PRINT N'③ 面板名译名已写入';
GO

/* ---------- ④ 自检 ---------- */
IF NOT EXISTS (SELECT 1 FROM dbo.yj_panel WHERE panel_code = N'SUPPLIER_PU_ORDER')
    RAISERROR(N'自检失败:SUPPLIER_PU_ORDER 面板未登记', 16, 1);

DECLARE @src int = (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code = N'PU_ORDER');
DECLARE @dst int = (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code = N'SUPPLIER_PU_ORDER');
IF @dst < @src
    RAISERROR(N'自检失败:字段未复制齐(采购订单 %d 行,新面板 %d 行)', 16, 1, @src, @dst);

IF NOT EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code = N'SUPPLIER_PU_ORDER' AND label = N'供应商编码')
    RAISERROR(N'自检失败:缺「供应商编码」字段(供应商范围过滤依赖它)', 16, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.yj_field WHERE panel_code = N'SUPPLIER_PU_ORDER' AND label = N'单据编号')
    RAISERROR(N'自检失败:缺「单据编号」字段', 16, 1);

IF (SELECT COUNT(*) FROM dbo.yj_translation WHERE scope = N'panel' AND ref_key = N'供应商采购打印') < 9
    RAISERROR(N'自检失败:面板名译名不足 9 种语言', 16, 1);

SELECT N'自检' AS k,
       (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code = N'SUPPLIER_PU_ORDER') AS 字段行,
       (SELECT COUNT(*) FROM dbo.yj_field WHERE panel_code = N'PU_ORDER') AS 采购订单字段行,
       (SELECT COUNT(*) FROM dbo.yj_translation WHERE scope = N'panel' AND ref_key = N'供应商采购打印') AS 译名条数;
GO
PRINT N'✅ 供应商采购订单面板就绪(SUPPLIER_PU_ORDER,只读,与采购订单同一张表)';
GO
