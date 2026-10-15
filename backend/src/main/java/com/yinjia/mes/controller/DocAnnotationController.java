package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.DocAnnotationService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 单据纸面文字标注接口(/api/annotation,yj_doc_annotation)。
 *
 * 三个动作与前端「标注笔 / 橡皮擦」一一对应:
 *   GET  /list  ?panelCode&docNo              → 该单据全部标注(只读态纸面与打印按它切段着色)
 *   POST /save  {panelCode,docNo,fieldKey,start,end,color,bold}   → 标注笔落一段(相交旧段先软删)
 *   POST /erase {panelCode,docNo,fieldKey,start?,end?}            → 橡皮擦(给范围只擦相交,不给清该字段)
 *
 * 均返回**该单据最新的标注列表**,前端一次替换本地状态,省掉再拉一次。
 * 权限在服务层:读=该面板查看权,写=该面板「保存」按钮权。
 * 错误走既有约定:IllegalArgumentException → HTTP 400(ApiResult 体),不触发前端登出。
 */
@RestController
@RequestMapping("/api/annotation")
public class DocAnnotationController {

    private final DocAnnotationService service;

    public DocAnnotationController(DocAnnotationService service) {
        this.service = service;
    }

    @GetMapping("/list")
    public ApiResult<List<Map<String, Object>>> list(@RequestParam String panelCode,
                                                     @RequestParam String docNo) {
        return ApiResult.ok(service.list(panelCode, docNo));
    }

    @PostMapping("/save")
    public ApiResult<List<Map<String, Object>>> save(@RequestBody Map<String, Object> body,
                                                     Authentication authentication) {
        return ApiResult.ok(service.save(
                str(body.get("panelCode")),
                str(body.get("docNo")),
                str(body.get("fieldKey")),
                num(body.get("start")),
                num(body.get("end")),
                str(body.get("color")),
                Boolean.TRUE.equals(body.get("bold")) || "1".equals(String.valueOf(body.get("bold"))),
                currentUsername(authentication)));
    }

    @PostMapping("/erase")
    public ApiResult<List<Map<String, Object>>> erase(@RequestBody Map<String, Object> body,
                                                      Authentication authentication) {
        return ApiResult.ok(service.erase(
                str(body.get("panelCode")),
                str(body.get("docNo")),
                str(body.get("fieldKey")),
                body.get("start") == null ? null : num(body.get("start")),
                body.get("end") == null ? null : num(body.get("end")),
                currentUsername(authentication)));
    }

    private static String str(Object v) {
        return v == null ? "" : String.valueOf(v);
    }

    private static int num(Object v) {
        if (v instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(v).trim());
        } catch (Exception e) {
            throw new IllegalArgumentException("标注位置必须是整数");
        }
    }

    private String currentUsername(Authentication authentication) {
        return authentication == null ? "" : String.valueOf(authentication.getName());
    }
}
