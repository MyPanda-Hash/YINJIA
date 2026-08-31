package com.yinjia.mes.service;

import com.yinjia.mes.panel.PanelActionContext;
import com.yinjia.mes.panel.PanelActionRegistry;
import com.yinjia.mes.panel.PanelRuntimeService;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * 面板运行时实现(对齐 light-mes 架构):PxController 只依赖 PanelRuntimeService,
 * 通用生命周期委托既有服务,领域动作先走 PanelActionRegistry。
 */
@Service
public class PxRuntimeService implements PanelRuntimeService {

    private final PanelConfigService configService;
    private final PanelFacade facade;
    private final QueryService queryService;
    private final ButtonService buttonService;
    private final PanelActionRegistry actionRegistry;

    public PxRuntimeService(PanelConfigService configService, PanelFacade facade,
                            QueryService queryService, ButtonService buttonService,
                            PanelActionRegistry actionRegistry) {
        this.configService = configService;
        this.facade = facade;
        this.queryService = queryService;
        this.buttonService = buttonService;
        this.actionRegistry = actionRegistry;
    }

    @Override
    public Map<String, Object> getPanelConfig(String panelCode) {
        return configService.getPanelConfig(panelCode);
    }

    @Override
    public Map<String, Object> getPermMatrix(String panelCode) {
        return configService.getPermMatrix(panelCode);
    }

    @Override
    public Map<String, Object> getNewFormPermMatrix(String panelCode, String operationName) {
        return facade.getNewFormPermMatrix(panelCode, operationName);
    }

    @Override
    public Map<String, Object> getFormDescriptor(String panelCode, String code) {
        return facade.getFormDescriptor(panelCode, code);
    }

    @Override
    public Map<String, Object> queryFormDataList(String panelCode, String keyword,
                                                 Map<String, Object> condition, int pageNo, int pageSize) {
        return queryService.queryFormDataList(panelCode, keyword, condition, pageNo, pageSize);
    }

    @Override
    public List<Map<String, Object>> getApprovalHistory(String panelCode, String formNo) {
        return facade.getApprovalHistory(panelCode, formNo);
    }

    @Override
    public Map<String, Object> callButton(String panelCode, String buttonName,
                                          Map<String, Object> formData, Map<String, Object> buttonParam) {
        // 领域动作优先(PanelActionHandler 扩展点),未注册则走通用生命周期
        var dispatched = actionRegistry.dispatch(new PanelActionContext(
                panelCode, buttonName, formData, buttonParam, currentUserName()));
        if (dispatched.isPresent()) return dispatched.get();
        return buttonService.callButton(panelCode, buttonName, formData, buttonParam);
    }

    @Override
    public void deleteForms(String panelCode, List<String> rowCodes) {
        buttonService.deleteForms(panelCode, rowCodes);
    }

    private String currentUserName() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getName() != null && !auth.getName().isBlank() ? auth.getName() : "system";
    }
}
