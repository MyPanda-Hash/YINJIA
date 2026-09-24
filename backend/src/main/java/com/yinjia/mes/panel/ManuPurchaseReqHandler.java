package com.yinjia.mes.panel;

import com.yinjia.mes.service.ButtonService;
import com.yinjia.mes.service.MessageService;
import com.yinjia.mes.service.PanelRegistry;
import com.yinjia.mes.service.VoucherFlowService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 工单结转 → 采购申请(生产部需求纪要 五,2026-09-22)。
 *
 * <p>期望流程:销售下单 → 生产审核(工单排产) → 系统自动计算(订单需求 − 库存)→ 生成采购申请推给采购。
 * 落地:MANU_ORDER「更多→生成采购申请」:按产品默认 BOM × 排产数量 计算需用,
 * 逐子件扣减 kucun 结余(yl,全部仓库),仅对**缺口>0** 的子件生成 采购申请(PU_REQ)草稿行,
 * 写来源(生产加工单/合同号)+ 站内消息推给采购(能看 PU_ORDER 的角色用户 ∪ 管理员)。
 *
 * <p>受限说明(纪要自述):泵的碳棒物料 BOM 不完整(碳棒工艺用料杂)——无默认 BOM 的产品给出明确指引,
 * 不自动计算,请手工建采购申请;BOM 补齐后同按钮即可自动结转。幂等:该工单已有 ACTIVE 结转占用时拒绝,
 * 删除采购申请草稿自动释放后可重转。
 */
@Component
public class ManuPurchaseReqHandler implements PanelActionHandler {

    private final ButtonService buttonService;
    private final PanelRegistry registry;
    private final VoucherFlowService voucherFlow;
    private final MessageService message;
    private final JdbcTemplate jdbc;

    public ManuPurchaseReqHandler(ButtonService buttonService, PanelRegistry registry,
                                  VoucherFlowService voucherFlow, MessageService message, JdbcTemplate jdbc) {
        this.buttonService = buttonService;
        this.registry = registry;
        this.voucherFlow = voucherFlow;
        this.message = message;
        this.jdbc = jdbc;
    }

    @Override
    public boolean supports(String panelCode, String action) {
        return "MANU_ORDER".equals(panelCode) && "生成采购申请".equals(action);
    }

