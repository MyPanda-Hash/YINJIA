package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.InspSummaryService;
import com.yinjia.mes.service.PagePanelRegistry;
import com.yinjia.mes.service.PanelPermissionService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * 样品检验汇总表(2026-11-17)—— 按时间范围汇总「谁送了什么样品、要测哪些项目」并导出送检汇总表。
 *
 * <p>页面 = {@code views/modules/qc/InspSummary.vue},**不是** yj_panel 单据面板
 * ⇒ 按页面级虚拟面板 {@link PagePanelRegistry#INSP_SUMMARY} 登记,授权落 {@code yj_role_panel};
 * 动作集 = 可见 / 查询 / 导出。
 *
 * <p>导出格式以用户 2026-11-17 给的纸表为准(时间 / 送样人 / 委托单编号 / 样品名称 / 数量 /
 * 测试项目 / 是否接收 / 是否检测 / 数据或报告输出 / 备注),后三列是 Excel 下拉勾选列,
 * 由 {@link InspSummaryService#export(Map)} 用 POI 生成(SheetJS 社区版写不出数据验证)。
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

    /**
     * 导出「送检信息汇总表」(.xlsx,单 sheet;后三列带 Excel 下拉数据验证)。
     *
     * <p>权限:页面查看权 + 「导出」词(组织架构里可单独取消某角色的导出格子)。
     *
     * @param body 与 {@link #summary(Map)} 同一套查询条件
     */
    @PostMapping("/export")
    public ResponseEntity<byte[]> export(@RequestBody(required = false) Map<String, Object> body) {
        perm.requirePanelView(PagePanelRegistry.INSP_SUMMARY);
        perm.requireButton(PagePanelRegistry.INSP_SUMMARY, "导出");
        InspSummaryService.ExportFile file = service.export(body);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDisposition(ContentDisposition.attachment()
                .filename(file.fileName(), StandardCharsets.UTF_8).build());
        headers.setContentLength(file.bytes().length);
        return ResponseEntity.ok().headers(headers).body(file.bytes());
    }
}
