package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.ReportService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * 对外正式报表接口(JasperReports,/api/report):
 *   GET /templates → 某面板可用的报表模板(前端入口显隐 + 下拉)
 *   GET /export    → 生成报表文件(code/panelCode/docNo/format/disposition)
 * 鉴权:沿用项目既有做法 —— SecurityConfig 里除白名单外 anyRequest().authenticated(),
 * 本控制器不加注解即要求登录;未带 token 由 AuthenticationEntryPoint 返回 403(前端按登录失效处理)。
 * 错误走既有约定:IllegalArgumentException→HTTP 400(ApiResult 体),前端 errMsg 展示、不触发登出。
 */
@RestController
@RequestMapping("/api/report")
public class ReportController {

    private final ReportService service;

    public ReportController(ReportService service) {
        this.service = service;
    }

    /** 可用报表模板;不给 panelCode 返回全部(便于排查"为什么面板上没有入口") */
    @GetMapping("/templates")
    public ApiResult<List<Map<String, Object>>> templates(@RequestParam(required = false) String panelCode) {
        return ApiResult.ok(service.templateList(panelCode));
    }

    /**
     * 导出报表。
     * format=pdf|xlsx;disposition=attachment(下载,默认)|inline(浏览器内预览 → 前端用它做「打印预览」)。
     */
    @GetMapping("/export")
    public ResponseEntity<byte[]> export(@RequestParam String code,
                                         @RequestParam(required = false) String panelCode,
                                         @RequestParam String docNo,
                                         @RequestParam(defaultValue = "pdf") String format,
                                         @RequestParam(defaultValue = "attachment") String disposition) {
        byte[] body = service.export(code, panelCode, docNo, format);
        boolean xlsx = "xlsx".equalsIgnoreCase(format);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(xlsx
                ? MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                : MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition
                .builder("inline".equalsIgnoreCase(disposition) ? "inline" : "attachment")
                .filename(service.fileName(code, panelCode, docNo, format), StandardCharsets.UTF_8).build());
        headers.setContentLength(body.length);
        return ResponseEntity.ok().headers(headers).body(body);
    }
}
