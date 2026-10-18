package com.yinjia.mes.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * **慢请求留痕**(2026-10-18):把「前端转圈」变成能查的事实。
 *
 * <p>背景:2026-10-18 现场报「手机端报工后前端卡住、只能重新进入系统」。查的时候发现
 * MES 后端**没有任何落盘日志**(start.bat 直接打到控制台),只能靠猜。而这类卡住的典型成因是
 * **数据库锁等待**:手机端小程序/参考库直连同一个库写 {@code plang/scjl},那边事务没提交时,
 * MES 的列表查询会一直等 —— 驱动默认锁等待**无上限**({@code lockTimeout=-1}),实测锁 1 行
 * 就让 {@code /api/px/workOrderList} 卡了 42.7 秒。
 *
 * <p>本拦截器只做两件事(不改业务):
 * <ol>
 *   <li>任何 {@code /api/**} 请求耗时 ≥ {@link #SLOW_MS} ⇒ WARN 一行(带方法/URI/耗时/状态);</li>
 *   <li>响应 503(锁等待超时/连接池拿不到连接)⇒ INFO 一行,便于和 {@code logs/backend.log} 对齐时间。</li>
 * </ol>
 * 日志统一前缀 {@code [慢请求]} / {@code [锁等待]} —— 现场用 {@code grep} 一次就能捞出全部证据。
 */
@Component
public class SlowRequestLogger implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(SlowRequestLogger.class);
    /** 超过这个耗时就算“用户能感觉到卡”的请求(手机端 2s 已经很明显) */
    private static final long SLOW_MS = 2000;
    private static final String START_ATTR = "yinjia.request.startNanos";

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        request.setAttribute(START_ATTR, System.nanoTime());
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        Object start = request.getAttribute(START_ATTR);
        if (!(start instanceof Long s)) return;
        long ms = (System.nanoTime() - s) / 1_000_000L;
        String uri = request.getRequestURI();
        if (ms >= SLOW_MS) {
            log.warn("[慢请求] {} {} {}ms status={} （≥{}ms；并发/锁等待线索）",
                    request.getMethod(), uri, ms, response.getStatus(), SLOW_MS);
        }
        // 503 目前只有两类来源:锁等待超时(1222) / 连接池拿不到连接 —— 都值得单独留一行
        if (response.getStatus() == 503) {
            log.info("[锁等待] 请求以 503 结束:{} {} {}ms（多为外部程序占着数据行）",
                    request.getMethod(), uri, ms);
        }
    }
}
