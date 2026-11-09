package com.yinjia.mes.service;

import java.util.Locale;
import java.util.Set;

/**
 * 计量单位 → 小数位数(超送量/可送上限按它取整),2026-11-09 用户口径:
 * 「要根据单位确定超送是否需要小数,如果需要小数要确定位数」。
 *
 * <h3>为什么需要</h3>
 * 原来超送上限直接按 `数量 × (1 + 比例)` 算浮点数:
 * 24 × 1.2 − 24 = 4.799999999999997,24 个(个/卷这种**计件**单位)根本不该出现小数,
 * 12 × 1.2 − 12 = 2.3999999999999986 同理。计件单位要整数,kg/米这类计量单位才允许小数。
 *
 * <h3>精度从哪来(优先级)</h3>
 * <ol>
 *   <li><b>{@code bs_uom.[小数位数]}</b> —— 金蝶同步过来的单位精度(实查:个/卷/张/支/PCS = 0,
 *       kg/米 = 3)。这是 ERP 的口径,能查到就以它为准(见 {@link BatchService#unitDecimals});</li>
 *   <li>查不到(单位是建面板时手填的、或 bs_uom 里那条是 U01 这种没有精度的种子行)时,
 *       按单位名**兜底分类**(本类的 {@link #guess}):
 *       计件单位 → 0 位;计量单位(kg/g/吨/L/ml/米/cm…)→ 3 位;都不认识 → 2 位。</li>
 * </ol>
 *
 * <h3>取整方向:向下(不超比例)</h3>
 * 超送上限是**上限** —— 24 个按 20% 超送 = 4.8 个,只能收 4 个(收 5 个 = 20.8%,已超比例)。
 * 故 {@link #floorTo} 用向下取整,而不是四舍五入。计量单位同理保留到精度位(kg × 20% = 60.92kg)。
 *
 * <p>本类**不依赖 Spring/数据库**(纯静态),便于在 {@link BatchService} 与探针里直接调用对账。
 */
public final class UnitPrecision {

    private UnitPrecision() {}

    /** 精度上限:库内数量列是 decimal(18,4),再多也没有意义 */
    public static final int MAX_DECIMALS = 4;

    /** 计量类单位(允许小数)的兜底精度 —— 与 bs_uom 里 kg/米 的 3 位一致 */
    public static final int MEASURED_DECIMALS = 3;

    /** 既不在计件表也不在计量表里的单位:按 2 位处理(与界面输入框默认精度一致) */
    public static final int DEFAULT_DECIMALS = 2;

    /** 计件单位(个数是整数,超送不允许小数) */
    private static final Set<String> DISCRETE = Set.of(
            "个", "只", "张", "条", "支", "支（成型前）", "片", "卷", "套", "台", "件", "包", "箱",
            "桶", "瓶", "盒", "根", "份", "次", "颗", "粒", "枚", "对", "双", "组", "批",
            "pcs", "pc", "ea", "set", "sets", "bag", "box", "roll", "sheet");

    /** 计量单位(重量/体积/长度,允许小数;与 bs_uom 的 3 位对齐) */
    private static final Set<String> MEASURED = Set.of(
            "kg", "千克", "公斤", "g", "克", "mg", "毫克", "吨", "t", "ton",
            "l", "升", "ml", "毫升", "m", "米", "cm", "厘米", "mm", "毫米",
            "㎡", "m²", "平方米", "m³", "立方米", "立方");

    /**
     * 单位名(或编码)的兜底精度。大小写不敏感;空/未知 → {@link #DEFAULT_DECIMALS}。
     *
     * @param unit 单位名/编码(如 个、卷、kg、PCS)
     * @return 小数位数(0~4)
     */
    public static int guess(String unit) {
        String u = unit == null ? "" : unit.trim().toLowerCase(Locale.ROOT);
        if (u.isEmpty()) return DEFAULT_DECIMALS;
        if (DISCRETE.contains(u)) return 0;
        if (MEASURED.contains(u)) return MEASURED_DECIMALS;
        // 带括号的写法(如「支(成型前)」「kg/包」)按括号前的部分再判一次
        int cut = u.indexOf('(');
        if (cut < 0) cut = u.indexOf('（');
        if (cut > 0) {
            String head = u.substring(0, cut).trim();
            if (DISCRETE.contains(head)) return 0;
            if (MEASURED.contains(head)) return MEASURED_DECIMALS;
        }
        return DEFAULT_DECIMALS;
    }

    /** 钳到 0~{@link #MAX_DECIMALS} */
    public static int clamp(int decimals) {
        return Math.max(0, Math.min(MAX_DECIMALS, decimals));
    }

    /**
     * 按精度**向下取整**(带 1e-9 容差,避免 4.799999999 * 100 = 479.9999 被 floor 成 479)。
     *
     * @param v        数值
     * @param decimals 小数位数(0 = 取整)
     * @return 取整后的值(非法值 → 0)
     */
    public static double floorTo(double v, int decimals) {
        if (!Double.isFinite(v)) return 0d;
        int nd = clamp(decimals);
        double p = Math.pow(10, nd);
        return Math.floor(v * p + 1e-9) / p;
    }

    /**
     * 按精度**四舍五入**(只用于"展示实际数量":已送/已打印/可补打,不能用 floor —— 会少报 0.001)。
     * 超送上限/可送上限一律用 {@link #floorTo}(上限只能少不能多)。
     */
    public static double roundTo(double v, int decimals) {
        if (!Double.isFinite(v)) return 0d;
        int nd = clamp(decimals);
        double p = Math.pow(10, nd);
        return Math.round(v * p + 1e-9) / p;
    }
}
