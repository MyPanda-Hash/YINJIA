package com.yinjia.mes.panel;

import com.yinjia.mes.service.QuickScheduleService;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 生产加工单排产:销售订单 →「生成生产加工单」**按明细行 1:1 生成**(参考库口径)。
 *
 * <p>依据:参考库 HSDZ_MES_0828 旧系统「工单排产」(plang_pc)实证——25 张工单与 25 条订单行严格 1:1
 * (pl_xc 恒为 1),排产是「勾选订单行 → 批量落表」;docs/design/补充设计-V2.0.md §3.1 亦以 MANU_ORDER 为工单实体。
 *
 * <p>落库逻辑统一在 {@link QuickScheduleService}(快速排产界面与本按钮共用同一实现,避免两套口径):
 * 已排产行按行级占用跳过(**增量排产**:订单新增行可再排),全部已排产则拒绝。
 */
@Component
public class ManuScheduleHandler implements PanelActionHandler {

    private final QuickScheduleService quickSchedule;

    public ManuScheduleHandler(QuickScheduleService quickSchedule) {
        this.quickSchedule = quickSchedule;
    }

    @Override
    public boolean supports(String panelCode, String action) {
        return "SO_ORDER".equals(panelCode) && "生成生产加工单".equals(action);
    }

    @Override
    public Map<String, Object> handle(PanelActionContext context) {
        Object noObj = context.formData() == null ? null : context.formData().get("编号");
        if (noObj == null || String.valueOf(noObj).isBlank()) throw new IllegalArgumentException("缺少表单编号");
        String sourceNo = String.valueOf(noObj);

        List<String> created = quickSchedule.generateFromOrder(sourceNo, context.userName());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("编号", created.get(0));
        out.put("生成张数", created.size());
        out.put("编号清单", created);
        out.put("单据状态", "草稿");
        out.put("gotoPanel", "MANU_ORDER");
        return out;
    }
}
