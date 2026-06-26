; Custom NSIS include for LBK Launcher installer — dark themed pages.
; electron-builder injects customHeader before MUI2 inclusion, so MUI color
; defines here are picked up at macro-expansion time.
;
; Colors are RGB hex (no # prefix), consumed by MUI_BGCOLOR / MUI_TEXTCOLOR
; and forwarded to SetCtlColors by Modern UI internals.
;   #0F0F10 = brand base   (--bg-base)
;   #FFFFFF = primary text
;   #A8CF96 = brand main   (accent for hyperlinks/headings, future use)

!macro customHeader
  !define MUI_BGCOLOR "0F0F10"
  !define MUI_TEXTCOLOR "FFFFFF"
  !define MUI_CUSTOMFUNCTION_GUIINIT lbkDarkInit
!macroend

!macro customUnHeader
  !define MUI_BGCOLOR "0F0F10"
  !define MUI_TEXTCOLOR "FFFFFF"
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
