# Generates the PWA PNG icons in public/ from the same shapes as public/favicon.svg.
# Run from the repo root: powershell -File scripts/generate-icons.ps1
Add-Type -AssemblyName System.Drawing

$cobalt = [System.Drawing.ColorTranslator]::FromHtml('#2743C9')
$chalk = [System.Drawing.ColorTranslator]::FromHtml('#F3F0E8')

function RoundedRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  if ($r -le 0) { $p.AddRectangle((New-Object System.Drawing.RectangleF $x, $y, $w, $h)); return $p }
  $d = 2 * $r
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

# $glyphScale: share of the icon used by the 64-unit design (maskable icons keep a safe zone).
function Icon([int]$size, [string]$path, [bool]$maskable) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)
  $bg = New-Object System.Drawing.SolidBrush $cobalt
  $fg = New-Object System.Drawing.SolidBrush $chalk

  if ($maskable) {
    $g.FillRectangle($bg, 0, 0, $size, $size)
    $scale = $size * 0.78 / 64
    $offset = ($size - 64 * $scale) / 2
  } else {
    $g.FillPath($bg, (RoundedRect 0 0 $size $size ($size * 14 / 64)))
    $scale = $size / 64
    $offset = 0
  }

  $shapes = @(
    @(8, 30, 48, 4, 2), @(13, 20, 7, 24, 2), @(44, 20, 7, 24, 2), @(21, 24, 4, 16, 1.5), @(39, 24, 4, 16, 1.5)
  )
  foreach ($s in $shapes) {
    $g.FillPath($fg, (RoundedRect ($offset + $s[0] * $scale) ($offset + $s[1] * $scale) ($s[2] * $scale) ($s[3] * $scale) ($s[4] * $scale)))
  }
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

$out = Join-Path $PSScriptRoot '..\public'
Icon 192 (Join-Path $out 'pwa-192x192.png') $false
Icon 512 (Join-Path $out 'pwa-512x512.png') $false
Icon 512 (Join-Path $out 'maskable-512x512.png') $true
Icon 180 (Join-Path $out 'apple-touch-icon.png') $true
Write-Output 'Icons written to public/'
