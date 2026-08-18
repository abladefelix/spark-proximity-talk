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

    private View overlay;
    private TextView statusLabel;
    private Button retryButton;
    private ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback networkCallback;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        connectivityManager = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(Network network) {
                runOnUiThread(() -> hideOffline(true));
            }

            @Override
            public void onLost(Network network) {
                runOnUiThread(() -> {
                    if (!isOnline()) showOffline();
                });
            }
        };
        connectivityManager.registerNetworkCallback(new NetworkRequest.Builder().build(), networkCallback);

        if (!isOnline()) showOffline();
    }

    @Override
    public void onDestroy() {
        if (connectivityManager != null && networkCallback != null) {
            try {
                connectivityManager.unregisterNetworkCallback(networkCallback);
            } catch (IllegalArgumentException ignored) {
            }
        }
        super.onDestroy();
    }

    private boolean isOnline() {
        Network network = connectivityManager.getActiveNetwork();
        if (network == null) return false;
        NetworkCapabilities caps = connectivityManager.getNetworkCapabilities(network);
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
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
        body.setText("SkanAround can't reach the network.\nTurn off airplane mode or reconnect to Wi-Fi.");
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
        if (isOnline()) {
            hideOffline(true);
            return;
        }
        if (statusLabel != null) statusLabel.animate().alpha(1f).setDuration(200).start();
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
        if (reload && getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().reload();
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
