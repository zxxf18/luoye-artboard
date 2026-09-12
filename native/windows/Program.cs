using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Luoye;
static class Program
{
    [STAThread] static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new StudioWindow());
    }
}
sealed class StudioWindow : Form
{
    readonly WebView2 web = new(){Dock=DockStyle.Fill};
    readonly string site=Path.Combine(AppContext.BaseDirectory,"site");
    readonly string profile=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"LuoyeBoard");
    StudioMusic? music;
    bool ready, closing, approved;
    Rectangle normalBounds;
    bool fullscreen;
    public StudioWindow()
    {
        Text="落叶画板";ClientSize=new Size(1380,900);MinimumSize=new Size(916,689);StartPosition=FormStartPosition.CenterScreen;
        Icon=Icon.ExtractAssociatedIcon(Application.ExecutablePath);Controls.Add(web);
        Shown+=async(_,_)=>await Initialize();FormClosing+=CloseSafely;
        FormClosed+=(_,_)=>music?.Dispose();
    }
    async Task Initialize()
    {
        try {
            Directory.CreateDirectory(profile);
            var environment=await CoreWebView2Environment.CreateAsync(null,profile);
            await web.EnsureCoreWebView2Async(environment);
            var core=web.CoreWebView2;
            core.Settings.AreDefaultContextMenusEnabled=false;core.Settings.AreDevToolsEnabled=false;
            core.SetVirtualHostNameToFolderMapping("luoye.local",site,CoreWebView2HostResourceAccessKind.DenyCors);
            core.NavigationStarting+=(_,e)=>{if(!Uri.TryCreate(e.Uri,UriKind.Absolute,out var url)||url.Scheme!="https"||url.Host!="luoye.local")e.Cancel=true;};
            core.NewWindowRequested+=(_,e)=>e.Handled=true;
            core.PermissionRequested+=(_,e)=>e.State=CoreWebView2PermissionState.Deny;
            core.WebMessageReceived+=Message;
            await core.AddScriptToExecuteOnDocumentCreatedAsync("window.LUOYE_PLATFORM='windows';window.webkit={messageHandlers:Object.fromEntries(['ready','files','music','display'].map(channel=>[channel,{postMessage:payload=>window.chrome.webview.postMessage({channel,payload})}]))};");
            core.Navigate("https://luoye.local/index.html");
        } catch(WebView2RuntimeNotFoundException) {
            MessageBox.Show(this,"请先运行安装包内的 MicrosoftEdgeWebView2RuntimeInstallerX64.exe，再打开落叶画板。",Text);approved=true;Close();
        } catch(Exception e) {MessageBox.Show(this,"画室未能打开："+e.Message,Text);}
    }
    async void Message(object? sender,CoreWebView2WebMessageReceivedEventArgs e)
    {
        if(!e.Source.StartsWith("https://luoye.local/",StringComparison.Ordinal))return;
        string? channel=null,id=null;
        try {
            using var message=JsonDocument.Parse(e.WebMessageAsJson);
            if(!message.RootElement.TryGetProperty("channel",out var channelValue))return;
            channel=channelValue.GetString();var body=message.RootElement.GetProperty("payload");
            if(body.TryGetProperty("id",out var identifier))id=identifier.GetString();
            if(id?.Length>100)return;
            switch(channel) {
                case "ready":
                    ready=true;
                    var fonts=new System.Drawing.Text.InstalledFontCollection().Families.Select(f=>f.Name).Order().ToArray();
                    await web.ExecuteScriptAsync("window.LUOYESetFonts("+JsonSerializer.Serialize(fonts)+")");break;
                case "files": await SaveFile(body,id);break;
                case "display": SetDisplay(body.GetProperty("action").GetString());break;
                case "music":
                    music??=new StudioMusic(Path.Combine(AppContext.BaseDirectory,"audio","GeneralUser-GS.sf2"));
                    switch(body.GetProperty("action").GetString()) {
                        case "track":
                            using(var tracks=JsonDocument.Parse(File.ReadAllText(Path.Combine(site,"music","tracks.json")))) {
                                var index=body.GetProperty("index").GetInt32();
                                if(index<0||index>=tracks.RootElement.GetArrayLength())throw new InvalidDataException("歌曲编号无效。");
                                var track=tracks.RootElement[index];var file=track.GetProperty("file").GetString()??"";
                                if(Path.GetFileName(file)!=file||!file.EndsWith(".mid",StringComparison.Ordinal))throw new InvalidDataException("音乐文件名无效。");
                                music.Load(File.ReadAllBytes(Path.Combine(site,"music",file)),track.GetProperty("label").GetString()??$"音乐{index+1}",track.GetProperty("gain").GetDouble());music.Play();
                            }
                            break;
                        case "import":var data=body.GetProperty("data").GetString()??"";if(data.Length>12*1024*1024)throw new InvalidDataException("音乐过大。");music.Load(Convert.FromBase64String(data),body.GetProperty("name").GetString()??"我的音乐");music.Play();break;
                        case "play":music.Play();break;
                        case "stop":music.Stop();break;
                        case "volume":music.SetVolume(body.GetProperty("volume").GetDouble());break;
                        case "state":break;
                        default:throw new InvalidDataException("音乐操作无效。");
                    }
                    await Reply("native-music-result",new {id,state=music.State()});break;
            }
        } catch(Exception ex) {
            if(id is not null)await Reply(channel=="music"?"native-music-result":"native-file-result",new{id,error=ex.Message});
            else MessageBox.Show(this,ex.Message,Text);
        }
    }
    Task Reply(string name,object payload)=>web.ExecuteScriptAsync("window.dispatchEvent(new CustomEvent("+JsonSerializer.Serialize(name)+",{detail:"+JsonSerializer.Serialize(payload)+"}))");
    async Task SaveFile(JsonElement body,string? id)
    {
        var mime=body.GetProperty("mime").GetString();var content=body.GetProperty("content").GetString()??"";
        if(content.Length>180*1024*1024)throw new InvalidDataException("文件过大。");
        byte[] bytes;
        if(mime=="application/json")bytes=System.Text.Encoding.UTF8.GetBytes(content);
        else if((mime=="image/png"||mime=="image/jpeg")&&content.StartsWith("data:"+mime+";base64,"))bytes=Convert.FromBase64String(content[(content.IndexOf(',')+1)..]);
        else throw new InvalidDataException("文件格式无效。");
        using var dialog=new SaveFileDialog{FileName=Path.GetFileName(body.GetProperty("name").GetString()),Filter="作品文件|*.luoyex;*.luoyer;*.png;*.jpg|所有文件|*.*",OverwritePrompt=true};
        if(dialog.ShowDialog(this)!=DialogResult.OK){await Reply("native-file-result",new{id,saved=false});return;}
        var destination=dialog.FileName??throw new IOException("请选择保存位置。");
        var tmp=destination+"."+Guid.NewGuid()+".tmp";
        try {await File.WriteAllBytesAsync(tmp,bytes);File.Move(tmp,destination,true);}finally{if(File.Exists(tmp))File.Delete(tmp);}
        await Reply("native-file-result",new{id,saved=true});
    }
    void SetDisplay(string? action)
    {
        var area=Screen.FromControl(this).WorkingArea;
        if(action=="fullscreen"){
            if(!fullscreen){normalBounds=Bounds;FormBorderStyle=FormBorderStyle.None;Bounds=Screen.FromControl(this).Bounds;}
            else{FormBorderStyle=FormBorderStyle.Sizable;Bounds=normalBounds;}
            fullscreen=!fullscreen;return;
        }
        if(fullscreen){FormBorderStyle=FormBorderStyle.Sizable;fullscreen=false;}
        var desired=action switch{"1080"=>new Size(1920,1080),"2k"=>new Size(2560,1440),"fit"=>area.Size,_=>ClientSize};
        WindowState=FormWindowState.Normal;ClientSize=new Size(Math.Min(desired.Width,area.Width-16),Math.Min(desired.Height,area.Height-39));CenterToScreen();
    }
    async void CloseSafely(object? sender,FormClosingEventArgs e)
    {
        if(approved||!ready)return;e.Cancel=true;if(closing)return;closing=true;
        try {
            // ExecuteScriptAsync doesn't await a JS Promise. Correlate a private completion message.
            var completion=new TaskCompletionSource<JsonElement>();var token=Guid.NewGuid().ToString();
            void Handler(object? s,CoreWebView2WebMessageReceivedEventArgs m){
                if(!m.Source.StartsWith("https://luoye.local/",StringComparison.Ordinal))return;
                using var d=JsonDocument.Parse(m.WebMessageAsJson);
                if(d.RootElement.TryGetProperty("closeToken",out var t)&&t.GetString()==token)completion.TrySetResult(d.RootElement.Clone());
            }
            web.CoreWebView2.WebMessageReceived+=Handler;
            try {
                await web.ExecuteScriptAsync("(async()=>{try{const payload=await window.LUOYERequestClose();window.chrome.webview.postMessage({closeToken:"+JsonSerializer.Serialize(token)+",payload});}catch(e){window.chrome.webview.postMessage({closeToken:"+JsonSerializer.Serialize(token)+",error:e.message});}})()");
                var result=await completion.Task;
                if(result.TryGetProperty("error",out var error))throw new IOException(error.GetString());
                var decision=result.GetProperty("payload");var action=decision.GetProperty("action").GetString();
                if(action=="cancel")return;
                if(action=="save")await Task.Run(()=>StudioArchive.Save(decision.GetProperty("payload"),Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyPictures),"落叶画板作品")));
                else if(action!="exit")throw new IOException("退出选择无效。");
            } finally {web.CoreWebView2.WebMessageReceived-=Handler;}
            approved=true;Close();
        } catch(Exception ex) {MessageBox.Show(this,"作品还没有保存成功，画室会保持打开。\n"+ex.Message,Text);}
        finally {closing=false;}
    }
}
