# LBK Launcher — AUR Package

Пакет для Arch Linux (AUR) застосунку **LBK Launcher** — інсталятора українізаторів відеоігор.

## Встановлення

### Через AUR-хелпер

```bash
yay -S lbk-launcher-bin
# або
paru -S lbk-launcher-bin
```

### Вручну

```bash
git clone https://aur.archlinux.org/lbk-launcher-bin.git
cd lbk-launcher-bin
makepkg -si
```

## Запуск

```bash
lbk-launcher
```

Або знайдіть **LBK Launcher** у меню застосунків.

## Для розробників

### Локальна збірка пакету

```bash
cd aur
makepkg -sf
```

### Встановлення локальної збірки

```bash
makepkg -si
```
