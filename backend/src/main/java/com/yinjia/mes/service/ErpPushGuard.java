package com.yinjia.mes.service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 「同一张单只许推送一次」的**单号级互斥**(2026-11-12 客户报障「点两下就生成两个入库单」)。
 *
 * <p><b>为什么需要它</b>:转ERP 唯一的防重是读单据头上的 `是否已转ERP`,而回写 `是` 发生在
 * 金蝶落单**之后** —— 慢的时候十几秒。这十几秒里双击产生的两个请求都读到"未转",
 * 于是各自向金蝶 POST 一次 ⇒ **金蝶两张入库单(重复入库)**,MES 只记住后一张的 ERP 单号。
 * 前端置灰只能挡住同一个页面上的连点;两个标签页、两台电脑、"第一次超时后再点"都绕过前端,
 * 所以必须在**服务端**按单号互斥。
 *
 * <p><b>语义</b>:{@link #acquire} 立即返回,不排队 —— 拿到 NULL 表示"这次归你推";
 * 拿到毫秒数表示"已经有一次在推",调用方应**立即拒绝**并提示用户,绝不发第二次 POST。
 * 不同单号之间互不影响(并行转两张不同的单照常可以)。
 *
 * <p><b>边界</b>:这是**进程内**互斥(本项目是单实例 jar 部署)。进程重启期间的窗口不覆盖 ——
 * 那种情况靠"推送成功后才回写 ERP 单号"的既有语义 + 用户刷新确认来兜。
 * 拆成独立类是为了能单测(见 tools/archive/_erp-speed-20261112/GuardCheck.java)。
 */
public class ErpPushGuard {

    /** 键(面板|单号) → 本次推送的开始时刻毫秒 */
    private final Map<String, Long> inFlight = new ConcurrentHashMap<>();

    /**
     * 尝试占位。
     * @return {@code null} = 占位成功(本次由你推送,用完务必 {@link #release});
     *         否则 = 已有一次在推,值 = 那次开始于多少毫秒前(用于提示"已 X 秒")
     */
    public Long acquire(String key) {
        long now = System.currentTimeMillis();
        Long prev = inFlight.putIfAbsent(key, now);
        return prev == null ? null : now - prev;
    }

    /** 释放占位(成功/失败/超时都必须调用,否则这张单会永久推不了) */
    public void release(String key) {
        inFlight.remove(key);
    }

    /** 当前正在推送的单数(仅诊断用) */
    public int inFlightCount() {
        return inFlight.size();
    }
}
