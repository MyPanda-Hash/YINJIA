package com.yinjia.mes.panel;

import java.util.Map;

/**
 * 面板别名(2026-10-25)。
 *
 * <p>背景:有些面板是另一个面板的**只读副本**(同一张表、同一批单据、只是按钮与数据范围不同)。
 * 采购订单的「供应商采购打印」`SUPPLIER_PU_ORDER` 就是这种:
 * 它和 `PU_ORDER` 共用 `bd_pu_order` / `bl_pu_order`,但**面板编码不同**。
 *
 * <p>而 MES 里有两类信息是**按面板编码**存的,不跟着业务表走:
 * <ol>
 *   <li><b>字段定义</b> `yj_field.panel_code` —— 副本面板要复用源面板的字段({@link #fieldSource});</li>
 *   <li><b>单据状态</b> `yj_doc_status(panel_code, doc_no)` —— 审核/作废/删除/归档/提交审批
 *       全记在这里。副本面板若按自己的编码去查,**一条都查不到** ⇒ 单据状态全显示「草稿」、
 *       已删除的单据也排除不掉、条数比源面板多(2026-10-25 用户报「采购订单删除数据,供应商打印并不同步」)。</li>
 * </ol>
 *
 * <p>所以凡是要读「单据状态」的地方,面板编码必须先过 {@link #statusSource} 折算成**真实记账的面板**。
 *
 * <p>⚠ 写入口(保存/审核/删除/归档)本来就走源面板,不需要折算;这里只服务读路径。
 * ⚠ 新增这类"副本面板"时**两处映射都要登记**,否则又会出现"状态不同步"。
 */
public final class PanelAliases {

    /** 采购订单 */
    public static final String PU_ORDER = "PU_ORDER";
    /** 供应商采购打印(采购订单的只读副本:同一张表,只有查询+打印) */
    public static final String SUPPLIER_PU_ORDER = "SUPPLIER_PU_ORDER";

    /** 字段定义的源面板:副本面板 → 源面板 */
    private static final Map<String, String> FIELD_SOURCE = Map.of(
            SUPPLIER_PU_ORDER, PU_ORDER);

    /** 单据状态(yj_doc_status)的源面板:副本面板 → 源面板 */
    private static final Map<String, String> STATUS_SOURCE = Map.of(
            SUPPLIER_PU_ORDER, PU_ORDER);

    private PanelAliases() {
    }

    /** 读字段定义时该用哪个面板的 yj_field(无别名则原样返回) */
    public static String fieldSource(String panelCode) {
        if (panelCode == null) return null;
        return FIELD_SOURCE.getOrDefault(panelCode, panelCode);
    }

    /**
     * 读单据状态时该用哪个面板的 yj_doc_status(无别名则原样返回)。
     * 列表行、条数统计、归档/作废过滤、关键字里的状态匹配都必须走它。
     */
    public static String statusSource(String panelCode) {
        if (panelCode == null) return null;
        return STATUS_SOURCE.getOrDefault(panelCode, panelCode);
    }

    /** 是否为"副本面板"(只读,不落自己的状态行) */
    public static boolean isMirror(String panelCode) {
        return panelCode != null && STATUS_SOURCE.containsKey(panelCode);
    }

    /** 全部副本面板编码(供注册表批量做"字段跟随",顺序稳定便于日志) */
    public static java.util.List<String> mirrorPanels() {
        return java.util.List.of(SUPPLIER_PU_ORDER);
    }
}
