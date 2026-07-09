param(
    [int]$Port = 4173,
    [string]$Root = (Join-Path $PSScriptRoot "..\website")
)

$Root = (Resolve-Path $Root).Path
$mime = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".mjs"  = "application/javascript; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".webp" = "image/webp"
    ".ico"  = "image/x-icon"
    ".json" = "application/json"
    ".webmanifest" = "application/manifest+json"
    ".woff2" = "font/woff2"
    ".glb"  = "model/gltf-binary"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $Root at http://localhost:$Port/"

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
        $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
        if ($path -eq "/") { $path = "/index.html" }
        $file = [IO.Path]::GetFullPath((Join-Path $Root ($path.TrimStart("/") -replace "/", "\")))
        if ($file.StartsWith($Root) -and (Test-Path $file -PathType Leaf)) {
            $bytes = [IO.File]::ReadAllBytes($file)
            $ext = [IO.Path]::GetExtension($file).ToLower()
            if ($mime.ContainsKey($ext)) { $ctx.Response.ContentType = $mime[$ext] }
            $ctx.Response.Headers.Add("Cache-Control", "no-store")
            $ctx.Response.ContentLength64 = $bytes.Length
            $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $ctx.Response.StatusCode = 404
            $msg = [Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
        }
        $ctx.Response.Close()
    } catch {
        Write-Host "ERR: $_"
    }
}
