package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.FirstInspItems;
import com.yinjia.mes.service.PanelPermissionService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 首件检验单(QC_FIRST_INSP)· 单上「取成型工艺清单」入口。
 *
 * <p>用户口径(2026-10-15):「检验方式参考成型工艺清单内的检验要求进行编写」。
 * 报工审核自动出单时已经按《成型工艺清单》RD_MOLD_PROC 预铺过 5 个检验项目(见
 * {@code ButtonService.firstInspGenerate});本接口是**同一个来源的手动入口** ——
 * 工艺清单当时还没维护、或者后来改了,品质在单上按产品编码重新带入一次即可。</p>
 *
 * <p>字段映射(与 {@link FirstInspItems} 同一份实现,不复制粘贴):
 * 检验项目 = 工艺清单「检验要求」区块的 5 个块名;
 * 检验要求 = 该块各字段取值的拼接(只拼有值的段)。</p>
 *
 * <p>查不到不算错:返回 200 + 空/带项目名的 5 行 + {@code moldProcNo=null},
 * 由前端给「该产品没有成型工艺清单」的话术。</p>
 */
@RestController
@RequestMapping("/api/qc/firstInsp")
public class QcFirstInspController {

    private static final String PANEL = "QC_FIRST_INSP";

    private final JdbcTemplate jdbc;
    private final PanelPermissionService perm;

    public QcFirstInspController(JdbcTemplate jdbc, PanelPermissionService perm) {
        this.jdbc = jdbc;
        this.perm = perm;
    }

    /** GET /api/qc/firstInsp/fromMoldProc?productCode=xxx */
    @GetMapping("/fromMoldProc")
    public ApiResult<Map<String, Object>> fromMoldProc(@RequestParam String productCode) {
        perm.requirePanelView(PANEL);
        String code = productCode == null ? "" : productCode.trim();
        if (code.isEmpty()) return ApiResult.error(400, "请先填写产品编码");

        FirstInspItems.Result r = FirstInspItems.load(jdbc, code);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("productCode", code);
        out.put("moldProcNo", r.docNo());
        out.put("rows", r.rows());
        return ApiResult.ok(out);
    }
}
