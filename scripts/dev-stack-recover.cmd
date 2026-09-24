@echo off
rem Autocuracion del stack dev SG-SST: detecta contenedores del compose
rem fuera de la red del proyecto y recrea el stack. Llamado por la tarea
rem programada "SG-SST dev stack recovery" (ver docs/convivencia-dev-prod-local.md).
bash "%~dp0dev-stack-recover.sh"
