; LBK Launcher — Ukrainian translation overrides for electron-builder NSIS.
;
; electron-builder ships `templates/nsis/messages.yml` with only 4 of 9 keys
; translated into Ukrainian (verified in node_modules/app-builder-lib/.../messages.yml).
; The 5 missing keys fall back to English. There is no `buildResources/`
; override mechanism — `nsisLang.js` reads exclusively from `nsisTemplatesDir`.
;
; NSIS `LangString` allows reassignment ("the second value overwrites the
; first"). We exploit that by redefining the English-fallback strings for
; ${LANG_UKRAINIAN} inside `customHeader`, which electron-builder splices
; AFTER `!insertmacro addLangs` — at that point ${LANG_UKRAINIAN} is defined
; and the original LangString from messages.nsh has already been emitted.
;
; Skipped: `win7Required` / `x64WinRequired` (only shown on legacy/incompatible
; systems we don't realistically target).

!macro customHeader
  !ifdef LANG_UKRAINIAN
    LangString installing ${LANG_UKRAINIAN} "Встановлюємо, зачекайте..."
    LangString areYouSureToUninstall ${LANG_UKRAINIAN} "Ви впевнені, що хочете видалити ${PRODUCT_NAME}?"
    LangString appClosing ${LANG_UKRAINIAN} "Закриваємо ${PRODUCT_NAME}..."
    LangString win7Required ${LANG_UKRAINIAN} "Потрібна Windows 7 або новіша"
    LangString x64WinRequired ${LANG_UKRAINIAN} "Потрібна 64-бітна Windows"
  !endif
!macroend
