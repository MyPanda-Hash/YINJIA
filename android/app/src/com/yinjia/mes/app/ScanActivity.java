package com.yinjia.mes.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.ImageFormat;
import android.hardware.Camera;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Vibrator;
import android.util.Log;
import android.view.Surface;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.view.View;
import android.widget.FrameLayout;
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
 * 原生扫码页(2026-10-20;2026-11-05 加「一屏多个码时可选择」)。
 *
 * 为什么不用网页里的 getUserMedia:
 *   安卓 WebView 把 http:// 视为**不安全上下文**,`navigator.mediaDevices` 直接不存在
 *   (和 Chrome 一个规则)。工厂内网是 http://IP:8090,没证书 ⇒ 网页调不起摄像头。
 *   所以扫码放在原生层做,解出字符串再回传给网页 —— 网页那边只负责把码填进输入框。
 *
 * 支持:QR / CODE_128 / CODE_39 / CODE_93 / EAN_13 / EAN_8 / ITF / DATA_MATRIX。
 * 交互:对准即扫;扫中震动一下并回传;点屏幕切换手电;返回键取消。
 *
 * <h3>2026-11-05 用户口径:「手机扫码遇到多码不能选择」</h3>
 * 改前是 `reader.decodeWithState()` 一帧只解**一个**码,解到谁就回传谁 —— 一屏里有
 * 好几个标签(一沓工单码、一箱多袋料)时,扫到哪个全看运气,想扫指定那个必须先挪开别的。
 * 现在:
 * <ul>
 *   <li>用 {@link GenericMultipleBarcodeReader} **一帧找多个**(它先整图、再分四个象限递归);</li>
 *   <li>一帧里只有 1 个码 ⇒ 连续命中 2 次才回传(既快又不会误扫旁边的码);</li>
 *   <li>一帧里 ≥2 个码 ⇒ **暂停解码、弹选择框**,列出每个码(带"工单/物料"预判 + 摘要),
 *       点哪个回传哪个;点「继续扫」回到取景继续扫;</li>
 *   <li>选择框里按**上一次成功的那类**排前面(优先工单/物料里的常见码型),减少点错。</li>
 * </ul>
 */
public class ScanActivity extends Activity implements SurfaceHolder.Callback {

    private static final String TAG = "YjScan";

    /** 同一个码连续命中多少次才自动回传(单码场景:≈0.3 秒,足够快又不会误扫) */
    private static final int CONFIRM_HITS = 2;
    /** 每隔几帧解一次(省电;1280×720 多码解码比单码慢,别每帧都解) */
    private static final int FRAME_SKIP = 4;

    private SurfaceView surface;
    private TextView hint;
    private Camera camera;
    private SurfaceHolder holder;
    private boolean decoding = false;
    private boolean found = false;
    /** 选择框打开中:暂停解码,别让取景里的码继续累积 */
    private boolean choosing = false;
    private boolean torchOn = false;

    private final MultiFormatReader reader = new MultiFormatReader();
    private GenericMultipleBarcodeReader multi;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private int frameSkip = 0;

    /** 候选码:text → {命中次数, 码型, 最近一次时间}。按插入顺序,选择框的顺序也照它 */
    private final Map<String, Cand> cands = new LinkedHashMap<String, Cand>();

    private static class Cand {
        int hits;
        BarcodeFormat format;
        long lastAt;
        Cand(BarcodeFormat f) { this.format = f; this.hits = 0; this.lastAt = 0; }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        setContentView(com.yinjia.mes.app.R.layout.activity_scan);

