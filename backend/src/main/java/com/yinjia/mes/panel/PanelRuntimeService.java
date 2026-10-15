package com.yinjia.mes.panel;

import java.util.List;
import java.util.Map;

/** 面板运行时契约(移植自 light-mes com.mes.panel):配置驱动的面板控制器只依赖此接口。 */
public interface PanelRuntimeService {

    Map<String, Object> getPanelConfig(String panelCode);

    Map<String, Object> getPermMatrix(String panelCode);

    Map<String, Object> getNewFormPermMatrix(String panelCode, String operationName);

    Map<String, Object> getFormDescriptor(String panelCode, String code);

    Map<String, Object> queryFormDataList(String panelCode, String keyword,
                                          Map<String, Object> condition, int pageNo, int pageSize);

    /** 同上,外加查询弹窗「高级筛选」条件行(仅报表/平表面板生效) */
    Map<String, Object> queryFormDataList(String panelCode, String keyword,
                                          Map<String, Object> condition, int pageNo, int pageSize,
                                          List<Map<String, Object>> advFilters);

    /**
     * 同上,外加 {@code countOnly} = 只要「共 N 条」不要行(前端「参照字段行数」判定专用)。
     * 默认实现忽略该开关、照常取数 —— 只有真正实现取数分层的运行时(见 {@code QueryService})
     * 才覆写它,契约保持向后兼容。
     */
    default Map<String, Object> queryFormDataList(String panelCode, String keyword,
                                                  Map<String, Object> condition, int pageNo, int pageSize,
                                                  List<Map<String, Object>> advFilters, boolean countOnly) {
        return queryFormDataList(panelCode, keyword, condition, pageNo, pageSize, advFilters);
    }

    List<Map<String, Object>> getApprovalHistory(String panelCode, String formNo);

    Map<String, Object> callButton(String panelCode, String buttonName,
                                    Map<String, Object> formData, Map<String, Object> buttonParam);

    void deleteForms(String panelCode, List<String> rowCodes);
}
