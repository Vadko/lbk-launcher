; Custom NSIS installer script for Ukrainian localization (Assisted installer)
; Forces Ukrainian as the primary language

; Override Multi-User page strings BEFORE pages are inserted
; These LangStrings override the electron-builder multiUser template
LangString multiUserInstallMode_AllUsers ${LANG_UKRAINIAN} "Встановити для всіх користувачів"
LangString multiUserInstallMode_CurrentUser ${LANG_UKRAINIAN} "Встановити тільки для мене"
LangString multiUserInstallMode_AllUsersDescription ${LANG_UKRAINIAN} "Встановити для всіх користувачів цього комп'ютера (потрібні права адміністратора)"
LangString multiUserInstallMode_CurrentUserDescription ${LANG_UKRAINIAN} "Встановити тільки для поточного користувача"
LangString multiUserInstallModePageTitle ${LANG_UKRAINIAN} "Виберіть режим встановлення"
LangString multiUserInstallModePageSubTitle ${LANG_UKRAINIAN} "Виберіть, для кого встановити $(^Name)."

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

; Custom install mode
!macro customInstallMode
  ; Nothing needed here - LangStrings above handle translation
!macroend

; Custom welcome page finish text (optional)
!macro customWelcomePageOption
  ; Custom welcome page options can be set here
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

; Remove files on uninstall (optional custom cleanup)
!macro customRemoveFiles
  ; Custom file removal logic
!macroend
