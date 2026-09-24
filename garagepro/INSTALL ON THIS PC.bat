@echo off
rem Installs GaragePro v3.1 (MendTech Auto + MendTech Mobile) on this PC.
rem Keeps a copy of the previous version in GaragePro-previous. Your data (inside Chrome / the cloud) is not touched.
set SRC=%~dp0
set DST=%USERPROFILE%\GaragePro
if exist "%DST%" robocopy "%DST%" "%USERPROFILE%\GaragePro-previous" /E /NFL /NDL /NJH /NJS /NP >nul
robocopy "%SRC%." "%DST%" /E /NFL /NDL /NJH /NJS /NP /XF "INSTALL ON THIS PC.bat" >nul
echo.
echo GaragePro v3.1 installed in %DST%
echo Open it from the Start menu (GaragePro) or https://mendtechauto.netlify.app
pause