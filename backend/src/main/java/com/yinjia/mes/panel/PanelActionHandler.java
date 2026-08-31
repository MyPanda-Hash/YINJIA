package com.yinjia.mes.panel;

import java.util.Map;

/**
 * 面板动作处理器扩展点(移植自 light-mes):
 * 通用生命周期(保存/审核/弃审/删除)之外的动作实现此接口,由 PanelActionRegistry 分发。
 */
public interface PanelActionHandler {

    boolean supports(String panelCode, String action);

    Map<String, Object> handle(PanelActionContext context);
}