    @Override
    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> handle(PanelActionContext context) {
        Object noObj = context.formData() == null ? null : context.formData().get("编号");
        if (noObj == null || String.valueOf(noObj).isBlank()) throw new IllegalArgumentException("缺少表单编号");
        String no = String.valueOf(noObj);
        String user = context.userName();

        List<Map<String, Object>> heads = jdbc.queryForList(
                "SELECT h.[合同号], ISNULL(h.[销售订单号],N'') AS 销售订单号, h.[预完工日],"
                        + " (SELECT TOP 1 l.[产品编码] FROM bl_manu_order l WHERE l.[合同号]=h.[合同号]"
                        + "   AND ISNULL(l.asp_cancel,'N')<>'Y' ORDER BY l.[id]) AS 产品编码,"
                        + " (SELECT TOP 1 l.[排产数量] FROM bl_manu_order l WHERE l.[合同号]=h.[合同号]"
                        + "   AND ISNULL(l.asp_cancel,'N')<>'Y' ORDER BY l.[id]) AS 排产数量"
                        + " FROM bd_manu_order h WHERE h.[合同号]=? AND ISNULL(h.asp_cancel,'N')<>'Y'", no);
        if (heads.isEmpty()) throw new IllegalStateException("生产加工单不存在:" + no);
        Map<String, Object> mo = heads.get(0);
        String item = str(mo.get("产品编码"));
        double qty = num(mo.get("排产数量"));
        if (item == null) throw new IllegalStateException("加工单无产品编码,无法按 BOM 结转");
        if (qty <= 0) throw new IllegalStateException("加工单排产数量为 0,请先排产再结转");

        Integer linked = jdbc.queryForObject(
                "SELECT COUNT(*) FROM form_flow_link WHERE source_panel_code='MANU_ORDER' AND source_form_no=?"
                        + " AND target_panel_code='PU_REQ' AND link_status='ACTIVE'", Integer.class, no);
        if (linked != null && linked > 0) throw new IllegalStateException("该工单已生成采购申请,请先删除下游草稿后重试");

        List<Map<String, Object>> bom = jdbc.queryForList(
                "SELECT [子件编码], [子件名称], [子件计量单位], [定额数量] FROM bs_bom"
                        + " WHERE [父件编码] = ? AND [默认BOM] = 1"
                        + " AND ISNULL([状态],N'启用') <> N'停用' AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + " ORDER BY [子件编码]", item);
        if (bom.isEmpty()) {
            throw new IllegalStateException("产品 " + item + " 无默认 BOM(碳棒工艺用料杂,BOM 尚不完整),无法自动计算;请补 BOM 后重试或手工建采购申请");
        }

        List<Map<String, Object>> items = new ArrayList<>();
        double gapTotal = 0;
        for (Map<String, Object> b : bom) {
            String sub = str(b.get("子件编码"));
            if (sub == null) continue;
            double need = Math.round(num(b.get("定额数量")) * qty * 10000d) / 10000d;
            if (need <= 0) continue;
            Double stockObj = jdbc.queryForObject(
                    "SELECT ISNULL(SUM(ISNULL(yl,0)),0) FROM kucun WHERE wzdm = ? AND ISNULL(asp_cancel,'N') <> 'Y'",
                    Double.class, sub);
            double stock = stockObj == null ? 0 : stockObj;
            double gap = Math.round((need - stock) * 10000d) / 10000d;
            if (gap <= 0.0001) continue;                     // 库存已覆盖
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("存货编码", sub);
            row.put("存货名称", str(b.get("子件名称")));
            row.put("数量", gap);
            items.add(row);
            gapTotal += gap;
        }
        if (items.isEmpty()) {
            throw new IllegalStateException("按 BOM×排产数量=" + qty + " 计算,材料库存已齐套,无需采购申请");
        }

        Map<String, Object> head = new LinkedHashMap<>();
        head.put("单据日期", java.time.LocalDate.now().toString());
        head.put("请购人", user);
        if (mo.get("预完工日") != null) {
            head.put("需求日期", String.valueOf(mo.get("预完工日")).substring(0, 10));
        }
        if (!String.valueOf(mo.get("销售订单号")).isBlank()) head.put("销售订单号", mo.get("销售订单号"));
        head.put("来源单据", "生产加工单");
        head.put("来源单号", no);
        head.put("备注", "工单结转:" + no + " " + item + " 排产 " + qty + ",按 BOM 需求减库存生成缺口行");

        Map<String, Object> formData = new LinkedHashMap<>(head);
        formData.put("detail", Map.of("items", items));
        Map<String, Object> saved = buttonService.save(registry.panel("PU_REQ"), formData, false);
        String newNo = String.valueOf(saved.get("编号"));
        voucherFlow.link("MANU_ORDER", no, null, "PU_REQ", newNo, null, 0, "");

        // 推给采购:能看 采购订单 面板的角色用户 ∪ 管理员(排除操作者)
        List<String> targets = new ArrayList<>(message.admins());
        try {
            targets.addAll(jdbc.queryForList(
                    "SELECT DISTINCT u.username FROM yj_user u JOIN yj_role_panel rp ON rp.role_id = u.role_id"
                            + " WHERE rp.panel_code = 'PU_ORDER' AND rp.perms LIKE '%view%'", String.class));
        } catch (Exception ignore) { /* 解析失败退回管理员 */ }
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("来源工单", no);
        params.put("产品", item);
        params.put("缺口行数", items.size());
        params.put("缺口合计", Math.round(gapTotal * 10000d) / 10000d);
        params.put("提示", "生产工单结转采购申请已生成,请查收");
        int notified = message.send(targets, "PURCHASE_REQUESTED", "PU_REQ", newNo, params, user);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("编号", newNo);
        out.put("缺口行数", items.size());
        out.put("缺口合计", Math.round(gapTotal * 10000d) / 10000d);
        out.put("通知人数", notified);
        return out;
    }

    private static String str(Object o) {
        return o == null || String.valueOf(o).isBlank() ? null : String.valueOf(o).trim();
    }

    private static double num(Object o) {
        if (o == null) return 0;
        if (o instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(String.valueOf(o).trim()); } catch (NumberFormatException e) { return 0; }
    }
}
