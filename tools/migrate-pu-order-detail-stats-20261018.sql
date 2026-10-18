/* migrate-pu-order-detail-stats-20261018.sql — 采购订单补齐:明细表 + 统计表
 *
 * 【用户原话】「为采购订单补齐,采购订单明细表与采购订单统计表」(2026-10-18)
 *
 * 【现状】采购管理下只有一张「采购订单 PU_ORDER」(doc 模式,头 bd_pu_order + 行 bl_pu_order),
 *   而同级的销售管理早就是「销售订单 → 销售订单明细表 → 销售订单统计表」三段式
 *   (SALES_ORDER_DETAIL / SALES_ORDER_STATS,都是 flat 模式直读视图)。
 *   采购订单少这两张,用户查「这单买了什么、按物料/供应商汇总买了多少」只能逐单点开。
 *
 * 【做什么】照销售订单同款补两张报表面板(不改任何业务表、不动 PU_ORDER 本身):
 *   A. v_pu_order_detail(明细表 PU_ORDER_DETAIL):头 × 行 逐行展开
 *      —— 单据日期/编号/状态、供应商、业务员、币种、交货日期/到货地址、合同号、付款方式,
 *         行上的 物料编码/名称/规格/单位/数量/单价/税率/含税单价/金额/含税金额/折扣/仓库/预计到货日期。
 *   B. v_pu_order_stats(统计表 PU_ORDER_STATS):按 供应商 × 物料 × 规格 × 单位 聚合
 *      —— 订单数(DISTINCT 单据编号)、数量、金额、含税金额、折扣金额、最早/最晚交货日期。
 *   C. yj_panel + yj_field 登记(「加面板 = 插行」);字段名与视图列名严格一致。
 *   D. 多语言词条(panel + 新增字段标签,10 语言)。
 *
 * 【口径】
 *   · 状态:直接取 bd_pu_order.单据状态(金蝶同步单已带「已审核/草稿」);
 *     已作废靠 asp_cancel 过滤(QueryService 对平表默认追加 ISNULL(t.asp_cancel,'N')<>'Y')。
 *   · 行表 asp_cancel='Y' 的作废行不计入(明细、汇总都排除):否则统计口径会把删掉的行算进去。
 *   · 统计表 = 「采购订单统计」:同一物料在不同订单里出现时并成一行,订单数列出的是**不同单据数**。
 *   · 两张都是**只读报表**(flat 模式本就不落库),没有新增/保存/删除入口。
 *
 * 【幂等】视图先 DROP 后 CREATE;面板/字段 NOT EXISTS 再插;词条按 (scope,ref_key,locale) 去重。
 * 【两账套】HSDZ_MES → HSDZ_MES_TEST(DbSync 自动排队)。
 */
SET NOCOUNT ON;
PRINT N'== migrate-pu-order-detail-stats-20261018 ==';

/* ─────────────── A. 明细表视图 ─────────────── */
IF OBJECT_ID(N'dbo.v_pu_order_detail', N'V') IS NOT NULL DROP VIEW dbo.v_pu_order_detail;
GO
CREATE VIEW dbo.v_pu_order_detail AS
SELECT
    ROW_NUMBER() OVER (ORDER BY h.[单据日期] DESC, h.[单据编号], l.id) AS id,
    h.[单据日期],
    h.[单据编号],
    h.[单据状态],
    h.[供应商],
    h.[供应商编码],
    ISNULL(h.[业务员名称], h.[业务员编码]) AS [业务员],
    h.[币种],
    h.[合同号],
    h.[交货日期],
    l.[预计到货日期],       -- 在**行**上(bl_pu_order),头表只有 交货日期
    h.[到货地址],
    h.[付款方式],
    h.[结算期限],
    h.[数据来源],
    l.[物料编码],
    l.[物料名称],
    l.[规格型号],
    l.[单位],
    l.[数量],
    l.[单价],
    l.[税率%],
    l.[含税单价],
    l.[金额],
    l.[含税金额],
    l.[折扣%],
    l.[折扣金额],
    l.[仓库],
    l.[备注] AS [行备注],
    h.asp_user1,
    h.asp_time1,
    h.asp_cancel,
    l.asp_cancel AS line_cancel
  FROM dbo.bd_pu_order h
  JOIN dbo.bl_pu_order l ON l.[单据编号] = h.[单据编号]
 WHERE ISNULL(l.asp_cancel, 'N') <> 'Y';
