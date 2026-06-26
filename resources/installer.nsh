; Custom NSIS include for LBK Launcher installer — dark themed pages.
; electron-builder injects customHeader before MUI2 inclusion AND already
; defines MUI_BGCOLOR / MUI_TEXTCOLOR with its own defaults, so we !undef
; first (guarded by !ifdef) before redefining with brand colors.
;
; Colors are RGB hex (no # prefix), consumed by MUI_BGCOLOR / MUI_TEXTCOLOR
; and forwarded to SetCtlColors by Modern UI internals.
;   #0F0F10 = brand base   (--bg-base)
;   #FFFFFF = primary text
;   #A8CF96 = brand main   (accent, future use)

!macro customHeader
  !ifdef MUI_BGCOLOR
    !undef MUI_BGCOLOR
  !endif
  !define MUI_BGCOLOR "0F0F10"

  !ifdef MUI_TEXTCOLOR
    !undef MUI_TEXTCOLOR
  !endif
  !define MUI_TEXTCOLOR "FFFFFF"

  !ifdef MUI_CUSTOMFUNCTION_GUIINIT
    !undef MUI_CUSTOMFUNCTION_GUIINIT
  !endif
  !define MUI_CUSTOMFUNCTION_GUIINIT lbkDarkInit
!macroend

!macro customUnHeader
  !ifdef MUI_BGCOLOR
    !undef MUI_BGCOLOR
  !endif
  !define MUI_BGCOLOR "0F0F10"

  !ifdef MUI_TEXTCOLOR
    !undef MUI_TEXTCOLOR
  !endif
  !define MUI_TEXTCOLOR "FFFFFF"

  !ifdef MUI_CUSTOMFUNCTION_UNGUIINIT
    !undef MUI_CUSTOMFUNCTION_UNGUIINIT
  !endif
  !define MUI_CUSTOMFUNCTION_UNGUIINIT un.lbkDarkInit
!macroend

; Paint the outer dialog (the area around MUI pages, where the button strip
; lives) with the brand base. Without this, the bottom band stays system-grey
; even though the page interior is dark.
Function lbkDarkInit
  SetCtlColors $HWNDPARENT FFFFFF 0F0F10
FunctionEnd

Function un.lbkDarkInit
  SetCtlColors $HWNDPARENT FFFFFF 0F0F10
FunctionEnd
