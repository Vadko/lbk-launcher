; LBK Launcher — Ukrainian installer strings in the project's voice.
;
; Why we override all nine keys (not just the missing five):
; electron-builder's `templates/nsis/messages.yml` provides Ukrainian for
; four of them, but in a flat, generic register that doesn't match LBK's
; tone ("От халепа...", direct polite "ви", friendly without emojis).
; Since we're already paying the LangString-redefinition cost for the
; missing five, we may as well restyle the rest to match the project.
;
; NSIS `LangString` reassignment emits warning 6030 ("set multiple times,
; wasting space"). electron-builder runs makensis with -WX, so we wrap
; the block in !pragma warning push/disable/pop to silence just 6030.
;
; This macro is inserted by electron-builder AFTER `!insertmacro addLangs`,
; which is the point at which ${LANG_UKRAINIAN} becomes defined.

!macro customHeader
  ; Window title bar — NSIS default is "$(^Name) $(^SetupCaption)" which in
  ; Ukrainian renders as "LBK Launcher Встановлення". Ukrainian word order
  ; reads more naturally as "Встановлення LBK Launcher", so we override.
  Caption "Встановлення $(^Name)"
  UninstallCaption "Видалення $(^Name)"

  !ifdef LANG_UKRAINIAN
    !pragma warning push
    !pragma warning disable 6030

    ; --- Shown during the actual install (most visible string).
    ; Keep it under ~45 characters. The one-click installer renders this with
    ; SpiderBanner into a single-line, fixed-width static control (control 1000,
    ; see app-builder-lib templates/nsis/installSection.nsh); anything wider is
    ; silently clipped, with no wrap and no ellipsis. The banner's size can't be
    ; configured — `SpiderBanner::Show` takes only position and distance — so
    ; the text is what has to fit. ---
    LangString installing ${LANG_UKRAINIAN} "Встановлюємо. Скоро гратимете українською!"

    ; --- App-already-running prompt before reinstall/update ---
    LangString appRunning ${LANG_UKRAINIAN} "Упс, ${PRODUCT_NAME} ще працює.$\r$\nНатисніть «ОК» — ми його чемно закриємо за вас.$\r$\nЯкщо не закриється — спробуйте вручну."
    LangString appCannotBeClosed ${LANG_UKRAINIAN} "Не вдалося закрити ${PRODUCT_NAME}.$\r$\nЗакрийте його вручну й натисніть «Повторити», щоб продовжити."
    LangString appClosing ${LANG_UKRAINIAN} "Закриваємо ${PRODUCT_NAME}..."

    ; --- Uninstall confirmation ---
    LangString areYouSureToUninstall ${LANG_UKRAINIAN} "Точно прощаємось з ${PRODUCT_NAME}?$\r$\nА як же грати в улюблені ігри українською?"

    ; --- Failure recovery messages ---
    LangString decompressionFailed ${LANG_UKRAINIAN} "От халепа... Не вдалося розпакувати файли.$\r$\nСпробуйте запустити встановлювач ще раз."
    LangString uninstallFailed ${LANG_UKRAINIAN} "От халепа... Не вдалося видалити старі файли застосунку.$\r$\nСпробуйте запустити встановлювач ще раз."

    ; --- Legacy-system gates (rarely shown but should still be on-brand) ---
    LangString win7Required ${LANG_UKRAINIAN} "Хм, схоже ваша Windows застаріла.$\r$\nПотрібна Windows 7 або новіша."
    LangString x64WinRequired ${LANG_UKRAINIAN} "Хм, схоже у вас 32-бітна Windows.$\r$\nПотрібна 64-бітна версія, щоб запустити LBK Launcher."

    !pragma warning pop
  !endif
!macroend

; Under Wine powershell.exe exits 0 for anything and findstr ignores /B and /C:, so the stock FIND_PROCESS always sees the app running.
; customCheckAppRunning makes the template skip getProcessInfo.nsh and $pid, which its Windows path still needs.
!include "getProcessInfo.nsh"
Var pid

!macro lbkIsWine _RESULT
  Push $0
  Push $1
  StrCpy $1 0
  System::Call 'kernel32::GetModuleHandle(t "ntdll.dll") p .r0'
  ${if} $0 != 0
    System::Call 'kernel32::GetProcAddress(p r0, m "wine_get_version") p .r1'
  ${endIf}
  ${if} $1 != 0
    StrCpy ${_RESULT} 1
  ${else}
    StrCpy ${_RESULT} 0
  ${endIf}
  Pop $1
  Pop $0
!macroend

!macro lbkWineCheckAppRunning
  nsProcess::_FindProcess "${APP_EXECUTABLE_FILENAME}"
  Pop $R0
  ${if} $R0 == 0
    ${ifNot} ${isUpdated}
      MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK IDOK lbkWineStop
      Quit
    ${endIf}
    lbkWineStop:
    DetailPrint "$(appClosing)"
    StrCpy $R1 0
    lbkWineLoop:
      nsProcess::_KillProcess "${APP_EXECUTABLE_FILENAME}"
      Pop $R0
      Sleep 1000
      nsProcess::_FindProcess "${APP_EXECUTABLE_FILENAME}"
      Pop $R0
      ${if} $R0 == 0
        IntOp $R1 $R1 + 1
        ${if} $R1 > 5
          MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY lbkWineRetry
          Quit
          lbkWineRetry:
          StrCpy $R1 0
        ${endIf}
        Goto lbkWineLoop
      ${endIf}
  ${endIf}
  nsProcess::_Unload
!macroend

!macro customCheckAppRunning
  !insertmacro lbkIsWine $R9
  ${if} $R9 == 1
    !insertmacro lbkWineCheckAppRunning
  ${else}
    !insertmacro IS_POWERSHELL_AVAILABLE
    !insertmacro _CHECK_APP_RUNNING
  ${endIf}
!macroend
