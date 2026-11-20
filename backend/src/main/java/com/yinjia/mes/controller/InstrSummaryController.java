package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.InstrSummaryService;
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
 * 仪器使用汇总表(2026-11-20)—— 实验室内所有仪器的使用记录总表 + 导出「实验室仪器使用记录表」。
 *
 * <p>用户口径:「为当前的试验仪器记录表创建一个汇总表,汇总表需要查看的内容如图1所示。
 * 汇总表实现可以参考样品检验汇总表」。表样列 = 仪器名称/型号 | 日期 | 起止时间 | 仪器状态 |
 * 是否内校 | 项目名称/内容 | 数量 | 使用人 | 备注。
 *
 * <p>页面 = {@code views/modules/rd/InstrSummary.vue},**不是** yj_panel 单据面板(不承载单据)
 * ⇒ 按页面级虚拟面板 {@link PagePanelRegistry#INSTR_SUMMARY} 登记,授权落 {@code yj_role_panel};
 * 动作集 = 可见 / 查询 / 导出(与样品检验汇总表同一套口径,见 {@link InspSummaryController})。
 */
@RestController
@RequestMapping("/api/px/instrSummary")
public class InstrSummaryController {

    private final InstrSummaryService service;
    private final PanelPermissionService perm;

    public InstrSummaryController(InstrSummaryService service, PanelPermissionService perm) {
        this.service = service;
        this.perm = perm;
    }

    /**
     * 汇总取数(只读)。
     *
     * @param body 条件:{@code 日期起} / {@code 日期止}(YYYY-MM-DD,任一端可空 = 不限)、
     *             {@code 仪器名称/型号}(模糊)、{@code 使用人}(模糊)、
     *             {@code keyword}(项目名称/内容 / 备注 / 仪器 / 使用人)
     */
    @PostMapping("/summary")
    public ApiResult<Map<String, Object>> summary(@RequestBody(required = false) Map<String, Object> body) {
        perm.requirePanelView(PagePanelRegistry.INSTR_SUMMARY);
        return ApiResult.ok(service.summary(body));
    }

    /**
     * 导出「实验室仪器使用记录表」(.xlsx:跨列大标题 + 表头 + 记录行;A4 横向一页宽)。
     *
     * <p>权限:页面查看权 + 「导出」词(组织架构里可单独取消某角色的导出格子)。
     *
     * @param body 与 {@link #summary(Map)} 同一套查询条件;另可带 {@code 记录id:[…]} 只导选中的行
     */
    @PostMapping("/export")
    public ResponseEntity<byte[]> export(@RequestBody(required = false) Map<String, Object> body) {
        perm.requirePanelView(PagePanelRegistry.INSTR_SUMMARY);
        perm.requireButton(PagePanelRegistry.INSTR_SUMMARY, "导出");
        InstrSummaryService.ExportFile file = service.export(body);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDisposition(ContentDisposition.attachment()
                .filename(file.fileName(), StandardCharsets.UTF_8).build());
        headers.setContentLength(file.bytes().length);
        return ResponseEntity.ok().headers(headers).body(file.bytes());
    }
}