GO

/* ─────────────── B. 统计表视图 ─────────────── */
IF OBJECT_ID(N'dbo.v_pu_order_stats', N'V') IS NOT NULL DROP VIEW dbo.v_pu_order_stats;
GO
CREATE VIEW dbo.v_pu_order_stats AS
SELECT
    ROW_NUMBER() OVER (ORDER BY h.[供应商], l.[物料编码]) AS id,
    h.[供应商],
    h.[供应商编码],
    l.[物料编码],
    l.[物料名称],
    l.[规格型号],
    l.[单位],
    COUNT(DISTINCT h.[单据编号]) AS [订单数],
    SUM(ISNULL(l.[数量], 0))   AS [数量],
    SUM(ISNULL(l.[金额], 0))   AS [金额],
    SUM(ISNULL(l.[含税金额], 0)) AS [含税金额],
    SUM(ISNULL(l.[折扣金额], 0)) AS [折扣金额],
    CASE WHEN SUM(ISNULL(l.[数量], 0)) = 0 THEN NULL
         ELSE SUM(ISNULL(l.[金额], 0)) / SUM(ISNULL(l.[数量], 0)) END AS [平均单价],
    MIN(h.[交货日期]) AS [最早交货日期],
    MAX(h.[交货日期]) AS [最晚交货日期],
    MAX(h.asp_cancel) AS asp_cancel
  FROM dbo.bd_pu_order h
  JOIN dbo.bl_pu_order l ON l.[单据编号] = h.[单据编号]
 WHERE ISNULL(l.asp_cancel, 'N') <> 'Y'
 GROUP BY h.[供应商], h.[供应商编码], l.[物料编码], l.[物料名称], l.[规格型号], l.[单位];
GO

/* ─────────────── C. 面板登记(flat 报表;module_group = 采购管理,与 PU_ORDER 同组) ─────────────── */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'PU_ORDER_DETAIL')
INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col,
                      code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
VALUES ('PU_ORDER_DETAIL', N'采购订单明细表', N'报表', N'flat', N'v_pu_order_detail', NULL, NULL, N'id',
        NULL, NULL, N'单据日期', 50, N'items', N'采购管理', N'Purchase Order Detail');

IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'PU_ORDER_STATS')
INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col,
                      code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
VALUES ('PU_ORDER_STATS', N'采购订单统计表', N'报表', N'flat', N'v_pu_order_stats', NULL, NULL, N'id',
        NULL, NULL, NULL, 50, N'items', N'采购管理', N'Purchase Order Summary');

/* ─────────────── C2. 字段登记(列名与视图一致;类型按语义给定,能合计的给小数) ─────────────── */
DECLARE @f TABLE (panel varchar(40), col_name sysname, label nvarchar(120), data_type nvarchar(40),
                  place varchar(60), seq int, width int, dict_sql nvarchar(1000));
