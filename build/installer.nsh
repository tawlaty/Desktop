; Runs on every install/update. Removes shortcuts left behind by the pre-1.2.0
; "Baristaflow" product name so only the "Tawlaty" shortcuts remain.
; Deliberately does NOT touch %APPDATA%\Baristaflow (settings.js migrates from it).
!macro customInstall
  SetShellVarContext current
  Delete "$DESKTOP\Baristaflow.lnk"
  Delete "$SMPROGRAMS\Baristaflow.lnk"
  Delete "$SMPROGRAMS\Baristaflow\Baristaflow.lnk"
  RMDir "$SMPROGRAMS\Baristaflow"
  SetShellVarContext all
  Delete "$DESKTOP\Baristaflow.lnk"
  Delete "$SMPROGRAMS\Baristaflow.lnk"
  Delete "$SMPROGRAMS\Baristaflow\Baristaflow.lnk"
  RMDir "$SMPROGRAMS\Baristaflow"
  SetShellVarContext current
!macroend
