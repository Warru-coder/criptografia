; SecureCrypt Windows Installer Script
; Requires Inno Setup 6.x

#define MyAppName "SecureCrypt"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "SecureCrypt"
#define MyAppURL "https://securecrypt.com"
#define MyAppExeName "SecureCrypt.exe"
#define MyAppAssocName "SecureCrypt Encrypted File"
#define MyAppAssocExt ".scrypt"
#define MyAppAssocKey StringChange(MyAppAssocName, " ", "") + MyAppAssocExt

[Setup]
AppId={{A7B3C9D1-E2F4-5A6B-8C9D-0E1F2A3B4C5D}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
LicenseFile=..\LICENSE
OutputDir=.\output
OutputBaseFilename=SecureCrypt-Setup-{#MyAppVersion}
SetupIconFile=..\resources\icons\app.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
WizardImageFile=..\resources\images\wizard-large.bmp
WizardSmallImageFile=..\resources\images\wizard-small.bmp
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
MinVersion=10.0
CloseApplications=force
RestartApplications=no
ChangesAssociations=yes
ChangesEnvironment=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "quicklaunchicon"; Description: "{cm:CreateQuickLaunchIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked; OnlyBelowVersion: 6.1; Check: not IsAdminInstallMode

[Files]
Source: "..\build\bin\SecureCrypt.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\build\bin\*.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\resources\*"; DestDir: "{app}\resources"; Flags: ignoreversion recursesubdirs
Source: "..\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
Name: "{userappdata}\Microsoft\Internet Explorer\Quick Launch\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: quicklaunchicon

[Registry]
Root: HKA; Subkey: "Software\Classes\{#MyAppAssocExt}\OpenWithProgids"; ValueType: string; ValueName: "{#MyAppAssocKey}"; ValueData: ""; Flags: uninsdeletevalue
Root: HKA; Subkey: "Software\Classes\{#MyAppAssocKey}"; ValueType: string; ValueName: ""; ValueData: "{#MyAppAssocName}"; Flags: uninsdeletekey
Root: HKA; Subkey: "Software\Classes\{#MyAppAssocKey}\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#MyAppExeName},0"
Root: HKA; Subkey: "Software\Classes\{#MyAppAssocKey}\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""
Root: HKA; Subkey: "Software\Classes\Applications\{#MyAppExeName}\SupportedTypes"; ValueType: string; ValueName: ".scrypt"; ValueData: ""

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
function IsDotNetDetected(version: string; service: cardinal): boolean;
var
    key: string;
    install, release, serviceCount, versionRelease: cardinal;
    success: boolean;
begin
    result := false;
    
    if version = 'v4.0' then
        key := 'v4\Full'
    else
        key := version;
    
    success := RegQueryDWordValue(HKLM, 'SOFTWARE\Microsoft\NET Framework Setup\NDP\' + key, 'Install', install);
    
    if version = 'v4.0' then
        success := success and RegQueryDWordValue(HKLM, 'SOFTWARE\Microsoft\NET Framework Setup\NDP\' + key, 'Release', release);
    
    if success and (install = 1) then
    begin
        result := true;
    end;
end;

function InitializeSetup(): boolean;
begin
    result := true;
    
    if not IsDotNetDetected('v4.0', 0) then
    begin
        MsgBox('SecureCrypt requires .NET Framework 4.0 or later.', mbError, MB_OK);
        result := false;
    end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
    ResultCode: Integer;
begin
    if CurStep = ssPostInstall then
    begin
        // Set secure permissions on application directory
        Exec('icacls', '"' + ExpandConstant('{app}') + '" /grant Users:(OI)(CI)M', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;
end;

function InitializeUninstall(): boolean;
begin
    result := MsgBox('Are you sure you want to uninstall SecureCrypt?' + #13#10 + #13#10 +
                     'WARNING: This will NOT delete your encrypted data.' + #13#10 +
                     'Your encrypted files will remain in %LOCALAPPDATA%\SecureCrypt',
                     mbConfirmation, MB_YESNO) = idYes;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
    if CurUninstallStep = usUninstall then
    begin
        // Remove registry associations
        RegDeleteKeyIncludingSubkeys(HKA, 'Software\Classes\.scrypt');
        RegDeleteKeyIncludingSubkeys(HKA, 'Software\Classes\SecureCryptEncryptedFile.scrypt');
    end;
end;
