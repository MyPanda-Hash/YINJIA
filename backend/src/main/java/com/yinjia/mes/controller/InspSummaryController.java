package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.InspSummaryService;
import com.yinjia.mes.service.PagePanelRegistry;
import com.yinjia.mes.service.PanelPermissionService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 样品检验汇总表(2026-11-17)—— 按时间范围汇总「谁送了什么样品、要测哪些项目」。
 *
 * <p>页面 = {@code views/modules/qc/InspSummary.vue},**不是** yj_panel 单据面板
 * ⇒ 按页面级虚拟面板 {@link PagePanelRegistry#INSP_SUMMARY} 登记,授权落 {@code yj_role_panel};
 * 动作集只有 可见 / 查询 / 导出(本接口只读,导出在前端用 xlsx 现生成)。
 *
 * <p>用户口径(2026-11-17):「为当前的样品检验增加汇总表,能够查看到一天或者一周,送好多个样品,
 * 测试啥的总表。要按一个时间范围,去导出有多少人送了啥样品测试啥,安排检测工作。」
 */
@RestController
@RequestMapping("/api/px/inspSummary")
public class InspSummaryController {

    private final InspSummaryService service;
    private final PanelPermissionService perm;

    public InspSummaryController(InspSummaryService service, PanelPermissionService perm) {
        this.service = service;
        this.perm = perm;
    }

    /**
     * 汇总取数(只读)。
     *
     * @param body 条件:{@code 日期起} / {@code 日期止}(YYYY-MM-DD,缺省=今天)、
     *             {@code 送样人}(模糊)、{@code 单据状态}(草稿/审批中/已审核/已作废/已中止/全部)、
     *             {@code keyword}
     */
    @PostMapping("/summary")
    public ApiResult<Map<String, Object>> summary(@RequestBody(required = false) Map<String, Object> body) {
        perm.requirePanelView(PagePanelRegistry.INSP_SUMMARY);
        return ApiResult.ok(service.summary(body));
    }
}
