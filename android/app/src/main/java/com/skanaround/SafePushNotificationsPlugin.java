package com.skanaround;

import android.util.Log;

import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.google.firebase.FirebaseApp;

/**
 * Native safety boundary for push registration. The web UI is loaded from the
 * live site, so an older deployed bundle may still call register() before the
 * JavaScript Firebase check exists. Capacitor's stock plugin throws a fatal
 * IllegalStateException when this binary has no google-services configuration.
 */
@CapacitorPlugin(
        name = "PushNotifications",
        permissions = @Permission(
                strings = { android.Manifest.permission.POST_NOTIFICATIONS },
                alias = "receive"
        )
)
public class SafePushNotificationsPlugin extends PushNotificationsPlugin {
    private static final String TAG = "SKAN_DEBUG";

    private boolean firebaseConfigured() {
        return !FirebaseApp.getApps(getContext()).isEmpty();
    }

    @Override
    @PluginMethod
    public void register(PluginCall call) {
        if (!firebaseConfigured()) {
            Log.w(TAG, "Push registration skipped: Firebase is not configured in this binary");
            JSObject result = new JSObject();
            result.put("skipped", true);
            result.put("reason", "fcm-not-configured");
            call.resolve(result);
            return;
        }
        super.register(call);
    }

    @Override
    @PluginMethod
    public void unregister(PluginCall call) {
        if (!firebaseConfigured()) {
            Log.w(TAG, "Push unregister skipped: Firebase is not configured in this binary");
            call.resolve();
            return;
        }
        super.unregister(call);
    }
}