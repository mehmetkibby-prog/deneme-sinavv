package com.caglar.muziksinavi;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;

@CapacitorPlugin(name = "PdfSaver")
public class PdfSaverPlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        String base64 = call.getString("base64");
        if (base64 == null || base64.isEmpty()) {
            call.reject("PDF verisi boş.");
            return;
        }
        try {
            byte[] decoded = Base64.decode(base64, Base64.DEFAULT);
            boolean hasPdfHeader = decoded.length >= 5
                    && decoded[0] == '%'
                    && decoded[1] == 'P'
                    && decoded[2] == 'D'
                    && decoded[3] == 'F'
                    && decoded[4] == '-';
            if (decoded.length < 5000 || !hasPdfHeader) {
                call.reject("PDF içeriği geçersiz veya boş; dosya kaydedilmedi.");
                return;
            }
        } catch (IllegalArgumentException error) {
            call.reject("PDF verisi çözülemedi.", error);
            return;
        }

        String requestedName = call.getString("filename", "calisma-ozeti.pdf");
        String safeName = requestedName.replaceAll("[\\\\/:*?\"<>|]", "-");
        if (!safeName.toLowerCase().endsWith(".pdf")) {
            safeName += ".pdf";
        }

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/pdf");
        intent.putExtra(Intent.EXTRA_TITLE, safeName);
        startActivityForResult(call, intent, "saveResult");
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        JSObject response = new JSObject();
        if (call == null) {
            return;
        }
        if (result.getResultCode() != Activity.RESULT_OK
                || result.getData() == null
                || result.getData().getData() == null) {
            response.put("saved", false);
            call.resolve(response);
            return;
        }

        Uri destination = result.getData().getData();
        String base64 = call.getString("base64");
        try (OutputStream output = getContext().getContentResolver().openOutputStream(destination)) {
            if (output == null) {
                call.reject("Seçilen dosya açılamadı.");
                return;
            }
            output.write(Base64.decode(base64, Base64.DEFAULT));
            output.flush();
            response.put("saved", true);
            response.put("bytes", Base64.decode(base64, Base64.DEFAULT).length);
            response.put("uri", destination.toString());
            call.resolve(response);
        } catch (Exception error) {
            call.reject("PDF kaydedilemedi: " + error.getMessage(), error);
        }
    }
}
