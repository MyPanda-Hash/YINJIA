package com.yinjia.mes.service;

import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 面板门面:组装 getNewFormPermMatrix / getFormDescriptor(对齐 light-mes PxService 契约)。
 */
@Service
public class PanelFacade {

    private final PanelRegistry registry;
    private final PanelConfigService configService;
    private final QueryService queryService;
    private final FormNoService formNoService;
    private final ButtonService buttonService;

    public PanelFacade(PanelRegistry registry, PanelConfigService configService,
                       QueryService queryService, FormNoService formNoService,
                       ButtonService buttonService) {
        this.registry = registry;
        this.configService = configService;
        this.queryService = queryService;
        this.formNoService = formNoService;
        this.buttonService = buttonService;
    }

    /** 新建表单元数据(默认值+meta+权限+明细+按钮组) */
    public Map<String, Object> getNewFormPermMatrix(String panelCode, String operationName) {
        PanelRegistry.PanelDef def = registry.panel(panelCode);
        Map<String, Object> cfg = configService.getPanelConfig(panelCode);

        Map<String, Object> data = new LinkedHashMap<>();
        if (def.isDoc()) {
            data.put("单据状态", "草稿");
            data.put("单据日期", LocalDate.now().toString());
            if (def.prefix() != null) {
                PanelRegistry.FieldDef g = def.byCol(def.groupCol());
                if (g != null) data.putIfAbsent(g.label(), formNoService.preview(def.prefix()));
            }
        } else if ("archive".equals(def.mode())) {
            data.put("状态", "启用");   // 基础档案单单据:panelState.dataName=状态
        } else {
            data.put("单据状态", "启用");
            data.put("单据日期", LocalDate.now().toString());
        }

        Map<String, Object> privilege = new HashMap<>();
        privilege.put("actionPrivileges", configService.actionPrivileges(cfg, true));
        privilege.put("fieldPrivileges", new ArrayList<>());
        privilege.put("groupPrivileges", new ArrayList<>());

        Map<String, Object> out = new HashMap<>();
        out.put("data", data);
        out.put("meta", configService.buildMeta(def));
        out.put("privilege", privilege);
        out.put("detail", detailOf(cfg));
        out.put("buttonGroups", configService.groupsOfConfig(cfg));
        out.put("panelName", def.name());
        out.put("selectConfig", new HashMap<>());
        return out;
    }

    /** 编辑表单描述符(既有单据的头+明细) */
    public Map<String, Object> getFormDescriptor(String panelCode, String code) {
        PanelRegistry.PanelDef def = registry.panel(panelCode);
        Map<String, Object> cfg = configService.getPanelConfig(panelCode);
        Map<String, Object> doc = queryService.loadOneDoc(def, code);

        Map<String, Object> data = new LinkedHashMap<>(doc);
        Object detailObj = data.remove("detail");

        Map<String, Object> privilege = new HashMap<>();
        privilege.put("actionPrivileges", configService.actionPrivileges(cfg, true));
        privilege.put("fieldPrivileges", new ArrayList<>());
        privilege.put("groupPrivileges", new ArrayList<>());

        Map<String, Object> out = new HashMap<>();
        out.put("data", data);
        out.put("meta", configService.buildMeta(def));
        out.put("privilege", privilege);
        out.put("detail", detailOf(cfg));
        out.put("detailData", detailObj == null ? new HashMap<>() : detailObj);
        out.put("buttonGroups", configService.groupsOfConfig(cfg));
        out.put("panelName", def.name());
        out.put("selectConfig", new HashMap<>());
        return out;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> detailOf(Map<String, Object> cfg) {
        Object d = cfg.get("detail");
        return d instanceof Map<?, ?> m ? (Map<String, Object>) m : new HashMap<>();
    }

    /** 审批历史:返回该单据全部审批记录(照搬 light-mes 契约,时间升序) */
    public List<Map<String, Object>> getApprovalHistory(String panelCode, String formNo) {
        return buttonService.queryApprovalHistory(panelCode, formNo);
    }
}
