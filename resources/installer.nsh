; Custom NSIS installer script for Ukrainian localization (Assisted installer)
; Forces Ukrainian as the primary language

; This macro runs before anything else
!macro preInit
  ; Set Ukrainian language early
  StrCpy $LANGUAGE 1058
!macroend

; Custom header - configure MUI
!macro customHeader
  ; Disable language selection dialog - use Ukrainian only
  !ifdef MUI_LANGDLL_ALLLANGUAGES
    !undef MUI_LANGDLL_ALLLANGUAGES
  !endif
!macroend

; This runs at installer initialization
!macro customInit
  ; Force Ukrainian language (LCID 1058)
  StrCpy $LANGUAGE 1058
!macroend

; Custom install section - runs during file installation
!macro customInstall
  ; Additional installation steps can be added here
!macroend

; Uninstaller initialization
!macro customUnInit
  ; Force Ukrainian for uninstaller too
  StrCpy $LANGUAGE 1058
!macroend

; Custom uninstall section
!macro customUnInstall
  ; Additional uninstallation steps can be added here
!macroend
