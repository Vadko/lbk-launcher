; LBK Launcher — dark-themed NSIS installer customization.
;
; HOW THIS LOADS:
; electron-builder splices `!include "<this file>"` into the generated script
; via `computeCommonInstallerScriptHeader()` — that lands BEFORE the bundled
; `installer.nsi` template runs, which means BEFORE `!include "MUI2.nsh"`.
; That ordering is the only place where MUI configuration defines (MUI_BGCOLOR,
; MUI_TEXTCOLOR, MUI_CUSTOMFUNCTION_GUIINIT, …) are still actionable —
; the `customHeader` extension point runs AFTER MUI2 and MUI page expansion,
; which is why we don't put theme defines there.
;
; TWO COMPILATION PASSES:
; NSIS compiles the script twice — once with BUILD_UNINSTALLER undefined
; (produces the installer .exe) and once with it defined (produces the
; uninstaller .exe). Any unreferenced function in either pass emits
; warning 6010, which electron-builder promotes to a fatal error. So
; pass-specific code lives inside `!ifdef BUILD_UNINSTALLER` / `!else`.
;
; BRAND COLORS (RGB hex, no `#`, consumed by SetCtlColors / MUI internals):
;   0F0F10 = brand base (--bg-base)
;   FFFFFF = primary text

; --- Global MUI theme — applied to BOTH installer and uninstaller pages. ---
!define MUI_BGCOLOR "0F0F10"
!define MUI_TEXTCOLOR "FFFFFF"

; --- Per-pass GUI init: paint the outer dialog frame to match the brand. ---
; MUI inserts the corresponding function call into .onGUIInit / un.onGUIInit
; only on its own side, so the function and the MUI_CUSTOMFUNCTION_*INIT
; define must be co-located inside the same !ifdef branch.
!ifdef BUILD_UNINSTALLER
  !define MUI_CUSTOMFUNCTION_UNGUIINIT un.lbkDarkInit
  Function un.lbkDarkInit
    SetCtlColors $HWNDPARENT FFFFFF 0F0F10
  FunctionEnd
!else
  !define MUI_CUSTOMFUNCTION_GUIINIT lbkDarkInit
  Function lbkDarkInit
    SetCtlColors $HWNDPARENT FFFFFF 0F0F10
  FunctionEnd
!endif
