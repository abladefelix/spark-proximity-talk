package com.skanaround;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.FirebaseApp;

/**
 * Reports whether Firebase was configured in this exact Android binary.
 * PushNotifications.register() throws a fatal native exception when it is not,
 * so the web layer must check this before asking the push plugin to register.
 */
@CapacitorPlugin(name = "FirebaseStatus")
public class FirebaseStatusPlugin extends Plugin {
    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("configured", !FirebaseApp.getApps(getContext()).isEmpty());
        call.resolve(result);
    }
}