INSERT INTO @f (panel, col_name, label, data_type, place, seq, width, dict_sql) VALUES
 -- 明细表:表头信息(可查) + 行信息
 ('PU_ORDER_DETAIL', N'单据日期',     N'单据日期',     N'日期',   N'query,detail',  10, 110, NULL),
 ('PU_ORDER_DETAIL', N'单据编号',     N'单据编号',     N'文本',   N'query,detail',  20, 170, NULL),
 ('PU_ORDER_DETAIL', N'单据状态',     N'单据状态',     N'文本',   N'query,detail',  30,  90, NULL),
 ('PU_ORDER_DETAIL', N'供应商',       N'供应商',       N'文本',   N'query,detail',  40, 180, NULL),
 ('PU_ORDER_DETAIL', N'供应商编码',   N'供应商编码',   N'文本',   N'detail',        50, 110, NULL),
 ('PU_ORDER_DETAIL', N'业务员',       N'业务员',       N'文本',   N'query,detail',  60, 100, NULL),
 ('PU_ORDER_DETAIL', N'币种',         N'币种',         N'文本',   N'detail',        70,  80, NULL),
 ('PU_ORDER_DETAIL', N'合同号',       N'合同号',       N'文本',   N'query,detail',  80, 140, NULL),
 ('PU_ORDER_DETAIL', N'交货日期',     N'交货日期',     N'日期',   N'query,detail',  90, 110, NULL),
 ('PU_ORDER_DETAIL', N'预计到货日期', N'预计到货日期', N'日期',   N'detail',       100, 110, NULL),
 ('PU_ORDER_DETAIL', N'到货地址',     N'到货地址',     N'文本',   N'detail',       110, 180, NULL),
 ('PU_ORDER_DETAIL', N'付款方式',     N'付款方式',     N'文本',   N'detail',       120, 110, NULL),
 ('PU_ORDER_DETAIL', N'结算期限',     N'结算期限',     N'文本',   N'detail',       130, 110, NULL),
 ('PU_ORDER_DETAIL', N'数据来源',     N'数据来源',     N'文本',   N'detail',       140,  90, NULL),
 ('PU_ORDER_DETAIL', N'物料编码',     N'物料编码',     N'文本',   N'query,detail', 150, 140, NULL),
 ('PU_ORDER_DETAIL', N'物料名称',     N'物料名称',     N'文本',   N'query,detail', 160, 200, NULL),
 ('PU_ORDER_DETAIL', N'规格型号',     N'规格型号',     N'文本',   N'detail',       170, 140, NULL),
 ('PU_ORDER_DETAIL', N'单位',         N'单位',         N'文本',   N'detail',       180,  70, NULL),
 ('PU_ORDER_DETAIL', N'数量',         N'数量',         N'小数',   N'detail',       190,  90, NULL),
 ('PU_ORDER_DETAIL', N'单价',         N'单价',         N'小数',   N'detail',       200,  90, NULL),
 ('PU_ORDER_DETAIL', N'税率%',        N'税率%',        N'小数',   N'detail',       210,  80, NULL),
 ('PU_ORDER_DETAIL', N'含税单价',     N'含税单价',     N'小数',   N'detail',       220,  90, NULL),
 ('PU_ORDER_DETAIL', N'金额',         N'金额',         N'小数',   N'detail',       230, 110, NULL),
 ('PU_ORDER_DETAIL', N'含税金额',     N'含税金额',     N'小数',   N'detail',       240, 110, NULL),
 ('PU_ORDER_DETAIL', N'折扣%',        N'折扣%',        N'小数',   N'detail',       250,  80, NULL),
 ('PU_ORDER_DETAIL', N'折扣金额',     N'折扣金额',     N'小数',   N'detail',       260, 100, NULL),
 ('PU_ORDER_DETAIL', N'仓库',         N'仓库',         N'文本',   N'detail',       270, 100, NULL),
 ('PU_ORDER_DETAIL', N'行备注',       N'行备注',       N'文本',   N'detail',       280, 160, NULL),
 -- 统计表:按 供应商 × 物料 聚合
 ('PU_ORDER_STATS',  N'供应商',       N'供应商',       N'文本',   N'query,detail',  10, 190, NULL),
 ('PU_ORDER_STATS',  N'供应商编码',   N'供应商编码',   N'文本',   N'detail',        20, 110, NULL),
 ('PU_ORDER_STATS',  N'物料编码',     N'物料编码',     N'文本',   N'query,detail',  30, 140, NULL),
 ('PU_ORDER_STATS',  N'物料名称',     N'物料名称',     N'文本',   N'query,detail',  40, 200, NULL),
 ('PU_ORDER_STATS',  N'规格型号',     N'规格型号',     N'文本',   N'detail',        50, 140, NULL),
 ('PU_ORDER_STATS',  N'单位',         N'单位',         N'文本',   N'detail',        60,  70, NULL),
 ('PU_ORDER_STATS',  N'订单数',       N'订单数',       N'整数',   N'detail',        70,  80, NULL),
 ('PU_ORDER_STATS',  N'数量',         N'数量',         N'小数',   N'detail',        80, 100, NULL),
 ('PU_ORDER_STATS',  N'金额',         N'金额',         N'小数',   N'detail',        90, 120, NULL),
 ('PU_ORDER_STATS',  N'含税金额',     N'含税金额',     N'小数',   N'detail',       100, 120, NULL),
 ('PU_ORDER_STATS',  N'折扣金额',     N'折扣金额',     N'小数',   N'detail',       110, 110, NULL),
 ('PU_ORDER_STATS',  N'平均单价',     N'平均单价',     N'小数',   N'detail',       120, 100, NULL),
 ('PU_ORDER_STATS',  N'最早交货日期', N'最早交货日期', N'日期',   N'query,detail', 130, 110, NULL),
 ('PU_ORDER_STATS',  N'最晚交货日期', N'最晚交货日期', N'日期',   N'query,detail', 140, 110, NULL);

INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, dict_sql, ref_panel, ref_field,
                      display_field, place, seq, width, editable, required, hidden, visible)
SELECT f.panel, f.col_name, f.label, NULL, f.data_type, f.dict_sql, NULL, NULL, NULL,
       f.place, f.seq, f.width, 0, 0, 0, 1
  FROM @f f
 WHERE NOT EXISTS (SELECT 1 FROM yj_field x WHERE x.panel_code = f.panel AND x.col_name = f.col_name);

/* ─────────────── D. 多语言(yj_translation) ─────────────── */
DECLARE @t TABLE (scope varchar(20), ref_key nvarchar(120), locale varchar(10), text nvarchar(400));
INSERT INTO @t (scope, ref_key, locale, text) VALUES
 ('panel', N'采购订单明细表', 'en', N'Purchase Order Detail'), ('panel', N'采购订单明细表', 'zh-TW', N'採購訂單明細表'),
 ('panel', N'采购订单明细表', 'ja', N'発注書明細表'), ('panel', N'采购订单明细表', 'ko', N'구매 주문 명세서'),
 ('panel', N'采购订单明细表', 'es', N'Detalle de pedido de compra'), ('panel', N'采购订单明细表', 'fr', N'Détail de commande fournisseur'),
 ('panel', N'采购订单明细表', 'de', N'Bestelldetail'), ('panel', N'采购订单明细表', 'ru', N'Детализация заказа на закупку'),
 ('panel', N'采购订单明细表', 'vi', N'Chi tiết đơn đặt hàng'), ('panel', N'采购订单明细表', 'th', N'รายละเอียดใบสั่งซื้อ'),
 ('panel', N'采购订单统计表', 'en', N'Purchase Order Summary'), ('panel', N'采购订单统计表', 'zh-TW', N'採購訂單匯總表'),
 ('panel', N'采购订单统计表', 'ja', N'発注書集計表'), ('panel', N'采购订单统计表', 'ko', N'구매 주문 요약서'),
 ('panel', N'采购订单统计表', 'es', N'Resumen de pedidos de compra'), ('panel', N'采购订单统计表', 'fr', N'Récapitulatif des commandes fournisseur'),
 ('panel', N'采购订单统计表', 'de', N'Bestellübersicht'), ('panel', N'采购订单统计表', 'ru', N'Сводка заказов на закупку'),
 ('panel', N'采购订单统计表', 'vi', N'Tổng hợp đơn đặt hàng'), ('panel', N'采购订单统计表', 'th', N'สรุปใบสั่งซื้อ'),
 -- 本批新增的字段标签(已有的如 供应商/数量/金额 由全局共享译名提供,不重复插)
 ('field', N'合同号', 'en', N'Contract No.'), ('field', N'合同号', 'zh-TW', N'合同號'),
 ('field', N'合同号', 'ja', N'契約番号'), ('field', N'合同号', 'ko', N'계약 번호'),
 ('field', N'合同号', 'es', N'N.º de contrato'), ('field', N'合同号', 'fr', N'N° de contrat'),
 ('field', N'合同号', 'de', N'Vertragsnummer'), ('field', N'合同号', 'ru', N'Номер договора'),
 ('field', N'合同号', 'vi', N'Số hợp đồng'), ('field', N'合同号', 'th', N'เลขที่สัญญา'),
 ('field', N'到货地址', 'en', N'Delivery address'), ('field', N'到货地址', 'zh-TW', N'到貨地址'),
 ('field', N'到货地址', 'ja', N'納品先住所'), ('field', N'到货地址', 'ko', N'납품 주소'),
 ('field', N'到货地址', 'es', N'Dirección de entrega'), ('field', N'到货地址', 'fr', N'Adresse de livraison'),
 ('field', N'到货地址', 'de', N'Lieferadresse'), ('field', N'到货地址', 'ru', N'Адрес доставки'),
 ('field', N'到货地址', 'vi', N'Địa chỉ giao hàng'), ('field', N'到货地址', 'th', N'ที่อยู่จัดส่ง'),
 ('field', N'结算期限', 'en', N'Settlement term'), ('field', N'结算期限', 'zh-TW', N'結算期限'),
 ('field', N'结算期限', 'ja', N'決済期限'), ('field', N'结算期限', 'ko', N'결제 기한'),
 ('field', N'结算期限', 'es', N'Plazo de liquidación'), ('field', N'结算期限', 'fr', N'Délai de règlement'),
 ('field', N'结算期限', 'de', N'Zahlungsziel'), ('field', N'结算期限', 'ru', N'Срок расчётов'),
 ('field', N'结算期限', 'vi', N'Kỳ hạn thanh toán'), ('field', N'结算期限', 'th', N'กำหนดชำระ'),
 ('field', N'数据来源', 'en', N'Data source'), ('field', N'数据来源', 'zh-TW', N'資料來源'),
 ('field', N'数据来源', 'ja', N'データソース'), ('field', N'数据来源', 'ko', N'데이터 원본'),
 ('field', N'数据来源', 'es', N'Origen de datos'), ('field', N'数据来源', 'fr', N'Source des données'),
 ('field', N'数据来源', 'de', N'Datenquelle'), ('field', N'数据来源', 'ru', N'Источник данных'),
 ('field', N'数据来源', 'vi', N'Nguồn dữ liệu'), ('field', N'数据来源', 'th', N'แหล่งข้อมูล'),
 ('field', N'行备注', 'en', N'Line remark'), ('field', N'行备注', 'zh-TW', N'行備註'),
 ('field', N'行备注', 'ja', N'明細備考'), ('field', N'行备注', 'ko', N'행 비고'),
 ('field', N'行备注', 'es', N'Observación de línea'), ('field', N'行备注', 'fr', N'Remarque de ligne'),
 ('field', N'行备注', 'de', N'Zeilenbemerkung'), ('field', N'行备注', 'ru', N'Примечание строки'),
 ('field', N'行备注', 'vi', N'Ghi chú dòng'), ('field', N'行备注', 'th', N'หมายเหตุบรรทัด'),
 ('field', N'订单数', 'en', N'Order count'), ('field', N'订单数', 'zh-TW', N'訂單數'),
 ('field', N'订单数', 'ja', N'注文件数'), ('field', N'订单数', 'ko', N'주문 건수'),
 ('field', N'订单数', 'es', N'N.º de pedidos'), ('field', N'订单数', 'fr', N'Nombre de commandes'),
 ('field', N'订单数', 'de', N'Bestellanzahl'), ('field', N'订单数', 'ru', N'Количество заказов'),
 ('field', N'订单数', 'vi', N'Số đơn'), ('field', N'订单数', 'th', N'จำนวนใบสั่งซื้อ'),
 ('field', N'平均单价', 'en', N'Average price'), ('field', N'平均单价', 'zh-TW', N'平均單價'),
 ('field', N'平均单价', 'ja', N'平均単価'), ('field', N'平均单价', 'ko', N'평균 단가'),
 ('field', N'平均单价', 'es', N'Precio medio'), ('field', N'平均单价', 'fr', N'Prix moyen'),
 ('field', N'平均单价', 'de', N'Durchschnittspreis'), ('field', N'平均单价', 'ru', N'Средняя цена'),
 ('field', N'平均单价', 'vi', N'Đơn giá trung bình'), ('field', N'平均单价', 'th', N'ราคาเฉลี่ย'),
 ('field', N'最早交货日期', 'en', N'Earliest delivery'), ('field', N'最早交货日期', 'zh-TW', N'最早交貨日期'),
 ('field', N'最早交货日期', 'ja', N'最早納品日'), ('field', N'最早交货日期', 'ko', N'최조 납품일'),
 ('field', N'最早交货日期', 'es', N'Entrega más temprana'), ('field', N'最早交货日期', 'fr', N'Livraison la plus tôt'),
 ('field', N'最早交货日期', 'de', N'Früheste Lieferung'), ('field', N'最早交货日期', 'ru', N'Ранняя поставка'),
 ('field', N'最早交货日期', 'vi', N'Ngày giao sớm nhất'), ('field', N'最早交货日期', 'th', N'วันส่งมอบเร็วสุด'),
 ('field', N'最晚交货日期', 'en', N'Latest delivery'), ('field', N'最晚交货日期', 'zh-TW', N'最晚交貨日期'),
 ('field', N'最晚交货日期', 'ja', N'最遅納品日'), ('field', N'最晚交货日期', 'ko', N'최종 납품일'),
 ('field', N'最晚交货日期', 'es', N'Entrega más tardía'), ('field', N'最晚交货日期', 'fr', N'Livraison la plus tardive'),
 ('field', N'最晚交货日期', 'de', N'Späteste Lieferung'), ('field', N'最晚交货日期', 'ru', N'Поздняя поставка'),
 ('field', N'最晚交货日期', 'vi', N'Ngày giao muộn nhất'), ('field', N'最晚交货日期', 'th', N'วันส่งมอบช้าสุด');

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT t.scope, t.ref_key, t.locale, t.text, 'manual'
  FROM @t t
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                    WHERE x.scope = t.scope AND x.ref_key = t.ref_key AND x.locale = t.locale);

