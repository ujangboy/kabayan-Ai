# Daftarkan folder proyek ke PATH user agar perintah `kp` bisa diketik dari
# terminal mana saja. Idempoten dan tidak mengubah token %VAR% yang sudah ada.

$dir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path.TrimEnd('\')
$key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', $true)
$current = [string]$key.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
$parts = @($current -split ';' | Where-Object { $_ })
$normalized = @($parts | ForEach-Object { $_.TrimEnd('\') })

if ($normalized -contains $dir) {
    $key.Close()
    Write-Host "PATH user sudah berisi: $dir"
    exit 0
}

$key.SetValue('Path', ((@($parts) + $dir) -join ';'), [Microsoft.Win32.RegistryValueKind]::ExpandString)
$key.Close()

# Beri tahu Explorer agar terminal yang dibuka setelah ini memakai PATH baru.
$signature = @'
using System;
using System.Runtime.InteropServices;
public static class Win32Broadcast {
    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam,
        string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);
}
'@
Add-Type -TypeDefinition $signature
[void][Win32Broadcast]::SendMessageTimeout([IntPtr]0xffff, 0x1A, [UIntPtr]::Zero,
    'Environment', 2, 5000, [ref]([UIntPtr]::Zero))

Write-Host "Ditambahkan ke PATH user: $dir"
