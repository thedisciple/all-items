param([ValidateSet('status','stop-app','start-app','switch','stop-sharing','restore-configuration')][string]$Action,[string]$ConfigPath,[string]$Release,[string]$Runtime,[string]$RecoveryXml,[string]$RecoveryHash)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$configuration=Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
foreach($name in @($configuration.appService,$configuration.caddyService)){if($name -notmatch '^[A-Za-z0-9_-]+$'){throw 'Invalid service identity'}}
if($Action -eq 'status'){
  $binding=$null
  try{
    $readerSettings=New-Object System.Xml.XmlReaderSettings
    $readerSettings.DtdProcessing=[System.Xml.DtdProcessing]::Prohibit
    $bindingReader=[System.Xml.XmlReader]::Create($configuration.appServiceXml,$readerSettings)
    $bindingDocument=New-Object System.Xml.XmlDocument
    try{$bindingDocument.Load($bindingReader)}finally{$bindingReader.Close()}
    if($bindingDocument.service.id -cne $configuration.appService){throw 'Service identity mismatch'}
    $runtimeFile=$null
    if([string]$bindingDocument.service.arguments -match '(?i)-ConfigPath\s+"([^"]+)"'){$runtimeFile=$Matches[1]}
    $binding=@{release=[string]$bindingDocument.service.workingdirectory;runtime=$runtimeFile}
  }catch{$binding=$null}
  @{app=(Get-Service -Name $configuration.appService).Status.ToString();caddy=(Get-Service -Name $configuration.caddyService).Status.ToString();binding=$binding}|ConvertTo-Json -Compress
  exit
}
if($Action -eq 'stop-app'){Stop-Service -Name $configuration.appService;(Get-Service -Name $configuration.appService).WaitForStatus('Stopped','00:00:45');exit}
if($Action -eq 'start-app'){Start-Service -Name $configuration.appService;(Get-Service -Name $configuration.appService).WaitForStatus('Running','00:00:45');exit}
if($Action -eq 'stop-sharing'){Stop-Service -Name $configuration.caddyService;(Get-Service -Name $configuration.caddyService).WaitForStatus('Stopped','00:00:45');exit}
if((Get-Service -Name $configuration.appService).Status -ne 'Stopped'){throw 'Stop application writers before switching'}
if($Action -eq 'restore-configuration'){
  if($RecoveryHash -notmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath $RecoveryXml -Algorithm SHA256).Hash.ToLowerInvariant() -cne $RecoveryHash){throw 'Recovery pointer checksum mismatch'}
  $recoverySettings=New-Object System.Xml.XmlReaderSettings
  $recoverySettings.DtdProcessing=[System.Xml.DtdProcessing]::Prohibit
  $recoveryReader=[System.Xml.XmlReader]::Create($RecoveryXml,$recoverySettings)
  $recoveryDocument=New-Object System.Xml.XmlDocument
  try{$recoveryDocument.Load($recoveryReader)}finally{$recoveryReader.Close()}
  if($recoveryDocument.service.id -cne $configuration.appService){throw 'Recovery service identity mismatch'}
  Copy-Item -LiteralPath $RecoveryXml -Destination ($configuration.appServiceXml+'.prepared')
  Move-Item -LiteralPath ($configuration.appServiceXml+'.prepared') -Destination $configuration.appServiceXml -Force
  exit
}
foreach($value in @($Release,$Runtime)){if(-not [IO.Path]::IsPathRooted($value) -or $value -match '["<>\r\n]'){throw 'Invalid private path'}}
$settings=New-Object System.Xml.XmlReaderSettings
$settings.DtdProcessing=[System.Xml.DtdProcessing]::Prohibit
$reader=[System.Xml.XmlReader]::Create($configuration.appServiceXml,$settings)
$document=New-Object System.Xml.XmlDocument
try{$document.Load($reader)}finally{$reader.Close()}
if($document.service.id -cne $configuration.appService -or [IO.Path]::GetFileName($document.service.executable) -ine 'powershell.exe'){throw 'Unsupported service adapter; review it explicitly'}
$document.service.workingdirectory=$Release
$policy=''
if([string]$document.service.arguments -match '(?i)-ExecutionPolicy\s+(Bypass|RemoteSigned|AllSigned|Restricted|Unrestricted|Default)(?:\s|$)'){$policy='-ExecutionPolicy '+$Matches[1]+' '}
$document.service.arguments='-NoProfile -NonInteractive '+$policy+'-File "'+(Join-Path $Release 'scripts\start-production.ps1')+'" -ConfigPath "'+$Runtime+'"'
$temporary=$configuration.appServiceXml+'.prepared'
$document.Save($temporary)
Move-Item -LiteralPath $temporary -Destination $configuration.appServiceXml -Force
