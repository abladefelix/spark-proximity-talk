package app.skanaround.mobile;

import android.animation.ObjectAnimator;
import android.animation.ValueAnimator;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.getcapacitor.BridgeActivity;

/**
 * The web UI is served from the live site, so with no connection the web view has
 * nothing to render. Show a native "no signal" screen instead of a blank page and
 * reload once the network comes back.
 */
public class MainActivity extends BridgeActivity {

    private static final int ACCENT = Color.parseColor("#FAC259");
    private static final int BACKDROP = Color.parseColor("#0E0C0B");

    /** Must match `server.url` in capacitor.config.ts. */
    private static final String SERVER_URL = "https://skanaround.bytenetdigital.com";

    private View overlay;
    private View splash;
    private TextView statusLabel;
    private Button retryButton;
    private ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback networkCallback;
    private final android.os.Handler handler = new android.os.Handler(android.os.Looper.getMainLooper());

    private final java.util.concurrent.ExecutorService probeExecutor =
            java.util.concurrent.Executors.newSingleThreadExecutor();
    private boolean probing = false;
    private final Runnable poll = new Runnable() {
        @Override
        public void run() {
            evaluateConnectivity();
            handler.postDelayed(this, 8000);
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        connectivityManager = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(Network network) {
                runOnUiThread(() -> evaluateConnectivity());
            }

            @Override
            public void onCapabilitiesChanged(Network network, NetworkCapabilities caps) {
                runOnUiThread(() -> evaluateConnectivity());
            }

            @Override
            public void onLost(Network network) {
                runOnUiThread(() -> evaluateConnectivity());
            }
        };
        connectivityManager.registerNetworkCallback(new NetworkRequest.Builder().build(), networkCallback);

        if (!hasNetwork()) {
            showOffline();
        } else {
            showSplash();
            evaluateConnectivity();
        }
        handler.postDelayed(poll, 8000);
    }

    /**
     * A connected interface is not the same as working internet — a Wi-Fi network
     * with no upstream still reports a network. Confirm with a real request.
     */
    private void evaluateConnectivity() {
        if (probing) return;
        if (!hasNetwork()) {
            applyConnectivity(false);
            return;
        }
        probing = true;
        probeExecutor.execute(() -> {
            boolean ok = probeReachable();
            runOnUiThread(() -> {
                probing = false;
                applyConnectivity(ok);
            });
        });
    }

    private boolean probeReachable() {
        java.net.HttpURLConnection conn = null;
        try {
            conn = (java.net.HttpURLConnection) new java.net.URL(SERVER_URL).openConnection();
            conn.setRequestMethod("HEAD");
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);
            conn.setUseCaches(false);
            return conn.getResponseCode() > 0;
        } catch (Exception e) {
            return false;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private void applyConnectivity(boolean online) {
        if (online) {
            hideOffline(overlay != null);
        } else {
            hideSplash();
            showOffline();
        }
    }


    /**
     * Reload if a document is present, otherwise start a fresh load — a web view
     * whose first load failed while offline has nothing to reload and stays white.
     */
    private void reloadWeb() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        android.webkit.WebView webView = getBridge().getWebView();
        String current = webView.getUrl();
        if (current == null || current.isEmpty() || "about:blank".equals(current)) {
            webView.loadUrl(SERVER_URL);
        } else {
            webView.reload();
        }
        handler.postDelayed(() -> {
            if (getBridge() != null && getBridge().getWebView() != null
                    && getBridge().getWebView().getProgress() < 10) {
                getBridge().getWebView().loadUrl(SERVER_URL);
            }
        }, 4000);
    }

