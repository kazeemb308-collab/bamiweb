package com.bamiweb.twa;

import android.os.Bundle;
import android.net.Uri;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Uri uri = Uri.parse("https://bamiweb.vercel.app");
        CustomTabsIntent.Builder builder = new CustomTabsIntent.Builder();
        builder.setShowTitle(true);
        builder.setUrlBarHidingEnabled(true);
        CustomTabsIntent intent = builder.build();
        intent.launchUrl(this, uri);
        finish();
    }
}
