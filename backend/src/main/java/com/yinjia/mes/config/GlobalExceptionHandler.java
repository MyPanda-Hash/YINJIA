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

    /**
     * **锁等待超时**(2026-10-18 新增):SQL Server 1222「Lock request time out period exceeded」。
     *
     * <p>为什么必须单独接:手机端小程序/参考库是**直连同一个库**写 plang/scjl 的,那边只要有一个事务
     * 没提交(或写得很慢),MES 的列表查询扫到被锁的行就会一直等。驱动默认 {@code lockTimeout=-1}
     * 是**无限等** —— 实测锁住 1 行 plang,{@code /api/px/workOrderList} 卡了 42.7 秒(直到对方释放),
     * 前端表现就是「页面一直转圈、只能重新进入系统」。
     * 现在连接串设了 {@code lockTimeout=8000},超时会被 Spring 翻成 CannotAcquireLockException,
     * 这里翻成 503 + 一句人话,让现场知道「是外部程序占着数据,不是系统坏了」,重试即可。
     *
     * <p>⚠ 实测补记(2026-10-18,8091 复验):SQL Server 的 1222 经 JdbcTemplate 出来是
     * {@code UncategorizedSQLException}(Spring 的错误码映射没命中它),所以**光按异常类接不住** ——
     * 真正兜底的是 {@link #serverError(Exception)} 里的 {@link #isLockTimeout(Throwable)} 判定
     * (走 SQLException.getErrorCode()==1222 + 文案匹配)。这里保留类型捕获,用于别的驱动路径。
     */
    @ExceptionHandler({org.springframework.dao.CannotAcquireLockException.class,
            org.springframework.dao.PessimisticLockingFailureException.class})
    public ResponseEntity<ApiResult<Object>> lockTimeout(Exception e) {
        return lockTimeoutBody();
    }

    /** 锁等待超时的统一口径(503 + 人话),供类型捕获与 1222 兜底两条路复用 */
    private ResponseEntity<ApiResult<Object>> lockTimeoutBody() {
        return ResponseEntity.status(503).body(ApiResult.error(503,
                "数据正被其它程序占用（等待数据库锁超时，通常来自手机端小程序/参考库正在写入）。"
                        + "请等几秒再点一次；若持续出现，请让小程序那边结束当前操作后重试。"));
    }

    /** 是否「数据库锁等待超时」:错误码 1222,或驱动原始文案命中(大小写不敏感) */
    private static boolean isLockTimeout(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof java.sql.SQLException se
                    && (se.getErrorCode() == 1222 || se.getErrorCode() == 1205)) {
                return true;   // 1222=锁等待超时 / 1205=死锁牺牲者(同样属于"抢锁失败,重试即可")
            }
            String m = t.getMessage();
            if (m != null && (m.contains("Lock request time out") || m.contains("锁请求超时")
                    || m.contains("was deadlocked") || m.contains("死锁"))) {
                return true;
            }
        }
        return false;
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResult<Object>> serverError(Exception e) {
        // 锁等待超时/死锁:JdbcTemplate 对 SQL Server 1222/1205 不一定能翻成 CannotAcquireLockException
        // (实测是 UncategorizedSQLException) ⇒ 这里按错误码/文案兜一层,别让现场看到"服务异常"的原始 SQL。
        if (isLockTimeout(e)) return lockTimeoutBody();
        String msg = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
        return ResponseEntity.status(500).body(ApiResult.error(500, "服务异常：" + msg));
    }
}