    /** Branded loading screen shown until the web app has painted. */
    private void showSplash() {
        if (splash != null) return;

        LinearLayout container = new LinearLayout(this);
        container.setOrientation(LinearLayout.VERTICAL);
        container.setGravity(Gravity.CENTER);
        container.setBackgroundColor(BACKDROP);
        container.setClickable(true);

        FrameLayout radar = new FrameLayout(this);
        radar.addView(ring(200, 30));
        radar.addView(ring(140, 46));
        radar.addView(ring(84, 62));

        View dot = new View(this);
        GradientDrawable dotShape = new GradientDrawable();
        dotShape.setShape(GradientDrawable.OVAL);
        dotShape.setColor(ACCENT);
        dot.setBackground(dotShape);
        FrameLayout.LayoutParams dotLp = new FrameLayout.LayoutParams(dp(16), dp(16));
        dotLp.gravity = Gravity.CENTER;
        radar.addView(dot, dotLp);

        ValueAnimator pulse = ValueAnimator.ofFloat(1f, 1.6f);
        pulse.setDuration(1200);
        pulse.setRepeatCount(ValueAnimator.INFINITE);
        pulse.setRepeatMode(ValueAnimator.REVERSE);
        pulse.setInterpolator(new AccelerateDecelerateInterpolator());
        pulse.addUpdateListener(a -> {
            float v = (float) a.getAnimatedValue();
            dot.setScaleX(v);
            dot.setScaleY(v);
            dot.setAlpha(1f - (v - 1f) * 0.7f);
        });
        pulse.start();

        LinearLayout.LayoutParams radarLp = new LinearLayout.LayoutParams(dp(200), dp(200));
        radarLp.bottomMargin = dp(28);
        container.addView(radar, radarLp);

        TextView wordmark = new TextView(this);
        wordmark.setText("SKANAROUND");
        wordmark.setTextColor(Color.WHITE);
        wordmark.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        wordmark.setLetterSpacing(0.3f);
        wordmark.setGravity(Gravity.CENTER);
        container.addView(wordmark);

        addContentView(container, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        splash = container;

        pollSplash(0);
    }

    private void pollSplash(final int elapsedMs) {
        handler.postDelayed(() -> {
            if (splash == null) return;
            boolean ready = getBridge() != null && getBridge().getWebView() != null
                    && getBridge().getWebView().getProgress() >= 90;
            if (ready || elapsedMs >= 8000) {
                hideSplash();
            } else {
                pollSplash(elapsedMs + 250);
            }
        }, 250);
    }

    private void hideSplash() {
        if (splash == null) return;
        final View view = splash;
        splash = null;
        view.animate().alpha(0f).setDuration(300).withEndAction(() -> {
            ViewGroup parent = (ViewGroup) view.getParent();
            if (parent != null) parent.removeView(view);
        }).start();
    }


    @Override
    public void onResume() {
        super.onResume();
        evaluateConnectivity();
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(poll);
        probeExecutor.shutdownNow();
        if (connectivityManager != null && networkCallback != null) {
            try {
                connectivityManager.unregisterNetworkCallback(networkCallback);
            } catch (IllegalArgumentException ignored) {
            }
        }
        super.onDestroy();
    }

    /** Interface-level check only; real reachability is confirmed by probeReachable(). */
    private boolean hasNetwork() {
        Network network = connectivityManager.getActiveNetwork();
        if (network == null) return false;
        NetworkCapabilities caps = connectivityManager.getNetworkCapabilities(network);
        if (caps == null) return false;
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
    }


    private View ring(int sizeDp, int alpha) {
        View ring = new View(this);
        GradientDrawable shape = new GradientDrawable();
        shape.setShape(GradientDrawable.OVAL);
        shape.setStroke(dp(1), Color.argb(alpha, 250, 194, 89));
        ring.setBackground(shape);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(dp(sizeDp), dp(sizeDp));
        lp.gravity = Gravity.CENTER;
        ring.setLayoutParams(lp);
        return ring;
    }

    private void showOffline() {
        if (overlay != null) return;

        LinearLayout container = new LinearLayout(this);
        container.setOrientation(LinearLayout.VERTICAL);
        container.setGravity(Gravity.CENTER);
        container.setBackgroundColor(BACKDROP);
        container.setClickable(true);
        container.setPadding(dp(32), dp(32), dp(32), dp(32));

        // Radar mark: concentric rings with a breathing centre dot.
        FrameLayout radar = new FrameLayout(this);
        radar.addView(ring(220, 28));
        radar.addView(ring(160, 44));
        radar.addView(ring(100, 60));

        View dot = new View(this);
        GradientDrawable dotShape = new GradientDrawable();
        dotShape.setShape(GradientDrawable.OVAL);
        dotShape.setColor(ACCENT);
        dot.setBackground(dotShape);
        FrameLayout.LayoutParams dotLp = new FrameLayout.LayoutParams(dp(18), dp(18));
        dotLp.gravity = Gravity.CENTER;
        radar.addView(dot, dotLp);

        ValueAnimator pulse = ValueAnimator.ofFloat(1f, 1.5f);
        pulse.setDuration(1400);
        pulse.setRepeatCount(ValueAnimator.INFINITE);
        pulse.setRepeatMode(ValueAnimator.REVERSE);
        pulse.setInterpolator(new AccelerateDecelerateInterpolator());
        pulse.addUpdateListener(a -> {
            float v = (float) a.getAnimatedValue();
            dot.setScaleX(v);
            dot.setScaleY(v);
            dot.setAlpha(1f - (v - 1f));
        });
        pulse.start();

        LinearLayout.LayoutParams radarLp = new LinearLayout.LayoutParams(dp(220), dp(220));
        radarLp.bottomMargin = dp(44);
        container.addView(radar, radarLp);

        TextView kicker = new TextView(this);
        kicker.setText("NO SIGNAL");
        kicker.setTextColor(ACCENT);
        kicker.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        kicker.setLetterSpacing(0.28f);
        kicker.setGravity(Gravity.CENTER);
        kicker.setPadding(0, 0, 0, dp(12));

        TextView title = new TextView(this);
        title.setText("You're off the radar");
        title.setTextColor(Color.WHITE);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 24);
        title.setGravity(Gravity.CENTER);

        TextView body = new TextView(this);
        body.setText("SKANAROUND can't reach the internet.\nCheck your Wi-Fi or mobile data and try again.");
        body.setTextColor(Color.parseColor("#85FFFFFF"));
        body.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        body.setGravity(Gravity.CENTER);
        body.setPadding(0, dp(8), 0, dp(18));

        statusLabel = new TextView(this);
        statusLabel.setText("Still no connection");
        statusLabel.setTextColor(Color.parseColor("#FF8C72"));
        statusLabel.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        statusLabel.setGravity(Gravity.CENTER);
        statusLabel.setAlpha(0f);
        statusLabel.setPadding(0, 0, 0, dp(14));

        retryButton = new Button(this);
        retryButton.setText("Try again");
        retryButton.setAllCaps(false);
        retryButton.setTextColor(Color.parseColor("#17150F"));
        retryButton.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        GradientDrawable pill = new GradientDrawable();
        pill.setShape(GradientDrawable.RECTANGLE);
        pill.setCornerRadius(dp(26));
        pill.setColor(ACCENT);
        retryButton.setBackground(pill);
        retryButton.setOnClickListener(v -> onRetry());

        container.addView(kicker);
        container.addView(title);
        container.addView(body);
        container.addView(statusLabel);
        LinearLayout.LayoutParams btnLp = new LinearLayout.LayoutParams(dp(200), dp(52));
        container.addView(retryButton, btnLp);

        addContentView(container, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        overlay = container;
    }

    /**
     * Only dismiss when the network is actually back — reloading while still
     * offline leaves a blank web view behind the dismissed overlay.
     */
    private void onRetry() {
        if (probing) return;
        if (statusLabel != null) {
            statusLabel.setText("Checking connection\u2026");
            statusLabel.setTextColor(Color.parseColor("#99FFFFFF"));
            statusLabel.animate().alpha(1f).setDuration(200).start();
        }
        if (!hasNetwork()) {
            failRetry();
            return;
        }
        probing = true;
        if (retryButton != null) retryButton.setEnabled(false);
        probeExecutor.execute(() -> {
            boolean ok = probeReachable();
            runOnUiThread(() -> {
                probing = false;
                if (retryButton != null) retryButton.setEnabled(true);
                if (ok) {
                    hideOffline(true);
                } else {
                    failRetry();
                }
            });
        });
    }

    private void failRetry() {
        if (statusLabel != null) {
            statusLabel.setText("Still no connection");
            statusLabel.setTextColor(Color.parseColor("#FF8C72"));
            statusLabel.animate().alpha(1f).setDuration(200).start();
        }
        if (retryButton != null) {
            ObjectAnimator shake = ObjectAnimator.ofFloat(
                    retryButton, "translationX", 0f, -dp(8), dp(8), -dp(6), dp(6), 0f);
            shake.setDuration(350);
            shake.start();
        }
    }

    private void hideOffline(boolean reload) {
        if (overlay == null) return;
        ViewGroup parent = (ViewGroup) overlay.getParent();
        if (parent != null) parent.removeView(overlay);
        overlay = null;
        statusLabel = null;
        retryButton = null;
        if (reload) {
            showSplash();
            reloadWeb();
        }

    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
