export const uk = {
  achievementsBadge: {
    settingOffDetail:
      'У налаштуваннях вимкнено «Швидке застосування параметрів запуску Steam» — без нього лаунчер не підключає плагін «LBK Bridge».',
    hidden: 'Не покажуться в Steam',
    millennium: 'Працюватиме через Millennium',
    decky: 'Працюватиме через Decky',
    afterRestart: "З'явиться після перезапуску Steam",
    needsMillennium: 'Потрібен Millennium',
    needsDeckyPlugin: 'Потрібен плагін для Decky',
    needsDecky: 'Потрібен Decky Loader',
  },
  achievementsNote: {
    needsMillennium:
      'Steam більше не показує перекладені досягнення зі звичайних файлів. Щоб встановити переклад досягнень і бачити його в бібліотеці, сповіщеннях та оверлеї Steam, потрібен Millennium. У меню самої гри назви лишаться мовою розробника.',
    needsDeckyPlugin:
      'Steam більше не показує перекладені досягнення зі звичайних файлів. Щоб встановити переклад досягнень і бачити його в бібліотеці, сповіщеннях та оверлеї Steam, потрібен плагін «LBK Bridge» для Decky Loader. У меню самої гри назви лишаться мовою розробника.',
    needsDecky:
      'Steam більше не показує перекладені досягнення зі звичайних файлів. На Steam Deck переклад досягнень показує плагін «LBK Bridge» для Decky Loader, тож спершу потрібен Decky Loader. У меню самої гри назви лишаться мовою розробника.',
    settingOff:
      'Переклад досягнень недоступний, поки вимкнено інтеграцію зі Steam. {{detail}}',
    unsupported:
      'Переклад досягнень недоступний: на цій системі Steam не може його показати. {{detail}}',
  },
  achievementsOption: {
    title: 'Досягнення Steam',
    checking: 'Перевірка…',
    description: 'Переклад досягнень Steam.',
    thirdPartyAuthor: 'Автор перекладу досягнень:',
  },
  adultWarning: {
    title: 'Контент для дорослих',
    message:
      'Ця гра містить контент для дорослих (18+). Щоб переглянути цю гру, увімкніть відповідне налаштування.',
    openSettings: 'Відкрити налаштування',
  },
  aiTranslationBadge: {
    edited: 'ШІ + редактура людиною',
    ai: 'Переклад ШІ',
  },
  appLoader: {
    tagline: 'Українізатор ігор',
    restartApp: 'Перезапустіть застосунок',
    status: {
      syncing: 'Синхронізація',
      error: "Помилка з'єднання",
      loading: 'Завантаження',
      ready: 'Завантаження',
    },
  },
  archiveDownload: {
    archiveNotFound: 'Архів {{type}} не знайдено',
    fetchingUrl: 'Отримання посилання для завантаження...',
    urlFailed: 'Не вдалося отримати посилання: {{error}}',
    refreshingUrl: 'Оновлення посилання на завантаження...',
    verifying: 'Перевірка цілісності файлу...',
    corrupted: 'Файл пошкоджено. Спробуйте завантажити ще раз.',
    completed: 'Завантаження завершено!',
  },
  authorSubscription: {
    title: 'Слідкувати за авторами',
    singleAuthor: 'Автор локалізації',
    authorsCount_one: '{{count}} автор локалізації',
    authorsCount_few: '{{count}} автори локалізації',
    authorsCount_many: '{{count}} авторів локалізації',
    authorsCount_other: '{{count}} автори локалізації',
    description_single:
      'Хочете отримувати сповіщення про нові локалізації від цього автора? Ви зможете змінити підписки в будь-який момент.',
    description_multiple:
      'Хочете отримувати сповіщення про нові локалізації від цих авторів? Ви зможете змінити підписки в будь-який момент.',
    subscribed: 'підписано',
    skip: 'Пропустити',
    subscribe: 'Підписатись',
    subscribeSelected: 'Підписатись ({{selected}})',
  },
  authorsList: {
    others: 'Інші автори:',
  },
  bridgeStatus: {
    connected: 'Підключено до Steam.',
    connectedDecky: 'Підключено до Steam через плагін «LBK Bridge» для Decky.',
    connectedMillennium: 'Підключено до Steam через плагін «LBK Bridge» для Millennium.',
    steamNotRunning: 'Steam не запущено.',
    restartPending: 'Щоб увімкнути швидке застосування, перезапустіть Steam один раз.',
    cefBlocked:
      'Steam не відкрив канал для лаунчера навіть після перезапуску, тож лаунчер більше не проситиме перезапускати Steam. Параметри запуску застосовуватимуться після закриття Steam. Можливо, канал блокує інший мод Steam.',
    millenniumOutdated:
      'Виявлено застарілий Millennium 2.x. Оновіть Millennium до версії 3 — тоді лаунчер зможе працювати з ним через плагін. До того параметри запуску застосовуватимуться після закриття Steam.',
  },
  catalogFilters: {
    title: 'Фільтри та сортування',
    apply: 'Переглянути',
    activeFilters: 'Активні фільтри',
    removeFilter: 'Зняти фільтр',
    statusSection: 'Статус',
    contentTypeSection: 'Тип контенту',
    translationTypeSection: 'Тип перекладу',
    librarySection: 'Бібліотека',
    authorsSection: 'Автори',
    tagsSection: 'Теги',
    searchAuthor: 'Пошук автора...',
    authorNotFound: 'Автора не знайдено',
    searchTag: 'Пошук категорії...',
    tagNotFound: 'Категорію не знайдено',
  },
  changelog: {
    title: 'Що нового',
    upcoming: 'Буде в оновленні',
    yourVersion: 'Ваша версія — v{{version}}',
    olderVersions: 'Попередні версії ({{total}})',
    fullList: 'Повний список змін на GitHub',
  },
  common: {
    cancel: 'Скасувати',
    selectFolder: 'Вибрати папку',
    error: 'Помилка',
    unknownError: 'Невідома помилка',
    installError: 'Помилка встановлення',
    uninstallError: 'Помилка видалення',
    close: 'Закрити',
    ok: 'Зрозуміло',
    notNow: 'Не зараз',
    dontOfferAgain: 'Більше не пропонувати',
    tryAgain: 'Спробувати ще раз',
    checkingSystem: 'Перевірка системи…',
    restartSteamNow: 'Перезапустити Steam зараз',
    afterSteamExit: 'Після закриття Steam',
  },
  confirmModal: {
    confirm: 'Підтвердити',
  },
  crashScreen: {
    uncaughtError: 'Необроблена помилка',
    unhandledRejection: 'Необроблений Promise rejection',
    intro:
      'На жаль, сталася критична помилка. Надішліть звіт, щоб ми могли виправити це швидше.',
    sendReport: 'Надіслати звіт про помилку',
    messagePlaceholder: "Опишіть що сталося (необов'язково)...",
    send: 'Надіслати',
    sending: 'Надсилання...',
    sent: '✅ Звіт надіслано. Дякуємо!',
    rateLimited: 'Зачекайте кілька хвилин',
    sendFailed: 'Помилка надсилання. Спробуйте пізніше',
    networkError: 'Помилка мережі',
    reload: '1. Перезавантажити',
    reloadHint: 'Швидке виправлення (зберігає всі дані)',
    clearCache: '2. Очистити кеш',
    clearCacheHint: 'Видалить тимчасові файли (зберігає налаштування)',
    clearAll: '3. Очистити всі дані ⚠️',
    clearAllHint: 'Видалить налаштування, підписки та всі дані',
    techInfo: 'Технічна інформація',
    errorLabel: 'Помилка:',
  },
  deckyLoader: {
    offerIntro:
      'Decky Loader — безкоштовний сторонній завантажувач плагінів для Steam Deck (не від Valve). Лаунчер може встановити його разом із плагіном «LBK Bridge».',
    offerBenefits:
      'Що це дасть:\n• перекладені досягнення в бібліотеці, сповіщеннях і оверлеї Steam.',
    offerWithout:
      'Що працює й без Decky Loader: параметри запуску, підписки в Майстерні, колекція «З українізаторами», ярлик лаунчера та обкладинки в Steam.',
    offerInstaller:
      'Лаунчер завантажить офіційний інсталятор Decky Loader з GitHub і запустить його. Пароль адміністратора (sudo) інсталятор питає у власному вікні, лаунчер його не бачить. Якщо пароля ще немає, інсталятор запропонує тимчасовий і прибере його після встановлення.',
    offerCaveat:
      'Зважте: після великих оновлень SteamOS Decky Loader іноді доводиться встановити ще раз.',
    repair:
      'Decky Loader встановлено, але він не працює — схоже, попереднє встановлення не завершилося. Лаунчер може запустити офіційний інсталятор Decky Loader ще раз.',
    gameMode:
      'Інсталятор Decky Loader працює лише в режимі робочого столу. Перейдіть у нього через меню живлення Steam, відкрийте лаунчер і натисніть «Встановити Decky Loader» ще раз.',
    installing:
      'Відкрито інсталятор Decky Loader. Введіть пароль адміністратора у вікні «Decky Installer» і оберіть «release». Якщо вікна не видно, знайдіть його на панелі завдань.',
    failure: {
      'download-failed':
        "Не вдалося завантажити інсталятор Decky Loader. Перевірте з'єднання з інтернетом і спробуйте ще раз.",
      'checksum-mismatch':
        'Завантажений інсталятор Decky Loader не збігається з перевіреною версією. Встановлення скасовано.',
      unsupported:
        'На цій системі лаунчер не може встановити Decky Loader. Встановіть його за інструкцією на сайті Decky Loader.',
      'not-running':
        'Decky Loader встановлено, але він не запустився. Спробуйте ще раз — інсталятор перевстановить його.',
      'not-installed':
        'Decky Loader не встановлено. Якщо вікно інсталятора закрито або пароль не підійшов, спробуйте ще раз.',
    },
    whatIs: 'Що таке Decky Loader',
    repairAction: 'Відновити Decky Loader',
    installAction: 'Встановити Decky Loader',
  },
  deckyPlugin: {
    waiting: 'Очікування LBK Launcher',
    connected: 'Підключено до LBK Launcher',
    viaMillennium: 'Працює через Millennium',
  },
  deckySetup: {
    title: 'Плагін «LBK Bridge» для Decky Loader',
    waiting:
      'Підтвердіть встановлення плагіна «LBK Bridge» у вікні Decky Loader. Якщо вікна не видно, натисніть кнопку Steam.',
    fallback:
      'Не вдалося відкрити запит Decky Loader. Збережіть плагін і встановіть його вручну: Decky → Налаштування → Розробник → Install Plugin from ZIP.',
    done: "Плагін «LBK Bridge» встановлено. Переклад досягнень з'явиться в Steam.",
    saveZip: 'Зберегти ZIP',
    saved: 'Файл збережено: {{path}}',
    saveFailed: 'Не вдалося зберегти файл.',
    saveFailedWithError: 'Не вдалося зберегти файл: {{error}}',
    intro:
      'Плагін показує в Steam перекладені досягнення — у бібліотеці, сповіщеннях і оверлеї. Усе інше лаунчер уміє й без нього. Decky Loader покаже запит на встановлення — підтвердьте його в Steam.',
    noDecky:
      'Decky Loader не знайдено. Спершу встановіть Decky Loader — після цього лаунчер зможе додати до нього плагін «LBK Bridge».',
    loaderDone: 'Decky Loader встановлено.',
    pluginReady: 'Плагін «LBK Bridge» для Decky Loader уже встановлено.',
    pluginUpdate: 'Доступне оновлення плагіна «LBK Bridge» для Decky.',
    updatePlugin: 'Оновити плагін для Decky',
    installPlugin: 'Встановити плагін',
  },
  download: {
    paused: 'Завантаження призупинено',
    pauseFailed: 'Не вдалося призупинити завантаження',
    resuming: 'Продовження завантаження...',
    resumeFailed: 'Не вдалося продовжити завантаження',
    cancelled: 'Завантаження скасовано',
    retryAttempt:
      'Спроба {{attempt}}/{{maxRetries}}... Перевірте підключення до Інтернету.',
    downloading: 'Завантаження українізатора...',
    connectionLost: "З'єднання втрачено. Перевірте підключення до Інтернету.",
    networkRetry: 'Помилка мережі. Спроба {{attempt}}/{{maxRetries}}...',
    failedAfterRetries:
      'Не вдалося завантажити файл після {{maxRetries}} спроб.\n\nОстання помилка: {{error}}\n\nПеревірте підключення до Інтернету та спробуйте ще раз.',
    rangeUnsupported: 'Сервер не підтримує продовження, перезапуск...',
    fileChanged: 'Файл на сервері змінився, потрібно перезапустити завантаження',
    timeout: 'Час очікування вичерпано. Перевірте підключення до Інтернету.',
    failed: 'Помилка завантаження',
    httpError: 'Помилка завантаження: HTTP {{statusCode}} {{statusMessage}}',
    noInternet: 'Відсутнє підключення до Інтернету',
    connectFailed:
      'Не вдалося підключитися до сервера. Перевірте підключення до Інтернету.',
    connectionReset: "З'єднання розірвано. Перевірте підключення до Інтернету.",
    serverUnavailable: 'Сервер недоступний',
    serverUnavailableRetry: 'Сервер недоступний. Спробуйте пізніше.',
    failedCheckConnection: 'Помилка завантаження. Перевірте підключення до Інтернету.',
    failedWithError: 'Помилка завантаження: {{error}}',
  },
  downloadLimit: {
    message:
      'Перевищено ліміт завантажень.\n\n{{used}}\n{{max}}\n\nСпробуйте знову після {{time}}.',
    used_one: 'Ви вже завантажили цю гру {{count}} раз за останні 24 години.',
    used_few: 'Ви вже завантажили цю гру {{count}} рази за останні 24 години.',
    used_many: 'Ви вже завантажили цю гру {{count}} разів за останні 24 години.',
    used_other: 'Ви вже завантажили цю гру {{count}} рази за останні 24 години.',
    max_one: 'Максимум дозволено: {{count}} завантаження на добу для великих ігор.',
    max_few: 'Максимум дозволено: {{count}} завантаження на добу для великих ігор.',
    max_many: 'Максимум дозволено: {{count}} завантажень на добу для великих ігор.',
    max_other: 'Максимум дозволено: {{count}} завантаження на добу для великих ігор.',
    unknownTime: 'невідомо',
  },
  downloadProgress: {
    downloadingFiles: 'Завантаження файлів...',
    pause: 'Пауза',
    resume: 'Продовжити',
    pauseResumeFailed: 'Не вдалося змінити стан завантаження',
    cancelFailed: 'Не вдалося скасувати завантаження',
    downloaded: 'Завантажено:',
    speed: 'Швидкість:',
    speedValue: '{{speed}}/с',
    timeLeft: 'Залишилось часу:',
  },
  duration: {
    underSecond: '< 1с',
  },
  favoriteToggle: {
    add: 'Додати в улюблені',
    remove: 'Видалити з улюблених',
  },
  feedbackModal: {
    title: 'Лишити відгук',
    type: {
      feedback: 'Відгук',
      error: 'Помилка',
    },
    typeLabel: 'Тип',
    descriptionLabel: 'Опис',
    placeholder_feedback: 'Опишіть ваш відгук та пропозиції ...',
    placeholder_error: 'Опишіть де саме помилка, яка мова в грі встановлена ...',
    screenshotsLabel: "Скріншоти (Необов'язково)",
    dropzone: '<hl>Оберіть файл</hl> або перетягніть сюди',
    submit: 'Надіслати',
    screenshotsFailed: 'Не вдалося завантажити скріншоти',
    screenshotFailed: 'Помилка завантаження скріншоту: {{name}}',
    rateLimit: 'Зачекайте кілька хвилин перед наступним звітом',
    sendFailed: 'Не вдалося надіслати звіт',
    networkError: 'Помилка мережі. Спробуйте пізніше',
    thanks: 'Дякуємо за звіт!',
    sent: 'Ваш звіт було надіслано автору перекладу',
  },
  filterBar: {
    filters: 'Фільтри',
    clearAll: 'Очистити всі фільтри',
    showInstalled: 'Показати завантажені переклади',
    hideInstalled: 'Приховати завантажені переклади',
    showFavorites: 'Показати улюблене',
    hideFavorites: 'Приховати улюблене',
    sort: 'Сортування',
  },
  filterOptions: {
    status: {
      planned: 'Заплановано',
      'in-progress': 'Ранній доступ',
      completed: 'Готово',
      'tech-improvement': 'Технічна доробка',
    },
    library: {
      'favorite-translations': 'Улюблені українізатори',
      'installed-translations': 'Встановлені українізатори',
      'installed-games': 'Встановлені ігри',
      'available-in-steam': 'Доступно зі Steam',
      'owned-gog-games': 'Доступно з GOG',
      'owned-epic-games': 'Доступно з Epic',
      'installed-xbox-games': 'Встановлено з Xbox app',
    },
    contentType: {
      'with-achievements': 'З перекладом досягнень',
      'with-voice': 'З озвученням',
      'from-workshop': 'З Майстерні Steam',
    },
    translationType: {
      manual: 'Ручний переклад',
      ai: 'ШІ переклад',
      'ai-edited': 'ШІ + редагування',
    },
    sort: {
      name: 'За назвою',
      downloads: 'За популярністю',
      subscribers: 'За кількістю підписників',
      newest: 'За новизною',
    },
  },
  fundraising: {
    title: 'Збір коштів',
    raised: 'Зібрано',
    goal: 'Ціль',
  },
  gameActions: {
    play: 'Грати',
    removedFromCatalog: 'Переклад більше не доступний у каталозі',
    offline: 'Відсутнє підключення до Інтернету',
    rerunTitle: 'Запустити інсталятор/скрипт повторно',
    rerun: 'Перевстановити',
    uninstallTitle: 'Видалити українізатор',
    support: 'Підтримати',
    feedback: 'Лишити відгук',
    cancel: 'Скасувати',
  },
  gameAuthors: {
    many: 'Автори локалізації',
    one: 'Автор локалізації',
  },
  gameCard: {
    unknownAuthor: 'Невідомий автор',
    downloadedByPlayers: 'Завантажено гравцями',
  },
  gameHero: {
    share: 'Поділитися',
  },
  gameLike: {
    like: 'Оцінити',
    unlike: 'Зняти оцінку',
    needsInstall: 'Встановіть переклад, щоб оцінити',
  },
  gameInfo: {
    title: 'Інформація',
    award: 'Відзнака',
    platforms: 'Платформи',
    version: 'Версія',
    size: 'Розмір',
    voice: 'Озвучення',
    achievements: 'Досягнення',
    achievementsBy: 'від {{author}}',
    subscribers: 'Підписників',
    downloads: 'Завантажень',
    downloadsUnder20: 'до 20',
    created: 'Створено',
    updated: 'Оновлено',
  },
  gameLanguage: {
    EN: 'англійську',
    GB: 'британську',
    FR: 'французьку',
    IT: 'італійську',
    DE: 'німецьку',
    ES: 'іспанську',
    JA: 'японську',
    KO: 'корейську',
    PL: 'польську',
    CS: 'чеську',
    ZH_CN: 'китайську (спрощена)',
    ZH_TW: 'китайську (традиційна)',
    ZH: 'китайську',
    PT: 'португальську',
    UK: 'українську',
  },
  gameLaunch: {
    executableNotFound: 'Не вдалося знайти виконуваний файл гри',
  },
  gameLinks: {
    title: 'Посилання',
    stores: 'Крамниці',
    other: 'Інше',
    openIn: 'Відкрити в {{store}}',
    steamGuide: 'Steam посібник',
    website: 'Вебсайт',
  },
  gameList: {
    loadFailed: 'Помилка завантаження ігор',
  },
  gameNotice: {
    kind_installer: 'Інсталятор',
    kind_script: 'Скрипт',
    language: 'В налаштуваннях гри оберіть <accent>{{language}} мову</accent>',
  },
  gamePage: {
    tombstone:
      'Цей переклад більше не доступний у каталозі. Ви можете лише видалити локалізацію — повторне встановлення недоступне.',
    uninstalling: 'Видалення українізатора та відновлення оригінальних файлів...',
  },
  gameSearch: {
    placeholder: 'Пошук гри...',
  },
  gameSections: {
    aboutTranslation: 'Про українізатор',
    aboutGame: 'Про гру',
  },
  gameStatus: {
    planned: 'Заплановано',
    inProgress: 'Ранній доступ',
    completed: 'Завершено',
    techImprovement: 'Технічна доробка',
  },
  gameSubscribe: {
    subscribedTitle: 'Ви отримуєте сповіщення про "{{game}}"',
    subscribeTitle: 'Отримувати сповіщення про "{{game}}"',
    unsubscribe: 'Вимкнути сповіщення',
    subscribe: 'Отримувати сповіщення',
  },
  gameVideo: {
    title: 'Відео',
    watch: 'Переглянути відео',
    trailer: 'Трейлер українізації',
    play: 'Відтворити',
  },
  gamepadHelp: {
    title: 'Керування геймпадом',
    deckKeyboard: 'На Steam Deck екранна клавіатура відкривається комбінацією STEAM + X.',
    everywhere: {
      title: 'Скрізь',
      move: 'Перейти до сусіднього елемента (утримуйте — швидше)',
      press: 'Натиснути / відкрити',
      back: 'Назад або закрити вікно',
      scroll: 'Плавна прокрутка',
      search: 'Пошук гри',
      home: 'Головна сторінка',
      settings: 'Налаштування',
      help: 'Ця довідка',
    },
    feed: {
      title: 'Стрічка перекладів',
      adjacent: 'Попередній / наступний переклад',
      page: 'Гортати на цілий екран',
      ends: 'На початок / в кінець списку',
      header: 'Верхнє меню: пошук, фільтри, новини',
      content: 'До вмісту сторінки',
      home: 'На головну зі сторінки перекладу',
    },
    gamePage: {
      title: 'Сторінка перекладу',
      move: 'До кнопки чи картки в цьому напрямку',
      scroll: 'Прокрутити на екран вгору / вниз',
      adjacent: 'Попередній / наступний переклад',
      back: 'Нагорі сторінки — назад до стрічки перекладів',
    },
    dialogs: {
      title: 'Вікна та поля вводу',
      startTyping: 'На полі вводу — почати друк',
      stopTyping: 'Завершити друк; ще раз — закрити вікно',
      clearSearch: 'На полі пошуку — очистити його',
      leaveList: 'У списку авторів чи тегів — вийти зі списку',
      scroll: 'Прокрутити вікно на екран',
    },
  },
  gamepadHints: {
    allButtons: 'Усі кнопки',
    finishInput: 'Завершити введення',
    clear: 'Очистити',
    select: 'Вибрати',
    items: 'Пункти',
    navigation: 'Навігація',
    scroll: 'Прокрутка',
    open: 'Відкрити',
    menu: 'Меню',
    toGames: 'До ігор',
    games: 'Ігри',
    page: 'Сторінка',
    search: 'Пошук',
    home: 'Головна',
    adjacentTranslation: 'Сусідній переклад',
  },
  homeSections: {
    newGames: 'Новинки',
    newTranslations: 'Нові переклади',
    updates: 'Оновлення',
    popular: 'Популярне у гравців',
    installedGames: 'Знайдено встановлені ігри',
    recommended: 'Вас може зацікавити',
    viewAll: 'Переглянути всі',
    noGames: 'Ігор не знайдено',
    back: 'Назад',
  },
  install: {
    rateLimitTitle: 'Ліміт завантажень',
  },
  installArchive: {
    extracting: 'Розпакування файлів... {{percent}}%',
    extracted: 'Розпакування завершено',
    extractFailed: 'Помилка розпакування архіву: {{error}}',
  },
  installBackup: {
    backupFailed: 'Помилка створення резервної копії: {{error}}',
    restoreFailed: 'Помилка відновлення файлів: {{error}}',
  },
  installButton: {
    offline: 'Немає інтернету',
    planned: 'Заплановано',
    techImprovement: 'Технічна доробка',
    reload: 'Перезавантажити (v{{version}})',
    update: 'Оновити до v{{version}}',
    install: 'Встановити українізатор',
  },
  installComponents: {
    removing: 'Видалення компонентів...',
    removeFailed: 'Не вдалося видалити компоненти',
    removedTitle: 'Компоненти видалено',
    removedMessage: 'Вибрані компоненти успішно видалено.',
  },
  installConflict: {
    title: 'Інша локалізація вже встановлена',
    message:
      'У папці гри вже встановлено іншу локалізацію:\n\n"{{name}}"{{team}}\nВерсія: {{version}}\n\nЩоб встановити нову локалізацію, потрібно спочатку видалити попередню.\n\nВидалити попередню локалізацію?',
    confirm: 'Видалити і продовжити',
    infoNotFound: 'Не вдалося знайти інформацію про встановлену локалізацію.',
    removeFailed: 'Не вдалося видалити попередню локалізацію.',
    unknownLocalization: 'Невідома локалізація',
  },
  installEmulator: {
    title: 'Виберіть папку з грою',
    message:
      'Для емуляторів потрібно вручну вказати папку з грою.\n\nВиберіть папку з грою?',
  },
  installFailure: {
    network: 'Не вдалося підключитися до сервера.\n\nПеревірте підключення до Інтернету.',
    permission:
      'Недостатньо прав для встановлення.\n\nЗапустіть застосунок від імені адміністратора.',
    diskSpace: 'Недостатньо місця на диску.\n\nЗвільніть місце та спробуйте знову.',
    notFound: 'Файл або папку не знайдено.\n\nПереконайтеся, що гра встановлена.',
    unknown: 'Невідома помилка встановлення.\n\nСпробуйте ще раз.',
    copyFailed: 'Помилка копіювання файлів: {{error}}',
    signing: 'Підписання застосунку...',
  },
  installGameNotFound: {
    title: 'Гру не знайдено',
    message: '{{error}}\n\nСпробуйте вибрати папку гри самостійно',
  },
  installIpc: {
    fileNotFound: 'Файл не знайдено',
    pickFolderTitle: 'Виберіть папку з грою',
    pickFolderButton: 'Вибрати',
    noActiveDownload: 'Немає активного завантаження для призупинення',
    noPausedDownload: 'Немає призупиненого завантаження',
  },
  installNetwork: {
    interruptedTitle: "З'єднання перервано",
    interruptedMessage:
      'Не вдалося відновити завантаження автоматично.\n\nПеревірте підключення до Інтернету та спробуйте знову.\nПрогрес завантаження збережено.',
    retry: 'Спробувати знову',
    waiting:
      "З'єднання втрачено. Завантаження продовжиться автоматично після відновлення з'єднання...",
    resuming: 'Відновлення завантаження...',
    offlineTitle: 'Немає підключення',
    offlineMessage: 'Перевірте підключення до Інтернету та спробуйте ще раз.',
  },
  installOptions: {
    reinstallTitle: 'Керування компонентами',
    installTitle: 'Опції встановлення',
    reinstallIntro: 'Оберіть компоненти для "{{name}}":',
    installIntro: 'Виберіть опції для встановлення українізатора "{{name}}":',
    platformAuto: 'Автоматично ({{platform}})',
    platformManual: 'Ручний вибір ({{platform}})',
    platformFound: 'Знайдено',
    platformNotFound: 'Не знайдено (вибір вручну)',
    platformLabel: 'Платформа гри',
    platformPlaceholder: 'Оберіть платформу',
    backupTitle: 'Створити резервну копію',
    backupDescription:
      'Зберегти оригінальні файли гри. Рекомендовано для можливості відновлення.',
    backupSize: 'Орієнтовний розмір: {{size}}',
    textTitle: 'Текстова локалізація',
    installed: 'встановлено',
    textDescription: 'Переклад текстів гри українською.',
    size: 'Розмір: {{size}}',
    willReinstall: 'Буде перевстановлено',
    willInstall: 'Буде встановлено',
    voiceTitle: 'Озвучення',
    unavailable: '(недоступно)',
    voiceWithText: '(разом з текстовою)',
    voiceDescription: 'Українське озвучення.',
    willRemove: 'Буде видалено',
    willDownload: 'Буде завантажено',
    launchOptions:
      'Цей переклад встановить власні <hl>параметри запуску</hl> для гри в Steam.',
    totalDownload: 'Буде завантажено:',
    removeList: 'Буде видалено: {{items}}',
    removeVoice: 'озвучення',
    removeAchievements: 'досягнення',
    confirm: 'Встановити',
  },
  installPlatform: {
    linuxOnly:
      'Цей українізатор доступний тільки для Linux. Встановлення на Windows неможливе.',
    windowsOnly:
      'Цей українізатор доступний тільки для Windows. Встановлення на macOS неможливе.',
    unsafeCmdPath: 'шлях містить символи, небезпечні для командного рядка: {{path}}',
    exitFailedOrCancelled: 'Встановлення завершилось з помилкою або було скасовано',
    exitCancelled: 'Встановлення скасовано',
    exitCode: 'Інсталятор завершився з кодом {{code}}',
    installerOutput: '\n\nВивід інсталятора:\n{{output}}',
    installerFileNotFound: 'файл інсталятора не знайдено: {{path}}',
    launching: 'Запуск інсталятора...',
    protonSetup: 'Налаштування та запуск Proton',
    notCompleted: 'встановлення не було завершене',
    windowsNeedsProton: 'Windows інсталятор ({{extensions}}) потребує Proton.',
    runFailed: 'Не вдалося запустити інсталятор: {{error}}',
    uninstallerFailed: 'Не вдалося запустити деінсталятор: {{error}}',
    rerunFailed: 'Повторний запуск інсталятора не вдався',
  },
  installStatus: {
    installing: 'Встановлення українізатора...',
    updating: 'Оновлення українізатора...',
    offlinePaused: 'Відсутнє підключення до Інтернету. Завантаження призупинено.',
    error: 'Помилка встановлення',
    update: 'Доступне оновлення:',
    installed: 'Українізатор встановлено:',
  },
  installSteamIntegration: {
    launchOptions: 'Налаштування параметрів запуску Steam...',
    artwork: 'Встановлення українських обкладинок Steam...',
  },
  installSteps: {
    licenseOnlyManual:
      'Встановлення цього перекладу доступне тільки для ліцензійної версії гри.\n\nРучний вибір папки заборонено.',
    licenseOnlyNotFound:
      'Встановлення цього перекладу доступне тільки для ліцензійної версії гри.\n\nГру не знайдено. Переконайтеся, що ліцензійна версія гри встановлена через офіційний магазин (Steam, GOG, Epic Games, Ubisoft Connect, EA App тощо).',
    gameNotFound:
      'Гру не знайдено\n\nМи не змогли автоматично визначити шлях до папки: {{path}}',
    pathNotSpecified: 'не вказано',
    protonMissing:
      'Цей українізатор має Windows-інсталятор, для якого потрібен Proton, але жодної версії не знайдено.\n\nВстановіть Proton у Steam і спробуйте ще раз.',
    notEnoughSpace:
      'Недостатньо місця на диску.\n\nНеобхідно: {{needed}}\nДоступно: {{available}}\n\nЗвільніть місце та спробуйте знову.',
    noArchiveForBuild:
      'Для встановленої збірки гри ({{build}}) немає архіву перекладу.\n\nПереклад доступний лише для: {{variants}}.',
    voiceStatus: 'Озвучення: {{message}}',
    copying: 'Копіювання файлів українізатора...',
    cleaning: 'Очищення тимчасових файлів...',
    backingUp: 'Створення резервної копії...',
    awaitingConfirm_installer: 'Очікування підтвердження запуску інсталятора...',
    awaitingConfirm_script: 'Очікування підтвердження запуску скрипта...',
    runDeclined_installer:
      'Встановлення скасовано: запуск інсталятора було відхилено.\n\nФайли розпаковано в папку гри — ви можете запустити інсталятор пізніше кнопкою «Перевстановити».',
    runDeclined_script:
      'Встановлення скасовано: запуск скрипта було відхилено.\n\nФайли розпаковано в папку гри — ви можете запустити скрипт пізніше кнопкою «Перевстановити».',
    macBundleUnresolved:
      'Не вдалося визначити місце встановлення всередині macOS-бандла (.app).\n\nДля цієї гри потрібен окремий macOS-архів перекладу.',
    status: 'Досягнення: {{message}}',
  },
  installSuccess: {
    updatedMessage: 'Українізатор {{name}} успішно оновлено до версії {{version}}!',
    installedMessage: 'Українізатор {{name}} успішно встановлено!',
    updatedTitle: 'Українізатор оновлено',
    installedTitle: 'Українізатор встановлено',
    pluginNextStart: "Переклад досягнень з'явиться після наступного запуску Steam.",
    needsMillenniumInstallable:
      'Переклад досягнень збережено. Щоб бачити його в Steam, потрібен Millennium — лаунчер може встановити його сам.',
    needsMillennium:
      'Переклад досягнень збережено. Щоб бачити його в Steam, потрібен Millennium.',
    needsDeckyPlugin:
      'Переклад досягнень збережено. Щоб бачити його в Steam, встановіть плагін «LBK Bridge» для Decky Loader.',
    needsDecky:
      'Переклад досягнень збережено. На Steam Deck його показує плагін «LBK Bridge» для Decky Loader — лаунчер може встановити Decky Loader сам.',
    unavailable:
      'Переклад досягнень збережено, але на цій системі Steam не може його показати: {{reason}}',
    disabled:
      'Переклад досягнень збережено. Щоб бачити його в Steam, увімкніть у налаштуваннях «Швидке застосування параметрів запуску Steam».',
    launchOptionsQueued:
      'Параметри запуску застосуються автоматично, щойно ви закриєте Steam. Лаунчер має бути відкритим — його можна згорнути в трей.',
    launchOptionsError: 'Не вдалося налаштувати параметри запуску: {{error}}',
    ok: 'Зрозуміло',
    restartSteamNow: 'Перезапустити Steam зараз',
    restartFailureTitle: 'Параметри запуску не застосовано',
    restartSuccessTitle: 'Параметри запуску застосовано',
    restartSuccessMessage: 'Параметри запуску записано. Можна запускати гру.',
  },
  installUnavailable: {
    title: 'Недоступно',
    message: 'Встановлення доступне тільки в десктопній версії застосунку',
  },
  installedGamesBanner: {
    noTranslationsTitle: 'Не знайшли перекладів для ваших ігор',
    noTranslationsText:
      'От халепа... Ми знайшли ваші ігри, але перекладів для них поки немає.<br/>Завантажте гру з нашого каталогу — відкрийте меню фільтрування, щоб переглянути доступні переклади.',
    noGamesTitle: 'Не можемо знайти ваші ігри',
    noGamesText:
      'От халепа... Ми не змогли знайти у вас встановлені ігри, для яких є переклад.<br/>Переконайтеся, що маєте хоча б одну гру з нашого каталогу у лаунчерах — Steam, GOG, EGS, Ubisoft Connect, EA App. А ще можна відкрити меню фільтрування й переглянути ігри, які ще не встановлені.',
  },
  kuliPlacement: {
    supported: 'Переклад наявний за підтримки KULI',
    beFirst: 'Будь <b>першим</b>, хто зіграє з перекладом!',
    goToKuli: 'Перейти на KULI →',
  },
  launch: {
    errorTitle: 'Помилка запуску',
    failed: 'Не вдалося запустити гру',
    gameNotFound: "Гру не знайдено на вашому комп'ютері",
    lutrisFailed: 'Не вдалося запустити гру через Lutris',
  },
  launchOptions: {
    noAppId: 'Гра не має Steam App ID',
    notConfigured: 'Для цього перекладу не задано параметрів запуску',
    gameDirUnresolved: 'Не вдалося визначити теку гри для параметрів запуску',
    writeFailed: 'Не вдалося записати параметри запуску',
    eglWriteFailed: 'не вдалося змінити налаштування гри в Epic Games Launcher',
    eglNeedsShell:
      'вони виконуються лише через оболонку, якою їх запускає Steam, а Epic Games Launcher так не вміє',
    eglEnvOnlyFromLbk:
      'Epic Games Launcher не передає грі змінні середовища, тож переклад працюватиме, лише якщо запускати гру з лаунчера',
  },
  millennium: {
    deckyHost:
      'Millennium несумісний із Decky Loader, тож тут переклад досягнень показується через плагін «LBK Bridge» для Decky Loader.',
    unsupported: {
      'flatpak-steam': 'Millennium не підтримує Steam, встановлений через Flatpak.',
      'snap-steam': 'Millennium не підтримує Steam, встановлений через Snap.',
      arch: "Millennium працює лише на комп'ютерах з процесором x86-64.",
      'steam-rt64':
        'Millennium не працює з 64-бітною бета-версією клієнта Steam. Вийдіть із бета-програми в налаштуваннях Steam («Сумісність»/«Бета-версії»).',
      'missing-libssl32':
        'Бракує 32-бітної бібліотеки OpenSSL 3 (пакет libssl3:i386 або lib32-openssl). Встановіть її й спробуйте ще раз.',
      'steam-home-link':
        'Не знайдено ~/.steam/steam, який вказує на теку Steam. Запустіть Steam один раз і спробуйте ще раз.',
      nixos:
        'На NixOS встановіть Millennium засобами системи — лаунчер сам додасть до нього плагін «LBK Bridge».',
      'macos-too-old': 'Millennium потребує macOS 13.3 або новішої.',
      'no-release': 'Встановлення Millennium з лаунчера для цієї системи ще готується.',
      'millennium-v2':
        'У вас стара версія Millennium. Оновіть її до версії 3 офіційним інсталятором — після цього лаунчер сам додасть плагін «LBK Bridge».',
      'no-steam': 'Лаунчер не знайшов Steam на цьому пристрої.',
      unknown: 'Millennium не підтримується на цій системі.',
      noReleaseMac: 'Збірка Millennium для macOS ще готується.',
    },
    failure: {
      installFailed: 'Не вдалося встановити Millennium.',
      'download-failed':
        "Не вдалося завантажити Millennium. Перевірте з'єднання з інтернетом і спробуйте ще раз.",
      'checksum-mismatch':
        'Завантажений файл Millennium пошкоджено або підмінено. Встановлення скасовано.',
      'extract-failed': 'Не вдалося розпакувати Millennium.',
      'av-blocked':
        'Антивірус видалив або заблокував файли Millennium. Додайте теку Steam до винятків антивіруса й спробуйте ще раз.',
      'not-writable':
        'Лаунчер не має доступу на запис до теки Steam. Встановіть Millennium офіційним інсталятором.',
      conflict:
        'У теці Steam уже є файли іншого мода, який завантажується так само, як Millennium. Лаунчер не змінюватиме їх.',
      'not-prepared': 'Спершу завантажте Millennium ще раз.',
      'script-failed': 'Не вдалося встановити файли Millennium.',
      'files-locked':
        'Файли Steam ще зайняті. Millennium встановиться після наступного закриття Steam.',
      cancelled: 'Встановлення Millennium скасовано.',
      busy: 'Лаунчер уже змінює Millennium. Зачекайте, доки це завершиться.',
      'plugin-not-connected':
        'Millennium встановлено, але плагін «LBK Bridge» ще не підключився. Перевірте, чи Steam запущено, і натисніть «Перевірити ще раз».',
    },
    phase: {
      download: 'Завантаження Millennium…',
      verify: 'Перевірка файлів…',
      extract: 'Розпакування…',
      'stop-steam': 'Закриття Steam…',
      'install-files': 'Встановлення файлів…',
      'start-steam': 'Запуск Steam…',
      'wait-plugin': 'Очікування підключення плагіна «LBK Bridge»…',
      uninstallFiles: 'Видалення файлів Millennium…',
    },
  },
  millenniumPending: {
    notDetected:
      'Steam не відкрив канал для лаунчера. Параметри запуску застосовуватимуться після закриття Steam. Можливо, канал блокує інший мод Steam.',
    unsupported:
      'Виявлено Millennium, але лаунчер не зміг додати до нього плагін «LBK Bridge». Параметри запуску застосовуватимуться після закриття Steam.',
    enabled:
      'Плагін «LBK Bridge» для Millennium увімкнено, але Steam ще не завантажив його. Плагін запрацює після наступного запуску Steam.',
    disabled:
      'Виявлено Millennium. Він закриває канал, через який лаунчер працює зі Steam, тому лаунчер встановив плагін «LBK Bridge» для Millennium. Плагін увімкнеться автоматично, щойно ви закриєте Steam. Або увімкніть його вже зараз: налаштування Millennium → Plugins → LBK Bridge.',
  },
  millenniumSetup: {
    title: 'Millennium і плагін «LBK Bridge»',
    done: 'Millennium встановлено. Steam підключився до лаунчера через плагін «LBK Bridge».',
    offlineDone:
      'Millennium встановлено. Плагін «LBK Bridge» підключиться, щойно ви запустите Steam.',
    queued:
      'Millennium встановиться, щойно ви закриєте Steam. Якщо лаунчер на той момент буде закритий — під час його наступного запуску, коли Steam не працюватиме.',
    macQueued: 'Потім запускайте Steam з лаунчера або через «Steam Millennium».',
    steamNotBack:
      'Steam не запустився після встановлення Millennium. Можливо, ця версія Millennium ще не підтримує ваш Steam.',
    envMissing:
      'Steam запущено не з лаунчера, тому Millennium не активний. Перезапустіть Steam з лаунчера або повторно увійдіть у систему.',
    external:
      'Millennium уже встановлено — лаунчер сам додасть до нього плагін «LBK Bridge».',
    openSite: 'Відкрити сайт Millennium',
    startSteam: 'Запустити Steam',
    uninstall: 'Видалити Millennium',
    restartSteam: 'Перезапустити Steam',
    recheck: 'Перевірити ще раз',
    restartToFinish:
      'Щоб завершити встановлення, Steam потрібно закрити й запустити знову.',
    install: 'Встановити',
    update: 'Оновити Millennium',
    repair: 'Відновити Millennium',
    updateTitle: 'Оновлення Millennium',
    repairTitle: 'Відновлення Millennium',
    updateAvailable: 'Доступне оновлення Millennium: {{version}}.',
    filesBroken: 'Файли Millennium у теці Steam пошкоджено або видалено.',
    restartNeeded: 'Для цього Steam потрібно буде закрити й запустити знову.',
    offer: {
      intro:
        'Millennium — безкоштовний сторонній мод клієнта Steam (не від Valve). Лаунчер може встановити його разом із плагіном «LBK Bridge».',
      benefitsMac:
        'Що це дасть:\n• перекладені досягнення в бібліотеці, сповіщеннях і оверлеї Steam.',
      benefits:
        'Що це дасть:\n• перекладені досягнення в бібліотеці, сповіщеннях і оверлеї Steam;\n• лаунчер працюватиме зі Steam без відкритого порту налагодження і без запитів перезапустити Steam.',
      withoutMillennium:
        'Що працює й без Millennium: параметри запуску, підписки в Майстерні, колекція «З українізаторами», ярлик лаунчера та обкладинки в Steam — через порт налагодження Steam (після одного перезапуску Steam).',
      sourceMac: 'Файли завантажуються з нашої збірки Millennium на GitHub.',
      source: 'Файли Millennium завантажуються з офіційної сторінки проєкту на GitHub.',
      caveatWindows:
        'Зважте: після оновлень Steam Millennium іноді тимчасово не працює, доки не вийде його оновлення. Антивірус може помилково заблокувати його файли.',
      caveat:
        'Зважте: після оновлень Steam Millennium іноді тимчасово не працює, доки не вийде його оновлення.',
      linux:
        'Millennium буде встановлено лише для вашого користувача, без пароля адміністратора. Якщо запускати Steam не з лаунчера, Millennium запрацює після повторного входу в систему.',
      macos:
        'На macOS лаунчер встановлює власну збірку Millennium. Вона працює, лише коли Steam запущено через «Steam Millennium» у теці «Програми» вашого користувача — лаунчер сам запускає Steam саме так.',
      restart: 'Для встановлення Steam потрібно буде закрити й запустити знову.',
    },
  },
  millenniumUninstall: {
    title: 'Видалення Millennium',
    restartNeeded: 'Щоб видалити Millennium, Steam потрібно закрити й запустити знову.',
    cannotRestart:
      'Лаунчер не може перезапустити Steam зараз. Закрийте Steam самостійно.',
    confirm:
      'Millennium буде видалено з теки Steam. Плагіни й теми Millennium залишаться, якщо не позначити «Видалити також плагіни й налаштування Millennium».',
    purge: 'Видалити також плагіни й налаштування Millennium',
    action: 'Видалити Millennium',
    queued: 'Millennium буде видалено, щойно ви закриєте Steam.',
    done: 'Millennium видалено.',
    filesLocked:
      'Файли Steam ще зайняті. Millennium буде видалено після наступного закриття Steam.',
    failed: 'Не вдалося видалити Millennium.',
    failedWithError: 'Не вдалося видалити Millennium: {{error}}',
    progress: 'Видалення Millennium…',
  },
  newsFeed: {
    title: 'Новини',
    tab: {
      sales: 'Ігри по знижці',
      'games-80': 'Ігри за 80',
      news: 'Новини',
    },
    empty: 'Новин не знайдено',
    open: 'Відкрити новину',
    discuss: 'Обговорити в Telegram',
  },
  notificationCenter: {
    title: 'Сповіщення',
    settingsTitle: 'Налаштування сповіщень',
    justNow: 'Щойно',
    statusChange: 'Стан змінено з "{{from}}" на "{{to}}"',
    versionUpdate: 'Оновлення версії з {{from}} до {{to}}',
    appUpdate: 'Доступна нова версія застосунку: {{version}}',
    teamNewGame: 'Нова локалізація від <team/>',
    teamStatusChange: '<team/>: стан змінено на "<status/>"',
    feedbackReply: 'Відповідь на ваш відгук:',
    fallback: 'Нове сповіщення',
    appUpdatesTitle: 'Оновлення застосунку',
    appUpdatesDescription: 'Сповіщення про нові версії LBK Launcher',
    gameUpdatesTitle: 'Оновлення українізаторів',
    gameUpdatesDescription: 'Сповіщення про нові версії встановлених українізаторів',
    empty: 'Сповіщень немає',
    emptyHint:
      'Підпишіться на українізатори зі станом "Заплановано",<br/>щоб отримувати сповіщення про зміни стану',
    markAllRead: 'Прочитати всі',
    clearAll: 'Очистити всі',
    clearConfirmTitle: 'Видалити всі сповіщення?',
    clearConfirmBody:
      'Цю дію неможливо скасувати. Всі сповіщення будуть видалені назавжди.',
    delete: 'Видалити',
  },
  notificationMessage: {
    statusChange: 'Стан змінено на "{{status}}"',
    progressChange: 'Прогрес оновлено: {{progress}}',
    firstFavorite: 'Натисніть, щоб відфільтрувати список улюблених',
    feedbackReply: 'Нова відповідь на ваш відгук',
    fallback: 'Нове сповіщення',
  },
  notificationToast: {
    'status-change': 'Зміна стану',
    'version-update': 'Доступне оновлення',
    'app-update': 'Оновлення застосунку',
    'first-favorite': 'Додано в улюблені',
    'progress-change': 'Оновлення прогресу',
    'feedback-reply': 'Відповідь на відгук',
    'team-new-game': 'Сповіщення',
    'team-status-change': 'Сповіщення',
  },
  notifications: {
    versionAvailable: 'Доступна версія {{version}}',
    teamNewGame: 'Нова локалізація від {{team}}',
    teamStatusChange: '{{team}}: стан змінено на "{{status}}"',
    feedbackReplyTitle: 'Відповідь на відгук: {{game}}',
  },
  pendingLaunchOptions: {
    queued_one: 'Очікують закриття Steam: параметри запуску для {{count}} гри.',
    queued_few: 'Очікують закриття Steam: параметри запуску для {{count}} ігор.',
    queued_many: 'Очікують закриття Steam: параметри запуску для {{count}} ігор.',
    queued_other: 'Очікують закриття Steam: параметри запуску для {{count}} ігор.',
    gameName: '«{{name}}»',
    games_one: '{{count}} гри',
    games_few: '{{count}} ігор',
    games_many: '{{count}} ігор',
    games_other: '{{count}} ігор',
    bridgeReady: 'Steam підключився до лаунчера',
    steamClosed: 'Steam закрито',
    appliedTitle: 'Параметри запуску застосовано',
    appliedBody:
      '{{lead}} — параметри запуску для {{target}} записано. Можна запускати гру.',
  },
  platformName: {
    steam: 'Steam',
    epic: 'Epic Games Store',
    gog: 'GOG',
    rockstar: 'Rockstar Games Launcher',
    xbox: 'Xbox app',
    uplay: 'Ubisoft Connect',
    ea: 'EA App',
    emulator: 'Емулятор',
    other: 'Інша',
  },
  pluginEntries: {
    deckyPluginDisabled:
      'Плагін «LBK Bridge» вимкнено в Decky Loader. Увімкніть його в налаштуваннях Decky.',
    recommend:
      'Порада: з Millennium лаунчер також показуватиме в Steam переклад досягнень.',
    noDeckyCanInstall:
      'Переклад досягнень у Steam показує плагін «LBK Bridge» для Decky Loader. Лаунчер може встановити Decky Loader разом із плагіном.',
    noDecky:
      'Переклад досягнень у Steam показує плагін «LBK Bridge» для Decky Loader. Спершу встановіть Decky Loader.',
    deckyPlugin:
      'Плагін «LBK Bridge» для Decky Loader показує в Steam перекладені досягнення.',
    deckyOutdated: 'Доступне оновлення плагіна «LBK Bridge» для Decky.',
    pendingActivate: 'Millennium встановиться, щойно ви закриєте Steam.',
    pendingDeactivate: 'Millennium буде видалено, щойно ви закриєте Steam.',
    installedVersion: 'Встановлено Millennium {{version}}.',
    repair: 'Файли Millennium у теці Steam пошкоджено або видалено.',
    update: 'Доступне оновлення Millennium: {{version}}.',
    unsupported: 'Переклад досягнень у Steam недоступний: {{reason}}',
    bridgeUpdate: 'Оновлення плагіна «LBK Bridge» застосується після перезапуску Steam.',
  },
  pluginOffer: {
    installMillennium: 'Встановити Millennium',
    repairMillennium: 'Відновити Millennium',
    uninstallMillennium: 'Видалити Millennium',
    millenniumInfo: 'Що таке Millennium',
    millenniumSite: 'Відкрити сайт Millennium',
    installDeckyLoader: 'Встановити Decky Loader',
    installDeckyPlugin: 'Встановити плагін для Decky',
    updateDeckyPlugin: 'Оновити плагін для Decky',
    deckyInfo: 'Що таке Decky Loader',
    openSettings: 'Відкрити налаштування',
    restartSteam: 'Перезапустити Steam',
    updateMillennium: 'Оновити Millennium до {{version}}',
  },
  privacyPolicy: {
    title: 'Політика приватності',
    updated: 'Оновлено: 10 жовтня 2026',
    intro:
      'LBK Launcher — сервіс для пошуку, встановлення та оновлення українських локалізацій.',
    openSource:
      'Сайт і застосунок мають відкритий вихідний код. Ця політика описує дані, які обробляються локально, надсилаються на інфраструктуру LBK або передаються зовнішнім сервісам.',
    sections: {
      controller: {
        title: '1. Хто обробляє дані',
        responsible:
          'За оброблення даних відповідає <b>LBK Team — що складається із двох спілок GameGlobe Localization та Little Bit</b>.',
        contactsIntro: 'Питання щодо приватності можна надсилати на:',
        email: 'пошту <mail>pr@gameglobe-localisation.com</mail>',
        telegram: 'або через <tg>Telegram-бот підтримки</tg>',
      },
      categories: {
        title: '2. Категорії даних, що обробляються',
        intro:
          'LBK розділяє дані на необхідні для роботи сервісу операції та аналітичні категорії.',
        essentialTitle: 'Необхідні функції LBK',
        essentialText:
          'Ці операції потрібні для роботи функцій, якими ви користуєтеся: завантаження, встановлення й оновлення локалізацій, захисту сервісу від зловживань та роботи акаунту перекладача.',
        essentialListIntro: 'До них належать:',
        essential1: 'отримання потрібного архіву локалізації;',
        essential2: 'встановлення, оновлення та локальне видалення локалізації;',
        essential3: 'збереження інформації про вашу підписку на локалізацію;',
        essential4:
          'захист сервісу від зловживань та застосування технічних обмежень завантажень;',
        essential5: 'робота акаунта для перекладачів, команд і модераторів.',
        improveTitle: 'Те, що допомагає покращувати LBK',
        improveText:
          'Продуктова аналітика допомагає нам зрозуміти, як ви користуєтеся застосунком і наскільки зручно в ньому знаходити та встановлювати локалізації.',
        improveListIntro: 'До неї належать:',
        improve1: 'запуск і завершення сесії застосунку;',
        improve2:
          'інформація про те, чи встановили ви локалізацію під час першого запуску застосунку;',
        improve3: 'продуктова аналітика Mixpanel;',
        improve4: 'перегляди інформаційних банерів у застосунку та натискання на них.',
        developTitle: 'Те, що допомагає розвивати українські локалізації',
        developText:
          'Аналітика попиту та використання локалізацій. Вона допомагає зрозуміти, які переклади потрібні гравцям і як вони користуються наявними локалізаціями.',
        developListIntro: 'До неї належать:',
        develop1: 'натискання кнопки «Підтримати»;',
        develop2:
          'пошукові запити, за якими нічого не знайдено задля оформлення списку задоволення попиту на переклад;',
        develop3:
          'інформація про видалення локалізацій, яка допомагає оцінювати їх використання;',
        develop4:
          'вимірювання часу в іграх із встановленими локалізаціями задля промо матеріалів на сайті «Скільки часу награно з нашим лаунчером» та у спільноті.',
        diagnosticsTitle: 'Діагностика та звіти про помилки',
        diagnosticsText:
          'Автоматичні звіти допомагають нам знаходити й виправляти помилки та збої застосунку. Ручні відгуки, знімки екрана та журнали надсилаються окремою дією користувача.',
        optOut:
          'Продуктова аналітика, аналітика розвитку локалізацій та автоматична діагностика не потрібні для встановлення й оновлення локалізацій. Ми працюємо над налаштуваннями, які дозволять вимикати кожну з цих категорій окремо в застосунку. Поки ці налаштування недоступні, ви можете написати нам і заперечити проти такого оброблення даних. Контакти та порядок звернення наведено в розділі 16.',
        publicTitle: 'Публічне та партнерське використання статистики',
        publicText:
          'Агреговані показники можуть використовуватися у публічній статистиці, промо-матеріалах і партнерських презентаціях без MachineID та інших ідентифікаторів деперсоналізаційного встановлення.',
        noTracking:
          'Застосунок і сайт не використовують рекламних мереж, пікселів відстеження, запису дій на екрані чи цифрових відбитків пристрою або браузера. Ми не продаємо персональних даних і не передаємо їх компаніям, що займаються збиранням і продажем таких даних.',
      },
      localOnly: {
        title: '3. Що застосунок обробляє лише локально',
        intro:
          'Частина функцій працює на пристрої користувача без надсилання їхнього вмісту на сервер LBK.',
        gameDetection:
          '<b>Пошук установлених ігор.</b> Застосунок читає службові файли Steam, Epic Games, GOG, EA, Xbox, Ubisoft Connect, Rockstar, Heroic і Lutris, щоб визначити встановлені ігри та їх розташування. У Windows застосунок також може визначати ці платформи за їхніми записами в системному реєстрі.',
        platformAccounts:
          '<b>Дані облікових записів ігрових платформ.</b> Із даних профілю Steam застосунок зчитує лише числовий ідентифікатор, щоб зіставити вашу бібліотеку ігор із каталогом локалізацій. Він не зчитує логін, нікнейм, список друзів, історію покупок, платіжні дані чи листування, навіть якщо вони містяться в тому самому файлі. Із службових файлів інших ігрових платформ застосунок зчитує лише дані, потрібні для пошуку встановлених ігор та їхнього розташування на диску.',
        steamLibrary:
          '<b>Зміни в бібліотеці Steam.</b> Поки застосунок відкритий, він відстежує зміни службових файлів Steam, щоб оновити локальний перелік ігор. Застосунок не читає вмісту файлу з переліком ваших ліцензій, а лише відстежує зміну його розміру.',
        localDb:
          '<b>Локальна база.</b> Каталог перекладів, історія встановлень, улюблене й налаштування зберігаються у файлі бази даних на вашому компʼютері. Усі ці локальні дані можна видалити через налаштування застосунку.',
        backups:
          '<b>Резервні копії.</b> Перед встановленням локалізації оригінальні файли гри можуть копіюватися локально для подальшого відновлення.',
        search:
          '<b>Пошук, фільтри та добірки.</b> Формуються з локальної бази. Ми не створюємо на сервері профілю ваших уподобань і не підлаштовуємо каталог під ваш пристрій.',
        thirdPartySync:
          '<b>Синхронізація зі стороннім застосунком.</b> Запускається дією користувача та переносить інформацію про встановлені локалізації локально.',
        playtime:
          '<b>Локальне читання Steam playtime.</b> Виконується лише для ігор із встановленими локалізаціями, щоб розрахувати зміну часу в грі.',
        outro:
          'Застосунок не робить знімків екрана, не читає буфер обміну й не збирає окремо імені компʼютера чи облікового запису операційної системи. Для пошуку ігор він читає лише файли в теках ігор та ігрових платформ. Назва облікового запису може траплятися у шляхах до файлів у діагностичних журналах, які ви надсилаєте вручну (див. розділ 7).',
      },
      network: {
        title: '4. Необхідні мережеві операції застосунку',
        downloadTitle: 'Завантаження локалізації',
        downloadIntro:
          'Для видачі потрібного файлу застосунок передає на сервер щонайменше:',
        download1: 'ID гри;',
        download2: 'шлях/ідентифікатор архіву;',
        download3: 'тип архіву;',
        download4:
          'MachineID — технічний ідентифікатор, за яким сервіс розрізняє пристрої.',
        downloadPurpose:
          'Ці поля використовуються для визначення потрібного файлу та виконання запиту на завантаження, обмеження кількості завантажень і підрахунку унікальних завантажень. Під час одного запиту сервер надає файл, перевіряє ліміт і враховує завантаження у статистиці.',
        workshopTitle: 'Перехід у Майстерню Steam',
        workshopText:
          'Деякі локалізації встановлюються через підписку в Майстерні Steam. Перехід до такої локалізації враховується в загальній статистиці завантажень. Для цього застосунок передає ID локалізації та MachineID. Для кожної локалізації враховується лише перший перехід із вашого пристрою.',
        subscriptionTitle: 'Підписка на локалізацію',
        subscriptionText:
          'Підписка на переклад дає змогу отримувати сповіщення про його нові версії. Ці сповіщення формує застосунок на вашому пристрої. Окремо сервер LBK зберігає ідентифікатор локалізації та MachineID, щоб команда перекладачів бачила, скільки користувачів чекають на оновлення її перекладу. Цей серверний запис не потрібен для створення сповіщень. Ви можете будь-коли скасувати підписку в застосунку — запис на сервері буде видалено одразу.',
      },
      productAnalytics: {
        title: '5. Продуктова аналітика',
        intro: 'Для продуктової аналітики застосунок надсилає такі дані:',
        sessions:
          '<b>початок і завершення сесії</b> — версію застосунку, час/тривалість сесії, MachineID та ознаку першого запуску. Ці дані допомагають підраховувати унікальні запуски й визначати, якими версіями застосунку користуються;',
        firstSession:
          '<b>інформацію про те, чи це перша сесія</b> — передається разом із запитом на завантаження й допомагає визначити, чи встановлюють користувачі локалізацію під час першого запуску застосунку;',
        mixpanel:
          '<b>події інтерфейсу Mixpanel</b> — відкриття розділів, взаємодії з елементами, встановлення, оновлення та видалення локалізацій. Разом із подіями передаються назва гри, версія застосунку та MachineID;',
        banners:
          '<b>перегляди банерів і натискання на них</b> — ідентифікатор кампанії, тип події та MachineID.',
      },
      localizationAnalytics: {
        title: '6. Аналітика розвитку українських локалізацій',
        intro: 'Для аналітики розвитку локалізацій застосунок надсилає такі дані:',
        support:
          '<b>натискання «Підтримати»</b> — ID гри/локалізації та MachineID, щоб команди бачили, скільки людей захотіли їх підтримати;',
        emptySearch:
          '<b>пошук без результатів</b> — текст пошукового запиту, джерело запиту та MachineID;',
        uninstall: '<b>видалення локалізації</b> — ID локалізації та MachineID;',
        playtime:
          '<b>час у грі</b> — лише для ігор із встановленою локалізацією: ID гри, приріст часу в хвилинах та MachineID.',
      },
      feedback: {
        title: '7. Відгуки, знімки екрана та журнали',
        intro: 'Ці дані надсилаються лише після окремої дії користувача.',
        feedbackTitle: 'Відгук про локалізацію',
        feedbackIntro: 'Під час відправлення відгуку можуть передаватися:',
        feedback1: 'ID гри;',
        feedback2: 'тип звернення;',
        feedback3: 'текст повідомлення;',
        feedback4: 'версія застосунку;',
        feedback5: 'операційна система/платформа та архітектура;',
        feedback6: 'MachineID — за ним ви отримаєте відповідь саме на своє звернення.',
        screenshotsTitle: 'Знімки екрана',
        screenshotsText:
          'Знімки додаються лише через явний вибір користувача. Перед завантаженням користувач має бачити, який файл буде відправлено. Знімок може містити особисту інформацію, яка випадково потрапила в кадр, — за це LBK Team відповідальності не несе. Знімки надсилаються без змін: застосунок не стискає їх, не змінює розміру й не видаляє метаданих — додаткової інформації, збереженої у файлі. До одного звернення можна додати до пʼяти знімків.',
        logsTitle: 'Діагностичні журнали',
        logsText:
          'Журнал може містити технічні повідомлення, шляхи до файлів (вони можуть містити назву вашого облікового запису в операційній системі), назви встановлених ігор, числові ідентифікатори платформ та тексти помилок. Перед надсиланням застосунок не видаляє окремих рядків із журналу: вони можуть містити інформацію, потрібну для зʼясування причини проблеми. Журнал не надсилається автоматично; передавання відбувається лише після окремого підтвердження користувача.',
      },
      crashReports: {
        title: '8. Автоматична діагностика збоїв',
        text: 'У разі помилки застосунок автоматично надсилає її опис, послідовність викликів, що призвели до помилки (стек викликів), версію застосунку та інші технічні дані, потрібні для діагностики (операційна система та її версія, останні дії в застосунку перед помилкою).',
        optIn:
          'Звіти про збої надсилаються лише тоді, коли в налаштуваннях застосунку ввімкнено відповідну опцію.',
        glitchTip:
          'Для звітів використовується <b>GlitchTip</b>, розгорнутий на інфраструктурі LBK.',
      },
      website: {
        title: '9. Що збирає сайт',
        publicTitle: 'Публічна частина сайту',
        zaraz:
          'Публічний сайт використовує <b>Cloudflare Zaraz</b> для аналітики переглядів і окремих подій, зокрема відкриття каталогу, сторінки локалізації та використання пошуку.',
        emptySearch:
          'Пошук без результатів на сайті зберігає текст запиту разом із випадковим ідентифікатором, створеним у памʼяті браузера. Цей ідентифікатор не повʼязаний із вашим пристроєм або особою.',
        videoTitle: 'Вбудоване відео',
        videoText:
          'На сторінках локалізацій можуть бути вбудовані відео YouTube. При завантаженні програвача браузер встановлює зʼєднання із сервісами Google/YouTube і передає їм технічні дані зʼєднання.',
        releasesTitle: 'Завантаження релізів',
        releasesText:
          'Файли релізів можуть завантажуватися з GitHub. При такому завантаженні GitHub отримує стандартні технічні дані мережевого запиту.',
      },
      accounts: {
        title: '10. Акаунти перекладачів, команд і модераторів',
        intro:
          'Для звичайного встановлення локалізацій акаунт не потрібен. Акаунти використовуються перекладачами, командами та модераторами за шляхом — https://admin.lbklauncher.com/',
        dataIntro: 'При створенні та використанні акаунта можуть оброблятися:',
        data1: 'імʼя;',
        data2: 'електронна пошта;',
        data3: 'дані профілю Google, якщо користувач обирає вхід через Google;',
        data4: 'службові дані, необхідні для автентифікації та ролей доступу.',
        googleAnalytics:
          'В адміністративній панелі використовується Google Analytics: сервіс збирає інформацію про перегляди сторінок панелі та використовує власні cookie. Коли ви натискаєте кнопку копіювання промотексту для Steam, панель надсилає до Google Analytics цю подію та назву відповідної гри. Електронна пошта та ідентифікатор акаунта не передаються. Ми працюємо над налаштуванням, яке дозволить вимкнути цю аналітику в адміністративній панелі.',
      },
      legalBasis: {
        title: '11. Мета та правові підстави оброблення',
        delivery:
          '<b>Видача та встановлення локалізації</b> — Необхідні функції LBK; підстава: Виконання запиту користувача / Умов користування',
        subscription:
          '<b>Збереження стану підписки</b> — Необхідні функції LBK; підстава: Виконання запиту користувача',
        abuse:
          '<b>Захист від зловживань, технічні ліміти та облік унікальних завантажень</b> — Необхідні функції LBK; підстава: Законний інтерес у забезпеченні стабільної роботи сервісу та достовірності публічної статистики',
        product:
          '<b>Сесії застосунку, взаємодії з інтерфейсом, перегляди банерів і натискання на них, інформація про першу сесію</b> — «Допомагати покращувати LBK»; підстава: Законний інтерес',
        localization:
          '<b>Натискання «Підтримати», пошук без результатів, видалення локалізації, час у грі</b> — «Допомагати розвивати українські локалізації»; підстава: Законний інтерес',
        diagnostics:
          '<b>Автоматична діагностика</b> — «Діагностика та звіти про помилки»; підстава: Законний інтерес',
        feedback:
          '<b>Відгуки, знімки екрана, журнали</b> — Окрема дія користувача; підстава: Згода користувача під час надсилання',
        account:
          '<b>Робота акаунта</b> — Необхідні функції акаунта; підстава: Виконання запиту користувача / Умов користування',
        objection:
          'Ви можете заперечити проти оброблення даних на підставі законного інтересу. Як це зробити, описано в розділі 16.',
      },
      retention: {
        title: '12. Строки зберігання',
        text: 'Ми зберігаємо дані стільки часу, скільки потрібно для цілей, описаних у цій політиці.',
        details:
          'Запис про підписку зберігається до її скасування й видаляється одразу після того, як ви відпишетеся. Дані акаунта зберігаються, поки він існує. Після видалення акаунта його дані та завантажені файли видаляються одразу.',
      },
      recipients: {
        title: '13. Одержувачі та інфраструктура',
        infraTitle: 'Інфраструктура LBK',
        supabase:
          '<b>Backend на базі Supabase</b> — база даних, сховище файлів та службові функції LBK. Розгорнутий на власних серверах LBK. Тут зберігаються серверні записи про завантаження й підписки, відгуки, знімки екрана, діагностичні журнали та статистика, яку LBK збирає на власній інфраструктурі. Ці дані зберігаються в межах інфраструктури LBK; використання зовнішніх сервісів описано окремо нижче.',
        glitchTip:
          '<b>GlitchTip</b> — звіти про помилки та збої. Сервіс розгорнутий на власних серверах LBK, де й зберігаються ці звіти.',
        coolify: 'Для керування розгортанням сервісів використовується Coolify.',
        externalTitle: 'Зовнішні сервіси',
        mixpanel: '<b>Mixpanel</b> — продуктова аналітика застосунку;',
        zaraz: '<b>Cloudflare Zaraz</b> — аналітика публічного сайту;',
        googleAnalytics: '<b>Google Analytics</b> — аналітика адміністративної панелі;',
        resend: '<b>Resend</b> — доставка листів для акаунтів/службових повідомлень;',
        youtube: '<b>YouTube / Google</b> — вбудоване відео;',
        steam: '<b>Steam</b> — дані, потрібні для роботи інтеграції Steam;',
        github: '<b>GitHub</b> — розповсюдження релізів та перевірка оновлень;',
        teamChannels:
          '<b>внутрішні канали сповіщень команди</b> — сповіщення про нові звернення, щоб LBK Team могла оперативно їх розглянути та відповісти.',
        partners:
          'Каталог локалізацій щодня синхронізується з партнерським сервісом. Під час цієї синхронізації дані гравців не передаються. Архіви, які завантажують перекладачі, перед публікацією перевіряються на віруси за допомогою зовнішнього сервісу Metadefender. Дані гравців для цієї перевірки не передаються.',
      },
      steamFallback: {
        title: '14. Steam: локальне визначення бібліотеки та серверний fallback',
        text: 'Зазвичай застосунок визначає вашу бібліотеку Steam за даними на пристрої. Якщо цих даних недостатньо, сервер LBK запитує список ігор через Steam Web API. Для запиту використовуються числовий ідентифікатор вашого профілю Steam та ключ доступу LBK. Запит до Steam надсилає сервер LBK.',
        notStored: 'Отриманий список ігор на сервері не зберігається.',
      },
      location: {
        title: '15. Де обробляються дані',
        servers: 'Власні сервери LBK розташовані в <b>Німеччині</b>.',
        external:
          'Частина зовнішніх сервісів може обробляти дані в інших країнах, зокрема у США — це стосується Mixpanel, Resend, Google/YouTube, GitHub і Steam.',
      },
      rights: {
        title: '16. Права та керування згодою',
        intro: 'Користувач може:',
        access:
          'дізнатися, які дані з ним повʼязані, й отримати їхню копію за зверненням до LBK Team;',
        rectify: 'виправити неточні дані;',
        erase:
          'вимагати видалення даних у випадках, коли вони більше не потрібні або підлягають видаленню;',
        object: 'заперечити проти оброблення даних на підставі законного інтересу.',
        requests:
          'Запити можна надсилати на <mail>pr@gameglobe-localisation.com</mail> або через <tg>Telegram-бот підтримки</tg>. Ми відповімо на ваш запит протягом 30 днів.',
        identification:
          'Якщо користувач має акаунт, записи можуть бути знайдені за даними акаунта. Якщо акаунта немає, для пошуку деперсоналізованих подій може знадобитися MachineID.',
      },
      security: {
        title: '17. Захист даних',
        roles:
          'Доступ до серверних таблиць та сховищ обмежений ролями. Ключ доступу, який міститься в застосунку та на сайті, не дає змоги читати відгуки, журнали чи статистику. Доступ до цих даних надається лише через сервер із відповідними правами доступу.',
        storage:
          'Відгуки, журнали й знімки екрана зберігаються в закритих сховищах; тимчасові посилання для доступу до них створюються лише для LBK Team.',
        passwords:
          'Платформа входу в акаунт зберігає паролі у вигляді хешів — результатів одностороннього перетворення. Код LBK не має доступу до паролів у відкритому вигляді.',
        tokens:
          'Токени для автоматичної публікації зберігаються лише у вигляді хешів, з яких неможливо відновити початковий токен.',
        secrets: 'Токени та секрети не передаються до аналітичних сервісів.',
        encryption: 'Мережеві зʼєднання сайту та застосунку використовують шифрування.',
      },
      limits: {
        title: '18. Чого LBK не робить',
        sell: 'не продає персональні дані користувачів;',
        account: 'не вимагає акаунта для звичайного встановлення локалізацій;',
        screenshots: 'не створює знімки екрана без дії користувача;',
        clipboard: 'не читає буфер обміну;',
        machineId: 'не передає MachineID у публічну або агреговану статистику;',
        ads: 'не показує реклами на основі вашої поведінки;',
        fingerprinting:
          'не використовує цифрових відбитків браузера й не записує дій на екрані.',
      },
      changes: {
        title: '19. Зміни до політики',
        text: 'Якщо змінюються категорії даних, цілі, одержувачі або правові підстави оброблення, політика та дата її оновлення мають бути змінені до або одночасно з відповідною зміною функціоналу.',
      },
      contacts: {
        title: '20. Контакти',
      },
    },
  },
  promoModal: {
    imageAlt: 'Підтримайте український лаунчер!',
    title: 'Трохи підтримки для лаунчера?',
    body: 'Ми розвиваємо цей лаунчер, щоб вам було зручно знаходити та завантажувати переклади. Покращуємо швидкість, стабільність і додаємо нові функції.',
    everyBitCounts: 'Навіть маленький внесок має значення ✨',
    dontShowAgain: 'Більше не показувати',
    donate: 'Задонатити',
  },
  runInstaller: {
    exeTitle: 'Запуск інсталятора',
    scriptTitle: 'Запуск скрипта',
    exeProtonMessage:
      'Українізатор завантажено та розпаковано. Інсталятор для Windows буде запущено через вибрану версію Proton.\n\nШлях до папки буде скопійовано в буфер.',
    scriptProtonMessage:
      'Українізатор завантажено та розпаковано. Скрипт для Windows буде запущено через вибрану версію Proton.\n\nШлях до папки буде скопійовано в буфер.',
    exeAskMessage:
      'Українізатор завантажено та розпаковано.\n\nЗапустити інсталятор зараз?',
    scriptAskMessage:
      'Українізатор завантажено та розпаковано.\n\nЗапустити скрипт зараз?',
    protonPlaceholder: 'Оберіть версію Proton',
    openFolder: 'Відкрити папку',
    run: 'Так, запустити',
    skip: 'Ні',
    confirmMessage:
      'Після завантаження та розпакування українізатора буде запущено його інсталятор або скрипт.\n\nПродовжити встановлення?',
    confirm: 'Продовжити',
    finishedTitle: 'Інсталятор завершено',
    finishedMessage: 'Інсталятор успішно завершив роботу',
    failed: 'Не вдалося запустити інсталятор',
  },
  selectDropdown: {
    placeholder: 'Оберіть варіант',
    empty: 'Немає варіантів',
  },
  sendLogs: {
    titleCrash: 'Звіт про помилку',
    title: 'Відправити логи',
    submit: 'Надіслати логи',
    consent: 'Надіславши логи, ви погоджуєтеся на обробку ваших персональних даних.',
    crashReason: 'Причина помилки:',
    descriptionLabel: "Опис (необов'язково)",
    placeholder: 'Опишіть що сталося, щоб ми могли швидше розібратися...',
    rateLimit: 'Зачекайте кілька хвилин перед наступною відправкою',
    sendFailed: 'Не вдалося надіслати логи',
    networkError: 'Помилка мережі. Спробуйте пізніше',
  },
  settings: {
    title: 'Налаштування',
    close: 'Закрити',
    feedback: {
      title: "Зворотний зв'язок",
      description: 'Написати нам у Telegram',
    },
    performance: {
      title: 'Режим продуктивності',
      weakHardware:
        'Увімкнено: на цьому пристрої недостатньо ресурсів для плавних анімацій, тому режим продуктивності не можна вимкнути',
      description: 'Вимикає анімації і блюр в інтерфейсі для кращої продуктивності',
    },
    liquidGlass: {
      title: 'Liquid Glass тема',
      weakHardware:
        'Вимкнено: на цьому пристрої недостатньо ресурсів для ефекту прозорості',
      description: 'Увімкнути ефект прозорості та розмиття для вікон (macOS 26+)',
    },
    backup: {
      title: 'Створювати резервну копію',
      description: 'Зберігати оригінальні файли гри перед встановленням українізатора',
    },
    steamCef: {
      title: 'Швидке застосування параметрів запуску Steam',
      description:
        'Дозволяє лаунчеру одразу, без перезапуску Steam, застосовувати параметри запуску, підписки в Майстерні, колекцію «З українізаторами» та обкладинки. Для цього в теці Steam створюється файл .cef-enable-remote-debugging (його ж використовує Decky Loader), і після увімкнення Steam потрібно один раз перезапустити. Якщо встановлено Millennium або Decky Loader, лаунчер додає до них плагін «LBK Bridge» — через нього Steam також показує переклад досягнень. Якщо вимкнути, параметри запуску застосовуватимуться лише після закриття Steam.',
    },
    steamArtwork: {
      title: 'Українські обкладинки в Steam',
      description:
        'Замінювати банер, логотип і горизонтальну обкладинку гри в бібліотеці Steam на українські версії з українізатора. Вертикальна обкладинка залишається оригінальною. Оригінали повертаються при видаленні українізатора або коли вимкнути цей перемикач',
    },
    adultGames: {
      title: 'Показувати ігри з порнографічним вмістом',
      description:
        'Дозволити відображення ігор з порнографічним/еротичним контентом (hentai, візуальні новели для дорослих тощо)',
    },
    aiTranslations: {
      title: 'Приховати ШІ-переклади',
      description: 'Сховати переклади, створені за допомогою штучного інтелекту',
    },
    recommendations: {
      title: 'Рекомендації ігор',
      description: 'Показувати блок «Вас може зацікавити» на сторінці гри',
    },
    notificationSounds: {
      title: 'Звуки сповіщень',
      description: 'Відтворювати звуки при отриманні сповіщень про оновлення',
    },
    gamepadSounds: {
      title: 'Звуки геймпада',
      description: 'Відтворювати звуки при навігації геймпадом',
    },
    productAnalytics: {
      title: 'Продуктова аналітика',
      description:
        'Сесії застосунку та взаємодії з інтерфейсом — допомагають зрозуміти, що в лаунчері незручно',
    },
    localizationAnalytics: {
      title: 'Аналітика розвитку локалізацій',
      description:
        'Підтримка авторів, пошук без результатів, видалення та час у грі — показують, яких перекладів бракує',
    },
    crashDiagnostics: {
      title: 'Звіти про збої',
      description:
        'Автоматичні звіти про помилки застосунку. Вимкнення діє одразу, увімкнення — після перезапуску',
    },
    collection: {
      title: 'Колекція «З українізаторами» в Steam',
      description:
        'Створити або оновити колекцію бібліотеки Steam з іграми, на які є переклад',
      updatedTitle: 'Колекція оновлена',
      updatedEmpty: 'У колекції «З українізаторами» тепер немає ігор.',
      updated_one: 'У колекції «З українізаторами» тепер {{count}} гра.',
      updated_few: 'У колекції «З українізаторами» тепер {{count}} гри.',
      updated_many: 'У колекції «З українізаторами» тепер {{count}} ігор.',
      updated_other: 'У колекції «З українізаторами» тепер {{count}} гри.',
      failedTitle: 'Не вдалося оновити колекцію',
    },
    kurin: {
      title: 'Синхронізація з Kurin`',
      description: 'Знайти встановлені ігри, додані через Kurin`, та імпортувати їх',
      failedTitle: 'Не вдалося синхронізувати',
      doneTitle: 'Синхронізація завершена',
      synced_one: 'Синхронізовано {{count}} гру: {{games}}',
      synced_few: 'Синхронізовано {{count}} гри: {{games}}',
      synced_many: 'Синхронізовано {{count}} ігор: {{games}}',
      synced_other: 'Синхронізовано {{count}} гри: {{games}}',
      none: 'Не знайдено ігор, встановлених через Kurin, або Kurin не встановлено.',
    },
    lbkShortcut: {
      title: 'LBK Launcher в бібліотеці Steam',
      description: 'Додати лаунчер як гру в Steam',
      addedTitle: 'Готово',
      addedMessage: 'LBK Launcher додано в бібліотеку Steam.',
      failedTitle: 'Не вдалося додати в Steam',
      errorTitle: 'Сталася помилка',
      errorMessage: 'Спробуйте ще раз пізніше.',
    },
    unexpectedError: 'Сталася непередбачена помилка.',
    clearCache: {
      title: 'Очистити кеш',
      description: 'Видалити тимчасові файли (зберігає налаштування)',
      confirmMessage:
        'Буде видалено тимчасові файли та базу даних. Налаштування збережуться. Застосунок перезапуститься.',
      confirmAction: 'Очистити',
    },
    clearAll: {
      title: 'Очистити всі дані',
      description: 'Видалити налаштування, підписки та всі дані',
      confirmMessage:
        'Буде видалено всі дані, включаючи налаштування та підписки. Застосунок перезапуститься.',
      confirmAction: 'Видалити все',
    },
    dev: {
      title: 'Dev налаштування',
      notificationSounds: 'Звуки сповіщень:',
      soundStatus: 'Стан',
      soundVersion: 'Версія',
      soundApp: 'Застосунок',
      soundProgress: 'Прогрес',
      soundNewGame: 'Нова гра',
      soundTeam: 'Команда',
      gamepadSounds: 'Звуки геймпада:',
      navigate: 'Навігація',
      confirm: 'Підтвердити',
      back: 'Назад',
      promoMode: 'Режим показу промо банера:',
      promoNormal: 'Звичайний (24 год + галочка)',
      promoAlways: 'Завжди показувати',
      promoNever: 'Ніколи не показувати',
      promoPlaceholder: 'Оберіть режим',
    },
    logs: {
      title: 'Відкрити папку з логами',
      description: 'Переглянути збережені файли логів',
      send: 'Відправити файл',
    },
    unlock: {
      title: 'Розблокувати прихований переклад',
      placeholder: 'Код перекладу',
      action: 'Розблокувати',
    },
    changelog: {
      title: 'Що нового',
      description: 'Історія оновлень · v{{version}}',
    },
    legal: {
      terms: 'Умови використання',
      privacy: 'Політика конфіденційності',
    },
    credits: {
      title: 'Подяки',
      description:
        'Особлива подяка перекладачам, які долучились до тестування з перших днів і допомогають робити цей лаунчер таким, яким він є:',
    },
    bridgeCard: {
      steamElevated:
        'Steam запущено від імені адміністратора, тому лаунчер не може його перезапустити.',
      restart: 'Перезапустити Steam',
      recheck: 'Перевірити ще раз',
    },
  },
  shareModal: {
    title: 'Поділитися',
    text: '{{game}} з українською локалізацією від {{team}} можна зручно встановити у LBK Launcher',
    shareIn: 'Поділитися в:',
    copyHint: 'Або скопіюйте посилання чи текст:',
    copyText: 'Копіювати текст',
    copied: 'Скопійовано!',
  },
  sidebarNav: {
    guides: 'Відкрити посібники та інструменти',
    donators: 'Відкрити сторінку донаторів',
    news: 'Відкрити новини',
    home: 'Відкрити головну сторінку',
    gamepadSoundsOff: 'Вимкнути звуки геймпада',
    gamepadSoundsOn: 'Увімкнути звуки геймпада',
    notifications: 'Сповіщення',
    settings: 'Налаштування',
  },
  specialTranslators: {
    earlySupporter: 'Допомагає розвивати LBK Launcher з перших днів',
    launcherTeam: 'Команда лаунчера',
  },
  statusBadge: {
    unknown: 'Невідомо',
  },
  steamActionErrors: {
    steamNotRunning: 'Steam не запущено. Запустіть Steam і спробуйте ще раз.',
    cefUnavailable:
      'Увімкніть налаштування «Швидке застосування параметрів запуску Steam» і перезапустіть Steam, щоб лаунчер міг {{purpose}}.',
    cefBlocked:
      'Steam не відкрив канал для лаунчера навіть після перезапуску. Щоб лаунчер міг {{purpose}}, перевірте, чи не блокує його інший мод Steam, і натисніть «Перевірити ще раз» у налаштуваннях.',
    millenniumPluginPending:
      'Millennium закриває канал, через який лаунчер працює зі Steam. Плагін «LBK Bridge» увімкнеться після наступного закриття Steam — тоді лаунчер зможе {{purpose}}. Або увімкніть його вже зараз у налаштуваннях Millennium (Plugins).',
    millenniumOutdated:
      'Ваша версія Millennium застаріла. Оновіть Millennium до версії 3, щоб лаунчер міг {{purpose}}.',
    libraryUnavailable: 'Бібліотека Steam ще завантажується. Спробуйте за кілька секунд.',
    noTranslatedGames:
      'У каталозі немає перекладів до ігор Steam. Якщо каталог ще синхронізується, спробуйте за хвилину.',
    noMatches: 'Серед ваших ігор у бібліотеці Steam немає жодної з перекладом.',
    failed: 'Спробуйте ще раз пізніше.',
  },
  steamActionPurposes: {
    manageCollections: 'керувати колекціями',
    addShortcut: 'додати ярлик у бібліотеку',
  },
  steamCollection: {
    name: 'З українізаторами',
  },
  steamRestart: {
    steamNotStarted: 'Steam не запустився',
    failed: 'Не вдалося перезапустити Steam',
    progressTitle: 'Перезапуск Steam',
    progressMessage:
      'Лаунчер закриває і знову запускає Steam. Це може тривати до двох хвилин.',
    unknownError: 'Невідома помилка',
    failedTitle: 'Steam не перезапущено',
    restartedTitle: 'Steam перезапущено',
  },
  steamRestartFailure: {
    launchFailed:
      'Steam закрито, але не вдалося запустити його знову. Запустіть Steam вручну.',
    accessDenied: {
      launchOptions:
        'Steam запущено від імені адміністратора, тому лаунчер не може його перезапустити. Закрийте Steam самостійно — параметри запуску застосуються автоматично.',
      plain:
        'Steam запущено від імені адміністратора, тому лаунчер не може його перезапустити. Перезапустіть Steam самостійно.',
    },
    gamescope: {
      launchOptions:
        'В ігровому режимі лаунчер не перезапускає Steam. Параметри запуску застосуються, щойно Steam буде закрито — наприклад, після переходу в режим робочого столу.',
      plain:
        'В ігровому режимі лаунчер не перезапускає Steam. Перезапустіть його самостійно — наприклад, перейдіть у режим робочого столу.',
    },
    gameRunning: {
      launchOptions:
        'Закрийте гру, щоб перезапустити Steam. Параметри запуску застосуються, щойно Steam буде закрито.',
      plain: 'Закрийте гру, щоб перезапустити Steam.',
    },
    timeout: {
      launchOptions:
        'Steam не закрився вчасно. Закрийте його вручну — параметри запуску застосуються автоматично.',
      plain: 'Steam не закрився вчасно. Перезапустіть його вручну.',
    },
    generic: 'Не вдалося перезапустити Steam.',
  },
  steamRestartPrompt: {
    title: 'Перезапустіть Steam',
    message:
      'Щоб зміни набули чинності, потрібно перезапустити Steam. Можна зробити це пізніше — налаштування вже збережено.',
    restartAction: 'Перезапустити Steam',
  },
  teamSubscribe: {
    subscribedTitle: 'Ви підписані на оновлення від "{{team}}"',
    followTitle_single: 'Слідкувати за автором "{{team}}"',
    followTitle_multiple: 'Слідкувати за авторами "{{team}}"',
    follow_team: 'Слідкувати за {{team}}',
    follow_single: 'Слідкувати за автором',
    follow_multiple: 'Слідкувати за авторами',
    unfollow_team: 'Відписатися від {{team}}',
    unfollow_single: 'Відписатися від автора',
    unfollow_multiple: 'Відписатися від авторів',
  },
  termsOfService: {
    title: 'Умови використання',
    subtitle: 'Умови використання послуги',
    intro:
      'Ці Умови регулюють використання сайту<site>lbklauncher.com</site> та десктопного клієнта <b>LBK Launcher</b>.',
    parties:
      '<b>Сторони:</b> LBK Team (GameGlobe Localization та Little Bit) та Користувач "ви", продуктів LBK Team - сайту та десктоп клієнту (ланчеру).',
    lastUpdated: 'Останнє оновлення: {{date}}',
    sections: {
      definitions: {
        title: 'Визначення та ключові терміни',
        country:
          '<b>Країна:</b> країна, де розташована LBK Team або її власники/засновники, у цьому випадку — Україна.',
        service:
          '<b>Сервіс:</b> послуга, яку надає GameGlobe Localization (вул. Металістів, 4, Київ, 02000) та Little Bit, як описано у відповідних умовах (якщо доступно) та на цій платформі.',
        website:
          '<b>Вебсайт:</b> сайт GameGlobe Localization, доступний за URL:<site>https://ggloc.org/</site>.',
        you: '<b>Ви:</b> особа або організація, що користуються сервісами від GameGlobe Localization та Little Bit для використання Сервісів.',
      },
      licensing: {
        title: 'Ліцензування та інтелектуальна власність',
        frontend:
          '<b>Front-end клієнта:</b> Вихідний код графічного інтерфейсу та клієнтської частини є відкритим і поширюється під ліцензією <b>GNU GPL v3</b>. Ви маєте право модифікувати та поширювати його згідно з умовами цієї ліцензії.',
        backend:
          '<b>Back-end та API:</b> Вся серверна частина, бази даних та логіка API є виключною інтелектуальною власністю <b>LBK Team</b>. Будь-які спроби несанкціонованого доступу, брутфорсу, реверс-інжинірингу серверних протоколів або втручання в роботу серверної інфраструктури <b>суворо заборонені</b>.',
        content:
          '<b>Контент (Переклади):</b> Усі локалізації, доступні в лаунчері, за ліцензією для кінцевого користувача з обмеженням лише для некомерційного приватного використання. Вони призначені виключно для особистого ознайомлення та некомерційного використання. Ви не маєте права перепродавати або використовувати ці файли у комерційних продуктах без дозволу правовласників.',
      },
      liability: {
        title: 'Обмеження відповідальності',
        text: 'Програмне забезпечення надається за принципом "as is" (як є). LBK Team не несе відповідальності за можливі конфлікти з античитами ігор, технічні збої або втрату ігрового прогресу, спричинені встановленням перекладів.',
        risk: 'ВИ ВИКОРИСТОВУЄТЕ ЛАУНЧЕР НА ВЛАСНИЙ РИЗИК. МИ НЕ ГАРАНТУЄМО ВІДСУТНІСТЬ БАНІВ В ОНЛАЙН-ІГРАХ',
      },
      contacts: {
        title: 'Контакти',
        intro: 'Якщо у вас є будь-які питання, звертайтесь:',
      },
    },
  },
  titleBar: {
    offlineSuffix: ' · ви оффлайн',
  },
  translationAwards: {
    mostAnticipated2026: 'Найочікуваніший переклад 2026 за версією спільноти',
    bestText2025: 'Найкращий текстовий переклад 2025 за версією спільноти',
  },
  translationPicker: {
    title: 'Оберіть переклад',
    unknownAuthor: 'Невідомий автор',
  },
  translationProgress: {
    translation: 'Переклад',
    editing: 'Редактура',
    voice: 'Озвучення',
    textures: 'Текстури',
    fonts: 'Шрифти',
  },
  translationStatusCard: {
    title: 'Прогрес перекладу',
    inProgress: 'У процесі',
  },
  translationStatusIcons: {
    updateAvailable: 'Є оновлення перекладу',
    upToDate: 'Переклад актуальний',
    availableToInstall: 'Переклад доступний для встановлення',
    aiEdited: 'ШІ + редактура людиною',
    aiOnly: 'Переклад ШІ',
    favorite: 'В улюбленому',
  },
  tray: {
    open: 'Відкрити',
    quit: 'Вийти',
  },
  uninstall: {
    title: 'Видалення українізатора',
    message:
      'Ви впевнені, що хочете видалити українізатор для "{{name}}"?\n\n{{backupWarning}}',
    noBackupWarning:
      'УВАГА: Резервну копію не було створено при встановленні. Оригінальні файли НЕ будуть відновлені!',
    backupWarning: 'Оригінальні файли гри будуть відновлені з резервної копії.',
    confirm: 'Видалити',
    doneTitle: 'Українізатор видалено',
    doneMessage: 'Українізатор "{{name}}" успішно видалено!',
    notInstalled: 'Українізатор не встановлено',
    failed: 'Помилка видалення: {{error}}',
    removeComponentsFailed: 'Помилка видалення компонентів: {{error}}',
  },
  updateNotice: {
    downloaded: 'Оновлення завантажено та готове до встановлення',
    versionAvailable: 'Версія {{version}} доступна для завантаження',
    newVersionAvailable: 'Версія нова доступна для завантаження',
    downloading: 'Завантаження...',
    openDownloadPage: 'Скачати нову версію',
    restart: 'Перезапустити',
    download: 'Завантажити',
    later: 'Пізніше',
    readyTitle: 'Оновлення готове!',
    availableTitle: 'Доступне оновлення',
  },
  workshopButton: {
    tombstoned: 'Переклад більше не доступний у каталозі',
    offline: 'Відсутнє підключення до Інтернету',
    gameNotInstalled: 'Гру не встановлено на цьому пристрої',
    progressInSteam: 'Прогрес показано в клієнті Steam',
    install: 'Встановити зі Steam',
    openPageTitle: 'Відкрити сторінку в Майстерні',
    openPage: 'Майстерня',
    unsubscribeTitle: 'Скасувати підписку в Steam',
  },
} as const;
