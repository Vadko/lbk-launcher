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

; Override the install mode page with Ukrainian translations
!macro customInstallMode
  ; Override multiUser LangStrings for Ukrainian (1058)
  !undef /noerrors MULTIUSER_INSTALLMODEPAGE_TEXT_TOP
  !define MULTIUSER_INSTALLMODEPAGE_TEXT_TOP "Виберіть, як встановити $(^NameDA):"

  !undef /noerrors MULTIUSER_INSTALLMODEPAGE_TEXT_ALLUSERS
  !define MULTIUSER_INSTALLMODEPAGE_TEXT_ALLUSERS "Встановити для всіх користувачів"

  !undef /noerrors MULTIUSER_INSTALLMODEPAGE_TEXT_CURRENTUSER
  !define MULTIUSER_INSTALLMODEPAGE_TEXT_CURRENTUSER "Встановити тільки для мене"
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
