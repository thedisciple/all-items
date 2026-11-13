param([ValidateSet('status','stop-app','start-app','switch','stop-sharing')][string]$Action,[string]$ConfigPath,[string]$Release,[string]$Runtime)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$configuration=Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
foreach($name in @($configuration.appService,$configuration.caddyService)){if($name -notmatch '^[A-Za-z0-9_-]+$'){throw 'Invalid service identity'}}
if($Action -eq 'status'){
  @{app=(Get-Service -Name $configuration.appService).Status.ToString();caddy=(Get-Service -Name $configuration.caddyService).Status.ToString()}|ConvertTo-Json -Compress
  exit
}
if($Action -eq 'stop-app'){Stop-Service -Name $configuration.appService;(Get-Service -Name $configuration.appService).WaitForStatus('Stopped','00:00:45');exit}
if($Action -eq 'start-app'){Start-Service -Name $configuration.appService;(Get-Service -Name $configuration.appService).WaitForStatus('Running','00:00:45');exit}
if($Action -eq 'stop-sharing'){Stop-Service -Name $configuration.caddyService;(Get-Service -Name $configuration.caddyService).WaitForStatus('Stopped','00:00:45');exit}
if((Get-Service -Name $configuration.appService).Status -ne 'Stopped'){throw 'Stop application writers before switching'}
foreach($value in @($Release,$Runtime)){if(-not [IO.Path]::IsPathRooted($value) -or $value -match '["<>\r\n]'){throw 'Invalid private path'}}
$settings=New-Object System.Xml.XmlReaderSettings
$settings.DtdProcessing=[System.Xml.DtdProcessing]::Prohibit
$reader=[System.Xml.XmlReader]::Create($configuration.appServiceXml,$settings)
$document=New-Object System.Xml.XmlDocument
try{$document.Load($reader)}finally{$reader.Close()}
if($document.service.id -cne $configuration.appService -or [IO.Path]::GetFileName($document.service.executable) -ine 'powershell.exe'){throw 'Unsupported service adapter; review it explicitly'}
$document.service.workingdirectory=$Release
$document.service.arguments='-NoProfile -NonInteractive -File "'+(Join-Path $Release 'scripts\start-production.ps1')+'" -ConfigPath "'+$Runtime+'"'
$temporary=$configuration.appServiceXml+'.prepared'
$document.Save($temporary)
Move-Item -LiteralPath $temporary -Destination $configuration.appServiceXml -Force
