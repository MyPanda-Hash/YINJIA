package com.yinjia.mes.panel;

import com.yinjia.mes.service.ButtonService;
import com.yinjia.mes.service.PanelConfigService;
import com.yinjia.mes.service.PanelRegistry;
import com.yinjia.mes.service.QueryService;
import com.yinjia.mes.service.VoucherFlowService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 工单生成领料单(生产过程层·扫码领料):按产品默认 BOM 展开子件 × 订单数量,
 * 生成材料出库单草稿;操作员在草稿上扫材料二维码补[批号]后审核出库(kucun 三键扣减)。
 * 与 PushGenerateHandler 同构(占用守卫/已审核守卫/返回 gotoPanel),差异仅在行来源=BOM 展开而非源单明细。
 */
@Component
public class WoPickingHandler implements PanelActionHandler {

    private final PanelRegistry registry;
    private final QueryService queryService;
    private final ButtonService buttonService;
    private final VoucherFlowService voucherFlow;
    private final PanelConfigService configService;
    private final JdbcTemplate jdbc;

    public WoPickingHandler(PanelRegistry registry, QueryService queryService, ButtonService buttonService,
                            VoucherFlowService voucherFlow, PanelConfigService configService, JdbcTemplate jdbc) {
        this.registry = registry;
        this.queryService = queryService;
        this.buttonService = buttonService;
        this.voucherFlow = voucherFlow;
        this.configService = configService;
        this.jdbc = jdbc;
    }

    @Override
    public boolean supports(String panelCode, String action) {
        return "WO_ORDER".equals(panelCode) && "生成领料单".equals(action);
    }

    @Override
    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> handle(PanelActionContext context) {
        String sourceNo = context.formData() == null ? null : String.valueOf(context.formData().get("编号"));
        if (sourceNo == null || sourceNo.isBlank() || "null".equals(sourceNo)) throw new IllegalArgumentException("缺少表单编号");

        // 1) 工单必须已审核
        Map<String, Object> st = buttonService.docStatus("WO_ORDER", sourceNo);
        if (!"已审核".equals(st.get("status"))) throw new IllegalStateException("仅已审核工单可生成领料单,当前状态:" + st.get("status"));

        // 2) 重复占用守卫
        Integer linked = jdbc.queryForObject(
                "SELECT COUNT(*) FROM form_flow_link WHERE source_panel_code='WO_ORDER' AND source_form_no=?"
                        + " AND target_panel_code='MATERIAL_OUT' AND link_status='ACTIVE'", Integer.class, sourceNo);
        if (linked != null && linked > 0) throw new IllegalStateException("该工单已生成领料单,请先删除下游草稿后重试");

        // 3) 工单头 + BOM 展开
        Map<String, Object> src = queryService.loadOneDoc(registry.panel("WO_ORDER"), sourceNo);
        Map<String, Object> head = new LinkedHashMap<>(src);
        head.remove("detail");
        String productCode = str(head.get("产品编码"));
        double orderQty = num(head.get("订单数量"));
        if (productCode == null) throw new IllegalStateException("工单缺少产品编码,不能按 BOM 展开领料");
        List<Map<String, Object>> bom = jdbc.queryForList(
                "SELECT [子件编码], [子件名称], [规格型号], [子件计量单位], [定额数量] FROM bs_bom"
                        + " WHERE [父件编码] = ? AND ISNULL([默认BOM], 0) = 1 AND ISNULL([状态], N'启用') = N'启用'"
                        + " AND ISNULL(asp_cancel, 'N') <> 'Y' AND [子件编码] IS NOT NULL ORDER BY id", productCode);
        if (bom.isEmpty()) throw new IllegalStateException("产品 " + productCode + " 未维护默认 BOM,不能生成领料单");

        String workshop = str(head.get("生产车间"));
        // 4) 组装材料出库单草稿:头 + BOM 行(数量=定额×订单数量;批号留空由扫码补)
        Map<String, Object> targetHead = new LinkedHashMap<>();
        targetHead.put("单据日期", java.time.LocalDate.now().toString());
        targetHead.put("加工单号", sourceNo);
        targetHead.put("来源单号", sourceNo);
        targetHead.put("生产车间", workshop);
        targetHead.put("仓库", "材料仓");
        targetHead.put("领用人", context.userName());
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> b : bom) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("材料编码", str(b.get("子件编码")));
            row.put("材料名称", str(b.get("子件名称")));
            row.put("规格型号", str(b.get("规格型号")));
            row.put("计量单位", str(b.get("子件计量单位")));
            row.put("数量", num(b.get("定额数量")) * orderQty);
            row.put("仓库", "材料仓");
            row.put("明细备注", "BOM 展开,待扫码补批号");
            items.add(row);
        }
        Map<String, Object> formData = new LinkedHashMap<>(targetHead);
        formData.put("detail", Map.of("items", items));
        Map<String, Object> saved = buttonService.save(registry.panel("MATERIAL_OUT"), formData, false);
        String newNo = String.valueOf(saved.get("编号"));

        voucherFlow.link("WO_ORDER", sourceNo, null, "MATERIAL_OUT", newNo, null, 0, "");

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("编号", newNo);
        out.put("单据状态", "草稿");
        out.put("gotoPanel", "MATERIAL_OUT");
        return out;
    }

    private static String str(Object o) {
        return o == null || String.valueOf(o).isBlank() ? null : String.valueOf(o).trim();
    }

    private static double num(Object o) {
        if (o == null) return 0;
        try { return Double.parseDouble(String.valueOf(o)); } catch (NumberFormatException e) { return 0; }
    }
}
