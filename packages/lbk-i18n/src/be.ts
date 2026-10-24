import type { Messages } from './uk';

export const be = {
  achievementsBadge: {
    settingOffDetail:
      'У наладах выключана «Хуткае прымяненне параметраў запуску Steam» — без яго лаўнчар не падключае плагін «LBK Bridge».',
    hidden: 'Не будуць паказвацца ў Steam',
    millennium: 'Будуць паказвацца праз Millennium',
    decky: 'Будуць паказвацца праз Decky Loader',
    afterRestart: 'З’явяцца пасля перазапуску Steam',
    needsMillennium: 'Патрэбны Millennium',
    needsDeckyPlugin: 'Патрэбны LBK Bridge для Decky Loader',
    needsDecky: 'Патрэбны Decky Loader',
  },
  achievementsNote: {
    needsMillennium:
      'Steam не чытае перакладзеныя назвы дасягненняў са звычайных файлаў гульні. Каб бачыць іх у бібліятэцы, апавяшчэннях і аверлэі Steam, усталюйце Millennium. Дасягненні ў інтэрфейсе самой гульні могуць застацца на мове распрацоўшчыка.',
    needsDeckyPlugin:
      'Steam не чытае перакладзеныя назвы дасягненняў са звычайных файлаў гульні. Каб бачыць іх у бібліятэцы, апавяшчэннях і аверлэі Steam, усталюйце плагін «LBK Bridge» для Decky Loader. Дасягненні ў інтэрфейсе самой гульні могуць застацца на мове распрацоўшчыка.',
    needsDecky:
      'Steam не чытае перакладзеныя назвы дасягненняў са звычайных файлаў гульні. На Steam Deck іх паказвае плагін «LBK Bridge», якому патрэбны Decky Loader. Дасягненні ў інтэрфейсе самой гульні могуць застацца на мове распрацоўшчыка.',
    settingOff:
      'Пераклад дасягненняў недаступны, пакуль інтэграцыя са Steam выключаная. {{detail}}',
    unsupported:
      'Пераклад дасягненняў недаступны: на гэтай сістэме Steam не можа яго паказаць. {{detail}}',
  },
  achievementsOption: {
    title: 'Дасягненні Steam',
    checking: 'Праверка…',
    description: 'Пераклад дасягненняў Steam.',
    thirdPartyAuthor: 'Аўтар перакладу дасягненняў:',
  },
  adultWarning: {
    title: 'Кантэнт для дарослых',
    message:
      'Гэтая гульня ўтрымлівае кантэнт для дарослых (18+). Каб праглядзець яе, уключыце адпаведную наладу.',
    openSettings: 'Адкрыць налады',
  },
  aiTranslationBadge: { edited: 'ШІ + рэдагаванне чалавекам', ai: 'Пераклад ШІ' },
  appLoader: {
    tagline: 'Украінізатар гульняў',
    restartApp: 'Перазапусціце праграму',
    status: {
      syncing: 'Сінхранізацыя',
      error: 'Памылка злучэння',
      loading: 'Загрузка',
      ready: 'Загрузка',
    },
  },
  archiveDownload: {
    archiveNotFound: 'Архіў {{type}} не знойдзены',
    fetchingUrl: 'Атрыманне спасылкі для спампоўвання...',
    urlFailed: 'Не ўдалося атрымаць спасылку: {{error}}',
    refreshingUrl: 'Абнаўленне спасылкі для спампоўвання...',
    verifying: 'Праверка цэласнасці файла...',
    corrupted: 'Файл пашкоджаны. Паспрабуйце спампаваць яшчэ раз.',
    completed: 'Спампоўванне завершанае!',
  },
  authorSubscription: {
    title: 'Сачыць за аўтарамі',
    singleAuthor: 'Аўтар лакалізацыі',
    authorsCount_one: '{{count}} аўтар лакалізацыі',
    authorsCount_few: '{{count}} аўтары лакалізацыі',
    authorsCount_many: '{{count}} аўтараў лакалізацыі',
    authorsCount_other: '{{count}} аўтара лакалізацыі',
    description_single:
      'Хочаце атрымліваць апавяшчэнні пра новыя лакалізацыі гэтага аўтара? Падпіскі можна змяніць у любы момант.',
    description_multiple:
      'Хочаце атрымліваць апавяшчэнні пра новыя лакалізацыі гэтых аўтараў? Падпіскі можна змяніць у любы момант.',
    subscribed: 'падпісана',
    skip: 'Прапусціць',
    subscribe: 'Падпісацца',
    subscribeSelected: 'Падпісацца ({{selected}})',
  },
  authorsList: { others: 'Іншыя аўтары:' },
  bridgeStatus: {
    connected: 'Падключана да Steam.',
    connectedDecky: 'Падключана да Steam праз плагін «LBK Bridge» для Decky Loader.',
    connectedMillennium: 'Падключана да Steam праз плагін «LBK Bridge» для Millennium.',
    steamNotRunning: 'Steam не запушчаны.',
    restartPending: 'Каб уключыць хуткае прымяненне, адзін раз перазапусціце Steam.',
    cefBlocked:
      'Steam не адкрыў канал для лаўнчара нават пасля перазапуску, таму лаўнчар больш не будзе прасіць перазапусціць Steam. Параметры запуску будуць ужывацца пасля закрыцця Steam. Магчыма, канал блакіруе іншы мод Steam.',
    millenniumOutdated:
      'Выяўлены састарэлы Millennium 2.x. Абнавіце Millennium да версіі 3 — тады лаўнчар зможа працаваць з ім праз плагін. Да гэтага параметры запуску будуць ужывацца пасля закрыцця Steam.',
  },
  catalogFilters: {
    title: 'Фільтры і сартаванне',
    apply: 'Паглядзець',
    activeFilters: 'Актыўныя фільтры',
    removeFilter: 'Зняць фільтр',
    statusSection: 'Статус',
    contentTypeSection: 'Тып кантэнту',
    translationTypeSection: 'Тып перакладу',
    librarySection: 'Бібліятэка',
    authorsSection: 'Аўтары',
    tagsSection: 'Тэгі',
    searchAuthor: 'Пошук аўтара...',
    authorNotFound: 'Аўтар не знойдзены',
    searchTag: 'Пошук катэгорыі...',
    tagNotFound: 'Катэгорыя не знойдзеная',
  },
  changelog: {
    title: 'Што новага',
    upcoming: 'Будзе ў абнаўленні',
    yourVersion: 'Ваша версія — v{{version}}',
    olderVersions: 'Папярэднія версіі ({{total}})',
    fullList: 'Поўны спіс змен на GitHub',
  },
  common: {
    cancel: 'Скасаваць',
    selectFolder: 'Выбраць папку',
    error: 'Памылка',
    unknownError: 'Невядомая памылка',
    installError: 'Памылка ўсталявання',
    uninstallError: 'Памылка выдалення',
    close: 'Закрыць',
    ok: 'Зразумела',
    notNow: 'Не цяпер',
    dontOfferAgain: 'Больш не прапаноўваць',
    tryAgain: 'Паспрабаваць яшчэ раз',
    checkingSystem: 'Праверка сістэмы…',
    restartSteamNow: 'Перазапусціць Steam цяпер',
    afterSteamExit: 'Пасля закрыцця Steam',
  },
  confirmModal: { confirm: 'Пацвердзіць' },
  crashScreen: {
    uncaughtError: 'Крытычная памылка',
    unhandledRejection: 'Неапрацаваная памылка проміса',
    intro:
      'На жаль, адбылася крытычная памылка. Адпраўце справаздачу, каб мы маглі хутчэй яе выправіць.',
    sendReport: 'Адправіць справаздачу пра памылку',
    messagePlaceholder: 'Апішыце, што адбылося (неабавязкова)…',
    send: 'Адправіць',
    sending: 'Адпраўка...',
    sent: 'Справаздача адпраўленая. Дзякуй!',
    rateLimited: 'Пачакайце некалькі хвілін',
    sendFailed: 'Памылка адпраўкі. Паспрабуйце пазней',
    networkError: 'Памылка сеткі',
    reload: '1. Перазагрузіць',
    reloadHint: 'Хуткае выпраўленне (захоўвае ўсе даныя)',
    clearCache: '2. Ачысціць кэш',
    clearCacheHint: 'Выдаліць часовыя файлы (захоўвае налады)',
    clearAll: '3. Ачысціць усе даныя ⚠️',
    clearAllHint: 'Выдаліць налады, падпіскі і ўсе даныя',
    techInfo: 'Тэхнічная інфармацыя',
    errorLabel: 'Памылка:',
  },
  deckyLoader: {
    offerIntro:
      'Decky Loader — бясплатны старонні менеджар плагінаў для Steam Deck, які не належыць Valve. Лаўнчар можа ўсталяваць яго, а потым дадаць плагін «LBK Bridge».',
    offerBenefits:
      'Што гэта дасць:\n• LBK Bridge будзе паказваць перакладзеныя назвы дасягненняў у бібліятэцы, апавяшчэннях і аверлэі Steam.',
    offerWithout:
      'Што працуе і без Decky Loader: параметры запуску, падпіскі ў майстэрні, калекцыя «З украінізатарамі», ярлык лаўнчара і вокладкі ў Steam.',
    offerInstaller:
      'Лаўнчар спампуе з GitHub афіцыйны ўсталёўшчык Decky Loader і запусціць яго. Калі спатрэбіцца пароль адміністратара (sudo), вы ўвядзяце яго ў акне ўсталёўшчыка — LBK Launcher не мае да яго доступу. Калі пароль не зададзены, усталёўшчык прапануе стварыць часовы і выдаліць яго пасля ўсталявання.',
    offerCaveat:
      'Звярніце ўвагу: пасля буйных абнаўленняў SteamOS Decky Loader часам трэба ўсталёўваць паўторна.',
    repair:
      'Decky Loader усталяваны, але не працуе — падобна, папярэдняе ўсталяванне не завяршылася. Лаўнчар можа яшчэ раз запусціць афіцыйны ўсталёўшчык Decky Loader.',
    gameMode:
      'Усталёўшчык Decky Loader працуе толькі ў рэжыме працоўнага стала (Desktop Mode). Перайдзіце ў яго праз меню сілкавання Steam, адкрыйце LBK Launcher і зноў націсніце «Усталяваць Decky Loader».',
    installing:
      'Усталёўшчык Decky Loader адкрыты. У акне «Decky Installer» увядзіце пароль адміністратара і выберыце канал «Release». Калі акна не відаць, знайдзіце яго на панэлі задач.',
    failure: {
      'download-failed':
        'Не ўдалося спампаваць усталёўшчык Decky Loader. Праверце падключэнне да інтэрнэту і паспрабуйце яшчэ раз.',
      'checksum-mismatch':
        'Спампаваны ўсталёўшчык Decky Loader не супадае з праверанай версіяй. Усталяванне скасаванае.',
      unsupported:
        'На гэтай сістэме лаўнчар не можа ўсталяваць Decky Loader. Усталюйце яго паводле інструкцыі на сайце Decky Loader.',
      'not-running':
        'Decky Loader усталяваны, але не запусціўся. Паспрабуйце яшчэ раз — усталёўшчык пераўсталюе яго.',
      'not-installed':
        'Decky Loader не ўсталяваны. Калі акно ўсталёўшчыка закрытае або пароль не падышоў, паспрабуйце яшчэ раз.',
    },
    whatIs: 'Што такое Decky Loader',
    repairAction: 'Аднавіць Decky Loader',
    installAction: 'Усталяваць Decky Loader',
  },
  deckyPlugin: {
    waiting: 'Чакаем LBK Launcher',
    connected: 'Падключана да LBK Launcher',
    viaMillennium: 'Падключана праз Millennium',
  },
  deckySetup: {
    title: 'Плагін «LBK Bridge» для Decky Loader',
    waiting:
      'Пацвердзіце ўсталяванне плагіна «LBK Bridge» у акне Decky Loader. Калі акна не відаць, націсніце кнопку Steam.',
    fallback:
      'Не ўдалося адкрыць запыт на ўсталяванне ў Decky Loader. Захавайце ZIP-файл і дадайце яго ўручную: Decky → Settings (Налады) → Developer (Распрацоўшчык) → Install Plugin from ZIP.',
    done: 'Плагін «LBK Bridge» усталяваны. Перакладзеныя назвы дасягненняў з’явяцца ў Steam пасля падключэння плагіна.',
    saveZip: 'Захаваць ZIP',
    saved: 'Файл захаваны: {{path}}',
    saveFailed: 'Не ўдалося захаваць файл.',
    saveFailedWithError: 'Не ўдалося захаваць файл: {{error}}',
    intro:
      'Плагін паказвае перакладзеныя назвы дасягненняў у бібліятэцы, апавяшчэннях і аверлэі Steam. Астатнія функцыі інтэграцыі працуюць і без яго. Decky Loader пакажа запыт на ўсталяванне — пацвердзіце яго ў Steam.',
    noDecky:
      'Decky Loader не знойдзены. Спачатку ўсталюйце Decky Loader — пасля гэтага лаўнчар зможа дадаць да яго плагін «LBK Bridge».',
    loaderDone: 'Decky Loader усталяваны.',
    pluginReady: 'Плагін «LBK Bridge» для Decky Loader ужо ўсталяваны.',
    pluginUpdate: 'Даступнае абнаўленне плагіна «LBK Bridge» для Decky Loader.',
    updatePlugin: 'Абнавіць плагін для Decky Loader',
    installPlugin: 'Усталяваць плагін',
  },
  download: {
    paused: 'Спампоўванне прыпыненае',
    pauseFailed: 'Не ўдалося прыпыніць спампоўванне',
    resuming: 'Працяг спампоўвання...',
    resumeFailed: 'Не ўдалося працягнуць спампоўванне',
    cancelled: 'Спампоўванне скасаванае',
    retryAttempt: 'Спроба {{attempt}}/{{maxRetries}}… Праверце падключэнне да інтэрнэту.',
    downloading: 'Спампоўванне ўкраінізатара...',
    connectionLost: 'Злучэнне страчанае. Праверце падключэнне да інтэрнэту.',
    networkRetry: 'Памылка сеткі. Спроба {{attempt}}/{{maxRetries}}…',
    failedAfterRetries:
      'Не ўдалося спампаваць файл пасля {{maxRetries}} спроб.\n\nАпошняя памылка: {{error}}\n\nПраверце падключэнне да інтэрнэту і паспрабуйце яшчэ раз.',
    rangeUnsupported:
      'Сервер не падтрымлівае працяг спампоўвання. Яно пачнецца спачатку…',
    fileChanged: 'Файл на серверы змяніўся. Трэба пачаць спампоўванне спачатку.',
    timeout: 'Час чакання скончыўся. Праверце падключэнне да інтэрнэту.',
    failed: 'Памылка спампоўвання',
    httpError: 'Памылка спампоўвання: HTTP {{statusCode}} {{statusMessage}}',
    noInternet: 'Няма падключэння да інтэрнэту',
    connectFailed:
      'Не ўдалося падключыцца да сервера. Праверце падключэнне да інтэрнэту.',
    connectionReset: 'Злучэнне разарванае. Праверце падключэнне да інтэрнэту.',
    serverUnavailable: 'Сервер недаступны',
    serverUnavailableRetry: 'Сервер недаступны. Паспрабуйце пазней.',
    failedCheckConnection: 'Памылка спампоўвання. Праверце падключэнне да інтэрнэту.',
    failedWithError: 'Памылка спампоўвання: {{error}}',
  },
  downloadLimit: {
    message:
      'Ліміт спампоўванняў вычарпаны.\n\n{{used}}\n{{max}}\n\nНаступнае спампоўванне будзе даступнае праз {{time}}.',
    used_one: 'Вы ўжо спампавалі гэтую гульню {{count}} раз за апошнія 24 гадзіны.',
    used_few: 'Вы ўжо спампавалі гэтую гульню {{count}} разы за апошнія 24 гадзіны.',
    used_many: 'Вы ўжо спампавалі гэтую гульню {{count}} разоў за апошнія 24 гадзіны.',
    used_other: 'Вы ўжо спампавалі гэтую гульню {{count}} раза за апошнія 24 гадзіны.',
    max_one: 'Для вялікіх гульняў дазволена не больш за {{count}} спампоўванне за суткі.',
    max_few: 'Для вялікіх гульняў дазволена не больш за {{count}} спампоўванні за суткі.',
    max_many:
      'Для вялікіх гульняў дазволена не больш за {{count}} спампоўванняў за суткі.',
    max_other:
      'Для вялікіх гульняў дазволена не больш за {{count}} спампоўвання за суткі.',
    unknownTime: 'невядома',
  },
  downloadProgress: {
    downloadingFiles: 'Спампоўванне файлаў...',
    pause: 'Паўза',
    resume: 'Працягнуць',
    pauseResumeFailed: 'Не ўдалося змяніць стан спампоўвання',
    cancelFailed: 'Не ўдалося скасаваць спампоўванне',
    downloaded: 'Спампавана:',
    speed: 'Хуткасць:',
    speedValue: '{{speed}}/с',
    timeLeft: 'Засталося часу:',
  },
  duration: { underSecond: '< 1с' },
  favoriteToggle: { add: 'Дадаць у абранае', remove: 'Выдаліць з абранага' },
  feedbackModal: {
    title: 'Пакінуць водгук',
    type: { feedback: 'Водгук', error: 'Памылка' },
    typeLabel: 'Тып',
    descriptionLabel: 'Апісанне',
    placeholder_feedback: 'Падзяліцеся ўражаннямі або прапановамі…',
    placeholder_error: 'Апішыце, дзе ўзнікла памылка і якая мова выбраная ў гульні…',
    screenshotsLabel: 'Здымкі экрана (неабавязкова)',
    dropzone: '<hl>Выберыце файл</hl> або перацягніце сюды',
    submit: 'Адправіць',
    screenshotsFailed: 'Не ўдалося загрузіць здымкі экрана',
    screenshotFailed: 'Не ўдалося загрузіць здымак экрана: {{name}}',
    rateLimit: 'Пачакайце некалькі хвілін перад наступнай справаздачай',
    sendFailed: 'Не ўдалося адправіць справаздачу',
    networkError: 'Памылка сеткі. Паспрабуйце пазней',
    thanks: 'Дзякуй за справаздачу!',
    sent: 'Ваша справаздача адпраўленая аўтару перакладу',
  },
  filterBar: {
    filters: 'Фільтры',
    clearAll: 'Ачысціць усе фільтры',
    showInstalled: 'Паказаць спампаваныя пераклады',
    hideInstalled: 'Схаваць спампаваныя пераклады',
    showFavorites: 'Паказаць абранае',
    hideFavorites: 'Схаваць абранае',
    sort: 'Сартаванне',
  },
  filterOptions: {
    status: {
      planned: 'Запланаваны',
      'in-progress': 'Ранні доступ',
      completed: 'Гатовы',
      'tech-improvement': 'Тэхнічныя паляпшэнні',
    },
    library: {
      'favorite-translations': 'Абраныя ўкраінізатары',
      'installed-translations': 'Усталяваныя ўкраінізатары',
      'installed-games': 'Усталяваныя гульні',
      'available-in-steam': 'Даступныя са Steam',
      'owned-gog-games': 'Даступныя з GOG',
      'owned-epic-games': 'Даступныя з Epic',
      'installed-xbox-games': 'Усталяваныя з Xbox app',
    },
    contentType: {
      'with-achievements': 'З перакладам дасягненняў',
      'with-voice': 'З агучваннем',
      'from-workshop': 'З майстэрні Steam',
    },
    translationType: {
      manual: 'Ручны пераклад',
      ai: 'ШІ-пераклад',
      'ai-edited': 'ШІ + рэдагаванне',
    },
    sort: {
      name: 'Паводле назвы',
      downloads: 'Паводле папулярнасці',
      subscribers: 'Паводле колькасці падпісчыкаў',
      newest: 'Паводле навізны',
    },
  },
  fundraising: { title: 'Збор сродкаў', raised: 'Сабрана', goal: 'Мэта' },
  gameActions: {
    play: 'Гуляць',
    removedFromCatalog: 'Пераклад больш недаступны ў каталогу',
    offline: 'Няма падключэння да інтэрнэту',
    rerunTitle: 'Запусціць усталёўшчык/скрыпт паўторна',
    rerun: 'Пераўсталяваць',
    uninstallTitle: 'Выдаліць украінізатар',
    support: 'Падтрымаць',
    feedback: 'Пакінуць водгук',
    cancel: 'Скасаваць',
  },
  gameAuthors: { many: 'Аўтары лакалізацыі', one: 'Аўтар лакалізацыі' },
  gameCard: {
    unknownAuthor: 'Невядомы аўтар',
    downloadedByPlayers: 'Спампавана гульцамі',
  },
  gameHero: { share: 'Падзяліцца' },
  gameLike: {
    like: 'Ацаніць',
    unlike: 'Зняць ацэнку',
    needsInstall: 'Усталюйце пераклад, каб ацаніць',
  },
  gameInfo: {
    title: 'Інфармацыя',
    award: 'Узнагарода',
    platforms: 'Платформы',
    version: 'Версія',
    size: 'Памер',
    voice: 'Агучванне',
    achievements: 'Дасягненні',
    achievementsBy: 'ад {{author}}',
    subscribers: 'Падпісчыкаў',
    downloads: 'Спампоўванняў',
    downloadsUnder20: 'да 20',
    openInSteam: 'Адкрыць у Steam',
    created: 'Створана',
    updated: 'Абноўлена',
  },
  gameLanguage: {
    EN: 'англійскую',
    GB: 'брытанскую',
    FR: 'французскую',
    IT: 'італьянскую',
    DE: 'нямецкую',
    ES: 'іспанскую',
    JA: 'японскую',
    KO: 'карэйскую',
    PL: 'польскую',
    CS: 'чэшскую',
    ZH_CN: 'кітайскую (спрошчаную)',
    ZH_TW: 'кітайскую (традыцыйную)',
    ZH: 'кітайскую',
    PT: 'партугальскую',
    UK: 'украінскую',
  },
  gameLaunch: { executableNotFound: 'Не ўдалося знайсці выканальны файл гульні' },
  gameLinks: {
    title: 'Спасылкі',
    stores: 'Крамы',
    other: 'Іншае',
    openIn: 'Адкрыць у {{store}}',
    steamGuide: 'Дапаможнік у Steam',
    website: 'Вэб-сайт',
  },
  gameList: { loadFailed: 'Памылка загрузкі гульняў' },
  gameNotice: {
    kind_installer: 'Усталёўшчык',
    kind_script: 'Скрыпт',
    language: 'У наладах гульні выберыце <accent>{{language}} мову</accent>',
  },
  gamePage: {
    tombstone:
      'Гэты пераклад больш недаступны ў каталогу. Вы можаце толькі выдаліць лакалізацыю — паўторнае ўсталяванне недаступнае.',
    uninstalling: 'Выдаленне ўкраінізатара і аднаўленне арыгінальных файлаў...',
  },
  gameSearch: { placeholder: 'Пошук гульні...' },
  gameSections: { aboutTranslation: 'Пра ўкраінізатар', aboutGame: 'Пра гульню' },
  gameStatus: {
    planned: 'Запланаваны',
    inProgress: 'Ранні доступ',
    completed: 'Завершаны',
    techImprovement: 'Тэхнічныя паляпшэнні',
  },
  gameSubscribe: {
    subscribedTitle: 'Вы атрымліваеце апавяшчэнні пра «{{game}}»',
    subscribeTitle: 'Атрымліваць апавяшчэнні пра «{{game}}»',
    unsubscribe: 'Выключыць апавяшчэнні',
    subscribe: 'Атрымліваць апавяшчэнні',
  },
  gameVideo: {
    title: 'Відэа',
    watch: 'Паглядзець відэа',
    trailer: 'Трэйлер украінізацыі',
    play: 'Прайграць',
  },
  gamepadHelp: {
    title: 'Кіраванне геймпадам',
    deckKeyboard: 'На Steam Deck экранная клавіятура адкрываецца спалучэннем STEAM + X.',
    everywhere: {
      title: 'Паўсюль',
      move: 'Перайсці да суседняга элемента (утрымлівайце — хутчэй)',
      press: 'Націснуць / адкрыць',
      back: 'Назад або закрыць акно',
      scroll: 'Плаўная пракрутка',
      search: 'Пошук гульні',
      home: 'Галоўная старонка',
      settings: 'Налады',
      help: 'Гэтая даведка',
    },
    feed: {
      title: 'Стужка перакладаў',
      adjacent: 'Папярэдні / наступны пераклад',
      page: 'Гартаць на цэлы экран',
      ends: 'У пачатак або канец спіса',
      header: 'Верхняе меню: пошук, фільтры, навіны',
      content: 'Да змесціва старонкі',
      home: 'На галоўную са старонкі перакладу',
    },
    gamePage: {
      title: 'Старонка перакладу',
      move: 'Да кнопкі ці карткі ў гэтым кірунку',
      scroll: 'Пракруціць на экран угору / уніз',
      adjacent: 'Папярэдні / наступны пераклад',
      back: 'Уверсе старонкі — назад да стужкі перакладаў',
    },
    dialogs: {
      title: 'Вокны і палі ўводу',
      startTyping: 'У полі ўводу — пачаць набіраць',
      stopTyping: 'Скончыць увод; яшчэ раз — закрыць акно',
      clearSearch: 'У полі пошуку — ачысціць яго',
      leaveList: 'У спісе аўтараў ці тэгаў — выйсці са спіса',
      scroll: 'Пракруціць акно на экран',
    },
  },
  gamepadHints: {
    allButtons: 'Усе кнопкі',
    finishInput: 'Скончыць увод',
    clear: 'Ачысціць',
    select: 'Выбраць',
    items: 'Пункты',
    navigation: 'Навігацыя',
    scroll: 'Пракрутка',
    open: 'Адкрыць',
    menu: 'Меню',
    toGames: 'Да гульняў',
    games: 'Гульні',
    page: 'Старонка',
    search: 'Пошук',
    home: 'Галоўная',
    adjacentTranslation: 'Суседні пераклад',
  },
  homeSections: {
    newGames: 'Навінкі',
    newTranslations: 'Новыя пераклады',
    updates: 'Абнаўленні',
    popular: 'Папулярнае сярод гульцоў',
    installedGames: 'Знойдзеныя ўсталяваныя гульні',
    recommended: 'Вас можа зацікавіць',
    viewAll: 'Паглядзець усе',
    noGames: 'Гульняў не знойдзена',
    back: 'Назад',
  },
  install: { rateLimitTitle: 'Ліміт спампоўванняў' },
  installArchive: {
    extracting: 'Распакоўванне файлаў... {{percent}}%',
    extracted: 'Распакоўванне завершанае',
    extractFailed: 'Памылка распакоўвання архіва: {{error}}',
  },
  installBackup: {
    backupFailed: 'Памылка стварэння рэзервовай копіі: {{error}}',
    restoreFailed: 'Памылка аднаўлення файлаў: {{error}}',
  },
  installButton: {
    offline: 'Няма інтэрнэту',
    planned: 'Запланаваны',
    techImprovement: 'Тэхнічныя паляпшэнні',
    reload: 'Спампаваць нанова (v{{version}})',
    update: 'Абнавіць да v{{version}}',
    install: 'Усталяваць украінізатар',
  },
  installComponents: {
    removing: 'Выдаленне кампанентаў...',
    removeFailed: 'Не ўдалося выдаліць кампаненты',
    removedTitle: 'Кампаненты выдаленыя',
    removedMessage: 'Выбраныя кампаненты выдаленыя.',
  },
  installConflict: {
    title: 'Іншая лакалізацыя ўжо ўсталяваная',
    message:
      'У папцы гульні ўжо ўсталяваная іншая лакалізацыя:\n\n«{{name}}»{{team}}\nВерсія: {{version}}\n\nКаб усталяваць новую лакалізацыю, трэба спачатку выдаліць папярэднюю.\n\nВыдаліць папярэднюю лакалізацыю?',
    confirm: 'Выдаліць і працягнуць',
    infoNotFound: 'Не ўдалося знайсці звесткі пра ўсталяваную лакалізацыю.',
    removeFailed: 'Не ўдалося выдаліць папярэднюю лакалізацыю.',
    unknownLocalization: 'Невядомая лакалізацыя',
  },
  installEmulator: {
    title: 'Выберыце папку з гульнёй',
    message:
      'Для эмулятараў трэба ўручную пазначыць папку з гульнёй.\n\nВыбраць папку з гульнёй?',
  },
  installFailure: {
    network: 'Не ўдалося падключыцца да сервера.\n\nПраверце падключэнне да інтэрнэту.',
    permission:
      'Недастаткова правоў для ўсталявання.\n\nЗапусціце праграму ад імя адміністратара.',
    diskSpace: 'Недастаткова месца на дыску.\n\nВызваліце месца і паспрабуйце зноў.',
    notFound: 'Файл або папка не знойдзеныя.\n\nПераканайцеся, што гульня ўсталяваная.',
    unknown: 'Невядомая памылка ўсталявання.\n\nПаспрабуйце яшчэ раз.',
    copyFailed: 'Памылка капіявання файлаў: {{error}}',
    signing: 'Падпісанне праграмы...',
  },
  installGameNotFound: {
    title: 'Гульня не знойдзеная',
    message: '{{error}}\n\nПаспрабуйце выбраць папку гульні самастойна',
  },
  installIpc: {
    fileNotFound: 'Файл не знойдзены',
    pickFolderTitle: 'Выберыце папку з гульнёй',
    pickFolderButton: 'Выбраць',
    noActiveDownload: 'Няма актыўнага спампоўвання для прыпынення',
    noPausedDownload: 'Няма прыпыненага спампоўвання',
  },
  installNetwork: {
    interruptedTitle: 'Злучэнне перарванае',
    interruptedMessage:
      'Не ўдалося аднавіць спампоўванне аўтаматычна.\n\nПраверце падключэнне да інтэрнэту і паспрабуйце зноў.\nХод спампоўвання захаваны.',
    retry: 'Паспрабаваць зноў',
    waiting:
      'Злучэнне страчанае. Спампоўванне працягнецца аўтаматычна пасля аднаўлення злучэння...',
    resuming: 'Аднаўленне спампоўвання...',
    offlineTitle: 'Няма падключэння',
    offlineMessage: 'Праверце падключэнне да інтэрнэту і паспрабуйце яшчэ раз.',
  },
  installOptions: {
    reinstallTitle: 'Кіраванне кампанентамі',
    installTitle: 'Параметры ўсталявання',
    reinstallIntro: 'Выберыце кампаненты для «{{name}}»:',
    installIntro: 'Выберыце параметры ўсталявання ўкраінізатара «{{name}}»:',
    platformAuto: 'Аўтаматычна ({{platform}})',
    platformManual: 'Ручны выбар ({{platform}})',
    platformFound: 'Знойдзена',
    platformNotFound: 'Не знойдзена (выбар уручную)',
    platformLabel: 'Платформа гульні',
    platformPlaceholder: 'Выберыце платформу',
    backupTitle: 'Стварыць рэзервовую копію',
    backupDescription: 'Захоўвае арыгінальныя файлы гульні, каб іх можна было аднавіць.',
    backupSize: 'Прыблізны памер: {{size}}',
    textTitle: 'Тэкставая лакалізацыя',
    installed: 'усталявана',
    textDescription: 'Пераклад тэкстаў гульні на ўкраінскую.',
    size: 'Памер: {{size}}',
    willReinstall: 'Будзе пераўсталявана',
    willInstall: 'Будзе ўсталявана',
    voiceTitle: 'Агучванне',
    unavailable: '(недаступна)',
    voiceWithText: '(разам з тэкставай)',
    voiceDescription: 'Украінскае агучванне.',
    willRemove: 'Будзе выдалена',
    willDownload: 'Будзе спампавана',
    launchOptions:
      'Гэты пераклад задасць уласныя <hl>параметры запуску</hl> гульні ў Steam.',
    totalDownload: 'Будзе спампавана:',
    removeList: 'Будзе выдалена: {{items}}',
    removeVoice: 'агучванне',
    removeAchievements: 'дасягненні',
    confirm: 'Усталяваць',
  },
  installPlatform: {
    linuxOnly:
      'Гэты ўкраінізатар даступны толькі для Linux. Усталяванне на Windows немагчымае.',
    windowsOnly:
      'Гэты ўкраінізатар даступны толькі для Windows. Усталяванне на macOS немагчымае.',
    unsafeCmdPath: 'шлях змяшчае сімвалы, небяспечныя для каманднага радка: {{path}}',
    exitFailedOrCancelled: 'Усталяванне завяршылася з памылкай або было скасаванае',
    exitCancelled: 'Усталяванне скасаванае',
    exitCode: 'Усталёўшчык завяршыўся з кодам {{code}}',
    installerOutput: '\n\nВывад усталёўшчыка:\n{{output}}',
    installerFileNotFound: 'файл усталёўшчыка не знойдзены: {{path}}',
    launching: 'Запуск усталёўшчыка...',
    protonSetup: 'Наладжванне і запуск Proton',
    notCompleted: 'усталяванне не завершанае',
    windowsNeedsProton: 'Усталёўшчыку Windows ({{extensions}}) патрэбны Proton.',
    runFailed: 'Не ўдалося запусціць усталёўшчык: {{error}}',
    uninstallerFailed: 'Не ўдалося запусціць сродак выдалення: {{error}}',
    rerunFailed: 'Не ўдалося паўторна запусціць усталёўшчык',
  },
  installStatus: {
    installing: 'Усталяванне ўкраінізатара...',
    updating: 'Абнаўленне ўкраінізатара...',
    offlinePaused: 'Няма падключэння да інтэрнэту. Спампоўванне прыпыненае.',
    error: 'Памылка ўсталявання',
    update: 'Даступнае абнаўленне:',
    installed: 'Украінізатар усталяваны:',
  },
  installSteamIntegration: {
    launchOptions: 'Наладжванне параметраў запуску Steam...',
    artwork: 'Усталяванне ўкраінскіх вокладак у Steam…',
  },
  installSteps: {
    licenseOnlyManual:
      'Гэты пераклад можна ўсталяваць толькі на ліцэнзійную версію гульні.\n\nВыбраць папку ўручную нельга.',
    licenseOnlyNotFound:
      'Гэты пераклад можна ўсталяваць толькі на ліцэнзійную версію гульні.\n\nГульня не знойдзеная. Пераканайцеся, што ліцэнзійная версія ўсталяваная праз афіцыйную краму (Steam, GOG, Epic Games, Ubisoft Connect, EA App і іншыя).',
    gameNotFound:
      'Гульня не знойдзеная\n\nНе ўдалося аўтаматычна вызначыць шлях да папкі: {{path}}',
    pathNotSpecified: 'не пазначана',
    protonMissing:
      'Гэты ўкраінізатар мае ўсталёўшчык Windows, якому патрэбны Proton, але ніводнай версіі не знойдзена.\n\nУсталюйце Proton у Steam і паспрабуйце яшчэ раз.',
    notEnoughSpace:
      'Недастаткова месца на дыску.\n\nПатрэбна: {{needed}}\nДаступна: {{available}}\n\nВызваліце месца і паспрабуйце зноў.',
    noArchiveForBuild:
      'Для ўсталяванай зборкі гульні ({{build}}) няма архіва перакладу.\n\nПераклад даступны толькі для: {{variants}}.',
    voiceStatus: 'Агучванне: {{message}}',
    copying: 'Капіяванне файлаў украінізатара...',
    cleaning: 'Ачыстка часовых файлаў...',
    backingUp: 'Стварэнне рэзервовай копіі...',
    awaitingConfirm_installer: 'Чакаем пацвярджэння запуску ўсталёўшчыка...',
    awaitingConfirm_script: 'Чакаем пацвярджэння запуску скрыпта...',
    runDeclined_installer:
      'Усталяванне скасаванае: запуск усталёўшчыка адхілены.\n\nФайлы распакаваныя ў папку гульні. Усталёўшчык можна запусціць пазней кнопкай «Пераўсталяваць».',
    runDeclined_script:
      'Усталяванне скасаванае: запуск скрыпта адхілены.\n\nФайлы распакаваныя ў папку гульні. Скрыпт можна запусціць пазней кнопкай «Пераўсталяваць».',
    macBundleUnresolved:
      'Не ўдалося вызначыць месца ўсталявання ўнутры пакета праграмы macOS (.app).\n\nДля гэтай гульні патрэбны асобны архіў перакладу для macOS.',
    status: 'Дасягненні: {{message}}',
  },
  installSuccess: {
    updatedMessage: 'Украінізатар {{name}} абноўлены да версіі {{version}}.',
    installedMessage: 'Украінізатар {{name}} усталяваны.',
    updatedTitle: 'Украінізатар абноўлены',
    installedTitle: 'Украінізатар усталяваны',
    pluginNextStart: 'Пераклад дасягненняў з’явіцца пасля наступнага запуску Steam.',
    needsMillenniumInstallable:
      'Пераклад дасягненняў захаваны. Каб бачыць яго ў Steam, патрэбны Millennium — лаўнчар можа ўсталяваць яго сам.',
    needsMillennium:
      'Пераклад дасягненняў захаваны. Каб бачыць яго ў Steam, патрэбны Millennium.',
    needsDeckyPlugin:
      'Пераклад дасягненняў захаваны. Каб бачыць яго ў Steam, усталюйце плагін «LBK Bridge» для Decky Loader.',
    needsDecky:
      'Пераклад дасягненняў захаваны. На Steam Deck яго паказвае плагін «LBK Bridge» для Decky Loader — лаўнчар можа ўсталяваць Decky Loader сам.',
    unavailable:
      'Пераклад дасягненняў захаваны, але на гэтай сістэме Steam не можа яго паказаць: {{reason}}',
    disabled:
      'Пераклад дасягненняў захаваны. Каб бачыць яго ў Steam, уключыце ў наладах «Хуткае прымяненне параметраў запуску Steam».',
    launchOptionsQueued:
      'Параметры запуску ўжывуцца аўтаматычна, як толькі вы закрыеце Steam. Лаўнчар павінен быць адкрыты — яго можна згарнуць у сістэмны трэй.',
    launchOptionsError: 'Не ўдалося наладзіць параметры запуску: {{error}}',
    ok: 'Зразумела',
    restartSteamNow: 'Перазапусціць Steam цяпер',
    restartFailureTitle: 'Параметры запуску не ўжытыя',
    restartSuccessTitle: 'Параметры запуску ўжытыя',
    restartSuccessMessage: 'Параметры запуску запісаныя. Можна запускаць гульню.',
  },
  installUnavailable: {
    title: 'Недаступна',
    message: 'Усталяванне даступнае толькі ў настольнай версіі праграмы',
  },
  installedGamesBanner: {
    noTranslationsTitle: 'Не знайшлі перакладаў для вашых гульняў',
    noTranslationsText:
      'На жаль, мы знайшлі вашы гульні, але перакладаў для іх пакуль няма.<br/>Адкрыйце меню фільтраў, каб паглядзець іншыя даступныя пераклады.',
    noGamesTitle: 'Не можам знайсці вашы гульні',
    noGamesText:
      'На жаль, мы не знайшлі ўсталяваных гульняў, для якіх ёсць пераклады.<br/>Пераканайцеся, што маеце хаця б адну гульню з нашага каталога ў Steam, GOG, Epic Games Store, Ubisoft Connect або EA App. Таксама можна адкрыць меню фільтраў і паглядзець гульні, якія яшчэ не ўсталяваныя.',
  },
  kuliPlacement: {
    supported: 'Пераклад даступны пры падтрымцы KULI',
    beFirst: 'Будзьце <b>першымі</b>, хто згуляе з перакладам!',
    goToKuli: 'Перайсці на KULI →',
  },
  launch: {
    errorTitle: 'Памылка запуску',
    failed: 'Не ўдалося запусціць гульню',
    gameNotFound: 'Гульня не знойдзеная на вашым камп’ютары',
    lutrisFailed: 'Не ўдалося запусціць гульню праз Lutris',
  },
  launchOptions: {
    noAppId: 'Гульня не мае Steam App ID',
    notConfigured: 'Для гэтага перакладу не зададзеныя параметры запуску',
    gameDirUnresolved: 'Не ўдалося вызначыць папку гульні для параметраў запуску',
    writeFailed: 'Не ўдалося запісаць параметры запуску',
    eglWriteFailed: 'не ўдалося змяніць налады гульні ў Epic Games Launcher',
    eglNeedsShell:
      'яны працуюць толькі праз абалонку, праз якую іх запускае Steam, а Epic Games Launcher так не ўмее',
    eglQueued:
      'Параметры запуску ўжывуцца аўтаматычна, як толькі вы выйдзеце з Epic Games Launcher праз яго значок у сістэмным трэі (закрытае акно пакідае яго працаваць). LBK Launcher тым часам павінен быць адкрыты — яго можна згарнуць у сістэмны трэй.',
    eglEnvUnsupported:
      'Epic Games Launcher не перадае гульні зменныя асяроддзя, таму без іх пераклад можа не працаваць.',
    eglEnvOnlyFromLbk:
      'Epic Games Launcher не перадае гульні зменныя асяроддзя, таму пераклад будзе працаваць, толькі калі запускаць гульню кнопкай «Гуляць» у LBK Launcher.',
  },
  millennium: {
    deckyHost:
      'У сістэмах з Decky Loader лаўнчар выкарыстоўвае плагін «LBK Bridge» для Decky Loader, таму ўсталяванне Millennium тут недаступнае.',
    unsupported: {
      'flatpak-steam': 'Millennium не падтрымлівае Steam, усталяваны праз Flatpak.',
      'snap-steam': 'Millennium не падтрымлівае Steam, усталяваны праз Snap.',
      arch: 'Millennium працуе толькі на камп’ютарах з працэсарам x86-64.',
      'steam-rt64':
        'Millennium не працуе з 64-бітнай бэта-версіяй кліента Steam. Выйдзіце з бэта-праграмы ў наладах Steam («Сумяшчальнасць»/«Бэта-версіі»).',
      'missing-libssl32':
        'Не хапае 32-бітнай бібліятэкі OpenSSL 3 (пакет libssl3:i386 або lib32-openssl). Усталюйце яе і паспрабуйце яшчэ раз.',
      'steam-home-link':
        'Не знойдзена ~/.steam/steam, які ўказвае на папку Steam. Запусціце Steam адзін раз і паспрабуйце яшчэ раз.',
      nixos:
        'На NixOS усталюйце Millennium сродкамі сістэмы — лаўнчар сам дадасць да яго плагін «LBK Bridge».',
      'macos-too-old': 'Millennium патрабуе macOS 13.3 або навейшай.',
      'no-release':
        'Аўтаматычнае ўсталяванне Millennium для гэтай сістэмы яшчэ недаступнае.',
      'millennium-v2':
        'У вас старая версія Millennium. Абнавіце яе да версіі 3 афіцыйным усталёўшчыкам — пасля гэтага лаўнчар сам дадасць плагін «LBK Bridge».',
      'no-steam': 'Лаўнчар не знайшоў Steam на гэтай прыладзе.',
      unknown: 'Millennium не падтрымліваецца на гэтай сістэме.',
      noReleaseMac: 'Зборка Millennium для macOS яшчэ рыхтуецца.',
    },
    failure: {
      installFailed: 'Не ўдалося ўсталяваць Millennium.',
      'download-failed':
        'Не ўдалося спампаваць Millennium. Праверце падключэнне да інтэрнэту і паспрабуйце яшчэ раз.',
      'checksum-mismatch':
        'Спампаваны файл Millennium пашкоджаны або падменены. Усталяванне скасаванае.',
      'extract-failed': 'Не ўдалося распакаваць Millennium.',
      'av-blocked':
        'Антывірус выдаліў або заблакіраваў файлы Millennium. Дадайце папку Steam у выключэнні антывіруса і паспрабуйце яшчэ раз.',
      'not-writable':
        'Лаўнчар не мае права запісу ў папку Steam. Усталюйце Millennium афіцыйным усталёўшчыкам.',
      conflict:
        'У папцы Steam ужо ёсць файлы іншага мода, які загружаецца гэтак жа, як Millennium. Лаўнчар не будзе іх змяняць.',
      'not-prepared': 'Спачатку спампуйце Millennium яшчэ раз.',
      'script-failed': 'Не ўдалося ўсталяваць файлы Millennium.',
      'files-locked':
        'Файлы Steam яшчэ занятыя. Millennium усталюецца пасля наступнага закрыцця Steam.',
      cancelled: 'Усталяванне Millennium скасаванае.',
      busy: 'Лаўнчар ужо змяняе Millennium. Дачакайцеся завяршэння.',
      'plugin-not-connected':
        'Millennium усталяваны, але плагін «LBK Bridge» яшчэ не падключыўся. Праверце, ці запушчаны Steam, і націсніце «Праверыць яшчэ раз».',
    },
    phase: {
      download: 'Спампоўванне Millennium…',
      verify: 'Праверка файлаў…',
      extract: 'Распакоўванне…',
      'stop-steam': 'Закрыццё Steam…',
      'install-files': 'Усталяванне файлаў…',
      'start-steam': 'Запуск Steam…',
      'wait-plugin': 'Чакаем падключэння плагіна «LBK Bridge»…',
      uninstallFiles: 'Выдаленне файлаў Millennium…',
    },
  },
  millenniumPending: {
    notDetected:
      'Steam не адкрыў канал для лаўнчара. Параметры запуску будуць ужывацца пасля закрыцця Steam. Магчыма, канал блакіруе іншы мод Steam.',
    unsupported:
      'Выяўлены Millennium, але лаўнчар не змог дадаць да яго плагін «LBK Bridge». Параметры запуску будуць ужывацца пасля закрыцця Steam.',
    enabled:
      'Плагін «LBK Bridge» для Millennium уключаны, але Steam яшчэ не загрузіў яго. Плагін запрацуе пасля наступнага запуску Steam.',
    disabled:
      'Выяўлены Millennium. Ён закрывае канал, праз які лаўнчар працуе са Steam, таму лаўнчар усталяваў плагін «LBK Bridge» для Millennium. Плагін уключыцца аўтаматычна, як толькі вы закрыеце Steam. Або ўключыце яго ўжо цяпер: налады Millennium → Plugins → LBK Bridge.',
  },
  millenniumSetup: {
    title: 'Millennium і плагін «LBK Bridge»',
    done: 'Millennium усталяваны. Steam падключыўся да лаўнчара праз плагін «LBK Bridge».',
    offlineDone:
      'Millennium усталяваны. Плагін «LBK Bridge» падключыцца, як толькі вы запусціце Steam.',
    queued:
      'Millennium усталюецца, як толькі вы закрыеце Steam. Калі лаўнчар тады будзе закрыты — пры яго наступным запуску, калі Steam не будзе працаваць.',
    macQueued: 'Потым запускайце Steam з лаўнчара або праз «Steam Millennium».',
    steamNotBack:
      'Steam не запусціўся пасля ўсталявання Millennium. Магчыма, гэтая версія Millennium яшчэ не падтрымлівае ваш Steam.',
    envMissing:
      'Steam запушчаны не з лаўнчара, таму Millennium не актыўны. Перазапусціце Steam з лаўнчара або паўторна ўвайдзіце ў сістэму.',
    external:
      'Millennium ужо ўсталяваны — лаўнчар сам дадасць да яго плагін «LBK Bridge».',
    openSite: 'Адкрыць сайт Millennium',
    startSteam: 'Запусціць Steam',
    uninstall: 'Выдаліць Millennium',
    restartSteam: 'Перазапусціць Steam',
    recheck: 'Праверыць яшчэ раз',
    restartToFinish: 'Каб завяршыць усталяванне, трэба закрыць Steam і запусціць зноў.',
    install: 'Усталяваць',
    update: 'Абнавіць Millennium',
    repair: 'Аднавіць Millennium',
    updateTitle: 'Абнаўленне Millennium',
    repairTitle: 'Аднаўленне Millennium',
    updateAvailable: 'Даступнае абнаўленне Millennium: {{version}}.',
    filesBroken: 'Файлы Millennium у папцы Steam пашкоджаныя або выдаленыя.',
    restartNeeded: 'Для гэтага трэба будзе закрыць Steam і запусціць зноў.',
    offer: {
      intro:
        'Millennium — бясплатная старонняя мадыфікацыя кліента Steam, якая не належыць Valve. Лаўнчар можа ўсталяваць яе разам з плагінам «LBK Bridge».',
      benefitsMac:
        'Што гэта дасць:\n• LBK Bridge будзе паказваць перакладзеныя назвы дасягненняў у бібліятэцы, апавяшчэннях і аверлэі Steam.',
      benefits:
        'Што гэта дасць:\n• LBK Bridge будзе паказваць перакладзеныя назвы дасягненняў у бібліятэцы, апавяшчэннях і аверлэі Steam;\n• лаўнчар зможа працаваць са Steam без адкрытага порта адладкі і паўторных просьбаў перазапусціць Steam.',
      withoutMillennium:
        'Што працуе і без Millennium: параметры запуску, падпіскі ў майстэрні, калекцыя «З украінізатарамі», ярлык лаўнчара і вокладкі ў Steam — праз порт адладкі Steam (пасля аднаго перазапуску Steam).',
      sourceMac: 'Файлы спампоўваюцца з нашай зборкі Millennium на GitHub.',
      source: 'Файлы Millennium спампоўваюцца з афіцыйнай старонкі праекта на GitHub.',
      caveatWindows:
        'Звярніце ўвагу: пасля абнаўленняў Steam Millennium часам часова не працуе, пакуль не выйдзе яго абнаўленне. Антывірус можа памылкова заблакіраваць яго файлы.',
      caveat:
        'Звярніце ўвагу: пасля абнаўленняў Steam Millennium часам часова не працуе, пакуль не выйдзе яго абнаўленне.',
      linux:
        'Millennium усталёўваецца толькі для бягучага карыстальніка і не патрабуе пароля адміністратара. Каб ён працаваў і пры запуску Steam па-за LBK Launcher, пасля ўсталявання выйдзіце з сеанса Linux і ўвайдзіце зноў.',
      macos:
        'На macOS лаўнчар усталёўвае адаптаваную зборку Millennium і ярлык «Steam Millennium» у папку «Праграмы» вашага карыстальніка. Millennium будзе працаваць толькі пры запуску Steam праз гэты ярлык; LBK Launcher будзе рабіць гэта аўтаматычна.',
      restart: 'Для ўсталявання трэба будзе закрыць Steam і запусціць зноў.',
    },
  },
  millenniumUninstall: {
    title: 'Выдаленне Millennium',
    restartNeeded: 'Каб выдаліць Millennium, трэба закрыць Steam і запусціць зноў.',
    cannotRestart:
      'Лаўнчар не можа перазапусціць Steam цяпер. Закрыйце Steam самастойна.',
    confirm:
      'Millennium будзе выдалены з папкі Steam. Плагіны і тэмы Millennium застануцца, калі не пазначыць «Выдаліць таксама плагіны і налады Millennium».',
    purge: 'Выдаліць таксама плагіны і налады Millennium',
    action: 'Выдаліць Millennium',
    queued: 'Millennium будзе выдалены, як толькі вы закрыеце Steam.',
    done: 'Millennium выдалены.',
    filesLocked:
      'Файлы Steam яшчэ занятыя. Millennium будзе выдалены пасля наступнага закрыцця Steam.',
    failed: 'Не ўдалося выдаліць Millennium.',
    failedWithError: 'Не ўдалося выдаліць Millennium: {{error}}',
    progress: 'Выдаленне Millennium…',
  },
  newsFeed: {
    title: 'Навіны',
    tab: { sales: 'Гульні са зніжкай', 'games-80': 'Гульні за 80', news: 'Навіны' },
    empty: 'Навін не знойдзена',
    open: 'Адкрыць навіну',
    discuss: 'Абмеркаваць у Telegram',
  },
  notificationCenter: {
    title: 'Апавяшчэнні',
    settingsTitle: 'Налады апавяшчэнняў',
    justNow: 'Толькі што',
    statusChange: 'Стан зменены з «{{from}}» на «{{to}}»',
    versionUpdate: 'Абнаўленне версіі з {{from}} да {{to}}',
    appUpdate: 'Даступная новая версія праграмы: {{version}}',
    teamNewGame: 'Новая лакалізацыя ад <team/>',
    teamStatusChange: '<team/>: стан зменены на «<status/>»',
    feedbackReply: 'Адказ на ваш водгук:',
    fallback: 'Новае апавяшчэнне',
    appUpdatesTitle: 'Абнаўленні праграмы',
    appUpdatesDescription: 'Апавяшчэнні пра новыя версіі LBK Launcher',
    gameUpdatesTitle: 'Абнаўленні ўкраінізатараў',
    gameUpdatesDescription: 'Апавяшчэнні пра новыя версіі ўсталяваных украінізатараў',
    empty: 'Апавяшчэнняў няма',
    emptyHint:
      'Падпішыцеся на ўкраінізатары са статусам «Запланаваны»,<br/>каб атрымліваць апавяшчэнні пра змены стану',
    markAllRead: 'Пазначыць усе прачытанымі',
    clearAll: 'Ачысціць усе',
    clearConfirmTitle: 'Выдаліць усе апавяшчэнні?',
    clearConfirmBody:
      'Гэта дзеянне нельга скасаваць. Усе апавяшчэнні будуць выдаленыя назаўсёды.',
    delete: 'Выдаліць',
  },
  notificationMessage: {
    statusChange: 'Стан зменены на «{{status}}»',
    progressChange: 'Гатоўнасць абноўленая: {{progress}}',
    firstFavorite: 'Націсніце, каб паказаць спіс абранага',
    feedbackReply: 'Новы адказ на ваш водгук',
    fallback: 'Новае апавяшчэнне',
  },
  notificationToast: {
    'status-change': 'Змена стану',
    'version-update': 'Даступнае абнаўленне',
    'app-update': 'Абнаўленне праграмы',
    'first-favorite': 'Дададзена ў абранае',
    'progress-change': 'Абнаўленне гатоўнасці',
    'feedback-reply': 'Адказ на водгук',
    'team-new-game': 'Апавяшчэнне',
    'team-status-change': 'Апавяшчэнне',
  },
  notifications: {
    versionAvailable: 'Даступная версія {{version}}',
    teamNewGame: 'Новая лакалізацыя ад {{team}}',
    teamStatusChange: '{{team}}: стан зменены на «{{status}}»',
    feedbackReplyTitle: 'Адказ на водгук: {{game}}',
  },
  pendingLaunchOptions: {
    queued_one: 'Чакаюць закрыцця Steam: параметры запуску для {{count}} гульні.',
    queued_few: 'Чакаюць закрыцця Steam: параметры запуску для {{count}} гульняў.',
    queued_many: 'Чакаюць закрыцця Steam: параметры запуску для {{count}} гульняў.',
    queued_other: 'Чакаюць закрыцця Steam: параметры запуску для {{count}} гульні.',
    gameName: '«{{name}}»',
    games_one: '{{count}} гульні',
    games_few: '{{count}} гульняў',
    games_many: '{{count}} гульняў',
    games_other: '{{count}} гульні',
    bridgeReady: 'Steam падключыўся да лаўнчара',
    steamClosed: 'Steam закрыты',
    appliedTitle: 'Параметры запуску ўжытыя',
    appliedBody:
      '{{lead}} — параметры запуску для {{target}} запісаныя. Можна запускаць гульню.',
  },
  platformName: {
    steam: 'Steam',
    epic: 'Epic Games Store',
    gog: 'GOG',
    rockstar: 'Rockstar Games Launcher',
    xbox: 'Xbox app',
    uplay: 'Ubisoft Connect',
    ea: 'EA App',
    emulator: 'Эмулятар',
    other: 'Іншая',
  },
  pluginEntries: {
    deckyPluginDisabled:
      'Плагін «LBK Bridge» выключаны ў Decky Loader. Уключыце яго ў наладах Decky.',
    recommend:
      'Парада: з Millennium лаўнчар таксама будзе паказваць у Steam пераклад дасягненняў.',
    noDeckyCanInstall:
      'Пераклад дасягненняў у Steam паказвае плагін «LBK Bridge» для Decky Loader. Лаўнчар можа ўсталяваць Decky Loader разам з плагінам.',
    noDecky:
      'Пераклад дасягненняў у Steam паказвае плагін «LBK Bridge» для Decky Loader. Спачатку ўсталюйце Decky Loader.',
    deckyPlugin:
      'Плагін «LBK Bridge» для Decky Loader паказвае ў Steam перакладзеныя дасягненні.',
    deckyOutdated: 'Даступнае абнаўленне плагіна «LBK Bridge» для Decky Loader.',
    pendingActivate: 'Millennium усталюецца, як толькі вы закрыеце Steam.',
    pendingDeactivate: 'Millennium будзе выдалены, як толькі вы закрыеце Steam.',
    installedVersion: 'Усталяваны Millennium {{version}}.',
    repair: 'Файлы Millennium у папцы Steam пашкоджаныя або выдаленыя.',
    update: 'Даступнае абнаўленне Millennium: {{version}}.',
    unsupported: 'Пераклад дасягненняў у Steam недаступны: {{reason}}',
    bridgeUpdate: 'Абнаўленне плагіна «LBK Bridge» будзе ўжытае пасля перазапуску Steam.',
  },
  pluginOffer: {
    installMillennium: 'Усталяваць Millennium',
    repairMillennium: 'Аднавіць Millennium',
    uninstallMillennium: 'Выдаліць Millennium',
    millenniumInfo: 'Што такое Millennium',
    millenniumSite: 'Адкрыць сайт Millennium',
    installDeckyLoader: 'Усталяваць Decky Loader',
    installDeckyPlugin: 'Усталяваць плагін для Decky Loader',
    updateDeckyPlugin: 'Абнавіць плагін для Decky Loader',
    deckyInfo: 'Што такое Decky Loader',
    openSettings: 'Адкрыць налады',
    restartSteam: 'Перазапусціць Steam',
    updateMillennium: 'Абнавіць Millennium да {{version}}',
  },
  privacyPolicy: {
    title: 'Палітыка прыватнасці',
    updated: 'Абноўлена: 22 кастрычніка 2026',
    intro:
      'LBK Launcher — сэрвіс для пошуку, усталявання і абнаўлення ўкраінскіх лакалізацый.',
    openSource:
      'Сайт і праграма маюць адкрыты зыходны код. Гэтая палітыка апісвае даныя, якія апрацоўваюцца лакальна, перадаюцца на інфраструктуру LBK або знешнім сэрвісам.',
    sections: {
      controller: {
        title: '1. Хто апрацоўвае вашы даныя',
        responsible:
          'За апрацоўку даных адказвае <b>LBK Team, у склад якой уваходзяць GameGlobe Localization і Little Bit</b>.',
        contactsIntro: 'Па пытаннях прыватнасці звяртайцеся:',
        email: 'на электронную пошту <mail>pr@gameglobe-localisation.com</mail>',
        telegram: 'або праз <tg>Telegram-бота падтрымкі</tg>',
      },
      categories: {
        title: '2. Катэгорыі апрацоўкі даных',
        intro:
          'LBK адрознівае аперацыі з данымі, неабходныя для працы сэрвісу, і катэгорыі аналітыкі.',
        essentialTitle: 'Неабходныя функцыі LBK',
        essentialText:
          'Гэтыя аперацыі патрэбныя для функцый, якімі вы карыстаецеся: спампоўвання, усталявання і абнаўлення лакалізацый, абароны сэрвісу ад злоўжыванняў і кіравання ўліковымі запісамі перакладчыкаў.',
        essentialListIntro: 'Да іх належаць:',
        essential1: 'прадастаўленне патрэбнага архіва лакалізацыі;',
        essential2: 'усталяванне, абнаўленне і лакальнае выдаленне лакалізацыі;',
        essential3: 'захаванне падпіскі на лакалізацыю;',
        essential4:
          'абарона сэрвісу ад злоўжыванняў і тэхнічныя абмежаванні спампоўванняў;',
        essential5: 'уліковыя запісы перакладчыкаў, каманд і мадэратараў.',
        improveTitle: 'Дапамога ў паляпшэнні LBK',
        improveText:
          'Прадуктовая аналітыка дапамагае зразумець, як вы карыстаецеся праграмай і наколькі зручна знаходзіць і ўсталёўваць лакалізацыі.',
        improveListIntro: 'Сюды ўваходзяць:',
        improve1: 'пачатак і заканчэнне сеанса праграмы;',
        improve2: 'ці ўсталявалі вы лакалізацыю падчас першага сеанса праграмы;',
        improve3: 'прадуктовая аналітыка Mixpanel;',
        improve4: 'паказы інфармацыйных банераў у праграме і націсканні на іх.',
        developTitle: 'Дапамога ў развіцці ўкраінскіх лакалізацый',
        developText:
          'Аналітыка попыту на лакалізацыі і іх выкарыстання дапамагае зразумець, якія пераклады патрэбныя гульцам і як яны карыстаюцца наяўнымі.',
        developListIntro: 'Сюды ўваходзяць:',
        develop1: 'націсканні на кнопку падтрымкі;',
        develop2:
          'пошукавыя запыты без вынікаў, каб вызначыць, якія пераклады шукаюць гульцы;',
        develop3: 'падзеі выдалення лакалізацыі для ацэнкі яе выкарыстання;',
        develop4:
          'час у гульнях з усталяванымі лакалізацыямі для рэкламных матэрыялаў на сайце («Час у гульнях з нашым лаўнчарам») і ў супольнасці.',
        diagnosticsTitle: 'Дыягностыка і справаздачы пра памылкі',
        diagnosticsText:
          'Аўтаматычныя справаздачы дапамагаюць знаходзіць і выпраўляць памылкі і збоі праграмы. Водгукі, здымкі экрана і журналы адпраўляюцца асобна, па відавочным дзеянні карыстальніка.',
        optOut:
          'Прадуктовая аналітыка, аналітыка развіцця лакалізацый і аўтаматычная дыягностыка не патрэбныя для ўсталявання або абнаўлення лакалізацый. Кожную катэгорыю можна асобна выключыць у наладах праграмы. Гэта не абмяжоўвае асноўных функцый лаўнчара.',
        publicTitle: 'Публічнае і партнёрскае выкарыстанне статыстыкі',
        publicText:
          'Абагульненыя паказчыкі могуць выкарыстоўвацца ў публічнай статыстыцы, рэкламных матэрыялах і партнёрскіх прэзентацыях без MachineID або іншых ідэнтыфікатараў асобных усталяванняў.',
        noTracking:
          'Праграма і сайт не выкарыстоўваюць рэкламных сетак, пікселяў адсочвання, запісу сеансаў або лічбавых адбіткаў прылад ці браўзераў. Мы не прадаём персанальных даных і не перадаём іх брокерам даных.',
      },
      localOnly: {
        title: '3. Даныя, якія апрацоўваюцца толькі на вашай прыладзе',
        intro:
          'Частка функцый працуе на вашай прыладзе без перадачы іх змесціва на серверы LBK.',
        gameDetection:
          '<b>Пошук усталяваных гульняў.</b> Праграма чытае службовыя файлы Steam, Epic Games, GOG, EA, Xbox, Ubisoft Connect, Rockstar, Heroic і Lutris, каб знайсці ўсталяваныя гульні і іх размяшчэнне. У Windows праграма таксама можа вызначаць гэтыя платформы па запісах у сістэмным рэестры.',
        platformAccounts:
          '<b>Даныя ўліковых запісаў гульнявых платформаў.</b> З даных профілю Steam праграма чытае толькі лікавы ідэнтыфікатар, патрэбны для супастаўлення бібліятэкі гульняў з каталогам лакалізацый. Яна не чытае лагін, нік, спіс сяброў, гісторыю пакупак, плацежныя даныя або паведамленні, нават калі яны ёсць у тым самым файле. Са службовых файлаў іншых гульнявых платформаў праграма чытае толькі даныя, патрэбныя для пошуку ўсталяваных гульняў і іх размяшчэння на дыску.',
        steamLibrary:
          '<b>Змены бібліятэкі Steam.</b> Падчас працы праграма сочыць за зменамі службовых файлаў Steam, каб абнаўляць лакальны спіс гульняў. Яна не чытае змесціва файла са спісам ліцэнзій, а толькі адсочвае змены яго памеру.',
        localDb:
          "<b>Лакальная база даных.</b> Каталог перакладаў, гісторыя ўсталяванняў, абранае і налады захоўваюцца ў файле базы даных на вашым камп'ютары. Усе гэтыя лакальныя даныя можна выдаліць у наладах праграмы.",
        backups:
          '<b>Рэзервовыя копіі.</b> Перад усталяваннем лакалізацыі арыгінальныя файлы гульні могуць капіявацца лакальна, каб іх можна было аднавіць.',
        search:
          '<b>Пошук, фільтры і падборкі.</b> Яны фарміруюцца з лакальнай базы даных. Мы не ствараем на серверы профіль вашых пераваг і не падладжваем каталог пад вашу прыладу.',
        thirdPartySync:
          '<b>Сінхранізацыя са старонняй праграмай.</b> Гэта дзеянне запускаеце вы, а звесткі пра ўсталяваныя лакалізацыі перадаюцца лакальна.',
        playtime:
          '<b>Лакальнае чытанне часу ў гульнях Steam.</b> Адбываецца толькі для гульняў з усталяванымі лакалізацыямі, каб вылічыць прырост часу ў гульні.',
        outro:
          "Праграма не робіць здымкаў экрана, не чытае буфер абмену і не збірае асобна імя камп'ютара ці імя ўліковага запісу аперацыйнай сістэмы. Для пошуку гульняў яна чытае толькі файлы ў папках гульняў і гульнявых платформаў. Імя ўліковага запісу можа трапіць у шляхі да файлаў у дыягнастычных журналах, якія вы адпраўляеце ўручную (гл. раздзел 7).",
      },
      network: {
        title: '4. Неабходныя сеткавыя аперацыі',
        downloadTitle: 'Спампоўванне лакалізацыі',
        downloadIntro:
          'Каб прадаставіць патрэбны файл, праграма перадае серверу як мінімум:',
        download1: 'ID гульні;',
        download2: 'шлях або ідэнтыфікатар архіва;',
        download3: 'тып архіва;',
        download4:
          'MachineID — тэхнічны ідэнтыфікатар, з дапамогай якога сэрвіс адрознівае прылады.',
        downloadPurpose:
          'Гэтыя палі патрэбныя, каб вызначыць файл, выканаць запыт на спампоўванне, прымяніць абмежаванні і падлічыць унікальныя спампоўванні. У межах аднаго запыту сервер прадастаўляе файл, правярае ліміт і запісвае спампоўванне ў статыстыку.',
        workshopTitle: 'Адкрыццё майстэрні Steam',
        workshopText:
          'Некаторыя лакалізацыі ўсталёўваюцца праз падпіску ў майстэрні Steam. Адкрыццё такой лакалізацыі ўлічваецца ў агульнай статыстыцы спампоўванняў. Для гэтага праграма перадае ID лакалізацыі і MachineID. Для кожнай лакалізацыі ўлічваецца толькі першы пераход з вашай прылады.',
        subscriptionTitle: 'Падпіска на лакалізацыю',
        subscriptionText:
          'Падпіска на пераклад дазваляе атрымліваць апавяшчэнні пра новыя версіі. Праграма стварае іх на вашай прыладзе. Асобна сервер LBK захоўвае ID лакалізацыі і MachineID, каб каманда перакладу бачыла, колькі карыстальнікаў чакае абнаўленняў. Гэты серверны запіс не патрэбны для стварэння апавяшчэнняў. Вы можаце ў любы момант адпісацца ў праграме, і запіс на серверы будзе адразу выдалены.',
      },
      productAnalytics: {
        title: '5. Прадуктовая аналітыка',
        intro: 'Для прадуктовай аналітыкі праграма перадае:',
        sessions:
          '<b>Пачатак і заканчэнне сеанса</b> — версію праграмы, час і працягласць сеанса, MachineID і прыкмету першага запуску. Гэтыя даныя дапамагаюць падлічыць унікальныя запускі і вызначыць, якія версіі праграмы выкарыстоўваюцца;',
        firstSession:
          '<b>Прыкмету першага сеанса</b> — разам з запытам на спампоўванне, каб зразумець, ці ўсталёўваюць карыстальнікі лакалізацыю падчас першага сеанса праграмы;',
        mixpanel:
          '<b>Падзеі інтэрфейсу Mixpanel</b> — адкрыццё раздзелаў, узаемадзеянне з элементамі кіравання, усталяванне, абнаўленне або выдаленне лакалізацый. Разам з імі перадаюцца назва гульні, версія праграмы і MachineID;',
        banners:
          '<b>Паказы банераў і націсканні</b> — ID кампаніі, тып падзеі і MachineID.',
      },
      localizationAnalytics: {
        title: '6. Аналітыка для развіцця ўкраінскіх лакалізацый',
        intro: 'Для аналітыкі развіцця лакалізацый праграма перадае:',
        support:
          '<b>Націсканні на кнопку падтрымкі</b> — ID гульні або лакалізацыі і MachineID, каб каманды бачылі, колькі людзей хацела іх падтрымаць;',
        emptySearch: '<b>Пошук без вынікаў</b> — тэкст запыту, яго крыніцу і MachineID;',
        uninstall: '<b>Выдаленне лакалізацыі</b> — ID лакалізацыі і MachineID;',
        playtime:
          '<b>Час у гульні</b> — толькі для гульняў з усталяванай лакалізацыяй: ID гульні, дадатковы час у хвілінах і MachineID.',
      },
      feedback: {
        title: '7. Водгукі, здымкі экрана і журналы',
        intro: 'Гэтыя даныя адпраўляюцца толькі пасля відавочнага дзеяння карыстальніка.',
        feedbackTitle: 'Водгукі пра лакалізацыю',
        feedbackIntro: 'Калі вы адпраўляеце водгук, могуць перадавацца:',
        feedback1: 'ID гульні;',
        feedback2: 'тып звароту;',
        feedback3: 'тэкст паведамлення;',
        feedback4: 'версія праграмы;',
        feedback5: 'аперацыйная сістэма або платформа і архітэктура;',
        feedback6: 'MachineID, які дазваляе даставіць адказ менавіта на ваш зварот.',
        screenshotsTitle: 'Здымкі экрана',
        screenshotsText:
          'Здымкі экрана далучаюцца толькі тады, калі вы відавочна іх выбіраеце. Перад адпраўкай вы бачыце, які файл будзе перададзены. Здымак можа выпадкова ўтрымліваць персанальныя звесткі; LBK Team не адказвае за яго змесціва. Здымкі адпраўляюцца без змен: праграма не сціскае іх, не змяняе памер і не выдаляе метаданыя (дадатковыя звесткі ў файле). Да аднаго звароту можна далучыць да пяці здымкаў.',
        logsTitle: 'Дыягнастычныя журналы',
        logsText:
          'Журнал можа ўтрымліваць тэхнічныя паведамленні, шляхі да файлаў (у тым ліку імя ўліковага запісу аперацыйнай сістэмы), назвы ўсталяваных гульняў, лікавыя ідэнтыфікатары платформаў і паведамленні пра памылкі. Праграма не выдаляе асобных радкоў перад адпраўкай, бо яны могуць спатрэбіцца для дыягностыкі. Журналы не адпраўляюцца аўтаматычна: патрэбнае ваша відавочнае пацвярджэнне.',
      },
      crashReports: {
        title: '8. Аўтаматычная дыягностыка збояў',
        text: 'Калі ўзнікае памылка, праграма можа адправіць яе апісанне, паслядоўнасць выклікаў, якія да яе прывялі (стэк выклікаў), версію праграмы і іншыя тэхнічныя звесткі для дыягностыкі, у тым ліку версію аперацыйнай сістэмы і апошнія дзеянні ў праграме перад памылкай.',
        optIn:
          'Справаздачы пра збоі адпраўляюцца толькі тады, калі адпаведная опцыя ўключаная ў наладах праграмы.',
        glitchTip:
          'Для справаздач выкарыстоўваецца <b>GlitchTip</b> на інфраструктуры LBK.',
      },
      website: {
        title: '9. Даныя, якія збірае сайт',
        publicTitle: 'Публічны сайт',
        zaraz:
          'Публічны сайт выкарыстоўвае <b>Cloudflare Zaraz</b> для аналізу праглядаў старонак і асобных падзей: адкрыцця каталога, прагляду старонкі лакалізацыі і выкарыстання пошуку.',
        emptySearch:
          'Для пошуку без вынікаў на сайце захоўваецца тэкст запыту з выпадковым ідэнтыфікатарам, створаным у сховішчы браўзера. Ён не звязаны з вашай прыладай ці асобай.',
        videoTitle: 'Убудаваныя відэа',
        videoText:
          'На старонках лакалізацый могуць быць убудаваныя відэа YouTube. Пры загрузцы прайгравальніка браўзер злучаецца з сэрвісамі Google/YouTube і перадае тэхнічныя даныя злучэння.',
        releasesTitle: 'Спампоўванне рэлізаў',
        releasesText:
          'Файлы рэлізаў могуць спампоўвацца з GitHub. Падчас спампоўвання GitHub атрымлівае стандартныя тэхнічныя даныя сеткавага запыту.',
      },
      accounts: {
        title: '10. Уліковыя запісы перакладчыкаў, каманд і мадэратараў',
        intro:
          'Для ўсталявання лакалізацый уліковы запіс не патрэбны. Перакладчыкі, каманды і мадэратары карыстаюцца ўліковымі запісамі ў панэлі https://admin.lbklauncher.com/',
        dataIntro: 'Пры стварэнні і выкарыстанні ўліковага запісу могуць апрацоўвацца:',
        data1: 'імя;',
        data2: 'адрас электроннай пошты;',
        data3: 'даныя профілю Google, калі вы выбіраеце ўваход праз Google;',
        data4: 'службовыя даныя для аўтэнтыфікацыі і роляў доступу.',
        googleAnalytics:
          'Панэль выкарыстоўвае Google Analytics, які збірае інфармацыю пра прагляды яе старонак і выкарыстоўвае ўласныя cookie. Калі вы капіюеце рэкламны тэкст для Steam, панэль перадае гэтую падзею і назву гульні ў Google Analytics. Адрас электроннай пошты і ID уліковага запісу не перадаюцца. Гэтую аналітыку можна выключыць у наладах панэлі.',
      },
      legalBasis: {
        title: '11. Мэты і прававыя падставы апрацоўкі',
        columns: {
          purpose: 'Мэта',
          category: 'Катэгорыя',
          basis: 'Прававая падстава',
        },
        purposes: {
          delivery: 'Прадастаўленне і ўсталяванне лакалізацыі',
          subscription: 'Захаванне стану падпіскі',
          abuse:
            'Прадухіленне злоўжыванняў, тэхнічныя абмежаванні і падлік унікальных спампоўванняў',
          improve:
            'Сеансы праграмы, дзеянні ў інтэрфейсе, паказы банераў і націсканні, звесткі пра першы сеанс',
          develop:
            'Націсканні падтрымкі, пошук без вынікаў, выдаленні лакалізацый і час у гульнях',
          diagnostics: 'Аўтаматычная дыягностыка',
          feedback: 'Водгукі, здымкі экрана і журналы',
          account: 'Праца ўліковага запісу',
        },
        categories: {
          essential: 'Неабходныя функцыі LBK',
          improve: '«Дапамога ў паляпшэнні LBK»',
          develop: '«Дапамога ў развіцці ўкраінскіх лакалізацый»',
          diagnostics: '«Дыягностыка і справаздачы пра памылкі»',
          userAction: 'Відавочнае дзеянне карыстальніка',
          account: 'Неабходныя функцыі ўліковага запісу',
        },
        bases: {
          requestOrTerms: 'Выкананне запыту карыстальніка / Умовы карыстання',
          request: 'Выкананне запыту карыстальніка',
          stability:
            'Законная зацікаўленасць у стабільнай працы сэрвісу і дакладнай публічнай статыстыцы',
          legitimateInterest: 'Законная зацікаўленасць',
          consent: 'Згода карыстальніка ў момант адпраўкі',
        },
        objection:
          'Вы можаце пярэчыць супраць апрацоўкі на падставе законнай зацікаўленасці. Як гэта зрабіць, апісана ў раздзеле 16.',
      },
      retention: {
        title: '12. Тэрміны захоўвання',
        text: 'Мы захоўваем даныя столькі, колькі патрэбна для мэт, апісаных у гэтай палітыцы.',
        details:
          'Запісы падпісак захоўваюцца да адпіскі і выдаляюцца адразу пасля яе. Даныя ўліковага запісу захоўваюцца, пакуль ён існуе. Пры выдаленні ўліковага запісу яго даныя і загружаныя файлы выдаляюцца адразу.',
      },
      recipients: {
        title: '13. Атрымальнікі і інфраструктура',
        infraTitle: 'Інфраструктура LBK',
        supabase:
          '<b>Серверная частка на базе Supabase</b> — база даных, файлавае сховішча і службовыя функцыі LBK на нашых уласных серверах. Тут захоўваюцца серверныя запісы спампоўванняў і падпісак, водгукі, здымкі экрана, дыягнастычныя журналы і статыстыка, сабраная на інфраструктуры LBK. Знешнія сэрвісы апісаныя асобна ніжэй.',
        glitchTip:
          '<b>GlitchTip</b> — справаздачы пра памылкі і збоі. Сэрвіс працуе на ўласных серверах LBK, дзе і захоўваюцца гэтыя справаздачы.',
        coolify: 'Для кіравання разгортваннем сэрвісаў выкарыстоўваецца Coolify.',
        externalTitle: 'Знешнія сэрвісы',
        mixpanel: '<b>Mixpanel</b> — прадуктовая аналітыка праграмы;',
        zaraz: '<b>Cloudflare Zaraz</b> — аналітыка публічнага сайта;',
        googleAnalytics: '<b>Google Analytics</b> — аналітыка панэлі кіравання;',
        resend: '<b>Resend</b> — лісты для ўліковых запісаў і службовыя апавяшчэнні;',
        youtube: '<b>YouTube / Google</b> — убудаваныя відэа;',
        steam: '<b>Steam</b> — даныя для інтэграцыі са Steam;',
        github: '<b>GitHub</b> — распаўсюджванне рэлізаў і праверка абнаўленняў;',
        teamChannels:
          '<b>Унутраныя каналы апавяшчэнняў каманды</b> — паведамленні пра новыя звароты, каб LBK Team магла хутка разгледзець іх і адказаць.',
        partners:
          'Каталог лакалізацый штодня сінхранізуецца з партнёрскім сэрвісам. Даныя гульцоў пры гэтым не перадаюцца. Перад публікацыяй архівы, загружаныя перакладчыкамі, правяраюцца на вірусы праз знешні сэрвіс MetaDefender. Даныя гульцоў для гэтай праверкі не перадаюцца.',
      },
      steamFallback: {
        title: '14. Steam: лакальны пошук бібліятэкі і рэзервовы запыт праз сервер',
        text: 'Звычайна праграма вызначае бібліятэку Steam з даных на вашай прыладзе. Калі іх недастаткова, сервер LBK запытвае спіс гульняў праз Steam Web API, выкарыстоўваючы лікавы ID вашага профілю Steam і ключ доступу LBK. Запыт у Steam адпраўляе сервер LBK.',
        notStored: 'Атрыманы спіс гульняў не захоўваецца на серверы.',
      },
      location: {
        title: '15. Дзе апрацоўваюцца даныя',
        servers: 'Уласныя серверы LBK знаходзяцца ў <b>Германіі</b>.',
        external:
          'Некаторыя знешнія сэрвісы могуць апрацоўваць даныя ў іншых краінах, у тым ліку ў ЗША. Да іх належаць Mixpanel, Resend, Google/YouTube, GitHub і Steam.',
      },
      rights: {
        title: '16. Вашы правы і кіраванне згодай',
        intro: 'Вы можаце:',
        access: 'запытаць у LBK Team, якія даныя звязаныя з вамі, і атрымаць іх копію;',
        rectify: 'выправіць недакладныя даныя;',
        erase:
          'запытаць выдаленне даных, калі яны больш не патрэбныя або павінны быць выдаленыя;',
        object: 'пярэчыць супраць апрацоўкі на падставе законнай зацікаўленасці.',
        identification:
          'Калі ў вас ёсць уліковы запіс, запісы можна знайсці па яго даных. Без уліковага запісу для пошуку абязлічаных падзей можа спатрэбіцца ваш MachineID.',
        requests:
          'Адпраўляйце запыты на <mail>pr@gameglobe-localisation.com</mail> або праз <tg>Telegram-бота падтрымкі</tg>. Мы адкажам на працягу 30 дзён.',
      },
      security: {
        title: '17. Абарона даных',
        roles:
          'Доступ да серверных табліц і сховішча абмежаваны ролямі. Ключ доступу ў праграме і на сайце не дазваляе чытаць водгукі, журналы або статыстыку. Гэтыя даныя даступныя толькі праз сервер з адпаведнымі правамі.',
        storage:
          'Водгукі, журналы і здымкі экрана захоўваюцца ў закрытым сховішчы; часовыя спасылкі доступу ствараюцца толькі для LBK Team.',
        passwords:
          'Платформа аўтэнтыфікацыі захоўвае паролі як хэшы — вынікі незваротнага пераўтварэння. Код LBK не мае доступу да пароляў у адкрытым выглядзе.',
        tokens:
          'Токены аўтаматычнай публікацыі захоўваюцца толькі як хэшы, з якіх немагчыма аднавіць зыходны токен.',
        secrets: 'Токены і сакрэты не перадаюцца ў аналітычныя сэрвісы.',
        encryption: 'Сеткавыя злучэнні сайта і праграмы выкарыстоўваюць шыфраванне.',
      },
      limits: {
        title: '18. Чаго LBK не робіць',
        sell: 'не прадае персанальных даных карыстальнікаў;',
        account: 'не патрабуе ўліковага запісу для звычайнага ўсталявання лакалізацый;',
        screenshots: 'не робіць здымкаў экрана без дзеяння карыстальніка;',
        clipboard: 'не чытае буфер абмену;',
        machineId: 'не перадае MachineID у публічную або абагульненую статыстыку;',
        ads: 'не паказвае рэкламы на падставе вашых паводзін;',
        fingerprinting:
          'не выкарыстоўвае лічбавых адбіткаў браўзера і не запісвае дзеянняў на экране.',
      },
      changes: {
        title: '19. Змены палітыкі',
        text: 'Калі змяняюцца катэгорыі даных, мэты, атрымальнікі або прававыя падставы апрацоўкі, палітыка і дата яе абнаўлення павінны быць змененыя да або адначасова з адпаведнай зменай функцый.',
      },
      contacts: {
        title: '20. Кантакты',
      },
    },
  },
  promoModal: {
    imageAlt: 'Падтрымайце ўкраінскі лаўнчар!',
    title: 'Крыху падтрымкі для лаўнчара?',
    body: 'Мы развіваем гэты лаўнчар, каб вам было зручна знаходзіць і спампоўваць пераклады. Паляпшаем хуткасць, стабільнасць і дадаём новыя функцыі.',
    everyBitCounts: 'Нават невялікі ўнёсак мае значэнне ✨',
    dontShowAgain: 'Больш не паказваць',
    donate: 'Зрабіць унёсак',
  },
  runInstaller: {
    exeTitle: 'Запуск усталёўшчыка',
    scriptTitle: 'Запуск скрыпта',
    exeProtonMessage:
      'Украінізатар спампаваны і распакаваны. Усталёўшчык для Windows будзе запушчаны праз выбраную версію Proton.\n\nШлях да папкі будзе скапіяваны ў буфер абмену.',
    scriptProtonMessage:
      'Украінізатар спампаваны і распакаваны. Скрыпт для Windows будзе запушчаны праз выбраную версію Proton.\n\nШлях да папкі будзе скапіяваны ў буфер абмену.',
    exeAskMessage:
      'Украінізатар спампаваны і распакаваны.\n\nЗапусціць усталёўшчык цяпер?',
    scriptAskMessage: 'Украінізатар спампаваны і распакаваны.\n\nЗапусціць скрыпт цяпер?',
    protonPlaceholder: 'Выберыце версію Proton',
    openFolder: 'Адкрыць папку',
    run: 'Так, запусціць',
    skip: 'Не',
    confirmMessage:
      'Пасля спампоўвання і распакавання ўкраінізатара будзе запушчаны яго ўсталёўшчык або скрыпт.\n\nПрацягнуць усталяванне?',
    confirm: 'Працягнуць',
    finishedTitle: 'Усталёўшчык завяршыў працу',
    finishedMessage: 'Усталёўшчык завяршыў працу',
    failed: 'Не ўдалося запусціць усталёўшчык',
  },
  selectDropdown: { placeholder: 'Выберыце варыянт', empty: 'Няма варыянтаў' },
  sendLogs: {
    titleCrash: 'Справаздача пра памылку',
    title: 'Адправіць журналы',
    submit: 'Адправіць журналы',
    consent: 'Адпраўляючы журналы, вы згаджаецеся на апрацоўку персанальных даных.',
    crashReason: 'Прычына памылкі:',
    descriptionLabel: 'Апісанне (неабавязкова)',
    placeholder: 'Апішыце, што адбылося, каб мы маглі хутчэй разабрацца…',
    rateLimit: 'Пачакайце некалькі хвілін перад наступнай адпраўкай',
    sendFailed: 'Не ўдалося адправіць журналы',
    networkError: 'Памылка сеткі. Паспрабуйце пазней',
  },
  settings: {
    title: 'Налады',
    feedback: { title: 'Зваротная сувязь', description: 'Напісаць нам у Telegram' },
    performance: {
      title: 'Рэжым прадукцыйнасці',
      weakHardware:
        'Уключаны: на гэтай прыладзе недастаткова рэсурсаў для плаўных анімацый, таму рэжым прадукцыйнасці нельга выключыць',
      description: 'Выключае анімацыі і размыццё ў інтэрфейсе для лепшай прадукцыйнасці',
    },
    liquidGlass: {
      title: 'Тэма Liquid Glass',
      weakHardware:
        'Выключаная: на гэтай прыладзе недастаткова рэсурсаў для эфекту празрыстасці',
      description: 'Уключыць эфект празрыстасці і размыцця для вокнаў (macOS 26+)',
    },
    backup: {
      title: 'Ствараць рэзервовую копію',
      description: 'Захоўваць арыгінальныя файлы гульні перад усталяваннем украінізатара',
    },
    steamCef: {
      title: 'Хуткае прымяненне параметраў запуску Steam',
      description:
        'Дазваляе лаўнчару адразу змяняць параметры запуску, падпіскі ў майстэрні, калекцыю «З украінізатарамі» і вокладкі Steam. Пасля першага ўключэння трэба адзін раз перазапусціць Steam. Для прамой сувязі лаўнчар выкарыстоўвае порт адладкі Steam або плагін «LBK Bridge» у Millennium ці Decky Loader; праз LBK Bridge таксама паказваюцца перакладзеныя назвы дасягненняў. Калі выключыць гэтую функцыю, параметры запуску будуць ужывацца толькі пасля закрыцця Steam.',
    },
    steamArtwork: {
      title: 'Украінскія вокладкі ў Steam',
      description:
        'Замяняць банер, лагатып і гарызантальную вокладку гульні ў бібліятэцы Steam на ўкраінскія версіі з украінізатара. Вертыкальная вокладка застаецца арыгінальнай. Першапачатковыя выявы вернуцца пасля выдалення ўкраінізатара або выключэння гэтага пераключальніка',
    },
    adultGames: {
      title: 'Паказваць гульні з парнаграфічным кантэнтам',
      description:
        'Дазволіць паказ гульняў з парнаграфічным/эратычным кантэнтам (hentai, візуальныя навелы для дарослых і іншыя)',
    },
    aiTranslations: {
      title: 'Схаваць ШІ-пераклады',
      description: 'Схаваць пераклады, створаныя з дапамогай штучнага інтэлекту',
    },
    recommendations: {
      title: 'Рэкамендацыі гульняў',
      description: 'Паказваць блок «Вас можа зацікавіць» на старонцы гульні',
    },
    notificationSounds: {
      title: 'Гукі апавяшчэнняў',
      description: 'Прайграваць гукі пры атрыманні апавяшчэнняў пра абнаўленні',
    },
    gamepadSounds: {
      title: 'Гукі геймпада',
      description: 'Прайграваць гукі падчас навігацыі геймпадам',
    },
    productAnalytics: {
      title: 'Прадуктовая аналітыка',
      description:
        'Сеансы праграмы і дзеянні ў інтэрфейсе — дапамагаюць зразумець, што ў лаўнчары нязручна',
    },
    localizationAnalytics: {
      title: 'Аналітыка развіцця лакалізацый',
      description:
        'Падтрымка аўтараў, пошук без вынікаў, выдаленні і час у гульні — паказваюць, якіх перакладаў не хапае',
    },
    crashDiagnostics: {
      title: 'Справаздачы пра збоі',
      description:
        'Аўтаматычныя справаздачы пра памылкі праграмы. Выключэнне дзейнічае адразу, уключэнне — пасля перазапуску',
    },
    collection: {
      title: 'Калекцыя «З украінізатарамі» ў Steam',
      description:
        'Стварыць або абнавіць калекцыю бібліятэкі Steam з гульнямі, для якіх ёсць пераклады',
      updatedTitle: 'Калекцыя абноўленая',
      updatedEmpty: 'У калекцыі «З украінізатарамі» цяпер няма гульняў.',
      updated_one: 'У калекцыі «З украінізатарамі» цяпер {{count}} гульня.',
      updated_few: 'У калекцыі «З украінізатарамі» цяпер {{count}} гульні.',
      updated_many: 'У калекцыі «З украінізатарамі» цяпер {{count}} гульняў.',
      updated_other: 'У калекцыі «З украінізатарамі» цяпер {{count}} гульні.',
      failedTitle: 'Не ўдалося абнавіць калекцыю',
    },
    kurin: {
      title: 'Сінхранізацыя з Kurin',
      description: 'Знайсці ўсталяваныя гульні, дададзеныя праз Kurin, і імпартаваць іх',
      failedTitle: 'Не ўдалося сінхранізаваць',
      doneTitle: 'Сінхранізацыя завершаная',
      synced_one: 'Сінхранізавана {{count}} гульня: {{games}}',
      synced_few: 'Сінхранізаваныя {{count}} гульні: {{games}}',
      synced_many: 'Сінхранізавана {{count}} гульняў: {{games}}',
      synced_other: 'Сінхранізавана {{count}} гульні: {{games}}',
      none: 'Не знойдзена гульняў, усталяваных праз Kurin, або Kurin не ўсталяваны.',
    },
    lbkShortcut: {
      title: 'LBK Launcher у бібліятэцы Steam',
      description: 'Дадаць лаўнчар як гульню ў Steam',
      addedTitle: 'Гатова',
      addedMessage: 'LBK Launcher дададзены ў бібліятэку Steam.',
      failedTitle: 'Не ўдалося дадаць у Steam',
      errorTitle: 'Адбылася памылка',
      errorMessage: 'Паспрабуйце яшчэ раз пазней.',
    },
    unexpectedError: 'Адбылася непрадбачаная памылка.',
    clearCache: {
      title: 'Ачысціць кэш',
      description: 'Выдаліць часовыя файлы (захоўвае налады)',
      confirmMessage:
        'Часовыя файлы і база даных будуць выдаленыя. Налады захаваюцца. Праграма перазапусціцца.',
      confirmAction: 'Ачысціць',
    },
    clearAll: {
      title: 'Ачысціць усе даныя',
      description: 'Выдаліць налады, падпіскі і ўсе даныя',
      confirmMessage:
        'Усе даныя, у тым ліку налады і падпіскі, будуць выдаленыя. Праграма перазапусціцца.',
      confirmAction: 'Выдаліць усё',
    },
    dev: {
      title: 'Налады для распрацоўшчыкаў',
      notificationSounds: 'Гукі апавяшчэнняў:',
      soundStatus: 'Стан',
      soundVersion: 'Версія',
      soundApp: 'Праграма',
      soundProgress: 'Гатоўнасць',
      soundNewGame: 'Новая гульня',
      soundTeam: 'Каманда',
      gamepadSounds: 'Гукі геймпада:',
      navigate: 'Навігацыя',
      confirm: 'Пацвердзіць',
      back: 'Назад',
      promoMode: 'Рэжым паказу рэкламнага банера:',
      promoNormal: 'Звычайны (24 гадзіны + пазнака)',
      promoAlways: 'Заўсёды паказваць',
      promoNever: 'Ніколі не паказваць',
      promoPlaceholder: 'Выберыце рэжым',
    },
    logs: {
      title: 'Адкрыць папку з журналамі',
      description: 'Паглядзець захаваныя файлы журналаў',
      send: 'Адправіць файл',
    },
    unlock: {
      title: 'Разблакіраваць схаваны пераклад',
      placeholder: 'Код перакладу',
      action: 'Разблакіраваць',
    },
    changelog: {
      title: 'Што новага',
      description: 'Гісторыя абнаўленняў · v{{version}}',
    },
    legal: { terms: 'Умовы карыстання', privacy: 'Палітыка прыватнасці' },
    credits: {
      title: 'Падзякі',
      description:
        'Асаблівая падзяка перакладчыкам, якія далучыліся да тэставання з першых дзён і дапамагаюць рабіць гэты лаўнчар такім, які ён ёсць:',
    },
    bridgeCard: {
      steamElevated:
        'Steam запушчаны ад імя адміністратара, таму лаўнчар не можа яго перазапусціць.',
      restart: 'Перазапусціць Steam',
      recheck: 'Праверыць яшчэ раз',
    },
  },
  shareModal: {
    title: 'Падзяліцца',
    text: 'Украінскую лакалізацыю {{game}} ад {{team}} можна зручна ўсталяваць у LBK Launcher',
    shareIn: 'Падзяліцца ў:',
    copyHint: 'Або скапіюйце спасылку ці тэкст:',
    copyText: 'Скапіяваць тэкст',
    copied: 'Скапіявана!',
  },
  sidebarNav: {
    guides: 'Адкрыць дапаможнікі і інструменты',
    donators: 'Адкрыць старонку фундатараў',
    news: 'Адкрыць навіны',
    home: 'Адкрыць галоўную старонку',
    gamepadSoundsOff: 'Выключыць гукі геймпада',
    gamepadSoundsOn: 'Уключыць гукі геймпада',
    notifications: 'Апавяшчэнні',
    settings: 'Налады',
  },
  specialTranslators: {
    earlySupporter: 'Дапамагае развіваць LBK Launcher з першых дзён',
    launcherTeam: 'Каманда лаўнчара',
  },
  statusBadge: { unknown: 'Невядома' },
  steamActionErrors: {
    steamNotRunning: 'Steam не запушчаны. Запусціце Steam і паспрабуйце яшчэ раз.',
    cefUnavailable:
      'Уключыце наладу «Хуткае прымяненне параметраў запуску Steam» і перазапусціце Steam, каб лаўнчар мог {{purpose}}.',
    cefBlocked:
      'Steam не адкрыў канал для лаўнчара нават пасля перазапуску. Каб лаўнчар мог {{purpose}}, праверце, ці не блакіруе яго іншы мод Steam, і націсніце «Праверыць яшчэ раз» у наладах.',
    millenniumPluginPending:
      'Millennium закрывае канал, праз які лаўнчар працуе са Steam. Плагін «LBK Bridge» уключыцца пасля наступнага закрыцця Steam — тады лаўнчар зможа {{purpose}}. Або ўключыце яго ўжо цяпер у наладах Millennium (Plugins).',
    millenniumOutdated:
      'Ваша версія Millennium састарэла. Абнавіце Millennium да версіі 3, каб лаўнчар мог {{purpose}}.',
    libraryUnavailable:
      'Бібліятэка Steam яшчэ загружаецца. Паспрабуйце праз некалькі секунд.',
    noTranslatedGames:
      'У каталогу няма перакладаў для гульняў Steam. Калі каталог яшчэ сінхранізуецца, паспрабуйце праз хвіліну.',
    noMatches: 'Сярод вашых гульняў у бібліятэцы Steam няма ніводнай з перакладам.',
    failed: 'Паспрабуйце яшчэ раз пазней.',
  },
  steamActionPurposes: {
    manageCollections: 'кіраваць калекцыямі',
    addShortcut: 'дадаць ярлык у бібліятэку',
  },
  steamCollection: { name: 'З украінізатарамі' },
  steamRestart: {
    steamNotStarted: 'Steam не запусціўся',
    failed: 'Не ўдалося перазапусціць Steam',
    progressTitle: 'Перазапуск Steam',
    progressMessage:
      'Лаўнчар закрывае і зноў запускае Steam. Гэта можа заняць да дзвюх хвілін.',
    unknownError: 'Невядомая памылка',
    failedTitle: 'Steam не перазапушчаны',
    restartedTitle: 'Steam перазапушчаны',
  },
  steamRestartFailure: {
    launchFailed:
      'Steam закрыты, але запусціць яго зноў не ўдалося. Запусціце Steam уручную.',
    accessDenied: {
      launchOptions:
        'Steam запушчаны ад імя адміністратара, таму лаўнчар не можа яго перазапусціць. Закрыйце Steam самастойна — параметры запуску ўжывуцца аўтаматычна.',
      plain:
        'Steam запушчаны ад імя адміністратара, таму лаўнчар не можа яго перазапусціць. Перазапусціце Steam самастойна.',
    },
    gamescope: {
      launchOptions:
        'У гульнявым рэжыме лаўнчар не перазапускае Steam. Параметры запуску ўжывуцца, як толькі Steam будзе закрыты — напрыклад, пасля пераходу ў рэжым працоўнага стала.',
      plain:
        'У гульнявым рэжыме лаўнчар не перазапускае Steam. Перазапусціце яго самастойна — напрыклад, перайдзіце ў рэжым працоўнага стала.',
    },
    gameRunning: {
      launchOptions:
        'Закрыйце гульню, каб перазапусціць Steam. Параметры запуску ўжывуцца, як толькі Steam будзе закрыты.',
      plain: 'Закрыйце гульню, каб перазапусціць Steam.',
    },
    timeout: {
      launchOptions:
        'Steam не закрыўся своечасова. Закрыйце яго ўручную — параметры запуску ўжывуцца аўтаматычна.',
      plain: 'Steam не закрыўся своечасова. Перазапусціце яго ўручную.',
    },
    generic: 'Не ўдалося перазапусціць Steam.',
  },
  steamRestartPrompt: {
    title: 'Перазапусціце Steam',
    message:
      'Каб змены набылі моц, трэба перазапусціць Steam. Гэта можна зрабіць пазней — налады ўжо захаваныя.',
    restartAction: 'Перазапусціць Steam',
  },
  teamSubscribe: {
    subscribedTitle: 'Вы падпісаныя на абнаўленні ад «{{team}}»',
    followTitle_single: 'Сачыць за аўтарам «{{team}}»',
    followTitle_multiple: 'Сачыць за аўтарамі «{{team}}»',
    follow_team: 'Сачыць за {{team}}',
    follow_single: 'Сачыць за аўтарам',
    follow_multiple: 'Сачыць за аўтарамі',
    unfollow_team: 'Адпісацца ад {{team}}',
    unfollow_single: 'Адпісацца ад аўтара',
    unfollow_multiple: 'Адпісацца ад аўтараў',
  },
  titleBar: { offlineSuffix: ' · вы па-за сеткай' },
  translationAwards: {
    mostAnticipated2026: 'Самы чаканы пераклад 2026 года паводле супольнасці',
    bestText2025: 'Найлепшы тэкставы пераклад 2025 года паводле супольнасці',
  },
  translationPicker: { title: 'Выберыце пераклад', unknownAuthor: 'Невядомы аўтар' },
  translationProgress: {
    translation: 'Пераклад',
    editing: 'Рэдагаванне',
    voice: 'Агучванне',
    textures: 'Тэкстуры',
    fonts: 'Шрыфты',
  },
  translationStatusCard: { title: 'Гатоўнасць перакладу', inProgress: 'У працы' },
  translationStatusIcons: {
    updateAvailable: 'Ёсць абнаўленне перакладу',
    upToDate: 'Пераклад актуальны',
    availableToInstall: 'Пераклад даступны для ўсталявання',
    aiEdited: 'ШІ + рэдагаванне чалавекам',
    aiOnly: 'Пераклад ШІ',
    favorite: 'У абраным',
  },
  tray: { open: 'Адкрыць', quit: 'Выйсці' },
  uninstall: {
    title: 'Выдаленне ўкраінізатара',
    message: 'Сапраўды выдаліць украінізатар для «{{name}}»?\n\n{{backupWarning}}',
    noBackupWarning:
      'УВАГА: Падчас усталявання рэзервовая копія не была створаная. Арыгінальныя файлы НЕ будуць адноўленыя!',
    backupWarning: 'Арыгінальныя файлы гульні будуць адноўленыя з рэзервовай копіі.',
    confirm: 'Выдаліць',
    doneTitle: 'Украінізатар выдалены',
    doneMessage: 'Украінізатар «{{name}}» выдалены',
    notInstalled: 'Украінізатар не ўсталяваны',
    failed: 'Памылка выдалення: {{error}}',
    removeComponentsFailed: 'Памылка выдалення кампанентаў: {{error}}',
  },
  updateNotice: {
    downloaded: 'Абнаўленне спампаванае і гатовае да ўсталявання',
    versionAvailable: 'Версія {{version}} даступная для спампоўвання',
    newVersionAvailable: 'Новая версія даступная для спампоўвання',
    downloading: 'Спампоўванне...',
    openDownloadPage: 'Спампаваць новую версію',
    restart: 'Перазапусціць',
    download: 'Спампаваць',
    later: 'Пазней',
    readyTitle: 'Абнаўленне гатовае!',
    availableTitle: 'Даступнае абнаўленне',
  },
  workshopButton: {
    tombstoned: 'Пераклад больш недаступны ў каталогу',
    offline: 'Няма падключэння да інтэрнэту',
    gameNotInstalled: 'Гульня не ўсталяваная на гэтай прыладзе',
    progressInSteam: 'Ход усталявання паказаны ў кліенце Steam',
    install: 'Усталяваць са Steam',
    openPageTitle: 'Адкрыць старонку ў майстэрні',
    openPage: 'Майстэрня',
    unsubscribeTitle: 'Скасаваць падпіску ў Steam',
  },
  termsOfService: {
    title: 'Умовы карыстання',
    subtitle: 'Умовы карыстання',
    intro:
      'Гэтыя Умовы рэгулююць карыстанне сайтам <site>lbklauncher.com</site> і настольнай праграмай <b>LBK Launcher</b>.',
    parties:
      '<b>Бакі:</b> LBK Team (GameGlobe Localization і Little Bit) і карыстальнік («вы»), які карыстаецца прадуктамі LBK Team: сайтам і настольнай праграмай (лаўнчарам).',
    lastUpdated: 'Абноўлена: 22 кастрычніка 2026',
    sections: {
      definitions: {
        title: 'Азначэнні і асноўныя тэрміны',
        country:
          '<b>Краіна:</b> краіна, дзе знаходзіцца LBK Team або яе ўладальнікі/заснавальнікі; у гэтым выпадку — Украіна.',
        service:
          '<b>Сэрвіс:</b> сайт і праграма LBK Launcher, якія GameGlobe Localization (вул. Металістаў, 4, Кіеў, 02000) і Little Bit прадастаўляюць паводле гэтых Умоў.',
        website:
          '<b>Сайт:</b> сайт GameGlobe Localization, даступны на <site>https://ggloc.org/</site>.',
        you: '<b>Вы:</b> фізічная або юрыдычная асоба, якая карыстаецца Сэрвісам.',
      },
      licensing: {
        title: 'Ліцэнзаванне і інтэлектуальная ўласнасць',
        frontend:
          '<b>Кліенцкая частка:</b> зыходны код графічнага інтэрфейсу і кліента адкрыты і распаўсюджваецца паводле ліцэнзіі <b>GNU GPL v3</b>. Вы можаце змяняць і распаўсюджваць яго на ўмовах гэтай ліцэнзіі.',
        backend:
          '<b>Сервер і API:</b> серверны код, базы даных і логіка API — выключная інтэлектуальная ўласнасць <b>LBK Team</b>. Несанкцыянаваны доступ, аўтаматызаваны збор даных, зваротная распрацоўка серверных пратаколаў і ўмяшанне ў працу інфраструктуры <b>строга забароненыя</b>.',
        content:
          '<b>Кантэнт (пераклады):</b> усе лакалізацыі ў лаўнчары прадастаўляюцца канчатковым карыстальнікам выключна для прыватнага некамерцыйнага выкарыстання. Іх перапродаж або выкарыстанне ў камерцыйных прадуктах без дазволу праваўладальнікаў забароненыя.',
      },
      liability: {
        title: 'Абмежаванне адказнасці',
        text: 'Праграма прадастаўляецца «як ёсць». LBK Team не нясе адказнасці за канфлікты з сістэмамі абароны гульняў, тэхнічныя збоі або страту гульнявога прагрэсу праз усталяванне перакладаў.',
        risk: 'ВЫ КАРЫСТАЕЦЕСЯ ЛАЎНЧАРАМ НА ЎЛАСНУЮ РЫЗЫКУ. МЫ НЕ ГАРАНТУЕМ, ШТО ВАС НЕ ЗАБЛАКІРУЮЦЬ У АНЛАЙН-ГУЛЬНЯХ.',
      },
      contacts: {
        title: 'Звязацца з намі',
        intro: 'Калі ў вас ёсць пытанні, звяжыцеся з намі:',
      },
    },
  },
} as const satisfies Messages;
