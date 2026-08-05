$root = 'C:\Users\tobis\walker-app'
$prefix = 'http://127.0.0.1:8000/'
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)
$listener.Start()

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $requestPath = $context.Request.Url.AbsolutePath
    $query = $context.Request.Url.Query

    if ($requestPath -eq '/proxy/nominatim') {
        $nominatimUrl = "https://nominatim.openstreetmap.org/search$($query)"
        $proxyJson = Invoke-RestMethod -Uri $nominatimUrl -Headers @{ 'Accept-Language' = 'en' }
        $jsonBytes = [System.Text.Encoding]::UTF8.GetBytes(($proxyJson | ConvertTo-Json -Depth 5 -Compress))
        $response = $context.Response
        $response.StatusCode = 200
        $response.ContentType = 'application/json'
        $response.AddHeader('Access-Control-Allow-Origin', '*')
        $response.ContentLength64 = $jsonBytes.Length
        $response.OutputStream.Write($jsonBytes, 0, $jsonBytes.Length)
        $response.Close()
        continue
    }

    if ($requestPath -eq '/proxy/overpass') {
        $bodyReader = [System.IO.StreamReader]::new($context.Request.InputStream)
        $bodyText = $bodyReader.ReadToEnd()
        $bodyReader.Dispose()

        $proxyContent = Invoke-WebRequest -Uri 'https://overpass-api.de/api/interpreter' -Method Post -Body $bodyText -ContentType 'text/plain' | Select-Object -ExpandProperty Content
        $responseBytes = [System.Text.Encoding]::UTF8.GetBytes($proxyContent)
        $response = $context.Response
        $response.StatusCode = 200
        $response.ContentType = 'application/json'
        $response.AddHeader('Access-Control-Allow-Origin', '*')
        $response.ContentLength64 = $responseBytes.Length
        $response.OutputStream.Write($responseBytes, 0, $responseBytes.Length)
        $response.Close()
        continue
    }

    $path = if ($requestPath -eq '/') { 'index.html' } else { $requestPath.TrimStart('/') }
    $fullPath = Join-Path $root $path

    if (Test-Path -LiteralPath $fullPath -PathType Leaf) {
        $contentType = 'text/html'
        if ($fullPath.EndsWith('.css')) { $contentType = 'text/css' }
        elseif ($fullPath.EndsWith('.js')) { $contentType = 'application/javascript' }
        elseif ($fullPath.EndsWith('.png')) { $contentType = 'image/png' }
        elseif ($fullPath.EndsWith('.jpg') -or $fullPath.EndsWith('.jpeg')) { $contentType = 'image/jpeg' }

        $bytes = [System.IO.File]::ReadAllBytes($fullPath)
        $response = $context.Response
        $response.StatusCode = 200
        $response.ContentType = $contentType
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
        $response.Close()
    }
    else {
        $response = $context.Response
        $response.StatusCode = 404
        $response.Close()
    }
}
