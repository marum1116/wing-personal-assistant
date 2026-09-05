Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path $PSScriptRoot -Parent
$labelsPath = Join-Path $repoRoot "assets\rich-menu-labels.json"
$labels = Get-Content -LiteralPath $labelsPath -Encoding UTF8 -Raw | ConvertFrom-Json

$width = 2500
$height = 1686
$colWidth = [int][Math]::Floor($width / 3)
$rowHeight = [int][Math]::Floor($height / 2)

$bmp = New-Object System.Drawing.Bitmap $width, $height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = "AntiAlias"
$g.TextRenderingHint = "ClearTypeGridFit"
$g.Clear([System.Drawing.Color]::FromArgb(245, 247, 250))

$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(180, 190, 200), 6)
$fontFamily = "Yu Gothic UI"
try {
  $font = New-Object System.Drawing.Font $fontFamily, 72, ([System.Drawing.FontStyle]::Bold)
} catch {
  $font = New-Object System.Drawing.Font "Meiryo UI", 72, ([System.Drawing.FontStyle]::Bold)
}
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(30, 45, 70))
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = "Center"
$sf.LineAlignment = "Center"

$fills = @(
  @(220, 235, 250),
  @(230, 240, 255),
  @(230, 240, 255),
  @(255, 240, 230),
  @(255, 235, 235),
  @(235, 250, 235)
)

for ($i = 0; $i -lt 6; $i++) {
  $col = $i % 3
  $row = [int][Math]::Floor($i / 3)
  $x = $col * $colWidth
  $y = $row * $rowHeight
  $w = if ($col -eq 2) { $width - $x } else { $colWidth }
  $h = if ($row -eq 1) { $height - $y } else { $rowHeight }
  $c = $fills[$i]
  $fillBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($c[0], $c[1], $c[2]))
  $g.FillRectangle($fillBrush, $x, $y, $w, $h)
  $fillBrush.Dispose()
  $g.DrawRectangle($pen, $x + 3, $y + 3, $w - 6, $h - 6)
  $rect = New-Object System.Drawing.RectangleF([float]$x, [float]$y, [float]$w, [float]$h)
  $g.DrawString([string]$labels[$i], $font, $brush, $rect, $sf)
}

$outPath = Join-Path $repoRoot "assets\rich-menu-wing.png"
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
$pen.Dispose()
$font.Dispose()
$brush.Dispose()
$sf.Dispose()

$item = Get-Item $outPath
Write-Output ("Wrote " + $item.FullName + " (" + [Math]::Round($item.Length / 1KB, 1) + " KB)")
Write-Output ("Labels: " + ($labels -join " / "))
