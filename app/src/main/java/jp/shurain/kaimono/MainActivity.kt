package jp.shurain.kaimono

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/** アプリ本体：画面は assets/index.html（HTML/JavaScript）で作り、ここは入れ物 */
class MainActivity : Activity() {
    lateinit var web: WebView
    private var pendingRoute: String? = null
    private var pageReady = false
    private var pendingExport: String? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Reminder.channels(this)
        web = WebView(this)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.textZoom = 100
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean {
                val u = req.url
                if (u.scheme == "http" || u.scheme == "https") {
                    openExternal(u.toString())
                    return true
                }
                return false
            }
        }
        web.addJavascriptInterface(Bridge(this), "Native")
        pendingRoute = routeOf(intent)
        setContentView(web)
        web.loadUrl("file:///android_asset/index.html")
        askNotificationOnce()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val r = routeOf(intent) ?: return
        if (pageReady) {
            web.evaluateJavascript("window.__route && window.__route(${JSONObject.quote(r)})", null)
        } else {
            pendingRoute = r
        }
    }

    override fun onResume() {
        super.onResume()
        Reminder.schedule(this)
    }

    /** 通知から開いた／共有から開いたときの行き先 */
    private fun routeOf(i: Intent?): String? {
        if (i == null) return null
        i.getStringExtra("route")?.let { if (it.isNotEmpty()) return it }
        if (i.action == Intent.ACTION_SEND) {
            val text = listOfNotNull(
                i.getStringExtra(Intent.EXTRA_SUBJECT),
                i.getStringExtra(Intent.EXTRA_TEXT)
            ).joinToString("\n")
            if (text.isNotBlank()) return "share:" + text
        }
        return null
    }

    fun takeRoute(): String {
        pageReady = true
        val r = pendingRoute ?: ""
        pendingRoute = null
        return r
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        web.evaluateJavascript("window.__back ? window.__back() : false") { r ->
            if (r != "true") finish()
        }
    }

    fun openExternal(url: String) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        } catch (_: Exception) {
        }
    }

    private fun askNotificationOnce() {
        if (Build.VERSION.SDK_INT < 33) return
        val p = Store.prefs(this)
        if (p.getBoolean("askedNotif", false)) return
        p.edit().putBoolean("askedNotif", true).apply()
        requestNotification()
    }

    fun requestNotification() {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_NOTIF)
        } else if (!Reminder.allowed(this)) {
            // 一度拒否した場合などは設定画面を開く
            try {
                startActivity(Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                    putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, packageName)
                })
            } catch (_: Exception) {
            }
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQ_NOTIF) js("window.__notifChanged && window.__notifChanged()")
    }

    // ---------- バックアップの書き出し・読み込み ----------

    fun startExport(json: String) {
        pendingExport = json
        val name = "kaimono-backup-" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + ".json"
        val i = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "application/json"
            putExtra(Intent.EXTRA_TITLE, name)
        }
        startActivityForResult(i, REQ_EXPORT)
    }

    fun startImport() {
        val i = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
        }
        startActivityForResult(i, REQ_IMPORT)
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        val uri = data?.data
        when (requestCode) {
            REQ_EXPORT -> {
                var ok = false
                val text = pendingExport
                pendingExport = null
                if (resultCode == RESULT_OK && uri != null && text != null) {
                    ok = try {
                        contentResolver.openOutputStream(uri, "wt")?.use { it.write(text.toByteArray(Charsets.UTF_8)) }
                        true
                    } catch (_: Exception) {
                        false
                    }
                }
                js("window.__exported && window.__exported($ok)")
            }
            REQ_IMPORT -> {
                if (resultCode == RESULT_OK && uri != null) {
                    val text = try {
                        contentResolver.openInputStream(uri)?.use { it.readBytes().toString(Charsets.UTF_8) } ?: ""
                    } catch (_: Exception) {
                        ""
                    }
                    js("window.__imported && window.__imported(${JSONObject.quote(text)})")
                }
            }
        }
    }

    fun js(code: String) {
        runOnUiThread { web.evaluateJavascript(code, null) }
    }

    /** ステータスバー・ナビゲーションバーの色を画面に合わせる */
    @Suppress("DEPRECATION")
    fun setChrome(dark: Boolean, color: Int) {
        window.statusBarColor = color
        window.navigationBarColor = color
        window.decorView.setBackgroundColor(color)
        window.decorView.systemUiVisibility =
            if (dark) 0 else (View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR)
    }

    companion object {
        const val REQ_EXPORT = 11
        const val REQ_IMPORT = 12
        const val REQ_NOTIF = 13
    }
}

