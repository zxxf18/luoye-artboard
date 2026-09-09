using System.Diagnostics;
using System.IO.Compression;
using System.Reflection;

var destination = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "LuoyeArtboard");
try {
    Directory.CreateDirectory(destination);
    using var payload = Assembly.GetExecutingAssembly().GetManifestResourceStream("LuoyeInstaller.payload.zip") ?? throw new InvalidOperationException("安装包数据缺失");
    var archive = Path.Combine(Path.GetTempPath(), $"luoye-{Guid.NewGuid():N}.zip");
    using (var output = File.Create(archive)) await payload.CopyToAsync(output);
    ZipFile.ExtractToDirectory(archive, destination, true);
    File.Delete(archive);
    Console.WriteLine($"落叶画板已安装到：{destination}");
    var executable = Path.Combine(destination, "落叶画板.exe");
    if (File.Exists(executable)) Process.Start(new ProcessStartInfo(executable) { UseShellExecute = true });
} catch (Exception error) {
    Console.Error.WriteLine($"落叶画板安装失败：{error.Message}");
    Environment.ExitCode = 1;
}
