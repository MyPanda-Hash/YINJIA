package com.yinjia.mes.app;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.ImageFormat;
import android.graphics.Matrix;
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
import com.google.zxing.ResultPoint;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.multi.GenericMultipleBarcodeReader;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 原生扫码页(2026-10-20 建;2026-11-05 三轮迭代)。
 *
 * 为什么不用网页里的 getUserMedia:
 *   安卓 WebView 把 http:// 视为**不安全上下文**,`navigator.mediaDevices` 直接不存在
 *   (和 Chrome 一个规则)。工厂内网是 http://IP:8090,没证书 ⇒ 网页调不起摄像头。
 *   所以扫码放在原生层做,解出字符串再回传给网页。
 *
 * 支持:QR / CODE_128 / CODE_39 / CODE_93 / EAN_13 / EAN_8 / ITF / DATA_MATRIX。
 * 交互:对准即扫;扫中震动;点屏幕切换手电;返回键取消。
 *
 * <h3>迭代史(都是现场反馈推着改的)</h3>
 * <ol>
 *   <li><b>2026-11-05 一轮</b>「手机扫码遇到多码不能选择」⇒ 一帧找多个 + 弹选择框;</li>
 *   <li><b>二轮</b>「9 个码只弹了 7 个(扫到部分码就弹窗);码和信息很难对应是哪一条」⇒
 *       ① 模态框改成**常驻面板**(解码不停,边扫边追加);② 每行补**原始码全文**;</li>
 *   <li><b>三轮(本轮)</b>「下边的提示框能不能按图片里的顺序对应」⇒ 列表改为按**屏幕上
 *       从上到下、从左到右**排序(用 ZXing 给出的条码中心点),不再按"谁先解出来";
 *       另加**多选模式**(生成工单领料单页用):勾选多张工单,一次回去批量生单。</li>
 * </ol>
 *
 * <h3>排序怎么还原纸面顺序</h3>
 * 竖屏 + {@code setDisplayOrientation(90)}:缓冲区像素 (x,y) 显示到屏幕上是
 * (screenX, screenY) = (H-1-y, x)。所以"屏幕行"随 buffer **x 增大**而往下,
 * "屏幕列"随 buffer **y 增大**而往左 ⇒ 排序键 = (x 升序, y 降序)。
 * 这样手机对着纸上那一列码时,列表顺序 = 纸上序号顺序(1、2、3…)。
 */
public class ScanActivity extends Activity implements SurfaceHolder.Callback {

    private static final String TAG = "YjScan";

    /** 单码场景:同一个码连续命中多少次才自动回传(≈0.3 秒) */
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

    /** 多码面板 */
    private View multiPanel;
    private TextView multiTitle;
    private LinearLayout multiList;
    private ScrollView multiScroll;
    private Button btnAll, btnPick, btnRescan;

    /** 多选模式(生成工单领料/退料单页):勾选多张工单,一次回传多个码 */
    private boolean multiMode = false;

    /** 拍照模式(2026-11-09):不扫码,用同一台相机拍一张照片回传(实验室记录手机登记的逐行附件) */
    private boolean photoMode = false;
    /** 正在保存照片:takePicture 回调回来前禁止连点 */
    private boolean taking = false;
    private Button shootBtn;

    private final MultiFormatReader reader = new MultiFormatReader();
    private GenericMultipleBarcodeReader multi;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private int frameSkip = 0;

    /** 候选:码文本 → {命中数, 码型, 中心点(缓冲区坐标)} */
    private final Map<String, Cand> cands = new LinkedHashMap<String, Cand>();
    /** 已勾选的码(仅多选模式用;默认全选) */
    private final Set<String> picked = new HashSet<String>();
    private boolean panelShown = false;

    private static class Cand {
        int hits;
        BarcodeFormat format;
        float px;
        float py;
        Cand(BarcodeFormat f) { this.format = f; }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        setContentView(com.yinjia.mes.app.R.layout.activity_scan);

        multiMode = getIntent() != null && getIntent().getBooleanExtra("multi", false);
        // 2026-11-09 第四轮:**拍照模式**。用户口径「点击拍照上传附件,并没有调用摄像机,
        //   摄像机就同一沿用之前的就行」—— 网页里的 <input type=file capture> 在 WebView 里
        //   根本调不起相机(壳没实现 onShowFileChooser;且 file:// 页面拿不到相机),
        //   所以复用本页已经调好的 Camera 预览/对焦/手电,只是把"解码"换成"拍一张"。
        photoMode = getIntent() != null && getIntent().getBooleanExtra("photo", false);