/** 画面（JavaScript の window.Native）から呼べる機能 */
class Bridge(private val a: MainActivity) {
    private val ctx = a.applicationContext

    @JavascriptInterface
    fun load(): String = Store.load(ctx)

    /** データ本体と通知予定を保存 */
    @JavascriptInterface
    fun save(data: String, schedule: String): Boolean {
        val ok = Store.save(ctx, data)
        Store.saveSchedule(ctx, schedule)
        return ok
    }

    @JavascriptInterface
    fun takeRoute(): String {
        var r = ""
        val latch = java.util.concurrent.CountDownLatch(1)
        a.runOnUiThread {
            r = a.takeRoute()
            latch.countDown()
        }
        latch.await(2, java.util.concurrent.TimeUnit.SECONDS)
        return r
    }

    @JavascriptInterface
    fun getHour(): Int = Reminder.hour(ctx)

    @JavascriptInterface
    fun setHour(h: Int) = Reminder.setHour(ctx, h)

    @JavascriptInterface
    fun notifAllowed(): Boolean = Reminder.allowed(ctx)

    @JavascriptInterface
    fun requestNotif() = a.runOnUiThread { a.requestNotification() }

    /** 日付が来ている通知を今すぐ確認して出す */
    @JavascriptInterface
    fun checkNow(): Int = Reminder.check(ctx)

    @JavascriptInterface
    fun testNotify() {
        Reminder.post(ctx, "test", "買い物上手", "通知はこんなふうに届きます。", "", Reminder.CH_RATE)
    }

    @JavascriptInterface
    fun fetchMeta(id: Int, url: String) {
        Thread {
            val res = Net.fetchMeta(url)
            a.js("window.__cb && window.__cb($id, $res)")
        }.start()
    }

    @JavascriptInterface
    fun checkUpdate(id: Int) {
        Thread {
            val res = Net.latestRelease()
            a.js("window.__cb && window.__cb($id, $res)")
        }.start()
    }

    @JavascriptInterface
    fun openUrl(url: String) = a.runOnUiThread { a.openExternal(url) }

    @JavascriptInterface
    fun exportData(json: String) = a.runOnUiThread { a.startExport(json) }

    @JavascriptInterface
    fun importData() = a.runOnUiThread { a.startImport() }

    @JavascriptInterface
    fun listBackups(): String = Store.listBackups(ctx).toString()

    @JavascriptInterface
    fun readBackup(name: String): String = Store.readBackup(ctx, name)

    @JavascriptInterface
    fun versionName(): String = pkg().versionName ?: ""

    @Suppress("DEPRECATION")
    @JavascriptInterface
    fun versionCode(): Int =
        if (Build.VERSION.SDK_INT >= 28) pkg().longVersionCode.toInt() else pkg().versionCode

    @JavascriptInterface
    fun setChrome(dark: Boolean, color: String) {
        val c = try {
            Color.parseColor(color)
        } catch (_: Exception) {
            Color.WHITE
        }
        a.runOnUiThread { a.setChrome(dark, c) }
    }

    private fun pkg() = ctx.packageManager.getPackageInfo(ctx.packageName, 0)
}