/* ─────────────── E. 自检 ─────────────── */
DECLARE @bad int = 0;
IF OBJECT_ID(N'dbo.v_pu_order_detail', N'V') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.v_pu_order_stats', N'V') IS NULL SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_panel WHERE panel_code IN ('PU_ORDER_DETAIL','PU_ORDER_STATS')) <> 2 SET @bad = @bad + 1;
-- 每个视图列(除 id/asp_*)都必须在 yj_field 有登记,否则列表少列
IF EXISTS (SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.v_pu_order_detail')
            AND c.name NOT IN ('id','asp_user1','asp_time1','asp_cancel','line_cancel')
            AND NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code='PU_ORDER_DETAIL' AND f.col_name=c.name))
  SET @bad = @bad + 1;
IF EXISTS (SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.v_pu_order_stats')
            AND c.name NOT IN ('id','asp_cancel')
            AND NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code='PU_ORDER_STATS' AND f.col_name=c.name))
  SET @bad = @bad + 1;
-- 反过来:登记的字段必须真实存在于视图(否则打开就报「列名无效」)
IF EXISTS (SELECT f.col_name FROM yj_field f WHERE f.panel_code='PU_ORDER_DETAIL'
            AND NOT EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id=OBJECT_ID(N'dbo.v_pu_order_detail') AND c.name=f.col_name))
  SET @bad = @bad + 1;
IF EXISTS (SELECT f.col_name FROM yj_field f WHERE f.panel_code='PU_ORDER_STATS'
            AND NOT EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id=OBJECT_ID(N'dbo.v_pu_order_stats') AND c.name=f.col_name))
  SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_translation WHERE scope='panel' AND ref_key=N'采购订单明细表' AND locale='en') = 0 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_translation WHERE scope='panel' AND ref_key=N'采购订单统计表' AND locale='en') = 0 SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'采购订单明细表/统计表迁移自检失败(坏项 %d)', 16, 1, @bad);
ELSE PRINT N'[OK] 采购订单明细表 PU_ORDER_DETAIL / 统计表 PU_ORDER_STATS 就绪(视图 + 面板 + 字段 + 10 语言)';
GO

SELECT (SELECT COUNT(*) FROM v_pu_order_detail) AS 明细行数,
       (SELECT COUNT(*) FROM v_pu_order_stats)  AS 统计行数,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code='PU_ORDER_DETAIL') AS 明细字段,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code='PU_ORDER_STATS')  AS 统计字段;
GO
