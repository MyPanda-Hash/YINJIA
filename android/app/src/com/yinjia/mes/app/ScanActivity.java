package com.yinjia.mes.app;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.graphics.ImageFormat;
import android.hardware.Camera;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Vibrator;
import android.util.Log;
import android.util.TypedValue;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.BinaryBitmap;
import com.google.zxing.DecodeHintType;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.PlanarYUVLuminanceSource;
import com.google.zxing.Result;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.multi.GenericMultipleBarcodeReader;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 原生扫码页(2026-10-20 建;2026-11-05 两次迭代:一屏多码可选取 → 边扫边累积)。
 *
 * 为什么不用网页里的 getUserMedia:
 *   安卓 WebView 把 http:// 视为**不安全上下文**,`navigator.mediaDevices` 直接不存在
 *   (和 Chrome 一个规则)。工厂内网是 http://IP:8090,没证书 ⇒ 网页调不起摄像头。
 *   所以扫码放在原生层做,解出字符串再回传给网页 —— 网页那边只负责把码填进输入框。
 *
 * 支持:QR / CODE_128 / CODE_39 / CODE_93 / EAN_13 / EAN_8 / ITF / DATA_MATRIX。
 * 交互:对准即扫;扫中震动;点屏幕切换手电;返回键取消。
 *
 * <h3>一屏多个码怎么办(用户 2026-11-05 两轮反馈)</h3>
 * 第一轮:「手机扫码遇到多码不能选择」⇒ 改成 {@link GenericMultipleBarcodeReader} 一帧找多个 + 弹选择框。
 * 第二轮(对着《成型生产任务单》一页 9 个码实测):
 * <blockquote>「实际上是 9 个码,但扫完后就弹出来 7 个码,扫到部分码就弹窗了,
 *   而且码和信息很难对应是哪一条的」</blockquote>
 * 根因与改法:
 * <ol>
 *   <li><b>弹模态框就停止了取景解码</b> ⇒ 只看到先入镜的那几个。
 *       现在改成**常驻覆盖面板**:不解码暂停,边扫边往列表里追加,9 个能集齐;</li>
 *   <li><b>每行只有「工单 · 号 行N」</b>,纸上一行行长得像,分不清是哪条。
 *       现在每行两段:第一段 = 预判类型 + 关键字段,第二段 = **原始码全文**(和纸上
 *       「单据编号」列、标签上的码一致),照着纸上的编号就能挑;</li>
 *   <li>面板出现后**不再自动回传** —— 一旦出现第二个码,就等用户点选,避免抢跑。</li>
 * </ol>
 */
public class ScanActivity extends Activity implements SurfaceHolder.Callback {

    private static final String TAG = "YjScan";

    /** 单码场景:同一个码连续命中多少次才自动回传(≈0.3 秒,够快又不会误扫刚入镜的邻码) */
    private static final int CONFIRM_HITS = 2;
    /** 每隔几帧解一次(省电;多码解码比单码慢) */
    private static final int FRAME_SKIP = 4;

    private SurfaceView surface;
    private TextView hint;
    private Camera camera;
    private SurfaceHolder holder;
    private boolean decoding = false;
    private boolean found = false;
    private boolean torchOn = false;

    /** 多码面板(2026-11-05):常驻覆盖层,边扫边加行,不解码暂停 */
    private View multiPanel;
    private TextView multiTitle;
    private LinearLayout multiList;
    private ScrollView multiScroll;

    private final MultiFormatReader reader = new MultiFormatReader();
    private GenericMultipleBarcodeReader multi;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private int frameSkip = 0;

    /** 候选码(按发现顺序):text → {命中次数, 码型} */
    private final Map<String, Cand> cands = new LinkedHashMap<String, Cand>();
    private final List<String> order = new ArrayList<String>();
    /** 面板是否已显示(显示后不再自动回传,一律等用户点) */
    private boolean panelShown = false;

    private static class Cand {
        int hits;
        BarcodeFormat format;
        Cand(BarcodeFormat f) { this.format = f; this.hits = 0; }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        setContentView(com.yinjia.mes.app.R.layout.activity_scan);

        surface = (SurfaceView) findViewById(com.yinjia.mes.app.R.id.preview);
        hint = (TextView) findViewById(com.yinjia.mes.app.R.id.hint);
        multiPanel = findViewById(com.yinjia.mes.app.R.id.multiPanel);
        multiTitle = (TextView) findViewById(com.yinjia.mes.app.R.id.multiTitle);
        multiList = (LinearLayout) findViewById(com.yinjia.mes.app.R.id.multiList);
        multiScroll = (ScrollView) findViewById(com.yinjia.mes.app.R.id.multiScroll);

