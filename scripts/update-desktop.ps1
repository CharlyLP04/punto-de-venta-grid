param([switch]$Watch)
$ErrorActionPreference = 'Stop'
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$outputs = [IO.Path]::GetFullPath((Join-Path $project '..'))
$desktopDirectory = [Environment]::GetFolderPath('Desktop')
if (!$desktopDirectory -or !(Test-Path -LiteralPath $desktopDirectory)) { throw 'No se encontro el escritorio de Windows.' }
$destination = Join-Path $desktopDirectory 'Grid POS.exe'
$binary = Join-Path $project 'src-tauri\target\release\grid-pos.exe'
$published = Join-Path $project 'Grid POS.exe'
$previous = Join-Path $project 'Grid POS anterior.exe'
$lockPath = Join-Path $project '.desktop-update.lock'
$lock = $null

function Get-SourceFingerprint {
    $paths = @('src','src-tauri/src','src-tauri/icons','src-tauri/capabilities')
    $files = @('package.json','package-lock.json','index.html','vite.config.ts','tsconfig.json','src-tauri/Cargo.toml','src-tauri/Cargo.lock','src-tauri/build.rs','src-tauri/tauri.conf.json')
    $items = @(
        foreach ($relative in $paths) {
            $folder = Join-Path $project $relative
            if (Test-Path -LiteralPath $folder) { Get-ChildItem -LiteralPath $folder -File -Recurse }
        }
        foreach ($relative in $files) {
            $file = Join-Path $project $relative
            if (Test-Path -LiteralPath $file) { Get-Item -LiteralPath $file }
        }
    )
    return (($items | Sort-Object FullName | ForEach-Object { '{0}|{1}' -f $_.FullName,(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }) -join "`n")
}

function Publish-Executable {
    # Stage in the destination directory so replacement is atomic, even across drives.
    $staged = Join-Path $desktopDirectory ('.grid-update-' + [guid]::NewGuid().ToString('N') + '.tmp')
    try {
        $sourceHash = (Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash
        Copy-Item -LiteralPath $binary -Destination $staged
        if ((Get-FileHash -LiteralPath $staged -Algorithm SHA256).Hash -ne $sourceHash) { throw 'La copia no coincide con el ejecutable compilado.' }
        if (Test-Path -LiteralPath $destination) {
            Copy-Item -LiteralPath $destination -Destination $previous -Force
            Move-Item -LiteralPath $staged -Destination $destination -Force
        } else {
            Move-Item -LiteralPath $staged -Destination $destination -Force
        }
        Copy-Item -LiteralPath $binary -Destination $published -Force
        if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash -ne $sourceHash) { throw 'No coincide el archivo final del escritorio.' }
        Write-Host "Actualizado: $destination" -ForegroundColor Green
        return $true
    } catch {
        Write-Warning "No se pudo publicar: $($_.Exception.Message)"
        Write-Warning 'Si Grid POS esta abierto, cierralo. No se cerrara la caja automaticamente.'
        return $false
    } finally {
        if (Test-Path -LiteralPath $staged) { Remove-Item -LiteralPath $staged -Force }
    }
}

try {
    # Prevent concurrent compilers/publishers for this checkout.
    $lock = [IO.File]::Open($lockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    Push-Location $project
    $attempted = $null
    $candidate = $null
    $pendingPublish = $false
    $retryAt = [datetime]::MinValue
    if ($Watch) { Write-Host 'Vigilando el codigo. Guarda cambios para actualizar el EXE. Ctrl+C para detener.' }
    while ($true) {
        $fingerprint = Get-SourceFingerprint
        if (!$Watch -or ($fingerprint -ne $attempted -and ($null -eq $attempted -or $fingerprint -eq $candidate))) {
            $attempted = $fingerprint
            $pendingPublish = $false
            Write-Host 'Compilando Grid POS (sin pruebas)...'
            & npm.cmd run tauri -- build --no-bundle
            $built = $LASTEXITCODE -eq 0
            if (!$built) {
                if (!$Watch) { throw 'La compilacion fallo. Se conserva el EXE anterior.' }
                Write-Warning 'La compilacion fallo. Corrige el codigo; se reintentara al guardar cambios.'
            } elseif (!$Watch -or (Get-SourceFingerprint) -eq $fingerprint) {
                $pendingPublish = !(Publish-Executable)
                $retryAt = [datetime]::Now.AddSeconds(10)
                if (!$Watch -and $pendingPublish) { throw 'Compilacion lista, publicacion pendiente. Cierra la app y repite el comando.' }
            } else {
                Write-Host 'Hubo cambios durante la compilacion; se compilara la version mas reciente antes de publicarla.'
            }
            if (!$Watch) { break }
        } elseif ($pendingPublish -and $fingerprint -eq $attempted -and [datetime]::Now -ge $retryAt) {
            $pendingPublish = !(Publish-Executable)
            $retryAt = [datetime]::Now.AddSeconds(10)
        }
        $candidate = $fingerprint
        Start-Sleep -Seconds 2
    }
} finally {
    if ($lock) { Pop-Location; $lock.Dispose() }
}