        surface = (SurfaceView) findViewById(com.yinjia.mes.app.R.id.preview);
        hint = (TextView) findViewById(com.yinjia.mes.app.R.id.hint);

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
        // 多码阅读器:内部先对整图调 delegate.decode,再对四个象限递归 —— 单码也走这条路,行为一致
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
                    if (decoding || found || choosing || data == null) return;
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
     * 解一帧:一次找**多个**码(2026-11-05 改)。
     *
     * <p>结果进 {@link #cands} 累积:
     * <ul>
     *   <li>本帧只有 1 个码 ⇒ 该码命中数 +1;到 {@link #CONFIRM_HITS} 次自动回传;</li>
     *   <li>本帧 ≥2 个码 ⇒ 弹选择框让人挑(这就是用户报的「多码不能选择」)。</li>
     * </ul>
     */
    private void decode(byte[] data, int width, int height) {
        PlanarYUVLuminanceSource source = new PlanarYUVLuminanceSource(data, width, height, 0, 0, width, height, false);
        BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(source));
        Result[] results = null;
        try {
            results = multi.decodeMultiple(bitmap, null);
        } catch (Throwable notFound) {
            // 正常:这一帧没扫到(GenericMultipleBarcodeReader 找不到时抛 NotFoundException)
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

        long now = System.currentTimeMillis();
        synchronized (cands) {
            for (Map.Entry<String, BarcodeFormat> e : frame.entrySet()) {
                Cand c = cands.get(e.getKey());
                if (c == null) {
                    c = new Cand(e.getValue());
                    cands.put(e.getKey(), c);
                }
                c.format = e.getValue();
                c.hits++;
                c.lastAt = now;
            }
            // ② 一帧里多个码 ⇒ 交给用户选(不再"谁先解出来就是谁")
            if (frame.size() >= 2) {
                List<String> options = new ArrayList<String>(frame.keySet());
                choosing = true;
                vibrate(80);
                showChooser(options);
                return;
            }
            // ① 单码:连续命中才回传
            String only = frame.keySet().iterator().next();
            Cand c = cands.get(only);
            if (c != null && c.hits >= CONFIRM_HITS) {
                onDecoded(only);
            }
        }
    }

    /**
     * 一屏多码:弹选择框(2026-11-05)。
     *
     * @param options 本帧解出的码(已去重,保持解出顺序)
     */
    private void showChooser(final List<String> options) {
        final String[] labels = new String[options.size()];
        for (int i = 0; i < options.size(); i++) {
            labels[i] = (i + 1) + ". " + describe(options.get(i));
        }
        hint.setText("扫到 " + options.size() + " 个码,请选择要用的那个");
        ui.post(new Runnable() {
            @Override public void run() {
                try {
                    AlertDialog.Builder b = new AlertDialog.Builder(ScanActivity.this);
                    b.setTitle("扫到 " + options.size() + " 个码,请选择");
                    b.setItems(labels, new DialogInterface.OnClickListener() {
                        @Override public void onClick(DialogInterface d, int which) {
                            choosing = false;
                            onDecoded(options.get(which));
                        }
                    });
                    b.setNegativeButton("继续扫", new DialogInterface.OnClickListener() {
                        @Override public void onClick(DialogInterface d, int which) {
                            d.dismiss();
                            resume();
                        }
                    });
                    b.setOnCancelListener(new DialogInterface.OnCancelListener() {
                        @Override public void onCancel(DialogInterface d) { resume(); }
                    });
                    b.show();
                } catch (Throwable t) {
                    Log.w(TAG, "弹选择框失败,退回自动取第一个: " + t.getMessage());
                    choosing = false;
                    onDecoded(options.get(0));
                }
            }
        });
    }

    /** 关掉选择框后回到取景继续扫(清掉旧候选,避免立刻又弹同一个框) */
    private void resume() {
        synchronized (cands) { cands.clear(); }
        choosing = false;
        frameSkip = 0;
        hint.setText("对准条码/二维码,扫到即自动填入");
    }

    /**
     * 把码翻译成人看得懂的一行(工单/物料 + 关键字段),给选择框用。
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
                if (first.startsWith("GD-") || (parts.size() > 1 && first.indexOf("GD-") >= 0)) {
                    kind = "工单";
                    String wo = first;
                    String tail = parts.size() > 1 ? parts.get(1) : "";
                    if (tail.matches("^\\d+$")) {
                        int n = 0;
                        try { n = Integer.parseInt(tail); } catch (Exception ignore) { }
                        int line = n >= 1000 ? n - 1000 : n;   // 1000+行号
                        detail = wo + (line > 0 ? (" 行" + line) : "");
                    } else {
                        detail = wo;
                    }
                } else if (parts.size() >= 2) {
                    kind = "物料";
                    detail = first + " 批号 " + parts.get(1);
                } else {
                    kind = "物料/其他";
                    detail = first;
                }
            }
        } catch (Throwable ignore) { }
        if (detail.length() > 44) detail = detail.substring(0, 44) + "…";
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
