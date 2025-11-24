# 📦 Налаштування репозиторію для перекладів

## 🎯 Структура репозиторію

Створіть окремий публічний репозиторій для зберігання перекладів, метаданих та зображень.

---

## 📁 Крок 1: Створення репозиторію

```bash
# Створіть новий репозиторій на GitHub
# Назва: littlebit-translations (або littlebit-ua-translations)
# Опис: Українські переклади відеоігор - дані та релізи
# Публічний репозиторій

# Або через GitHub CLI:
gh repo create littlebit-translations \
  --public \
  --description "Українські переклади відеоігор" \
  --clone
```

---

## 📂 Крок 2: Початкова структура

```bash
cd littlebit-translations

# Створіть директорії
mkdir -p assets/{banners,logos,thumbnails}
mkdir -p scripts
mkdir -p .github/workflows

# Створіть основні файли
touch games.json
touch README.md
touch .gitignore
```

### Структура репозиторію:

```
littlebit-translations/
├── README.md                    # Опис проєкту
├── games.json                   # 🔥 Головний файл з метаданими ігор
├── .gitignore
├── assets/                      # 🖼️ Зображення
│   ├── banners/                # Банери ігор (1920x1080)
│   │   ├── yakuza-k2.jpg
│   │   ├── judgment.jpg
│   │   └── ...
│   ├── logos/                  # Логотипи ігор (800x400)
│   │   ├── yakuza-k2.png
│   │   ├── judgment.png
│   │   └── ...
│   └── thumbnails/             # Мініатюри (400x400)
│       ├── yakuza-k2.jpg
│       ├── judgment.jpg
│       └── ...
├── scripts/                    # Утиліти
│   ├── add-game.js            # Додати нову гру
│   ├── update-metadata.js     # Оновити метадані
│   └── validate.js            # Перевірка games.json
└── .github/
    └── workflows/
        ├── validate.yml       # Автоперевірка games.json
        └── create-release.yml # Створення релізів
```

---

## 🗂️ Крок 3: Створення games.json

```json
{
  "version": "1.0.0",
  "updated": "2024-11-24T12:00:00Z",
  "cdn": "https://github.com/YOUR_USERNAME/littlebit-translations/releases/download",
  "games": [
    {
      "id": "yakuza-kiwami-2",
      "slug": "yakuza-k2",
      "name": "Yakuza Kiwami 2",
      "nameUk": "Якудза Ківамі 2",
      "banner": "https://raw.githubusercontent.com/YOUR_USERNAME/littlebit-translations/main/assets/banners/yakuza-k2.jpg",
      "logo": "https://raw.githubusercontent.com/YOUR_USERNAME/littlebit-translations/main/assets/logos/yakuza-k2.png",
      "thumbnail": "https://raw.githubusercontent.com/YOUR_USERNAME/littlebit-translations/main/assets/thumbnails/yakuza-k2.jpg",
      "version": "1.0.2",
      "progress": {
        "translation": 99,
        "editing": 52,
        "voicing": 0
      },
      "platforms": ["steam", "gog"],
      "size": "156 MB",
      "updated": "2024-11-20T15:30:00Z",
      "team": "Little Bit UA",
      "description": "Повний український переклад Yakuza Kiwami 2. Переклад включає всі діалоги, текст та інтерфейс.",
      "releaseTag": "yakuza-k2-v1.0.2",
      "downloadFileName": "translation.zip",
      "installPaths": {
        "steam": "steamapps/common/Yakuza Kiwami 2/data",
        "gog": "Games/Yakuza Kiwami 2/data"
      },
      "status": "in-progress"
    }
  ]
}
```

---

## 📝 Крок 4: Створення README.md

```markdown
# 🎮 Little Bit - Українські переклади ігор

Репозиторій містить метадані та релізи українських перекладів відеоігор.

## 📥 Завантаження перекладів

Використовуйте [Little Bit](https://github.com/YOUR_USERNAME/littlebit-launcher) для автоматичного встановлення перекладів.

## 🎯 Список перекладів

- ✅ **Yakuza Kiwami 2** - 99% переклад
- ✅ **Judgment** - 100% переклад
- 🔄 **Lost Judgment** - в процесі (45%)
- 🔄 **Persona 5 Royal** - ранній доступ (15%)

## 👨‍💻 Для розробників

### Додати нову гру:
\`\`\`bash
node scripts/add-game.js "game-id" "slug" "Game Name" "Українська Назва"
\`\`\`

### Випустити новий переклад:
\`\`\`bash
# 1. Підготуйте translation.zip
# 2. Створіть реліз
gh release create game-id-v1.0.0 translation.zip \\
  --title "Game Name v1.0.0" \\
  --notes "Опис змін"
\`\`\`

## 🤝 Як долучитися

1. Fork репозиторій
2. Додайте ваш переклад
3. Створіть Pull Request

## 📄 Ліцензія

MIT
```