        Button rescan = (Button) findViewById(com.yinjia.mes.app.R.id.multiRescan);
        rescan.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { restartScan(); }
        });
        Button cancel = (Button) findViewById(com.yinjia.mes.app.R.id.multiCancel);
        cancel.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { setResult(RESULT_CANCELED); finish(); }
        });

        holder = surface.getHolder();
        holder.addCallback(this);
        holder.setType(SurfaceHolder.SURFACE_TYPE_PUSH_BUFFERS);

        Map<DecodeHintType, Object> hints = new EnumMap<DecodeHintType, Object>(DecodeHintType.class);
        List<BarcodeFormat> formats = new ArrayList<BarcodeFormat>();
        formats.add(BarcodeFormat.QR_CODE);
        formats.add(BarcodeFormat.CODE_128);
        formats.add(BarcodeFormat.CODE_39);
        formats.add(BarcodeFormat.CODE_93);
        formats.add(BarcodeFormat.EAN_13);
        formats.add(BarcodeFormat.EAN_8);
        formats.add(BarcodeFormat.ITF);
        formats.add(BarcodeFormat.DATA_MATRIX);
        hints.put(DecodeHintType.POSSIBLE_FORMATS, formats);
        hints.put(DecodeHintType.TRY_HARDER, Boolean.TRUE);
        hints.put(DecodeHintType.CHARACTER_SET, "UTF-8");
        reader.setHints(hints);
        // 多码阅读器:内部先对整图调 delegate.decode,再对四个象限递归 —— 单码也走这条路
        multi = new GenericMultipleBarcodeReader(reader);

        // 点屏幕:手电开关(仓库光线差时用)
        surface.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { toggleTorch(); }
        });
    }

    private void toggleTorch() {
        if (camera == null) return;
        try {
            Camera.Parameters p = camera.getParameters();
            if (p.getFlashMode() == null) return;
            torchOn = !torchOn;
            p.setFlashMode(torchOn ? Camera.Parameters.FLASH_MODE_TORCH : Camera.Parameters.FLASH_MODE_OFF);
            camera.setParameters(p);
        } catch (Exception ignore) { }
    }

    // ───────────── Surface ─────────────

    @Override
    public void surfaceCreated(SurfaceHolder h) {
        try {
            camera = Camera.open();
        } catch (Exception e) {
            Log.e(TAG, "打开相机失败: " + e.getMessage());
            hint.setText("打不开相机:请检查权限,或用「设置」里的手动输入");
            return;
        }
        try {
            Camera.Parameters p = camera.getParameters();
            p.setPreviewFormat(ImageFormat.NV21);
            Camera.Size size = pickSize(p.getSupportedPreviewSizes());
            if (size != null) p.setPreviewSize(size.width, size.height);
            camera.setParameters(p);
            camera.setDisplayOrientation(90);   // 竖屏
            camera.setPreviewDisplay(h);
            camera.setPreviewCallback(new Camera.PreviewCallback() {
                @Override public void onPreviewFrame(byte[] data, Camera cam) {
                    // ⚠ 多码面板打开时**也要继续解码**(2026-11-05 修:旧版暂停解码导致"9 个只收到 7 个")
                    if (decoding || found || data == null) return;
                    if ((frameSkip++ % FRAME_SKIP) != 0) return;
                    decoding = true;
                    try {
                        Camera.Size sz = cam.getParameters().getPreviewSize();
                        decode(data, sz.width, sz.height);
                    } catch (Throwable t) {
                        Log.w(TAG, "解码异常: " + t.getMessage());
                    } finally {
                        decoding = false;
                    }
                }
            });
            camera.startPreview();
            autoFocusLoop();
        } catch (Exception e) {
            Log.e(TAG, "启动预览失败: " + e.getMessage());
        }
    }

    private Camera.Size pickSize(List<Camera.Size> sizes) {
        if (sizes == null || sizes.isEmpty()) return null;
        Camera.Size best = sizes.get(0);
        for (Camera.Size s : sizes) {
            // 目标 1280×720 左右:分辨率够解码,又不至于太慢
            boolean better = Math.abs(s.width * s.height - 1280 * 720) < Math.abs(best.width * best.height - 1280 * 720);
            if (better) best = s;
        }
        return best;
    }

    private void autoFocusLoop() {
        if (camera == null) return;
        try { camera.autoFocus(new Camera.AutoFocusCallback() {
            @Override public void onAutoFocus(boolean ok, Camera cam) {
                ui.postDelayed(new Runnable() { @Override public void run() { autoFocusLoop(); } }, 1200);
            }
        }); } catch (Exception ignore) { }
    }

    /**
     * 解一帧:一次找**多个**码,结果累积到 {@link #cands}。
     *
     * <ul>
     *   <li>累计到第 2 个不同码 ⇒ 弹出多码面板(**不暂停解码**,后面扫到的继续追加);</li>
     *   <li>只有 1 个码且面板没弹出 ⇒ 连续命中 {@link #CONFIRM_HITS} 次自动回传;</li>
     *   <li>面板已显示 ⇒ 一律等用户点,绝不自动回传。</li>
     * </ul>
     */
    private void decode(byte[] data, int width, int height) {
        PlanarYUVLuminanceSource source = new PlanarYUVLuminanceSource(data, width, height, 0, 0, width, height, false);
        BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(source));
        Result[] results = null;
        try {
            results = multi.decodeMultiple(bitmap, null);
        } catch (Throwable notFound) {
            // 正常:这一帧没扫到
        } finally {
            try { reader.reset(); } catch (Throwable ignore) { }
        }
        if (results == null || results.length == 0) return;

        // 一帧内的去重(同一个码可能被整图+象限各解一次)
        LinkedHashMap<String, BarcodeFormat> frame = new LinkedHashMap<String, BarcodeFormat>();
        for (Result r : results) {
            if (r == null) continue;
            String text = r.getText();
            if (text == null) continue;
            text = text.trim();
            if (text.length() == 0) continue;
            if (!frame.containsKey(text)) frame.put(text, r.getBarcodeFormat());
        }
        if (frame.isEmpty()) return;

        boolean added = false;
        synchronized (cands) {
            for (Map.Entry<String, BarcodeFormat> e : frame.entrySet()) {
                Cand c = cands.get(e.getKey());
                if (c == null) {
                    c = new Cand(e.getValue());
                    cands.put(e.getKey(), c);
                    order.add(e.getKey());
                    added = true;
                }
                c.format = e.getValue();
                c.hits++;
            }

            // ② 有第二个码 ⇒ 常驻面板(解码继续,后面扫到的自动追加)
            if (order.size() >= 2) {
                if (!panelShown) { panelShown = true; vibrate(80); }
                if (added) refreshPanel();
                return;
            }

            // ① 只有 1 个码、面板没弹 ⇒ 连续命中就回传
            if (!panelShown) {
                String only = frame.keySet().iterator().next();
                Cand c = cands.get(only);
                if (c != null && c.hits >= CONFIRM_HITS) onDecoded(only);
            }
        }
    }

    /** 把当前累积的码刷进面板(边扫边加行,2026-11-05) */
    private void refreshPanel() {
        final List<String> snapshot = new ArrayList<String>(order);
        ui.post(new Runnable() {
            @Override public void run() {
                multiPanel.setVisibility(View.VISIBLE);
                multiTitle.setText("已识别 " + snapshot.size() + " 个码 · 点一条选用(继续对准会自动加)");
                hint.setText("可以在下面点选,也可以继续对准让更多码进来");
                multiList.removeAllViews();
                for (int i = 0; i < snapshot.size(); i++) {
                    final String code = snapshot.get(i);
                    final int no = i + 1;
                    LinearLayout row = new LinearLayout(ScanActivity.this);
                    row.setOrientation(LinearLayout.VERTICAL);
                    row.setPadding(dp(16), dp(10), dp(16), dp(10));
                    row.setBackgroundColor(Color.parseColor("#1AFFFFFF"));

                    TextView t1 = new TextView(ScanActivity.this);
                    t1.setText(no + ". " + describe(code));
                    t1.setTextColor(Color.WHITE);
                    t1.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
                    row.addView(t1);

                    // 第二行显示原始码全文 —— 照纸上的「单据编号」/标签上的码就能对上号
                    TextView t2 = new TextView(ScanActivity.this);
                    t2.setText(code);
                    t2.setTextColor(Color.parseColor("#B3FFFFFF"));
                    t2.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
                    row.addView(t2);

                    row.setOnClickListener(new View.OnClickListener() {
                        @Override public void onClick(View v) { onDecoded(code); }
                    });
                    multiList.addView(row);
                    View divider = new View(ScanActivity.this);
                    divider.setLayoutParams(new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1)));
                    divider.setBackgroundColor(Color.parseColor("#33FFFFFF"));
                    multiList.addView(divider);
                }
                multiScroll.post(new Runnable() {
                    @Override public void run() { multiScroll.fullScroll(View.FOCUS_DOWN); }
                });
            }
        });
    }

    /** 清空候选、收起面板,继续扫(「重新扫」按钮) */
    private void restartScan() {
        synchronized (cands) {
            cands.clear();
            order.clear();
        }
        panelShown = false;
        multiPanel.setVisibility(View.GONE);
        multiList.removeAllViews();
        frameSkip = 0;
        hint.setText("对准二维码 / 条形码;点屏幕开关手电;返回键取消");
    }

    private int dp(int v) {
        return (int) (v * getResources().getDisplayMetrics().density + 0.5f);
    }

    /**
     * 把码翻译成人看得懂的一行(工单/物料 + 关键字段),给面板用。
     *
     * <p>码型口径与网页 `scanCode.js` 一致:`0@GD-2026-10-0221@1001`(**1000+行号**)、
     * `0@YJ-ZZ-001`(物料)、`0@YJ-ZZ-001@20261021`(物料 + 批次);老标签用 `|` 分隔。
     */
    private static String describe(String text) {
        String kind = "码";
        String detail = text;
        try {
            String sep = text.indexOf('@') >= 0 ? "@" : (text.indexOf('|') >= 0 ? "\\|" : null);
            String[] segs = (sep == null) ? new String[] { text } : text.split(sep);
            List<String> parts = new ArrayList<String>();
            for (String s : segs) {
                if (s != null && s.trim().length() > 0) parts.add(s.trim());
            }
            // 首段是 ≤3 位纯数字的占位(典型就是 0),丢掉
            if (parts.size() > 1 && parts.get(0).matches("^\\d{1,3}$")) parts.remove(0);
            if (!parts.isEmpty()) {
                String first = parts.get(0);
                if (first.startsWith("GD-") || first.indexOf("GD-") >= 0) {
                    kind = "工单";
                    String tail = parts.size() > 1 ? parts.get(1) : "";
                    if (tail.matches("^\\d+$")) {
                        int n = 0;
                        try { n = Integer.parseInt(tail); } catch (Exception ignore) { }
                        int line = n >= 1000 ? n - 1000 : n;   // 1000+行号
                        detail = first + (line > 0 ? (" 行" + line) : "");
                    } else {
                        detail = first;
                    }
                } else if (parts.size() >= 2) {
                    kind = "物料";
                    detail = first + " 批号 " + parts.get(1);
                } else {
                    kind = "码";
                    detail = first;
                }
            }
        } catch (Throwable ignore) { }
        return kind + " · " + detail;
    }

    private void vibrate(int ms) {
        try {
            Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (v != null) v.vibrate(ms);
        } catch (Exception ignore) { }
    }

    private void onDecoded(final String text) {
        if (found || text == null || text.trim().length() == 0) return;
        found = true;
        vibrate(60);
        ui.post(new Runnable() {
            @Override public void run() {
                hint.setText("已扫到:" + text);
                Intent out = new Intent();
                out.putExtra("code", text);
                setResult(RESULT_OK, out);
                ui.postDelayed(new Runnable() { @Override public void run() { finish(); } }, 250);
            }
        });
    }

    @Override
    public void onBackPressed() {
        // 面板开着时,返回键先收起面板(不直接退出扫码页)
        if (panelShown) { restartScan(); return; }
        setResult(RESULT_CANCELED);
        super.onBackPressed();
    }

    @Override
    public void surfaceChanged(SurfaceHolder h, int format, int w, int hh) { }

    @Override
    public void surfaceDestroyed(SurfaceHolder h) { release(); }

    private void release() {
        if (camera != null) {
            try { camera.setPreviewCallback(null); } catch (Exception ignore) { }
            try { camera.stopPreview(); } catch (Exception ignore) { }
            try { camera.release(); } catch (Exception ignore) { }
            camera = null;
        }
    }

    @Override
    protected void onPause() { super.onPause(); release(); }
    @Override
    protected void onDestroy() { super.onDestroy(); release(); }
}