        surface = (SurfaceView) findViewById(com.yinjia.mes.app.R.id.preview);
        hint = (TextView) findViewById(com.yinjia.mes.app.R.id.hint);
        multiPanel = findViewById(com.yinjia.mes.app.R.id.multiPanel);
        multiTitle = (TextView) findViewById(com.yinjia.mes.app.R.id.multiTitle);
        multiList = (LinearLayout) findViewById(com.yinjia.mes.app.R.id.multiList);
        multiScroll = (ScrollView) findViewById(com.yinjia.mes.app.R.id.multiScroll);
        btnAll = (Button) findViewById(com.yinjia.mes.app.R.id.multiAll);
        btnPick = (Button) findViewById(com.yinjia.mes.app.R.id.multiPick);
        btnRescan = (Button) findViewById(com.yinjia.mes.app.R.id.multiRescan);

        btnAll.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { toggleAll(); }
        });
        btnPick.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { returnPicked(); }
        });
        btnRescan.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { restartScan(); }
        });
        Button cancel = (Button) findViewById(com.yinjia.mes.app.R.id.multiCancel);
        cancel.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { setResult(RESULT_CANCELED); finish(); }
        });

        // 拍照模式:露出底部「拍照」按钮,隐藏多码面板;点取景框仍是手电开关
        shootBtn = (Button) findViewById(com.yinjia.mes.app.R.id.btn_shoot);
        if (shootBtn != null) {
            shootBtn.setVisibility(photoMode ? View.VISIBLE : View.GONE);
            shootBtn.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) { takePhoto(); }
            });
        }

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
        multi = new GenericMultipleBarcodeReader(reader);

        surface.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { toggleTorch(); }
        });

        hint.setText(photoMode
                ? "对准要拍的内容;点底部「拍照」保存那张照片,返回键取消"
                : (multiMode
                    ? "对准整张任务单:可一次扫多个码,勾选后点『确定』"
                    : "对准二维码 / 条形码;点屏幕开关手电;返回键取消"));
    }

    /**
     * 拍照模式的核心:用**同一个 Camera** 拍一张,压到长边 ≤1280 / JPEG 80,存进 App 缓存目录,
     * 把文件路径回给 MainActivity 转 base64 → 网页(`window.__yjPhotoResult`)。
     *
     * 为什么不把 byte[] 塞 Intent:Intent extra 有 ~1MB 事务限制,原图几 MB 会直接
     * TransactionTooLargeException;走缓存文件最稳。
     */
    private void takePhoto() {
        if (camera == null) { hint.setText("相机没准备好,请稍后重试"); return; }
        if (taking) return;
        taking = true;
        if (shootBtn != null) shootBtn.setEnabled(false);
        hint.setText("正在保存照片…");
        try {
            camera.takePicture(null, null, new Camera.PictureCallback() {
                @Override public void onPictureTaken(byte[] raw, Camera cam) {
                    String path = null;
                    try {
                        path = compressToCache(raw);
                    } catch (Throwable t) {
                        Log.e(TAG, "保存照片失败: " + t.getMessage());
                    }
                    taking = false;
                    if (path == null) {
                        if (shootBtn != null) shootBtn.setEnabled(true);
                        hint.setText("拍照失败,请重试");
                        try { if (cam != null) cam.startPreview(); } catch (Exception ignore) { }
                        return;
                    }
                    Intent out = new Intent();
                    out.putExtra("photoPath", path);
                    setResult(RESULT_OK, out);
                    finish();
                }
            });
        } catch (Exception e) {
            taking = false;
            if (shootBtn != null) shootBtn.setEnabled(true);
            hint.setText("拍照失败:" + e.getMessage());
            Log.e(TAG, "takePicture 异常: " + e.getMessage());
        }
    }

    /** 原图 JPEG → 缩到长边 ≤1280 → JPEG 80 → 缓存文件;失败返回 null */
    private String compressToCache(byte[] raw) throws Exception {
        Bitmap bmp = BitmapFactory.decodeByteArray(raw, 0, raw.length);
        if (bmp == null) return null;
        int w = bmp.getWidth(), h = bmp.getHeight();
        int max = Math.max(w, h);
        float k = max > 1280 ? 1280f / max : 1f;
        Bitmap outBmp = bmp;
        if (k < 1f) {
            Matrix m = new Matrix();
            m.postScale(k, k);
            outBmp = Bitmap.createBitmap(bmp, 0, 0, w, h, m, true);
        }
        java.io.File f = new java.io.File(getCacheDir(), "yj_photo_" + System.currentTimeMillis() + ".jpg");
        java.io.FileOutputStream fos = new java.io.FileOutputStream(f);
        try {
            outBmp.compress(Bitmap.CompressFormat.JPEG, 80, fos);
            fos.flush();
        } finally {
            try { fos.close(); } catch (Exception ignore) { }
        }
        if (outBmp != bmp) bmp.recycle();
        return f.getAbsolutePath();
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
                    // 面板打开时也**继续解码**(2026-11-05 修:旧版暂停导致"9 个只收到 7 个")
                    // 拍照模式只取景不解码(省电;这一页压根不做识别)
                    if (photoMode) return;
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

    /** 解一帧:一次找多个码,结果累积;≥2 个就进面板(不暂停),单码且面板没开就自动回传 */
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

        boolean added = false;
        synchronized (cands) {
            for (Result r : results) {
                if (r == null) continue;
                String text = r.getText();
                if (text == null) continue;
                text = text.trim();
                if (text.length() == 0) continue;

                Cand c = cands.get(text);
                if (c == null) {
                    c = new Cand(r.getBarcodeFormat());
                    cands.put(text, c);
                    picked.add(text);           // 多选模式默认全选
                    added = true;
                }
                c.format = r.getBarcodeFormat();
                c.hits++;
                // 记中心点(缓冲区坐标),用于"按屏幕顺序"排序
                float[] ctr = centerOf(r);
                if (ctr != null) { c.px = ctr[0]; c.py = ctr[1]; }
            }

            if (cands.size() >= (multiMode ? 1 : 2)) {
                if (!panelShown) { panelShown = true; vibrate(80); }
                if (added) refreshPanel(true);   // 新码:滚到最新一条
                return;
            }
            if (!panelShown) {
                String only = cands.keySet().iterator().next();
                Cand c = cands.get(only);
                if (c != null && c.hits >= CONFIRM_HITS) onDecoded(only);
            }
        }
    }

    /** 码在图像里的中心点;取不到返回 null */
    private static float[] centerOf(Result r) {
        try {
            ResultPoint[] pts = r.getResultPoints();
            if (pts == null || pts.length == 0) return null;
            float sx = 0, sy = 0;
            int n = 0;
            for (ResultPoint p : pts) {
                if (p == null) continue;
                sx += p.getX();
                sy += p.getY();
                n++;
            }
            if (n == 0) return null;
            return new float[] { sx / n, sy / n };
        } catch (Throwable t) {
            return null;
        }
    }

    /**
     * 当前候选按**屏幕顺序**排:上→下、左→右(2026-11-05 第三轮用户口径「按图片里的顺序对应」)。
     *
     * <p>竖屏 + displayOrientation(90):buffer(x,y) → screenX = H-1-y、screenY = x,
     * 所以屏幕行随 **x 增大**,屏幕列随 **y 增大而变左** ⇒ 排序键 (x↑, y↓)。
     * 这样手机对着纸上那一列码,列表顺序与纸上序号一致。
     */
    private List<String> sortedCodes() {
        List<String> list = new ArrayList<String>(cands.keySet());
        Collections.sort(list, new Comparator<String>() {
            @Override public int compare(String a, String b) {
                Cand ca = cands.get(a), cb = cands.get(b);
                float ax = ca == null ? 0 : ca.px, ay = ca == null ? 0 : ca.py;
                float bx = cb == null ? 0 : cb.px, by = cb == null ? 0 : cb.py;
                if (Math.abs(ax - bx) > 24f) return ax < bx ? -1 : 1;   // 不同行:上→下
                if (Math.abs(ay - by) > 8f) return ay > by ? -1 : 1;    // 同一行:右→左(y 大 = 屏左)
                return a.compareTo(b);
            }
        });
        return list;
    }

    /**
     * 把当前候选刷进面板(边扫边加行)。
     *
     * @param scrollToEnd true = 有新码进来,滚到最新一行;false = 只是勾选/取消勾选,
     *                    **保持用户当前看到的位置**(2026-11-05 用户报「取消勾选后会自动下跳」:
     *                    旧实现每次重排都 {@code fullScroll(FOCUS_DOWN)},所以点一下就跳到底)。
     */
    private void refreshPanel(final boolean scrollToEnd) {
        final List<String> snapshot = sortedCodes();
        final int keepY = multiScroll.getScrollY();
        ui.post(new Runnable() {
            @Override public void run() {
                multiPanel.setVisibility(View.VISIBLE);
                // 2026-11-05 用户报「提示框挡住按钮了」:hint 与面板都贴底,且 hint 在 later 绘制 ⇒ 盖住按钮。
                // 面板自己有标题,底部提示这时没必要显示,直接藏掉。
                hint.setVisibility(View.GONE);
                int n = snapshot.size();
                if (multiMode) {
                    multiTitle.setText("已识别 " + n + " 个码 · 已选 " + picked.size() + " 个(默认全选,点一行可取消)");
                    hint.setText("勾选要生成工单领料单的工单,点右下『确定』");
                } else {
                    multiTitle.setText("已识别 " + n + " 个码 · 按纸面顺序排列,点一条选用");
                    hint.setText("可以在下面点选,也可以继续对准让更多码进来");
                }
                btnAll.setVisibility(multiMode ? View.VISIBLE : View.GONE);
                btnPick.setVisibility(multiMode ? View.VISIBLE : View.GONE);
                btnPick.setText("确定(" + picked.size() + ")");
                btnAll.setText(picked.size() >= n ? "全不选" : "全选");

                multiList.removeAllViews();
                for (int i = 0; i < n; i++) {
                    final String code = snapshot.get(i);
                    final boolean on = picked.contains(code);
                    LinearLayout row = new LinearLayout(ScanActivity.this);
                    row.setOrientation(LinearLayout.HORIZONTAL);
                    row.setPadding(dp(12), dp(10), dp(12), dp(10));
                    row.setBackgroundColor(Color.parseColor(on ? "#3322AA55" : "#1AFFFFFF"));

                    TextView mark = new TextView(ScanActivity.this);
                    mark.setText(multiMode ? (on ? "☑" : "☐") : (i + 1) + ".");
                    mark.setTextColor(Color.WHITE);
                    mark.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
                    mark.setPadding(0, 0, dp(8), 0);
                    row.addView(mark);

                    LinearLayout col = new LinearLayout(ScanActivity.this);
                    col.setOrientation(LinearLayout.VERTICAL);

                    TextView t1 = new TextView(ScanActivity.this);
                    // 序号用纸面顺序(=屏幕顺序);后面跟预判类型 + 关键字段
                    t1.setText((i + 1) + ". " + describe(code));
                    t1.setTextColor(Color.WHITE);
                    t1.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
                    col.addView(t1);

                    TextView t2 = new TextView(ScanActivity.this);
                    t2.setText(code);   // 原始码全文,便于和纸上「单据编号」核对
                    t2.setTextColor(Color.parseColor("#B3FFFFFF"));
                    t2.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
                    col.addView(t2);

                    row.addView(col);
                    row.setOnClickListener(new View.OnClickListener() {
                        @Override public void onClick(View v) {
                            if (multiMode) {
                                if (picked.contains(code)) picked.remove(code); else picked.add(code);
                                refreshPanel(false);
                            } else {
                                onDecoded(code);
                            }
                        }
                    });
                    multiList.addView(row);

                    View divider = new View(ScanActivity.this);
                    divider.setLayoutParams(new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1)));
                    divider.setBackgroundColor(Color.parseColor("#33FFFFFF"));
                    multiList.addView(divider);
                }
                multiScroll.post(new Runnable() {
                    @Override public void run() {
                        if (scrollToEnd) {
                            multiScroll.fullScroll(View.FOCUS_DOWN);          // 新码进来:跟到最新一条
                        } else {
                            multiScroll.scrollTo(0, keepY);                   // 只是勾选:回到原位置,不跳
                        }
                    }
                });
            }
        });
    }

    /** 全选 / 全不选 */
    private void toggleAll() {
        synchronized (cands) {
            if (picked.size() >= cands.size()) picked.clear();
            else picked.addAll(cands.keySet());
        }
        refreshPanel(false);
    }

    /** 多选模式:把勾选的码一次回传(生成工单领料/退料单页据此批量入队) */
    private void returnPicked() {
        List<String> out = new ArrayList<String>();
        synchronized (cands) {
            for (String c : sortedCodes()) if (picked.contains(c)) out.add(c);
        }
        if (out.isEmpty()) {
            vibrate(60);
            multiTitle.setText("还没勾选任何码:点一行勾上,或点『全选』");
            return;
        }
        found = true;
        vibrate(60);
        Intent data = new Intent();
        data.putStringArrayListExtra("codes", new ArrayList<String>(out));
        setResult(RESULT_OK, data);
        finish();
    }

    /** 清空候选、收起面板,继续扫 */
    private void restartScan() {
        synchronized (cands) {
            cands.clear();
            picked.clear();
        }
        panelShown = false;
        multiPanel.setVisibility(View.GONE);
        hint.setVisibility(View.VISIBLE);
        multiList.removeAllViews();
        frameSkip = 0;
        hint.setText(multiMode
                ? "对准整张任务单:可一次扫多个码,勾选后点『确定』"
                : "对准二维码 / 条形码;点屏幕开关手电;返回键取消");
    }

    private int dp(int v) {
        return (int) (v * getResources().getDisplayMetrics().density + 0.5f);
    }

    /** 码 → 人看得懂的一行(工单/物料 + 关键字段),口径与网页 scanCode.js 一致 */
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

    /** 单码模式:回传这一个码 */
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