---

## 🛠️ Крок 5: Додавання скриптів

### scripts/add-game.js

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

if (process.argv.length < 6) {
  console.error('Usage: node add-game.js <id> <slug> <name> <nameUk>');
  console.error('Example: node add-game.js "yakuza-k2" "yakuza-k2" "Yakuza Kiwami 2" "Якудза Ківамі 2"');
  process.exit(1);
}

const [, , id, slug, name, nameUk] = process.argv;
const YOUR_USERNAME = 'YOUR_GITHUB_USERNAME'; // Замініть на ваш username

const newGame = {
  id,
  slug,
  name,
  nameUk,
  banner: `https://raw.githubusercontent.com/${YOUR_USERNAME}/littlebit-translations/main/assets/banners/${slug}.jpg`,
  logo: `https://raw.githubusercontent.com/${YOUR_USERNAME}/littlebit-translations/main/assets/logos/${slug}.png`,
  thumbnail: `https://raw.githubusercontent.com/${YOUR_USERNAME}/littlebit-translations/main/assets/thumbnails/${slug}.jpg`,
  version: "0.0.1",
  progress: {
    translation: 0,
    editing: 0,
    voicing: 0
  },
  platforms: [],
  size: "0 MB",
  updated: new Date().toISOString(),
  team: "Little Bit UA",
  description: "Опис перекладу...",
  releaseTag: `${slug}-v0.0.1`,
  downloadFileName: "translation.zip",
  installPaths: {},
  status: "in-progress"
};

const gamesPath = path.join(__dirname, '..', 'games.json');
const data = JSON.parse(fs.readFileSync(gamesPath, 'utf8'));

data.games.push(newGame);
data.updated = new Date().toISOString();

fs.writeFileSync(gamesPath, JSON.stringify(data, null, 2) + '\n');

console.log(`✅ Додано ${name} до games.json`);
console.log(`\n📝 Додайте зображення:`);
console.log(`   assets/banners/${slug}.jpg`);
console.log(`   assets/logos/${slug}.png`);
console.log(`   assets/thumbnails/${slug}.jpg`);
```

### scripts/validate.js

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const gamesPath = path.join(__dirname, '..', 'games.json');
const data = JSON.parse(fs.readFileSync(gamesPath, 'utf8'));

let errors = 0;

console.log('🔍 Валідація games.json...\n');

if (!data.version || !data.updated || !Array.isArray(data.games)) {
  console.error('❌ Невірна структура games.json');
  process.exit(1);
}

data.games.forEach((game, index) => {
  const required = ['id', 'slug', 'name', 'nameUk', 'progress', 'platforms'];

  required.forEach(field => {
    if (!game[field]) {
      console.error(`❌ Гра #${index + 1}: відсутнє поле "${field}"`);
      errors++;
    }
  });

  if (game.progress) {
    ['translation', 'editing', 'voicing'].forEach(type => {
      const val = game.progress[type];
      if (typeof val !== 'number' || val < 0 || val > 100) {
        console.error(`❌ ${game.name}: невірне значення progress.${type}`);
        errors++;
      }
    });
  }
});

