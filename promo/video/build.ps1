# Génère promo/focus-promo.mp4 (1080x1920, ~24s, muet) - reproductible.
$FF = "$env:LOCALAPPDATA\Programs\ffmpeg\ffmpeg.exe"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent (Split-Path -Parent $here)
$tmp = Join-Path $env:TEMP "focus-video"
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
Copy-Item "C:\Windows\Fonts\segoeui.ttf", "C:\Windows\Fonts\segoeuib.ttf" $tmp -Force
Copy-Item (Join-Path $root "client\public\pwa-512x512.png") (Join-Path $tmp "logo.png") -Force
$logo = "logo.png"
$FB = "segoeui.ttf"
$FBB = "segoeuib.ttf"

function Text-File($name, $lines) {
  $p = Join-Path $tmp ($name + ".txt")
  ($lines -join "`n") | Set-Content -LiteralPath $p -Encoding utf8NoBOM
  return ($name + ".txt")
}

function Scene($n, $bg1, $bg2, $logoY, $logoSize, $texts) {
  # $texts: @(font, size, color, y, start, txtfile)
  $draws = @()
  foreach ($t in $texts) {
    $e = 3.6
    $draws += "drawtext=fontfile=$($t[0]):fontsize=$($t[1]):fontcolor=$($t[2]):x=(w-text_w)/2:y=$($t[3]):textfile='$($t[5])':alpha='min(clip((t-$($t[4]))/0.4,0,1),clip(($e-t)/0.4,0,1))'"
  }
  $fc = "gradients=s=1080x1920:speed=0:c0=${bg1}:c1=${bg2}:x0=0:y0=0:x1=1080:y1=1920,format=yuv420p[bg]"
  $head = "[bg]"
  if ($logoY -ge 0) {
    $fc += ";movie=logo.png,scale=${logoSize}:-1,format=rgba[lg];[bg][lg]overlay=(W-w)/2:${logoY}:format=yuv420[ov]"
    $head = "[ov]"
  }
  if ($draws.Count) { $fc += ";" + $head + ($draws -join ",") }
  $fc += ",fade=t=in:st=0:d=0.5,fade=t=out:st=3.5:d=0.5,format=yuv420p[v]"
  $out = Join-Path $tmp ("seg$($n).mp4")
  & $FF -y -v error -f lavfi -i "color=c=0x000000:s=1080x1920:r=30:d=0.01" -filter_complex $fc -map "[v]" -t 4 -r 30 -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p $out
  if ($LASTEXITCODE -ne 0) { throw "scene $n failed" }
}

# Les filtres n'acceptant pas les lettres de lecteur (C:), tout se joue en chemins relatifs.
Set-Location $tmp

# --- Scène 0 : logo + titre ---
$t0a = Text-File "t0a" @("Focus")
$t0b = Text-File "t0b" @("Votre journ", "e, enfin lisible.")
Scene 0 "0x1d4ed8" "0x0f1e5b" 480 400 @(@($FBB, 110, "white", 1020, 0.3, $t0a), @($FB, 42, "0xbcd0ff", 1180, 0.9, $t0b))

# --- Scènes 1..3 : promesses ---
$k1 = Text-File "k1" @("01 - ORGANISER")
$h1 = Text-File "h1" @("Toujours savoir", "quoi faire")
$b1 = Text-File "b1" @("Tâches, Kanban, calendrier", "et priorités.")
Scene 1 "0x101c4e" "0x0f1e5b" -1 0 @(@($FBB, 34, "0x8fb0ff", 560, 0.2, $k1), @($FBB, 84, "white", 660, 0.5, $h1), @($FB, 42, "0xbcd0ff", 980, 1.1, $b1))
$k2 = Text-File "k2" @("02 - CENTRALISER")
$h2 = Text-File "h2" @("Tous vos fichiers", "au même endroit")
$b2 = Text-File "b2" @("Documents, scans PDF,", "hors-ligne.")
Scene 2 "0x101c4e" "0x0f1e5b" -1 0 @(@($FBB, 34, "0x8fb0ff", 560, 0.2, $k2), @($FBB, 84, "white", 660, 0.5, $h2), @($FB, 42, "0xbcd0ff", 980, 1.1, $b2))
$k3 = Text-File "k3" @("03 - AVANCER")
$h3 = Text-File "h3" @("Concentration", "et objectifs")
$b3 = Text-File "b3" @("Minuteur Focus,", "progression auto.")
Scene 3 "0x101c4e" "0x0f1e5b" -1 0 @(@($FBB, 34, "0x8fb0ff", 560, 0.2, $k3), @($FBB, 84, "white", 660, 0.5, $h3), @($FB, 42, "0xbcd0ff", 980, 1.1, $b3))

# --- Scène 4 : plateformes ---
$k4 = Text-File "k4" @("PARTOUT AVEC VOUS")
$h4 = Text-File "h4" @("Web · Android", "· Windows")
$b4 = Text-File "b4" @("focus.vercel.app")
Scene 4 "0x101c4e" "0x0f1e5b" -1 0 @(@($FBB, 34, "0x8fb0ff", 560, 0.2, $k4), @($FBB, 84, "white", 660, 0.5, $h4), @($FB, 44, "0xbcd0ff", 980, 1.1, $b4))

# --- Scène 5 : final ---
$t5 = Text-File "t5" @("Focus")
$b5 = Text-File "b5" @("github.com/DanielMb24/focus")
Scene 5 "0x1d4ed8" "0x0f1e5b" 560 300 @(@($FBB, 100, "white", 1040, 0.3, $t5), @($FB, 38, "0xbcd0ff", 1190, 0.9, $b5))

$list = Join-Path $tmp "list.txt"
0..5 | ForEach-Object { "file 'seg$($_).mp4'" } | Set-Content -LiteralPath $list -Encoding ascii
Set-Location $tmp
& $FF -y -v error -f concat -safe 0 -i "list.txt" -c copy (Join-Path $root "promo\focus-promo.mp4")
Set-Location $root
Write-Output "VIDEO OK"

