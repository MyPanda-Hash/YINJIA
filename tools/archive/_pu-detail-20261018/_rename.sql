SET NOCOUNT ON;
UPDATE yj_panel SET panel_name = N'采购订单统计表', panel_name_en = N'Purchase Order Statistics'
 WHERE panel_code = N'PU_ORDER_STATS' AND panel_name = N'采购订单汇总表';
SELECT @@ROWCOUNT AS 面板名更新;
UPDATE yj_translation SET ref_key = N'采购订单统计表', text = CASE locale
    WHEN 'en' THEN N'Purchase Order Statistics' WHEN 'zh-TW' THEN N'採購訂單統計表'
    WHEN 'ja' THEN N'発注書統計表' WHEN 'ko' THEN N'구매 주문 통계' WHEN 'es' THEN N'Estadísticas de pedidos de compra'
    WHEN 'fr' THEN N'Statistiques des commandes fournisseur' WHEN 'de' THEN N'Bestellstatistik'
    WHEN 'ru' THEN N'Статистика заказов на закупку' WHEN 'vi' THEN N'Thống kê đơn đặt hàng' WHEN 'th' THEN N'สถิติใบสั่งซื้อ'
    ELSE text END
 WHERE scope = N'panel' AND ref_key = N'采购订单汇总表';
SELECT @@ROWCOUNT AS 译名更新;
SELECT panel_code, panel_name, panel_name_en FROM yj_panel WHERE panel_code IN ('PU_ORDER_DETAIL','PU_ORDER_STATS');