if (errors === 0) {
  console.log('✅ Валідація пройшла успішно!');
  console.log(`📊 Всього ігор: ${data.games.length}`);
} else {
  console.error(`\n❌ Знайдено помилок: ${errors}`);
  process.exit(1);
}
```

Зробіть скрипти виконуваними:
```bash
chmod +x scripts/*.js
```

---

## 🚀 Крок 6: GitHub Actions

### .github/workflows/validate.yml

```yaml
name: Validate games.json

on:
  push:
    paths:
      - 'games.json'
  pull_request:
    paths:
      - 'games.json'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Validate games.json
        run: node scripts/validate.js
```

---

## 📦 Крок 7: Як публікувати переклади

### Спосіб 1: GitHub CLI (рекомендовано)

```bash
# 1. Підготуйте переклад
cd ~/my-translation-files
zip -r translation.zip ./

# 2. Створіть реліз
gh release create yakuza-k2-v1.0.0 \
  translation.zip \
  --repo YOUR_USERNAME/littlebit-translations \
  --title "Yakuza Kiwami 2 v1.0.0" \
  --notes "## Український переклад Yakuza Kiwami 2 v1.0.0

### 📥 Встановлення
Використовуйте додаток Little Bit для автоматичного встановлення

### 📝 Зміни
- Переклад основного сюжету
- Переклад субтитрів
- Локалізація інтерфейсу

### 📊 Статус
- Переклад: 99%
- Редагування: 52%
- Озвучення: 0%"

# 3. Оновіть games.json
node scripts/update-metadata.js --game-id yakuza-kiwami-2 --version 1.0.0
git add games.json
git commit -m "Update Yakuza Kiwami 2 to v1.0.0"
git push
```

### Спосіб 2: Через веб-інтерфейс GitHub

1. Перейдіть на https://github.com/YOUR_USERNAME/littlebit-translations/releases/new
2. Введіть тег: `yakuza-k2-v1.0.0`
3. Назва релізу: `Yakuza Kiwami 2 v1.0.0`
4. Додайте опис
5. Прикріпіть файл `translation.zip`
6. Натисніть "Publish release"

---

## 🔄 Крок 8: Оновлення додатку

Оновіть файл у вашому додатку:

**src/shared/constants.ts:**
```typescript
export const REPO_OWNER = 'YOUR_USERNAME'; // Ваш GitHub username
export const REPO_NAME = 'littlebit-translations'; // Назва репозиторію
export const GAMES_JSON_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/games.json`;
```

---

## 📊 Приклад повного workflow

### 1️⃣ Додати нову гру

```bash
cd littlebit-translations

# Додати метадані
node scripts/add-game.js \
  "judgment" \
  "judgment" \
  "Judgment" \
  "Джаджмент"

# Додати зображення
cp ~/images/judgment-banner.jpg assets/banners/judgment.jpg
cp ~/images/judgment-logo.png assets/logos/judgment.png
cp ~/images/judgment-thumb.jpg assets/thumbnails/judgment.jpg

# Оптимізувати зображення (опціонально)
# brew install imagemagick
mogrify -resize 1920x1080^ -quality 85 assets/banners/judgment.jpg
mogrify -resize 800x400 assets/logos/judgment.png
mogrify -resize 400x400^ -quality 85 assets/thumbnails/judgment.jpg

# Commit
git add .
git commit -m "Add Judgment to games list"
git push
```

### 2️⃣ Опублікувати переклад

```bash
# Підготувати файли
cd ~/my-judgment-translation
zip -r translation.zip ./

# Створити реліз
gh release create judgment-v1.0.0 \
  translation.zip \
  --repo YOUR_USERNAME/littlebit-translations \
  --title "Judgment v1.0.0" \
  --notes "Повний український переклад Judgment"

# Оновити метадані
cd ~/littlebit-translations
node scripts/update-metadata.js --game-id judgment --version 1.0.0
git add games.json
git commit -m "Release Judgment v1.0.0"
git push
```

### 3️⃣ Оновити існуючий переклад

```bash
# Нова версія перекладу
cd ~/my-judgment-translation
# ... внесіть зміни ...
zip -r translation.zip ./

# Новий реліз
gh release create judgment-v1.1.0 \
  translation.zip \
  --repo YOUR_USERNAME/littlebit-translations \
  --title "Judgment v1.1.0" \
  --notes "Виправлення та покращення"

# Оновити метадані
node scripts/update-metadata.js --game-id judgment --version 1.1.0
git add games.json
git commit -m "Update Judgment to v1.1.0"
git push
```

---

## 🎯 Переваги такої структури

✅ **Безкоштовно** - GitHub надає необмежене сховище для публічних репо
✅ **CDN** - Зображення автоматично роздаються через GitHub CDN
✅ **Версіонування** - Повна історія змін
✅ **Releases** - Зручне управління версіями перекладів
✅ **API** - Легкий доступ з додатку
✅ **Community** - Відкритий процес, можливість PR від спільноти
✅ **Автоматизація** - GitHub Actions для перевірки та релізів

---

## 📱 Що побачить користувач

1. Відкриє Little Bit додаток
2. Побачить список ігор з красивими зображеннями
3. Натисне "Встановити переклад"
4. Додаток завантажить останню версію з GitHub Releases
5. Автоматично встановить у папку гри

---

## 🔐 Безпека

- Всі файли публічні (це OK для перекладів)
- Не зберігайте приватну інформацію в games.json
- Переклади завантажуються через HTTPS
- GitHub Releases підписані та безпечні

---

## 📞 Наступні кроки

1. Створіть репозиторій `littlebit-translations`
2. Додайте початкові файли (games.json, скрипти)
3. Завантажте зображення для ваших ігор
4. Створіть перший реліз з перекладом
5. Оновіть константи в додатку на ваш GitHub username
6. Протестуйте завантаження

Готово! 🎉
