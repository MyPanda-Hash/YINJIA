package com.yinjia.mes.panel;

import java.util.Map;

/** 面板动作输入(移植自 light-mes)。 */
public record PanelActionContext(
        String panelCode,
        String action,
        Map<String, Object> formData,
        Map<String, Object> parameters,
        String userName) {
}
