package cn.com.yebuluo

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.view.View
import android.view.Window
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.Toast
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import org.json.JSONObject
import java.io.IOException
import java.nio.charset.StandardCharsets

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var bridge: AndroidBridge
    private val mainHandler = Handler(Looper.getMainLooper())
    private var uploadCallback: ValueCallback<Array<Uri>>? = null
    private var pendingSave: PendingSave? = null
    private var closeInFlight = false
    private var music: AndroidMusic? = null

    private data class PendingSave(
        val id: String?,
        val name: String,
        val mime: String,
        val bytes: ByteArray,
        val closeAfter: Boolean = false,
    )

    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        webView = WebView(this)
        setContentView(webView)
        configureWebView()
    }

    private fun configureWebView() {
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.allowFileAccessFromFileURLs = false
        settings.allowUniversalAccessFromFileURLs = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.mediaPlaybackRequiresUserGesture = true
        settings.setSupportZoom(false)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false)

        bridge = AndroidBridge(this)
        webView.addJavascriptInterface(bridge, "AndroidBridge")
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        webView.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest) =
                loader.shouldInterceptRequest(request.url)

            @Suppress("DEPRECATION")
            override fun shouldInterceptRequest(view: WebView, url: String) =
                loader.shouldInterceptRequest(Uri.parse(url))

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                return request.url.host != "appassets.androidplatform.net"
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams,
            ): Boolean {
                uploadCallback?.onReceiveValue(null)
                uploadCallback = callback
                val intent = try {
                    params.createIntent().apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false)
                    }
                } catch (_: ActivityNotFoundException) {
                    Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "*/*"
                    }
                }
                return try {
                    startActivityForResult(intent, REQUEST_OPEN)
                    true
                } catch (_: ActivityNotFoundException) {
                    uploadCallback?.onReceiveValue(null)
                    uploadCallback = null
                    toast("系统没有可用的文件选择器")
                    false
                }
            }
        }
        webView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
    }

    fun handleBridge(channel: String, payload: String) {
        // @JavascriptInterface may run away from the UI thread. Every handler
        // below re-enters the main thread before touching Activity/WebView state.
        mainHandler.post {
            try {
                when (channel) {
                    "ready" -> Unit
                    "files" -> handleFileMessage(JSONObject(payload))
                    "display" -> handleDisplayMessage(JSONObject(payload))
                    "music" -> handleMusicMessage(JSONObject(payload))
                    else -> Unit
                }
            } catch (error: Exception) {
                val id = runCatching { optionalId(JSONObject(payload)) }.getOrNull()
                if (channel == "music") dispatch("native-music-result", result(id, error = error.message))
                else if (id != null) dispatch("native-file-result", result(id, error = error.message))
                else toast(error.message ?: "操作失败")
            }
        }
    }

    private fun handleFileMessage(message: JSONObject) {
        val id = optionalId(message)
        val name = safeFileName(message.optString("name", "落叶画板文件"))
        val mime = message.optString("mime", "application/octet-stream")
        val content = message.optString("content", "")
        val bytes = decodePayload(mime, content)
        if (bytes.size > MAX_FILE_BYTES) throw IOException("文件超过 180 MiB 上限")
        pendingSave = PendingSave(id, name, mime, bytes)
        launchSave(pendingSave!!)
    }

    private fun launchSave(save: PendingSave) {
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = save.mime
            putExtra(Intent.EXTRA_TITLE, save.name)
        }
        try {
            startActivityForResult(intent, REQUEST_SAVE)
        } catch (_: ActivityNotFoundException) {
            pendingSave = null
            if (save.closeAfter) closeInFlight = false
            dispatch("native-file-result", result(save.id, saved = false, error = "系统没有可用的文件保存器"))
        }
    }

    private fun handleDisplayMessage(message: JSONObject) {
        when (message.optString("action")) {
            "fullscreen" -> {
                if (window.decorView.systemUiVisibility == FULLSCREEN_FLAGS) {
                    window.decorView.systemUiVisibility = 0
                } else {
                    window.decorView.systemUiVisibility = FULLSCREEN_FLAGS
                }
            }
            "fit", "1080", "2k" -> Unit // Android uses the available window size.
            else -> throw IOException("窗口操作无效")
        }
        dispatch("native-display-result", JSONObject().put("width", webView.width).put("height", webView.height))
    }

    private fun handleMusicMessage(message: JSONObject) {
        // Android's platform MIDI decoder is device dependent. Keep this
        // capability behind the same bridge and report codec errors cleanly.
        val player = music ?: AndroidMusic(this).also { music = it }
        val action = message.optString("action")
        when (action) {
            "track" -> {
                val index = message.optInt("index", -1)
                if (index !in 0 until 20) throw IOException("歌曲编号无效")
                player.loadAsset("music/back$index.mid", "音乐${index + 1}")
                if (message.optBoolean("autoplay", true)) player.play()
            }
            "import" -> {
                val bytes = Base64.decode(message.optString("data"), Base64.DEFAULT)
                if (bytes.size > 8 * 1024 * 1024) throw IOException("MIDI 文件不能超过 8 MiB")
                player.loadBytes(bytes, safeFileName(message.optString("name", "我的音乐")))
                player.play()
            }
            "play" -> player.play()
            "stop" -> player.stop()
            "volume" -> player.volume = message.optDouble("volume", 0.35).toFloat().coerceIn(0f, 1f)
            "state" -> Unit
            else -> throw IOException("音乐操作无效")
        }
        dispatch("native-music-result", result(optionalId(message), state = player.state()))
    }

    private fun decodePayload(mime: String, content: String): ByteArray {
        if (mime == "application/json") return content.toByteArray(StandardCharsets.UTF_8)
        val prefix = "data:$mime;base64,"
        if ((mime == "image/png" || mime == "image/jpeg") && content.startsWith(prefix)) {
            return Base64.decode(content.removePrefix(prefix), Base64.DEFAULT)
        }
        throw IOException("不支持的文件格式")
    }

    private fun dispatch(event: String, detail: JSONObject) {
        val script = "window.dispatchEvent(new CustomEvent(${JSONObject.quote(event)},{detail:${detail}}))"
        webView.evaluateJavascript(script, null)
    }

    private fun optionalId(value: JSONObject): String? =
        if (value.has("id") && !value.isNull("id")) value.optString("id") else null

    private fun result(id: String?, saved: Boolean? = null, error: String? = null, state: JSONObject? = null): JSONObject {
        val value = JSONObject()
        if (id != null) value.put("id", id)
        if (saved != null) value.put("saved", saved)
        if (error != null) value.put("error", error)
        if (state != null) value.put("state", state)
        return value
    }

    fun handleCloseResult(payload: String) {
        mainHandler.post {
            if (!closeInFlight) return@post
            try {
                val value = JSONObject(payload)
                when (value.optString("action")) {
                    "exit" -> finishApproved()
                    "cancel" -> closeInFlight = false
                    "save" -> {
                        val project = value.getJSONObject("payload").toString().toByteArray(StandardCharsets.UTF_8)
                        pendingSave = PendingSave(null, "我的画.luoyex", "application/json", project, closeAfter = true)
                        launchSave(pendingSave!!)
                    }
                    else -> throw IOException("退出选择无效")
                }
            } catch (error: Exception) {
                handleCloseError(error.message ?: "退出失败")
            }
        }
    }

    fun handleCloseError(message: String) {
        mainHandler.post {
            closeInFlight = false
            toast("作品还没有保存成功：$message")
        }
    }

    override fun onBackPressed() {
        if (closeInFlight) return
        closeInFlight = true
        webView.evaluateJavascript(
            "(async()=>{try{AndroidBridge.closeResult(JSON.stringify(await window.LUOYERequestClose()))}catch(e){AndroidBridge.closeError(e.message||'退出失败')}})()",
            null,
        )
    }

    override fun onPause() {
        // Android may reclaim the WebView process while the app is backgrounded.
        // The page owns the transactional draft/recording flush, so trigger it
        // without blocking the Activity lifecycle callback.
        if (::webView.isInitialized) {
            webView.evaluateJavascript(
                "(window.LUOYEFlushBeforeClose?.() ?? Promise.resolve()).catch(()=>{})",
                null,
            )
        }
        super.onPause()
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_OPEN) {
            val result = if (resultCode == RESULT_OK && data?.data != null) arrayOf(data.data!!) else null
            uploadCallback?.onReceiveValue(result)
            uploadCallback = null
            return
        }
        if (requestCode != REQUEST_SAVE) return
        val save = pendingSave ?: return
        pendingSave = null
        if (resultCode != RESULT_OK || data?.data == null) {
            if (save.closeAfter) closeInFlight = false
            dispatch("native-file-result", result(save.id, saved = false))
            return
        }
        try {
            contentResolver.openOutputStream(data.data!!)?.use { it.write(save.bytes) }
                ?: throw IOException("无法打开保存位置")
            if (save.closeAfter) finishApproved()
            else dispatch("native-file-result", result(save.id, saved = true))
        } catch (error: Exception) {
            if (save.closeAfter) closeInFlight = false
            dispatch("native-file-result", result(save.id, saved = false, error = error.message))
        }
    }

    private fun finishApproved() {
        closeInFlight = false
        finish()
    }

    override fun onDestroy() {
        music?.release()
        webView.removeJavascriptInterface("AndroidBridge")
        webView.destroy()
        super.onDestroy()
    }

    private fun safeFileName(value: String): String {
        val candidate = value.trim().replace(Regex("[\\x00-\\x1F\\\\/:*?\"<>|]"), "_")
        return candidate.take(120).ifBlank { "落叶画板文件" }
    }

    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_SHORT).show()

    companion object {
        private const val REQUEST_OPEN = 4101
        private const val REQUEST_SAVE = 4102
        private const val MAX_FILE_BYTES = 180L * 1024 * 1024
        private const val FULLSCREEN_FLAGS =
            View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
    }
}
