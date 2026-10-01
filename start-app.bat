@echo off
setlocal

set "BASH_EXE="

for /f "delims=" %%B in ('where bash.exe 2^>nul') do (
  if not defined BASH_EXE set "BASH_EXE=%%B"
)

if not defined BASH_EXE if defined ProgramFiles if exist "%ProgramFiles%\Git\bin\bash.exe" set "BASH_EXE=%ProgramFiles%\Git\bin\bash.exe"
if not defined BASH_EXE if defined LocalAppData if exist "%LocalAppData%\Programs\Git\bin\bash.exe" set "BASH_EXE=%LocalAppData%\Programs\Git\bin\bash.exe"

if not defined BASH_EXE (
  for /f "delims=" %%G in ('where git.exe 2^>nul') do (
    if exist "%%~dpG..\bin\bash.exe" set "BASH_EXE=%%~dpG..\bin\bash.exe"
  )
)

if not defined BASH_EXE (
  echo Git Bash was not found. It is included with Git for Windows.
  where winget.exe >nul 2>nul
  if errorlevel 1 (
    echo Windows Package Manager is unavailable, so Git for Windows cannot be installed automatically.
    echo Install Git for Windows, then double-click start-app.bat again.
    start "" "https://git-scm.com/download/win"
    pause
    exit /b 1
  )

  echo Installing Git for Windows. Windows may ask for permission.
  winget install --id Git.Git --exact --silent --accept-package-agreements --accept-source-agreements
  if errorlevel 1 (
    echo Git for Windows could not be installed automatically.
    echo Install it from https://git-scm.com/download/win, then double-click start-app.bat again.
    start "" "https://git-scm.com/download/win"
    pause
    exit /b 1
  )

  if defined ProgramFiles if exist "%ProgramFiles%\Git\bin\bash.exe" set "BASH_EXE=%ProgramFiles%\Git\bin\bash.exe"
  if not defined BASH_EXE if defined LocalAppData if exist "%LocalAppData%\Programs\Git\bin\bash.exe" set "BASH_EXE=%LocalAppData%\Programs\Git\bin\bash.exe"
)

if not defined BASH_EXE (
  echo Git for Windows installed, but Git Bash could not be located.
  echo Restart Windows and double-click start-app.bat again.
  pause
  exit /b 1
)

"%BASH_EXE%" --login "%~dp0scripts\setup-and-run.sh"
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" pause
exit /b %EXIT_CODE%
