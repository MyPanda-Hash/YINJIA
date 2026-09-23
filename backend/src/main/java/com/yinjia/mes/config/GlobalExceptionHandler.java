package com.yinjia.mes.config;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.ocr.OcrRateLimitException;
import com.yinjia.mes.ocr.OcrServiceException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

/**
 * 异常归一化(对齐 light-mes):
 * - 通用业务异常保持 HTTP 状态(400/409/500),前端 axios reject -> errMsg 展示
 * - OCR/上传/权限类走 body-code(HTTP 200 + code),避免 403 触发前端登出
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(AccessDeniedException.class)
    public ApiResult<Void> handleAccessDenied(AccessDeniedException e) {
        return ApiResult.fail(403, e.getMessage());
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ApiResult<Void> handleMaxUploadSize(MaxUploadSizeExceededException e) {
        return ApiResult.fail(400, "上传文件不能超过20MB(OCR 扫描图片仍限 10MB)");
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public ApiResult<Void> handleMissingPart(MissingServletRequestPartException e) {
        return ApiResult.fail(400, "image".equals(e.getRequestPartName())
                ? "请选择需要扫描的图片" : "上传请求缺少必要参数");
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ApiResult<Void> handleMissingParameter(MissingServletRequestParameterException e) {
        return ApiResult.fail(400, "panelCode".equals(e.getParameterName())
                ? "面板编码不能为空" : "请求缺少必要参数");
    }

    @ExceptionHandler(MultipartException.class)
    public ApiResult<Void> handleMultipart(MultipartException e) {
        return ApiResult.fail(400, "图片上传请求格式不正确");
    }

    @ExceptionHandler(OcrServiceException.class)
    public ApiResult<Void> handleOcrService(OcrServiceException e) {
        return ApiResult.fail(503, e.getMessage());
    }

    @ExceptionHandler(OcrRateLimitException.class)
    public ApiResult<Void> handleOcrRateLimit(OcrRateLimitException e) {
        return ApiResult.fail(429, e.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResult<Object>> badRequest(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(ApiResult.error(400, e.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiResult<Object>> conflict(IllegalStateException e) {
        return ResponseEntity.status(409).body(ApiResult.error(409, e.getMessage()));
    }

    /**
     * 静态资源不存在 → **404**(2026-09-22 实测补):浏览器默认会请求 /favicon.ico,
     * 而缺文件被兜底的 serverError() 当成 500 返回「服务异常：No static resource favicon.ico.」——
     * 每次打开页面都在控制台留红线、还在服务端日志里刷 500。
     */
    @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class)
    public ResponseEntity<ApiResult<Object>> notFound(org.springframework.web.servlet.resource.NoResourceFoundException e) {
        return ResponseEntity.status(404).body(ApiResult.error(404, "资源不存在：" + e.getResourcePath()));
    }

    /**
     * 数据库连不上(账套库缺失/网络/口令错) → 给**能读懂的**提示(503),别暴露驱动原文。
     * 实测触发场景:服务器上没有 HSDZ_MES_TEST,却从账套菜单切到"测试库"。
     */
    @ExceptionHandler(org.springframework.jdbc.CannotGetJdbcConnectionException.class)
    public ResponseEntity<ApiResult<Object>> noDb(org.springframework.jdbc.CannotGetJdbcConnectionException e) {
        return ResponseEntity.status(503).body(ApiResult.error(503,
                "数据库连接失败：当前账套的数据库不可用。若显示的是「测试库」账套，说明本服务器没有部署该账套 —— "
                        + "请改用正式账套登录，或让运维在服务端打开 yinjia.enable-test-ledger"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResult<Object>> serverError(Exception e) {
        String msg = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
        return ResponseEntity.status(500).body(ApiResult.error(500, "服务异常：" + msg));
    }
}
