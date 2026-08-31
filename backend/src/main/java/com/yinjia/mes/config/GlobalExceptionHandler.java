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
        return ApiResult.fail(400, "图片不能超过10MB");
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

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResult<Object>> serverError(Exception e) {
        String msg = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
        return ResponseEntity.status(500).body(ApiResult.error(500, "服务异常：" + msg));
    }
}
