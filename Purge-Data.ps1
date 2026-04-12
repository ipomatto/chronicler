#Requires -Version 5.1
<#
.SYNOPSIS
    Cancella tutti i file .md presenti nelle cartelle "data" del progetto Chronicler.
#>

$root = $PSScriptRoot
$dataFolders = Get-ChildItem -Path $root -Recurse -Directory -Filter "data" |
    Where-Object { $_.FullName -notlike "*node_modules*" }

$files = $dataFolders | ForEach-Object {
    Get-ChildItem -Path $_.FullName -Recurse -Filter "*.md"
} | Sort-Object FullName

if ($files.Count -eq 0) {
    Write-Host "Nessun file .md trovato nelle cartelle 'data'. Niente da fare." -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "File .md trovati ($($files.Count) totali):" -ForegroundColor Cyan
$files | ForEach-Object {
    Write-Host "  $($_.FullName.Replace($root, '.'))" -ForegroundColor DarkGray
}
Write-Host ""

# Conferma 1: seria
Write-Host "!!! ATTENZIONE !!!" -ForegroundColor Red
Write-Host "Stai per eliminare DEFINITIVAMENTE $($files.Count) file .md." -ForegroundColor Red
Write-Host "Questa operazione e' IRREVERSIBILE. I dati della campagna andranno perduti per sempre." -ForegroundColor Red
Write-Host ""
$r1 = Read-Host "Sei sicuro di voler procedere? (scrivi 'si' per confermare)"
if ($r1.Trim().ToLower() -ne "si") {
    Write-Host "Operazione annullata. I tuoi dati sono al sicuro." -ForegroundColor Green
    exit 0
}

Write-Host ""

# Conferma 2: spiritosa
Write-Host "Ok, hai detto 'si'. Ma sei DAVVERO sicuro?" -ForegroundColor Yellow
Write-Host "Perche' una volta che premi Invio, nemmeno un chierico di livello 20 potra' fare Raise Dead sui tuoi file." -ForegroundColor Yellow
Write-Host ""
$r2 = Read-Host "Ultima possibilita' prima del punto di non ritorno (scrivi 'si, davvero' per procedere)"
if ($r2.Trim().ToLower() -ne "si, davvero") {
    Write-Host "Saggio. I draghi della campagna ringraziano per la clemenza." -ForegroundColor Green
    exit 0
}

Write-Host ""

# Conferma 3: ancora piu' spiritosa
Write-Host "...Stai ancora andando avanti? Chapeau." -ForegroundColor Magenta
Write-Host "Il tuo Dungeon Master ti guardera' con sospetto per il resto della campagna." -ForegroundColor Magenta
Write-Host "Se vuoi davvero immolare $($files.Count) file sull'altare del caos, scrivi il sacro giuramento:" -ForegroundColor Magenta
Write-Host ""
$r3 = Read-Host "Digita 'cancella tutto, lo giuro sul dado a 20' per eseguire il rito"
if ($r3.Trim().ToLower() -ne "cancella tutto, lo giuro sul dado a 20") {
    Write-Host "Il dado ha parlato: 1. Missione fallita, file salvati." -ForegroundColor Green
    exit 0
}

Write-Host ""

# Esecuzione
$deleted = 0
$errors  = 0

foreach ($file in $files) {
    try {
        Remove-Item -Path $file.FullName -Force
        Write-Host "  Rimosso: $($file.FullName.Replace($root, '.'))" -ForegroundColor DarkGray
        $deleted++
    } catch {
        Write-Host "  ERRORE su: $($file.FullName) - $_" -ForegroundColor Red
        $errors++
    }
}

Write-Host ""
if ($errors -eq 0) {
    Write-Host "Fatto. $deleted file eliminati. La campagna e' ora un foglio bianco." -ForegroundColor Green
} else {
    Write-Host "Completato con errori: $deleted eliminati, $errors falliti." -ForegroundColor Yellow
}
