package com.yinjia.mes.panel;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/** 面板动作注册表(移植自 light-mes):领域动作经 PanelActionHandler 插拔,通用生命周期之外的动作在此扩展。 */
@Component
public class PanelActionRegistry {

    private final List<PanelActionHandler> handlers;

    public PanelActionRegistry(List<PanelActionHandler> handlers) {
        this.handlers = List.copyOf(handlers);
    }

    public Optional<Map<String, Object>> dispatch(PanelActionContext context) {
        List<PanelActionHandler> matches = handlers.stream()
                .filter(handler -> handler.supports(context.panelCode(), context.action()))
                .toList();
        if (matches.isEmpty()) return Optional.empty();
        if (matches.size() > 1) {
            throw new IllegalStateException("面板动作存在多个处理器："
                    + context.panelCode() + "/" + context.action());
        }
        Map<String, Object> result = Objects.requireNonNull(
                matches.get(0).handle(context),
                "面板动作处理器不能返回 null");
        return Optional.of(result);
    }
}
