using System.Text.Json;

namespace Luoye;
static class StudioArchive
{
    public static string Save(JsonElement value, string root)
    {
        var session=value.GetProperty("sessionId").GetString();
        if(!Guid.TryParse(session,out _)||value.GetProperty("revision").GetInt32()<0)throw new InvalidDataException("保存编号无效。");
        var image=value.GetProperty("png").GetString()??"";
        if(!image.StartsWith("data:image/png;base64,")||image.Length>180*1024*1024)throw new InvalidDataException("图片不完整。");
        var png=Convert.FromBase64String(image[22..]);
        if(png.Length<8||!png.AsSpan(0,8).SequenceEqual(new byte[]{137,80,78,71,13,10,26,10}))throw new InvalidDataException("图片格式无效。");
        var project=value.GetProperty("project");
        var json=JsonSerializer.SerializeToUtf8Bytes(project);
        if(json.Length>128*1024*1024)throw new InvalidDataException("工程过大，请先减少图层。");
        Directory.CreateDirectory(root);
        var destination=Path.Combine(root,session+"-"+value.GetProperty("revision").GetInt32());
        if(Directory.Exists(destination)) {
            if(File.ReadAllBytes(Path.Combine(destination,"作品.luoyex")).SequenceEqual(json)&&File.ReadAllBytes(Path.Combine(destination,"作品.png")).SequenceEqual(png))return destination;
            throw new IOException("保存编号重复，但内容不同，请重试。");
        }
        var staging=Path.Combine(root,".saving-"+Guid.NewGuid());Directory.CreateDirectory(staging);
        try {
            File.WriteAllBytes(Path.Combine(staging,"作品.luoyex"),json);
            File.WriteAllBytes(Path.Combine(staging,"作品.png"),png);
            File.WriteAllText(Path.Combine(staging,"作品信息.json"),JsonSerializer.Serialize(new {title=project.GetProperty("title").GetString(),savedAt=DateTimeOffset.Now,sessionId=session,revision=value.GetProperty("revision").GetInt32()}));
            Directory.Move(staging,destination);return destination;
        } finally {if(Directory.Exists(staging))Directory.Delete(staging,true);}
    }
}
