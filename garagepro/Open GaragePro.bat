@echo off
rem Opens GaragePro in Google Chrome (or Microsoft Edge if Chrome is not installed).
rem Always use the SAME browser - your data is stored inside that browser on this PC.
set APP=%~dp0index.html
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%APP%" & exit /b
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%APP%" & exit /b
start "" msedge "%APP%"
