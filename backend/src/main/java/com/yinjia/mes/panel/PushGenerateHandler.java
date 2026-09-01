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
 * 推式生单(生成XX):来源单整单映射为目标面板草稿,写 form_flow_link 占用,返回 {编号, gotoPanel}
 * 由前端跳转到目标面板继续填写(对齐 PANDA PxService 推式生单语义,复用选单同源映射)。
 *
 * 与选单(拉式)共用 SELECT_FLOWS 链路图与 buildSelectConfig 的头/行映射——同一份映射双向使用。
 * 守护:来源必须「已审核」;该来源→该目标已有 ACTIVE 占用时拒绝重复生单(删除下游草稿自动释放)。
 */
@Component
public class PushGenerateHandler implements PanelActionHandler {

    /** (面板|动作) → 目标面板:与 PanelConfigService.PUSH_TARGETS 同源(按钮生成据此区分可执行/灰占位)。 */
    private String pushTarget(String panelCode, String action) {
        return configService.pushTarget(panelCode, action);
    }

    private final PanelRegistry registry;
    private final QueryService queryService;
    private final ButtonService buttonService;
    private final VoucherFlowService voucherFlow;
    private final PanelConfigService configService;
    private final JdbcTemplate jdbc;

    public PushGenerateHandler(PanelRegistry registry, QueryService queryService, ButtonService buttonService,
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
        return pushTarget(panelCode, action) != null;
    }

    @Override
    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> handle(PanelActionContext context) {
        String sourcePanel = context.panelCode();
        String target = pushTarget(sourcePanel, context.action());
        Object noObj = context.formData() == null ? null : context.formData().get("编号");
        if (noObj == null || String.valueOf(noObj).isBlank()) throw new IllegalArgumentException("缺少表单编号");
        String sourceNo = String.valueOf(noObj);

        // 1) 来源必须已审核(已中止/作废/审批中均不可生单,对齐 T+)
        Map<String, Object> st = buttonService.docStatus(sourcePanel, sourceNo);
        String status = String.valueOf(st.get("status"));
        if (!"已审核".equals(status)) throw new IllegalStateException("仅已审核单据可生单,当前状态:" + status);

        // 2) 该来源→该目标已有占用(选单或生单)时拒绝整单重复生单;删除下游草稿自动释放后可重生
        Integer linked = jdbc.queryForObject(
                "SELECT COUNT(*) FROM form_flow_link WHERE source_panel_code=? AND source_form_no=?"
                        + " AND target_panel_code=? AND link_status='ACTIVE'",
                Integer.class, sourcePanel, sourceNo, target);
        if (linked != null && linked > 0) {
            throw new IllegalStateException("该单已向目标面板生单(或已选单占用),请先删除下游草稿后重试");
        }

        // 3) 载入来源单(head + 明细,中文标签键)
        PanelRegistry.PanelDef srcDef = registry.panel(sourcePanel);
        Map<String, Object> src = queryService.loadOneDoc(srcDef, sourceNo);
        Map<String, Object> head = new LinkedHashMap<>(src);
        Object detailObj = head.remove("detail");
        List<Map<String, Object>> items = new ArrayList<>();
        if (detailObj instanceof Map<?, ?> dm && dm.get("items") instanceof List<?> l) {
            for (Object o : l) if (o instanceof Map<?, ?> m) items.add(new LinkedHashMap<>((Map<String, Object>) m));
        }
        if (items.isEmpty()) throw new IllegalStateException("来源单据无明细行,不能生单");

        // 4) 头/行映射:与选单共用 buildSelectConfig 生成的 headerMap/detailMap(from=源标签,to=目标标签)
        Map<String, Object> maps = configService.flowMaps(target);
        if (maps == null) throw new IllegalStateException("目标面板未配置流转来源:" + target);
        List<Map<String, String>> headerMap = (List<Map<String, String>>) maps.get("headerMap");
        List<Map<String, String>> detailMap = (List<Map<String, String>>) maps.get("detailMap");

        Map<String, Object> targetHead = new LinkedHashMap<>();
        for (Map<String, String> m : headerMap) {
            Object v = head.get(m.get("from"));
            if (v != null) targetHead.put(m.get("to"), v);
        }
        targetHead.put("来源单据", srcDef.name());
        targetHead.put("来源单号", sourceNo);
        // 新建兜底(对齐 PANDA insertGenerated):单据日期缺省当天(来源无该字段时,如 加工单→产成品入库)
        targetHead.putIfAbsent("单据日期", java.time.LocalDate.now().toString());

        List<Map<String, Object>> targetItems = new ArrayList<>();
        for (Map<String, Object> item : items) {
            Map<String, Object> row = new LinkedHashMap<>();
            for (Map<String, String> m : detailMap) {
                Object v = item.get(m.get("from"));
                if (v != null) row.put(m.get("to"), v);
            }
            targetItems.add(row);
        }

        // 5) 保存为目标草稿(复用通用保存语义:头行分表/默认值/号池取号)
        Map<String, Object> formData = new LinkedHashMap<>(targetHead);
        formData.put("detail", Map.of("items", targetItems));
        Map<String, Object> saved = buttonService.save(registry.panel(target), formData);
        String newNo = String.valueOf(saved.get("编号"));

        // 6) 写占用:来源行不再出现在选单列表(与选单同一占用语义)
        voucherFlow.link(sourcePanel, sourceNo, null, target, newNo, null, 0, "");

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("编号", newNo);
        out.put("单据状态", "草稿");
        out.put("gotoPanel", target);
        return out;
    }
}
