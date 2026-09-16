# Upload mp-weixin to WeChat (requires: CLI logged in, real AppID in project.private.config.json)
param(
  [string]$Version = "1.0.0",
  [string]$Desc = "静心小玩具：木鱼/念珠/颂钵，数据仅存本机"
)
$Cli = "D:\微信web开发者工具\cli.bat"
$Project = "C:\Users\MOON\Desktop\dianzi-muyu\mp-weixin"
$private = Get-Content (Join-Path $Project "project.private.config.json") -Raw | ConvertFrom-Json
if ($private.appid -eq "touristappid" -or -not $private.appid) {
  Write-Host "ERROR: Set real wx AppID in project.private.config.json before upload." -ForegroundColor Red
  exit 1
}
Write-Host "Uploading with AppID $($private.appid) version $Version ..."
& $Cli upload --project $Project -v $Version -d $Desc
exit $LASTEXITCODE
