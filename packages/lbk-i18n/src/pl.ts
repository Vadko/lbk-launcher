import type { Messages } from './uk';

export const pl = {
  achievementsBadge: {
    settingOffDetail:
      'Opcja „Natychmiast stosuj opcje uruchamiania Steam” jest wyłączona w ustawieniach. Bez niej launcher nie może połączyć się z LBK Bridge.',
    hidden: 'Nie pojawią się w Steam',
    millennium: 'Pojawią się dzięki Millennium',
    decky: 'Pojawią się dzięki Decky Loader',
    'after-restart': 'Dostępne po ponownym uruchomieniu Steam',
    'needs-millennium': 'Wymaga Millennium',
    'needs-decky-plugin': 'Wymaga LBK Bridge dla Decky Loader',
    'needs-decky': 'Wymaga Decky Loader',
  },
  achievementsNote: {
    needsMillennium:
      'Steam nie odczytuje przetłumaczonych nazw osiągnięć ze zwykłych plików gry. Zainstaluj Millennium, aby zobaczyć je w bibliotece Steam, powiadomieniach i nakładce. Osiągnięcia w interfejsie samej gry mogą pozostać w języku twórców.',
    needsDeckyPlugin:
      'Steam nie odczytuje przetłumaczonych nazw osiągnięć ze zwykłych plików gry. Zainstaluj wtyczkę LBK Bridge dla Decky Loader, aby zobaczyć je w bibliotece Steam, powiadomieniach i nakładce. Osiągnięcia w interfejsie samej gry mogą pozostać w języku twórców.',
    deckyPluginDisabled:
      'Steam nie odczytuje przetłumaczonych nazw osiągnięć ze zwykłych plików gry. Wtyczka LBK Bridge je wyświetla, ale jest wyłączona w Decky Loader. Włącz ją w ustawieniach Decky. Osiągnięcia w interfejsie samej gry mogą pozostać w języku twórców.',
    needsDecky:
      'Steam nie odczytuje przetłumaczonych nazw osiągnięć ze zwykłych plików gry. Na Steam Deck wyświetla je wtyczka LBK Bridge, która wymaga Decky Loader. Osiągnięcia w interfejsie samej gry mogą pozostać w języku twórców.',
    settingOff:
      'Tłumaczenia osiągnięć są niedostępne, dopóki integracja ze Steam jest wyłączona. {{detail}}',
    unsupported:
      'Tłumaczenia osiągnięć są niedostępne: Steam nie może ich wyświetlić w tym systemie. {{detail}}',
  },
  achievementsOption: {
    title: 'Osiągnięcia Steam',
    checking: 'Sprawdzanie…',
    description: 'Tłumaczenia osiągnięć Steam.',
    thirdPartyAuthor: 'Autor tłumaczenia osiągnięć:',
  },
  adultWarning: {
    title: 'Treści dla dorosłych',
    message:
      'Ta gra zawiera treści dla dorosłych (18+). Włącz treści dla dorosłych w ustawieniach, aby ją zobaczyć.',
    openSettings: 'Otwórz ustawienia',
  },
  aiTranslationBadge: { edited: 'AI + redakcja przez człowieka', ai: 'Tłumaczenie AI' },
  appLoader: {
    tagline: 'Ukraińskie lokalizacje gier',
    restartApp: 'Uruchom aplikację ponownie',
    status: {
      syncing: 'Synchronizacja',
      error: 'Błąd połączenia',
      loading: 'Ładowanie',
      ready: 'Ładowanie',
    },
  },
  archiveDownload: {
    archiveNotFound: 'Nie znaleziono archiwum: {{type}}',
    fetchingUrl: 'Uzyskiwanie linku do pobrania...',
    urlFailed: 'Nie udało się uzyskać linku do pobrania: {{error}}',
    refreshingUrl: 'Odświeżanie linku do pobrania...',
    verifying: 'Sprawdzanie integralności pliku...',
    corrupted: 'Plik jest uszkodzony. Spróbuj pobrać go ponownie.',
    completed: 'Pobieranie zakończone!',
  },
  authorSubscription: {
    title: 'Obserwuj twórców',
    singleAuthor: 'Twórca lokalizacji',
    authorsCount_one: '{{count}} twórca lokalizacji',
    authorsCount_few: '{{count}} twórcy lokalizacji',
    authorsCount_many: '{{count}} twórców lokalizacji',
    authorsCount_other: '{{count}} twórcy lokalizacji',
    description_single:
      'Chcesz otrzymywać powiadomienia o nowych lokalizacjach tego twórcy? Subskrypcje możesz zmienić w dowolnej chwili.',
    description_multiple:
      'Chcesz otrzymywać powiadomienia o nowych lokalizacjach tych twórców? Subskrypcje możesz zmienić w dowolnej chwili.',
    subscribed: 'obserwujesz',
    skip: 'Pomiń',
    subscribe: 'Obserwuj',
    subscribeSelected: 'Obserwuj ({{selected}})',
  },
  authorsList: { others: 'Pozostali twórcy:' },
  bridgeStatus: {
    connected: 'Połączono ze Steam.',
    connectedDecky: 'Połączono ze Steam przez LBK Bridge dla Decky Loader.',
    connectedMillennium: 'Połączono ze Steam przez LBK Bridge dla Millennium.',
    steamNotRunning: 'Steam nie jest uruchomiony.',
    restartPending: 'Uruchom Steam ponownie raz, aby włączyć natychmiastowe zmiany.',
    cefBlocked:
      'Steam nie otworzył połączenia dla launchera, nawet po ponownym uruchomieniu. Launcher nie będzie ponownie prosić o restart Steam. Opcje uruchamiania zostaną zastosowane po zamknięciu Steam. Połączenie może blokować inny mod do Steam.',
    millenniumOutdated:
      'Wykryto przestarzałe Millennium 2.x. Zaktualizuj Millennium do wersji 3, aby launcher mógł połączyć się przez jego wtyczkę. Do tego czasu opcje uruchamiania będą stosowane po zamknięciu Steam.',
  },
  catalogFilters: {
    title: 'Filtry i sortowanie',
    apply: 'Pokaż wyniki',
    activeFilters: 'Aktywne filtry',
    removeFilter: 'Usuń filtr',
    statusSection: 'Status',
    contentTypeSection: 'Rodzaj zawartości',
    translationTypeSection: 'Rodzaj tłumaczenia',
    librarySection: 'Biblioteka',
    authorsSection: 'Twórcy',
    tagsSection: 'Tagi',
    searchAuthor: 'Szukaj twórców...',
    authorNotFound: 'Nie znaleziono twórcy',
    searchTag: 'Szukaj kategorii...',
    tagNotFound: 'Nie znaleziono kategorii',
  },
  changelog: {
    title: 'Co nowego',
    upcoming: 'Wkrótce w aktualizacji',
    yourVersion: 'Twoja wersja — v{{version}}',
    olderVersions: 'Poprzednie wersje ({{total}})',
    fullList: 'Pełna lista zmian na GitHub',
  },
  common: {
    cancel: 'Anuluj',
    selectFolder: 'Wybierz folder',
    error: 'Błąd',
    unknownError: 'Nieznany błąd',
    installError: 'Błąd instalacji',
    uninstallError: 'Błąd odinstalowania',
    close: 'Zamknij',
    ok: 'Rozumiem',
    notNow: 'Nie teraz',
    dontOfferAgain: 'Nie proponuj ponownie',
    tryAgain: 'Spróbuj ponownie',
    checkingSystem: 'Sprawdzanie systemu…',
    restartSteamNow: 'Uruchom Steam ponownie teraz',
    afterSteamExit: 'Po zamknięciu Steam',
  },
  confirmModal: { confirm: 'Potwierdź' },
  crashScreen: {
    uncaughtError: 'Nieobsłużony błąd',
    unhandledRejection: 'Nieobsłużone odrzucenie obietnicy',
    intro:
      'Przepraszamy, wystąpił błąd krytyczny. Wyślij raport, aby pomóc nam szybciej go naprawić.',
    sendReport: 'Wyślij raport o błędzie',
    messagePlaceholder: 'Opisz, co się stało (opcjonalnie)...',
    send: 'Wyślij',
    sending: 'Wysyłanie...',
    sent: 'Raport wysłany. Dziękujemy!',
    rateLimited: 'Poczekaj kilka minut',
    sendFailed: 'Nie udało się wysłać raportu. Spróbuj ponownie później',
    networkError: 'Błąd sieci',
    reload: '1. Odśwież',
    reloadHint: 'Szybka naprawa (zachowuje wszystkie dane)',
    clearCache: '2. Wyczyść pamięć podręczną',
    clearCacheHint: 'Usuwa pliki tymczasowe (zachowuje ustawienia)',
    clearAll: '3. Wyczyść wszystkie dane ⚠️',
    clearAllHint: 'Usuwa ustawienia, subskrypcje i wszystkie dane',
    techInfo: 'Szczegóły techniczne',
    errorLabel: 'Błąd:',
  },
  deckyLoader: {
    offerIntro:
      'Decky Loader to darmowy, niezależny program do ładowania wtyczek na Steam Deck, nie pochodzi od Valve. Launcher może go zainstalować, a następnie dodać LBK Bridge.',
    offerBenefits:
      'Co zyskujesz:\n• LBK Bridge będzie wyświetlać przetłumaczone nazwy osiągnięć w bibliotece Steam, powiadomieniach i nakładce.',
    offerWithout:
      'Co działa bez Decky Loader: opcje uruchamiania, subskrypcje warsztatu, kolekcja „Z ukraińskimi lokalizacjami”, skrót launchera i grafiki Steam.',
    offerInstaller:
      'Launcher pobierze i uruchomi oficjalny instalator Decky Loader z GitHub. Instalator prosi o hasło administratora (sudo) we własnym oknie; launcher go nie widzi. Jeśli nie ustawiono hasła, instalator zaproponuje tymczasowe i usunie je po instalacji.',
    offerCaveat:
      'Uwaga: duże aktualizacje SteamOS mogą wymagać ponownej instalacji Decky Loader.',
    repair:
      'Decky Loader jest zainstalowany, ale nie działa. Poprzednia instalacja mogła nie zostać dokończona. Launcher może ponownie uruchomić oficjalny instalator Decky Loader.',
    gameMode:
      'Instalator Decky Loader działa tylko w trybie pulpitu. Przełącz się na niego z menu zasilania Steam, otwórz launcher i ponownie wybierz „Zainstaluj Decky Loader”.',
    installing:
      'Instalator Decky Loader jest otwarty. Wpisz hasło administratora w oknie „Decky Installer” i wybierz „release”. Jeśli nie widzisz okna, poszukaj go na pasku zadań.',
    failure: {
      'download-failed':
        'Nie udało się pobrać instalatora Decky Loader. Sprawdź połączenie z internetem i spróbuj ponownie.',
      'checksum-mismatch':
        'Pobrany instalator Decky Loader nie zgadza się ze zweryfikowaną wersją. Instalacja anulowana.',
      unsupported:
        'Launcher nie może zainstalować Decky Loader w tym systemie. Postępuj zgodnie z instrukcją na stronie Decky Loader.',
      'not-running':
        'Decky Loader jest zainstalowany, ale się nie uruchomił. Spróbuj zainstalować go ponownie.',
      'not-installed':
        'Decky Loader nie został zainstalowany. Jeśli okno instalatora zostało zamknięte lub hasło było nieprawidłowe, spróbuj ponownie.',
    },
    whatIs: 'Czym jest Decky Loader?',
    repairAction: 'Napraw Decky Loader',
    installAction: 'Zainstaluj Decky Loader',
  },
  deckyPlugin: {
    waiting: 'Oczekiwanie na LBK Launcher',
    connected: 'Połączono z LBK Launcher',
    viaMillennium: 'Połączono przez Millennium',
  },
  deckySetup: {
    title: 'LBK Bridge dla Decky Loader',
    waiting:
      'Potwierdź instalację LBK Bridge w oknie Decky Loader. Jeśli nie widzisz okna, naciśnij przycisk Steam.',
    fallback:
      'Nie udało się otworzyć prośby o instalację w Decky Loader. Zapisz plik ZIP i dodaj go ręcznie: Decky → Settings (Ustawienia) → Developer (Programista) → Install Plugin from ZIP.',
    done: 'LBK Bridge jest zainstalowany. Przetłumaczone nazwy osiągnięć pojawią się w Steam po połączeniu wtyczki.',
    saveZip: 'Zapisz ZIP',
    saved: 'Plik zapisany: {{path}}',
    saveFailed: 'Nie udało się zapisać pliku.',
    saveFailedWithError: 'Nie udało się zapisać pliku: {{error}}',
    intro:
      'Wtyczka wyświetla przetłumaczone nazwy osiągnięć w bibliotece Steam, powiadomieniach i nakładce. Pozostałe funkcje integracji działają bez niej. Decky Loader poprosi o potwierdzenie instalacji w Steam.',
    noDecky:
      'Nie znaleziono Decky Loader. Najpierw go zainstaluj, aby launcher mógł dodać LBK Bridge.',
    loaderDone: 'Decky Loader jest zainstalowany.',
    pluginReady: 'LBK Bridge dla Decky Loader jest już zainstalowany.',
    pluginUpdate: 'Dostępna jest aktualizacja LBK Bridge dla Decky.',
    updatePlugin: 'Zaktualizuj wtyczkę Decky',
    installPlugin: 'Zainstaluj wtyczkę',
  },
  download: {
    paused: 'Pobieranie wstrzymane',
    pauseFailed: 'Nie udało się wstrzymać pobierania',
    resuming: 'Wznawianie pobierania...',
    resumeFailed: 'Nie udało się wznowić pobierania',
    cancelled: 'Pobieranie anulowane',
    retryAttempt: 'Próba {{attempt}}/{{maxRetries}}... Sprawdź połączenie z internetem.',
    downloading: 'Pobieranie ukraińskiej lokalizacji...',
    connectionLost: 'Utracono połączenie. Sprawdź połączenie z internetem.',
    networkRetry: 'Błąd sieci. Próba {{attempt}}/{{maxRetries}}...',
    failedAfterRetries:
      'Nie udało się pobrać pliku po {{maxRetries}} próbach.\n\nOstatni błąd: {{error}}\n\nSprawdź połączenie z internetem i spróbuj ponownie.',
    rangeUnsupported: 'Serwer nie obsługuje wznawiania. Rozpoczynanie od nowa...',
    fileChanged: 'Plik na serwerze uległ zmianie. Pobieranie trzeba rozpocząć od nowa',
    timeout: 'Przekroczono czas połączenia. Sprawdź połączenie z internetem.',
    failed: 'Nie udało się pobrać',
    httpError: 'Nie udało się pobrać: HTTP {{statusCode}} {{statusMessage}}',
    noInternet: 'Brak połączenia z internetem',
    connectFailed: 'Nie udało się połączyć z serwerem. Sprawdź połączenie z internetem.',
    connectionReset: 'Połączenie zostało przerwane. Sprawdź połączenie z internetem.',
    serverUnavailable: 'Serwer niedostępny',
    serverUnavailableRetry: 'Serwer niedostępny. Spróbuj ponownie później.',
    failedCheckConnection: 'Nie udało się pobrać. Sprawdź połączenie z internetem.',
    failedWithError: 'Nie udało się pobrać: {{error}}',
  },
  downloadLimit: {
    message:
      'Przekroczono limit pobrań.\n\n{{used}}\n{{max}}\n\nNastępne pobranie będzie dostępne za {{time}}.',
    used_one: 'W ciągu ostatnich 24 godzin ta gra została pobrana {{count}} raz.',
    used_few: 'W ciągu ostatnich 24 godzin ta gra została pobrana {{count}} razy.',
    used_many: 'W ciągu ostatnich 24 godzin ta gra została pobrana {{count}} razy.',
    used_other: 'W ciągu ostatnich 24 godzin ta gra została pobrana {{count}} razy.',
    max_one: 'Limit dla dużych gier: {{count}} pobranie dziennie.',
    max_few: 'Limit dla dużych gier: {{count}} pobrania dziennie.',
    max_many: 'Limit dla dużych gier: {{count}} pobrań dziennie.',
    max_other: 'Limit dla dużych gier: {{count}} pobrania dziennie.',
    unknownTime: 'nieznany czas',
  },
  downloadProgress: {
    downloadingFiles: 'Pobieranie plików...',
    pause: 'Wstrzymaj',
    resume: 'Wznów',
    pauseResumeFailed: 'Nie udało się zmienić stanu pobierania',
    cancelFailed: 'Nie udało się anulować pobierania',
    downloaded: 'Pobrano:',
    speed: 'Prędkość:',
    speedValue: '{{speed}}/s',
    timeLeft: 'Pozostały czas:',
  },
  duration: { underSecond: '< 1 s' },
  favoriteToggle: { add: 'Dodaj do ulubionych', remove: 'Usuń z ulubionych' },
  feedbackModal: {
    title: 'Zostaw opinię',
    type: { feedback: 'Opinia', error: 'Błąd' },
    typeLabel: 'Rodzaj',
    descriptionLabel: 'Opis',
    placeholder_feedback: 'Podziel się opinią i sugestiami...',
    placeholder_error: 'Opisz, gdzie występuje błąd i jaki język jest wybrany w grze...',
    screenshotsLabel: 'Zrzuty ekranu (opcjonalnie)',
    dropzone: '<hl>Wybierz plik</hl> lub przeciągnij go tutaj',
    submit: 'Wyślij',
    screenshotsFailed: 'Nie udało się przesłać zrzutów ekranu.',
    screenshotFailed: 'Nie udało się przesłać zrzutu ekranu: {{name}}.',
    rateLimit: 'Poczekaj kilka minut przed wysłaniem kolejnego wpisu.',
    sendFailed: 'Nie udało się wysłać opinii.',
    sendFailed_error: 'Nie udało się wysłać zgłoszenia.',
    networkError: 'Błąd sieci. Spróbuj ponownie później.',
    thanks: 'Dziękujemy za opinię!',
    thanks_error: 'Dziękujemy za zgłoszenie!',
    sent: 'Twoja opinia została wysłana do twórcy lokalizacji',
    sent_error: 'Twoje zgłoszenie zostało wysłane do twórcy lokalizacji',
    allowPublish: 'Zgadzam się na opublikowanie mojej opinii wśród opinii społeczności',
    allowPublish_error:
      'Zgadzam się na opublikowanie mojego zgłoszenia błędu wśród opinii społeczności',
    captchaFailed: 'Weryfikacja nie powiodła się. Spróbuj ponownie później.',
    gameUnavailable:
      'Ta lokalizacja jest ukryta, jeszcze nie zatwierdzona lub usunięta z katalogu, więc wpisu nie można opublikować.',
    gameRemoved: 'Tej lokalizacji nie ma już w katalogu, więc opinii nie można wysłać.',
    gameRemoved_error:
      'Tej lokalizacji nie ma już w katalogu, więc zgłoszenia nie można wysłać.',
    authorRequired: 'Aby opublikować wpis, wybierz pseudonim lub odznacz publikowanie.',
    dailyLimit:
      'Dzienny limit publicznych wpisów został wyczerpany. Wyślij później lub bez publikowania.',
    published: 'Opublikowano!',
    publishedHint: 'Twój wpis jest już widoczny wśród opinii społeczności.',
    onModeration: 'Wysłano do moderacji',
    removedByModeration: 'Moderacja nie przepuściła wpisu',
    removedHint: 'Nie został opublikowany wśród opinii społeczności.',
  },
  filterBar: {
    filters: 'Filtry',
    clearAll: 'Wyczyść wszystkie filtry',
    showInstalled: 'Pokaż zainstalowane lokalizacje',
    hideInstalled: 'Ukryj zainstalowane lokalizacje',
    showFavorites: 'Pokaż ulubione',
    hideFavorites: 'Ukryj ulubione',
    sort: 'Sortowanie',
  },
  filterOptions: {
    status: {
      planned: 'Planowane',
      'in-progress': 'Wczesny dostęp',
      completed: 'Ukończone',
      'tech-improvement': 'Dopracowanie techniczne',
    },
    library: {
      'favorite-translations': 'Ulubione ukraińskie lokalizacje',
      'installed-translations': 'Zainstalowane ukraińskie lokalizacje',
      'installed-games': 'Zainstalowane gry',
      'available-in-steam': 'Dostępne w Steam',
      'owned-gog-games': 'Dostępne w GOG',
      'owned-epic-games': 'Dostępne w Epic',
      'installed-xbox-games': 'Zainstalowane przez aplikację Xbox',
    },
    contentType: {
      'with-achievements': 'Z przetłumaczonymi osiągnięciami',
      'with-voice': 'Z dubbingiem',
      'from-workshop': 'Z warsztatu Steam',
    },
    translationType: {
      manual: 'Tłumaczenie ręczne',
      ai: 'Tłumaczenie AI',
      'ai-edited': 'AI + redakcja przez człowieka',
    },
    sort: {
      name: 'Nazwa',
      downloads: 'Popularność',
      subscribers: 'Liczba subskrybentów',
      newest: 'Najnowsze',
    },
  },
  fundraising: { title: 'Zbiórka', raised: 'Zebrano', goal: 'Cel' },
  gameActions: {
    play: 'Graj',
    removedFromCatalog: 'Ta lokalizacja nie jest już dostępna w katalogu',
    offline: 'Brak połączenia z internetem',
    rerunTitle: 'Uruchom instalator/skrypt ponownie',
    rerun: 'Zainstaluj ponownie',
    uninstallTitle: 'Odinstaluj ukraińską lokalizację',
    support: 'Wesprzyj',
    feedback: 'Zostaw opinię',
    cancel: 'Anuluj',
  },
  gameAuthors: { many: 'Twórcy lokalizacji', one: 'Twórca lokalizacji' },
  gameCard: {
    unknownAuthor: 'Nieznany twórca',
    downloadedByPlayers: 'Pobrane przez graczy',
  },
  gameHero: { share: 'Udostępnij' },
  gameLike: {
    like: 'Podoba mi się',
    unlike: 'Cofnij polubienie',
    needsInstall: 'Zainstaluj lokalizację, aby zagłosować',
  },
  gameInfo: {
    title: 'Szczegóły',
    award: 'Nagroda',
    platforms: 'Platformy',
    version: 'Wersja',
    size: 'Rozmiar',
    voice: 'Dubbing',
    achievements: 'Osiągnięcia',
    achievementsBy: 'autor: {{author}}',
    subscribers: 'Subskrybenci',
    downloads: 'Pobrania',
    downloadsUnder20: 'poniżej 20',
    created: 'Utworzono',
    updated: 'Zaktualizowano',
  },
  gameLanguage: {
    EN: 'angielski',
    GB: 'brytyjski angielski',
    FR: 'francuski',
    IT: 'włoski',
    DE: 'niemiecki',
    ES: 'hiszpański',
    JA: 'japoński',
    KO: 'koreański',
    PL: 'polski',
    CS: 'czeski',
    ZH_CN: 'chiński uproszczony',
    ZH_TW: 'chiński tradycyjny',
    ZH: 'chiński',
    PT: 'portugalski',
    UK: 'ukraiński',
  },
  gameLaunch: { executableNotFound: 'Nie znaleziono pliku wykonywalnego gry' },
  gameLinks: {
    title: 'Linki',
    stores: 'Sklepy',
    other: 'Inne',
    openIn: 'Otwórz w {{store}}',
    steamGuide: 'Poradnik Steam',
    website: 'Strona internetowa',
  },
  gameList: { loadFailed: 'Nie udało się załadować gier' },
  gameNotice: {
    kind_installer: 'Instalator',
    kind_script: 'Skrypt',
    language: 'Wybierz <accent>{{language}}</accent> w ustawieniach języka gry',
  },
  gamePage: {
    tombstone:
      'Ta lokalizacja nie jest już dostępna w katalogu. Możesz ją odinstalować, ale nie będzie można zainstalować jej ponownie.',
    uninstalling:
      'Odinstalowywanie ukraińskiej lokalizacji i przywracanie oryginalnych plików...',
  },
  gameReviews: {
    title: 'Opinie społeczności',
    write: 'Napisz opinię',
    filter: {
      all: 'Wszystkie',
      feedback: 'Opinie',
      error: 'Błędy',
    },
    installRequired: 'Opinię możesz zostawić po zainstalowaniu lokalizacji.',
    loadFailed: 'Nie udało się załadować opinii. Spróbuj ponownie później.',
    empty: 'Na razie brak opinii.',
    emptyErrors: 'Na razie brak zgłoszeń błędów.',
    you: 'Ty',
    moderator: 'Moderator',
    translationAuthor: 'Twórca lokalizacji',
    bug: 'Błąd',
    edited: 'edytowano',
    private: 'Prywatne',
    badge: {
      checking: 'Sprawdzanie',
      confirmed: 'Potwierdzono',
      moderation: 'Czeka na moderację',
      failed: 'Nie wysłano',
    },
    hint: {
      moderation: 'Inni zobaczą ten wpis, gdy moderator go zatwierdzi.',
      moderationEdit:
        'Inni widzą poprzednią wersję, dopóki moderator nie zatwierdzi zmian.',
      private: 'Widzisz to tylko Ty i twórcy lokalizacji.',
    },
    reply: 'Odpowiedz',
    edit: 'Edytuj',
    editTimeLeft: 'jeszcze {{minutes}} min',
    replyPlaceholder: 'Twoja odpowiedź…',
    send: 'Wyślij',
    resend: 'Wyślij ponownie',
    save: 'Zapisz',
    actionFailed: 'Nie udało się zapisać. Spróbuj ponownie.',
    showMoreReplies_one: 'Pokaż jeszcze {{count}} odpowiedź',
    showMoreReplies_few: 'Pokaż jeszcze {{count}} odpowiedzi',
    showMoreReplies_many: 'Pokaż jeszcze {{count}} odpowiedzi',
    showMoreReplies_other: 'Pokaż jeszcze {{count}} odpowiedzi',
    hideReplies: 'Zwiń odpowiedzi',
    today: 'Dziś, {{time}}',
    yesterday: 'Wczoraj, {{time}}',
    screenshotAlt: 'Zrzut ekranu {{number}}',
    loadMoreFailed: 'Nie udało się załadować kolejnych opinii.',
    focusMissing: 'Ten komentarz nie jest już dostępny.',
    focusFailed: 'Nie udało się załadować tego komentarza.',
    removed: 'Usunięte przez moderatora',
    rejected: {
      editRejected: 'Moderacja nie przyjęła zmian, więc przywrócono poprzedni tekst.',
      removed: 'Moderacja usunęła wpis.',
      banned: 'Wpisy z tego urządzenia są zablokowane.',
      notFound: 'Ten wpis już nie istnieje.',
      replyTargetGone: 'Wpis, na który odpowiadasz, już nie istnieje.',
      editWindowClosed: 'Czas na edycję minął, więc poprzedni tekst pozostaje.',
      editLimitReached:
        'Tego wpisu nie można już zmienić, więc poprzedni tekst pozostaje.',
      threadFull: 'Ten wątek nie przyjmuje już odpowiedzi.',
      generic: 'Serwer nie przyjął wpisu.',
    },
    failed: {
      dailyLimit: 'Dzienny limit wpisów został wyczerpany. Wyślij później.',
      generic: 'Nie udało się wysłać wpisu.',
    },
  },
  gameSearch: { placeholder: 'Szukaj gier...' },
  gameSections: {
    aboutTranslation: 'O ukraińskiej lokalizacji',
    aboutGame: 'O grze',
  },
  gameStatus: {
    planned: 'Planowane',
    'in-progress': 'Wczesny dostęp',
    completed: 'Ukończone',
    'tech-improvement': 'Dopracowanie techniczne',
  },
  gameTabs: {
    info: 'Informacje',
    recommended: 'Polecane',
    reviews: 'Opinie',
    reviewsNews: 'Nowe w opiniach',
  },
  gameSubscribe: {
    subscribedTitle: 'Otrzymujesz powiadomienia o „{{game}}”',
    subscribeTitle: 'Otrzymuj powiadomienia o „{{game}}”',
    unsubscribe: 'Wyłącz powiadomienia',
    subscribe: 'Włącz powiadomienia',
  },
  gameVideo: {
    title: 'Wideo',
    watch: 'Obejrzyj wideo',
    trailer: 'Zwiastun ukraińskiej lokalizacji',
    play: 'Odtwórz',
  },
  gamepadHelp: {
    title: 'Sterowanie kontrolerem',
    deckKeyboard: 'Na Steam Deck naciśnij STEAM + X, aby otworzyć klawiaturę ekranową.',
    everywhere: {
      title: 'Wszędzie',
      move: 'Przejdź do następnego elementu (przytrzymaj, aby przesuwać szybciej)',
      press: 'Wybierz / otwórz',
      back: 'Wróć lub zamknij okno',
      scroll: 'Płynne przewijanie',
      search: 'Szukaj gier',
      home: 'Strona główna',
      settings: 'Ustawienia',
      help: 'Ten ekran pomocy',
    },
    feed: {
      title: 'Lista lokalizacji',
      adjacent: 'Poprzednia / następna lokalizacja',
      page: 'Przewiń o jeden ekran',
      ends: 'Przejdź na początek / koniec listy',
      header: 'Górne menu: wyszukiwanie, filtry, wiadomości',
      content: 'Przejdź do zawartości strony',
      home: 'Wróć na stronę główną ze strony lokalizacji',
    },
    gamePage: {
      title: 'Strona lokalizacji',
      move: 'Przejdź do przycisku lub karty w tym kierunku',
      scroll: 'Przewiń w górę / w dół o jeden ekran',
      adjacent: 'Poprzednia / następna lokalizacja',
      back: 'Na górze strony: powrót do listy lokalizacji',
    },
    dialogs: {
      title: 'Okna dialogowe i pola tekstowe',
      startTyping: 'W polu tekstowym: zacznij pisać',
      stopTyping: 'Zakończ pisanie; naciśnij ponownie, aby zamknąć okno',
      clearSearch: 'W polu wyszukiwania: wyczyść je',
      leaveList: 'Na liście twórców lub tagów: opuść listę',
      scroll: 'Przewiń okno o jeden ekran',
    },
  },
  gamepadHints: {
    allButtons: 'Wszystkie przyciski',
    finishInput: 'Zakończ pisanie',
    clear: 'Wyczyść',
    select: 'Wybierz',
    items: 'Elementy',
    navigation: 'Nawigacja',
    scroll: 'Przewijanie',
    open: 'Otwórz',
    menu: 'Menu',
    toGames: 'Wróć do gier',
    games: 'Gry',
    page: 'Strona',
    search: 'Szukaj',
    home: 'Strona główna',
    adjacentTranslation: 'Poprzednia / następna lokalizacja',
  },
  homeSections: {
    newGames: 'Nowości',
    newTranslations: 'Nowe lokalizacje',
    updates: 'Aktualizacje',
    newStars: 'Nowe gwiazdki w launcherze',
    popular: 'Popularne wśród graczy',
    installedGames: 'Znalezione zainstalowane gry',
    recommended: 'Może Ci się spodobać',
    weeklyPicks: 'Wybór tygodnia',
    viewAll: 'Zobacz wszystkie',
    noGames: 'Nie znaleziono gier',
    back: 'Wstecz',
  },
  install: { rateLimitTitle: 'Limit pobrań' },
  installArchive: {
    extracting: 'Rozpakowywanie plików... {{percent}}%',
    extracted: 'Rozpakowywanie zakończone',
    extractFailed: 'Nie udało się rozpakować archiwum: {{error}}',
  },
  installBackup: {
    backupFailed: 'Nie udało się utworzyć kopii zapasowej: {{error}}',
    restoreFailed: 'Nie udało się przywrócić plików: {{error}}',
  },
  installButton: {
    offline: 'Brak połączenia z internetem',
    planned: 'Planowane',
    techImprovement: 'Dopracowanie techniczne',
    reload: 'Pobierz ponownie (v{{version}})',
    update: 'Zaktualizuj do v{{version}}',
    install: 'Zainstaluj ukraińską lokalizację',
  },
  installComponents: {
    removing: 'Usuwanie komponentów...',
    removeFailed: 'Nie udało się usunąć komponentów',
    removedTitle: 'Komponenty usunięte',
    removedMessage: 'Wybrane komponenty zostały usunięte.',
    artworkTitle: 'Grafiki zaktualizowane',
    artworkMessage_on: 'Ukraińskie grafiki gry są już w Twojej bibliotece Steam.',
    artworkMessage_off: 'Oryginalne grafiki gry wróciły do Twojej biblioteki Steam.',
    artworkAfterSteamStart: 'Zmianę zobaczysz przy następnym uruchomieniu Steam.',
  },
  installConflict: {
    title: 'Zainstalowana jest już inna lokalizacja',
    message:
      'W folderze gry jest już zainstalowana inna lokalizacja:\n\n„{{name}}”{{team}}\nWersja: {{version}}\n\nAby zainstalować nową lokalizację, trzeba najpierw usunąć poprzednią.\n\nUsunąć poprzednią lokalizację?',
    confirm: 'Usuń i kontynuuj',
    infoNotFound: 'Nie udało się znaleźć informacji o zainstalowanej lokalizacji.',
    removeFailed: 'Nie udało się usunąć poprzedniej lokalizacji.',
    unknownLocalization: 'Nieznana lokalizacja',
  },
  installEmulator: {
    title: 'Wybierz folder gry',
    message:
      'W przypadku emulatorów folder gry trzeba wybrać ręcznie.\n\nWybrać folder gry teraz?',
  },
  installFailure: {
    network: 'Nie udało się połączyć z serwerem.\n\nSprawdź połączenie z internetem.',
    permission:
      'Niewystarczające uprawnienia do instalacji.\n\nUruchom aplikację jako administrator.',
    diskSpace: 'Za mało miejsca na dysku.\n\nZwolnij trochę miejsca i spróbuj ponownie.',
    notFound:
      'Nie znaleziono pliku lub folderu.\n\nUpewnij się, że gra jest zainstalowana.',
    unknown: 'Nieznany błąd instalacji.\n\nSpróbuj ponownie.',
    copyFailed: 'Nie udało się skopiować plików: {{error}}',
    signing: 'Podpisywanie aplikacji...',
  },
  installGameNotFound: {
    title: 'Nie znaleziono gry',
    message: '{{error}}\n\nSpróbuj wybrać folder gry ręcznie',
  },
  installIpc: {
    fileNotFound: 'Nie znaleziono pliku',
    pickFolderTitle: 'Wybierz folder gry',
    pickFolderButton: 'Wybierz',
    noActiveDownload: 'Brak aktywnego pobierania do wstrzymania',
    noPausedDownload: 'Brak wstrzymanego pobierania',
  },
  installNetwork: {
    interruptedTitle: 'Połączenie przerwane',
    interruptedMessage:
      'Nie udało się automatycznie wznowić pobierania.\n\nSprawdź połączenie z internetem i spróbuj ponownie.\nPostęp pobierania został zapisany.',
    retry: 'Spróbuj ponownie',
    waiting:
      'Utracono połączenie. Pobieranie zostanie wznowione automatycznie po przywróceniu połączenia...',
    resuming: 'Wznawianie pobierania...',
    offlineTitle: 'Brak połączenia',
    offlineMessage: 'Sprawdź połączenie z internetem i spróbuj ponownie.',
  },
  installOptions: {
    reinstallTitle: 'Zarządzanie komponentami',
    installTitle: 'Opcje instalacji',
    reinstallIntro: 'Wybierz komponenty dla „{{name}}”:',
    installIntro: 'Wybierz opcje instalacji ukraińskiej lokalizacji „{{name}}”:',
    platformAuto: 'Automatycznie ({{platform}})',
    platformManual: 'Wybór ręczny ({{platform}})',
    platformFound: 'Znaleziono',
    platformNotFound: 'Nie znaleziono (wybierz ręcznie)',
    platformLabel: 'Platforma gry',
    platformPlaceholder: 'Wybierz platformę',
    backupTitle: 'Utwórz kopię zapasową',
    backupDescription: 'Zapisuje oryginalne pliki gry, aby można je było przywrócić.',
    backupSize: 'Szacowany rozmiar: {{size}}',
    steamArtworkTitle: 'Ukraińskie grafiki w Steam',
    steamArtworkDescription:
      'Zastępuje baner, logo i poziomą grafikę gry w bibliotece Steam. Odznacz, aby przywrócić oryginalne grafiki tej gry.',
    textTitle: 'Lokalizacja tekstu',
    installed: 'zainstalowano',
    textDescription: 'Ukraińskie tłumaczenie tekstu w grze.',
    size: 'Rozmiar: {{size}}',
    willReinstall: 'Zostanie zainstalowane ponownie',
    willInstall: 'Zostanie zainstalowane',
    voiceTitle: 'Dubbing',
    unavailable: '(niedostępne)',
    voiceWithText: '(wraz z tekstem)',
    voiceDescription: 'Ukraiński dubbing.',
    willRemove: 'Zostanie usunięte',
    willDownload: 'Zostanie pobrane',
    launchOptions:
      'To tłumaczenie ustawi w Steam własne <hl>opcje uruchamiania</hl> gry.',
    totalDownload: 'Rozmiar pobierania:',
    removeList: 'Zostanie usunięte: {{items}}',
    removeVoice: 'dubbing',
    removeAchievements: 'osiągnięcia',
    confirm: 'Zainstaluj',
  },
  installPlatform: {
    linuxOnly:
      'Ta ukraińska lokalizacja jest dostępna tylko dla systemu Linux. Nie można jej zainstalować w systemie Windows.',
    windowsOnly:
      'Ta ukraińska lokalizacja jest dostępna tylko dla systemu Windows. Nie można jej zainstalować w systemie macOS.',
    unsafeCmdPath: 'ścieżka zawiera znaki niebezpieczne dla wiersza poleceń: {{path}}',
    exitFailedOrCancelled: 'Instalacja nie powiodła się lub została anulowana',
    exitCancelled: 'Instalacja anulowana',
    exitCode: 'Instalator zakończył działanie z kodem {{code}}',
    installerOutput: '\n\nDane wyjściowe instalatora:\n{{output}}',
    installerFileNotFound: 'nie znaleziono pliku instalatora: {{path}}',
    launching: 'Uruchamianie instalatora...',
    protonSetup: 'Konfigurowanie i uruchamianie Proton',
    notCompleted: 'instalacja nie została ukończona',
    windowsNeedsProton: 'Instalator dla Windows ({{extensions}}) wymaga Proton.',
    runFailed: 'Nie udało się uruchomić instalatora: {{error}}',
    uninstallerFailed: 'Nie udało się uruchomić dezinstalatora: {{error}}',
    rerunFailed: 'Nie udało się ponownie uruchomić instalatora',
  },
  installStatus: {
    installing: 'Instalowanie ukraińskiej lokalizacji...',
    updating: 'Aktualizowanie ukraińskiej lokalizacji...',
    offlinePaused: 'Brak połączenia z internetem. Pobieranie wstrzymane.',
    error: 'Błąd instalacji',
    update: 'Dostępna aktualizacja:',
    installed: 'Ukraińska lokalizacja zainstalowana:',
  },
  installSteamIntegration: {
    launchOptions: 'Ustawianie opcji uruchamiania Steam...',
    artwork: 'Instalowanie ukraińskich grafik Steam...',
    artworkRevert: 'Przywracanie oryginalnych grafik Steam...',
    artworkNotSteam: 'Grafiki Steam można zmienić tylko dla gry zainstalowanej ze Steam.',
    artworkFailed:
      'Nie udało się zmienić grafik w bibliotece Steam. Upewnij się, że jesteś zalogowany w Steam, i spróbuj ponownie.',
  },
  installSteps: {
    licenseOnlyManual:
      'Tę lokalizację można zainstalować tylko dla licencjonowanej kopii gry.\n\nRęczny wybór folderu jest niedozwolony.',
    licenseOnlyNotFound:
      'Tę lokalizację można zainstalować tylko dla licencjonowanej kopii gry.\n\nNie znaleziono gry. Upewnij się, że licencjonowana kopia jest zainstalowana przez oficjalny sklep (Steam, GOG, Epic Games, Ubisoft Connect, EA App itp.).',
    gameNotFound:
      'Nie znaleziono gry\n\nNie udało się automatycznie znaleźć folderu: {{path}}',
    pathNotSpecified: 'nie podano',
    protonMissing:
      'Ta ukraińska lokalizacja korzysta z instalatora dla Windows, który wymaga Proton, ale nie znaleziono żadnej wersji Proton.\n\nZainstaluj Proton w Steam i spróbuj ponownie.',
    notEnoughSpace:
      'Za mało miejsca na dysku.\n\nPotrzeba: {{needed}}\nDostępne: {{available}}\n\nZwolnij trochę miejsca i spróbuj ponownie.',
    noArchiveForBuild:
      'Brak archiwum lokalizacji dla zainstalowanej wersji gry ({{build}}).\n\nLokalizacja jest dostępna tylko dla: {{variants}}.',
    voiceStatus: 'Dubbing: {{message}}',
    copying: 'Kopiowanie plików ukraińskiej lokalizacji...',
    cleaning: 'Usuwanie plików tymczasowych...',
    backingUp: 'Tworzenie kopii zapasowej...',
    awaitingConfirm_installer: 'Oczekiwanie na zgodę na uruchomienie instalatora...',
    awaitingConfirm_script: 'Oczekiwanie na zgodę na uruchomienie skryptu...',
    runDeclined_installer:
      'Instalacja anulowana: odmówiono zgody na uruchomienie instalatora.\n\nPliki zostały rozpakowane do folderu gry. Instalator możesz uruchomić później, wybierając „Zainstaluj ponownie”.',
    runDeclined_script:
      'Instalacja anulowana: odmówiono zgody na uruchomienie skryptu.\n\nPliki zostały rozpakowane do folderu gry. Skrypt możesz uruchomić później, wybierając „Zainstaluj ponownie”.',
    macBundleUnresolved:
      'Nie udało się ustalić miejsca instalacji wewnątrz pakietu aplikacji macOS (.app).\n\nTa gra wymaga osobnego archiwum lokalizacji dla macOS.',
    status: 'Osiągnięcia: {{message}}',
  },
  installSuccess: {
    updatedMessage:
      'Ukraińska lokalizacja {{name}} została zaktualizowana do wersji {{version}}.',
    installedMessage: 'Ukraińska lokalizacja {{name}} została zainstalowana.',
    updatedTitle: 'Ukraińska lokalizacja zaktualizowana',
    installedTitle: 'Ukraińska lokalizacja zainstalowana',
    pluginNextStart:
      'Tłumaczenia osiągnięć pojawią się przy następnym uruchomieniu Steam.',
    needsMillenniumInstallable:
      'Tłumaczenia osiągnięć zostały zapisane. Do wyświetlania ich w Steam wymagane jest Millennium. Launcher może je dla Ciebie zainstalować.',
    needsMillennium:
      'Tłumaczenia osiągnięć zostały zapisane. Do wyświetlania ich w Steam wymagane jest Millennium.',
    needsDeckyPlugin:
      'Tłumaczenia osiągnięć zostały zapisane. Zainstaluj LBK Bridge dla Decky Loader, aby wyświetlać je w Steam.',
    deckyPluginDisabled:
      'Tłumaczenia osiągnięć zostały zapisane. Włącz LBK Bridge w ustawieniach Decky Loader, aby wyświetlać je w Steam.',
    needsDecky:
      'Tłumaczenia osiągnięć zostały zapisane. Na Steam Deck wyświetla je LBK Bridge dla Decky Loader. Launcher może zainstalować Decky Loader za Ciebie.',
    unavailable:
      'Tłumaczenia osiągnięć zostały zapisane, ale Steam nie może ich wyświetlić w tym systemie: {{reason}}',
    disabled:
      'Tłumaczenia osiągnięć zostały zapisane. Włącz w ustawieniach „Natychmiast stosuj opcje uruchamiania Steam”, aby wyświetlać je w Steam.',
    launchOptionsQueued:
      'Opcje uruchamiania zostaną zastosowane automatycznie po zamknięciu Steam. Pozostaw launcher uruchomiony; możesz zminimalizować go do zasobnika.',
    launchOptionsError: 'Nie udało się ustawić opcji uruchamiania: {{error}}',
    ok: 'Rozumiem',
    restartSteamNow: 'Uruchom Steam ponownie teraz',
    restartFailureTitle: 'Opcje uruchamiania nie zostały zastosowane',
    restartSuccessTitle: 'Opcje uruchamiania zastosowane',
    restartSuccessMessage: 'Opcje uruchamiania zostały zapisane. Możesz uruchomić grę.',
  },
  installUnavailable: {
    title: 'Niedostępne',
    message: 'Instalacja jest dostępna tylko w aplikacji na komputer',
  },
  installedGamesBanner: {
    noTranslationsTitle: 'Nie znaleziono lokalizacji dla Twoich gier',
    noTranslationsText:
      'Ojej… Znaleźliśmy Twoje gry, ale nie ma dla nich jeszcze lokalizacji.<br/>Otwórz menu filtrów, aby przejrzeć inne dostępne lokalizacje.',
    noGamesTitle: 'Nie możemy znaleźć Twoich gier',
    noGamesText:
      'Ojej… Nie znaleźliśmy żadnych zainstalowanych gier z dostępnymi lokalizacjami.<br/>Upewnij się, że masz co najmniej jedną grę z naszego katalogu w Steam, GOG, Epic Games Store, Ubisoft Connect lub EA App. Możesz też otworzyć menu filtrów, aby przeglądać gry, których jeszcze nie zainstalowano.',
  },
  kuliPlacement: {
    supported: 'Lokalizacja dostępna dzięki wsparciu KULI',
    beFirst: 'Zagraj z lokalizacją <b>jako pierwszy</b>!',
    goToKuli: 'Odwiedź KULI →',
  },
  launch: {
    errorTitle: 'Błąd uruchamiania',
    failed: 'Nie udało się uruchomić gry',
    gameNotFound: 'Nie znaleziono gry na Twoim komputerze',
    lutrisFailed: 'Nie udało się uruchomić gry przez Lutris',
  },
  launchOptions: {
    noAppId: 'Gra nie ma identyfikatora Steam App ID',
    notConfigured: 'Dla tej lokalizacji nie ustawiono opcji uruchamiania',
    gameDirUnresolved: 'Nie udało się znaleźć folderu gry dla opcji uruchamiania',
    writeFailed: 'Nie udało się zapisać opcji uruchamiania',
    eglWriteFailed: 'nie udało się zmienić ustawień gry w Epic Games Launcher',
    eglGameNotFound: 'gry nie ma wśród zainstalowanych w Epic Games Launcher',
    eglNeedsShell:
      'działają tylko przez powłokę, z którą uruchamia je Steam, a Epic Games Launcher tego nie potrafi',
    eglQueued:
      'Opcje uruchamiania zostaną zastosowane automatycznie, gdy tylko zamkniesz Epic Games Launcher z ikony w zasobniku (zamknięcie okna nie wyłącza programu). Do tego czasu pozostaw LBK Launcher otwarty; możesz zminimalizować go do zasobnika.',
    eglEnvUnsupported:
      'Epic Games Launcher nie przekazuje zmiennych środowiskowych do gry, więc lokalizacja może nie działać bez nich.',
    eglEnvOnlyFromLbk:
      'Epic Games Launcher nie przekazuje zmiennych środowiskowych do gry, więc lokalizacja będzie działać tylko wtedy, gdy uruchomisz grę przyciskiem „Graj” w LBK Launcher.',
  },
  millennium: {
    deckyHost:
      'W systemach z Decky Loader launcher korzysta z LBK Bridge dla Decky Loader, dlatego instalacja Millennium nie jest tu dostępna.',
    unsupported: {
      'flatpak-steam': 'Millennium nie obsługuje Steam zainstalowanego przez Flatpak.',
      'snap-steam': 'Millennium nie obsługuje Steam zainstalowanego przez Snap.',
      arch: 'Millennium obsługuje tylko komputery z procesorem x86-64.',
      'steam-rt64':
        'Millennium nie obsługuje bety 64-bitowego klienta Steam. Opuść program beta w ustawieniach Steam („Zgodność” / „Wersje beta”).',
      'missing-libssl32':
        'Brakuje 32-bitowej biblioteki OpenSSL 3 (libssl3:i386 lub lib32-openssl). Zainstaluj ją i spróbuj ponownie.',
      'steam-home-link':
        'Nie znaleziono łącza ~/.steam/steam do folderu Steam. Uruchom Steam raz i spróbuj ponownie.',
      nixos:
        'W NixOS zainstaluj Millennium przez konfigurację systemu. Launcher doda LBK Bridge automatycznie.',
      'macos-too-old': 'Millennium wymaga macOS 13.3 lub nowszego.',
      'no-release':
        'Instalacja Millennium z poziomu launchera nie jest jeszcze dostępna dla tego systemu.',
      'millennium-v2':
        'Masz starą wersję Millennium. Zaktualizuj do wersji 3 za pomocą oficjalnego instalatora. Launcher doda wtedy LBK Bridge automatycznie.',
      'no-steam': 'Launcher nie znalazł Steam na tym urządzeniu.',
      unknown: 'Millennium nie jest obsługiwane w tym systemie.',
      noReleaseMac: 'Wersja Millennium dla macOS nie jest jeszcze dostępna.',
    },
    failure: {
      installFailed: 'Nie udało się zainstalować Millennium.',
      'download-failed':
        'Nie udało się pobrać Millennium. Sprawdź połączenie z internetem i spróbuj ponownie.',
      'checksum-mismatch':
        'Pobrany plik Millennium jest uszkodzony lub został zmodyfikowany. Instalacja anulowana.',
      'extract-failed': 'Nie udało się rozpakować Millennium.',
      'av-blocked':
        'Twój program antywirusowy usunął lub zablokował pliki Millennium. Dodaj folder Steam do wyjątków antywirusa i spróbuj ponownie.',
      'not-writable':
        'Launcher nie może zapisywać w folderze Steam. Zainstaluj Millennium za pomocą oficjalnego instalatora.',
      conflict:
        'W folderze Steam są już pliki innego modu, który ładuje się tak samo jak Millennium. Launcher ich nie zmieni.',
      'not-prepared': 'Najpierw pobierz Millennium ponownie.',
      'script-failed': 'Nie udało się zainstalować plików Millennium.',
      'files-locked':
        'Pliki Steam są nadal używane. Millennium zostanie zainstalowane przy następnym zamknięciu Steam.',
      cancelled: 'Instalacja Millennium anulowana.',
      busy: 'Launcher już wprowadza zmiany w Millennium. Poczekaj na zakończenie.',
      'plugin-not-connected':
        'Millennium jest zainstalowane, ale LBK Bridge jeszcze się nie połączył. Upewnij się, że Steam jest uruchomiony, i wybierz „Sprawdź ponownie”.',
    },
    phase: {
      download: 'Pobieranie Millennium…',
      verify: 'Sprawdzanie plików…',
      extract: 'Rozpakowywanie…',
      'stop-steam': 'Zamykanie Steam…',
      'install-files': 'Instalowanie plików…',
      'start-steam': 'Uruchamianie Steam…',
      'wait-plugin': 'Oczekiwanie na połączenie LBK Bridge…',
      uninstallFiles: 'Usuwanie plików Millennium…',
    },
  },
  millenniumPending: {
    notDetected:
      'Steam nie otworzył połączenia dla launchera. Opcje uruchamiania zostaną zastosowane po zamknięciu Steam. Połączenie może blokować inny mod do Steam.',
    unsupported:
      'Wykryto Millennium, ale launcher nie mógł dodać LBK Bridge. Opcje uruchamiania zostaną zastosowane po zamknięciu Steam.',
    enabled:
      'LBK Bridge dla Millennium jest włączony, ale Steam jeszcze go nie załadował. Wtyczka zacznie działać przy następnym uruchomieniu Steam.',
    disabled:
      'Wykryto Millennium. Zamyka ono połączenie, którego launcher używa do komunikacji ze Steam, dlatego launcher zainstalował LBK Bridge dla Millennium. Wtyczka zostanie włączona automatycznie po zamknięciu Steam. Aby włączyć ją teraz, wejdź w ustawienia Millennium → Plugins → LBK Bridge.',
  },
  millenniumSetup: {
    title: 'Millennium i LBK Bridge',
    done: 'Millennium jest zainstalowane. Steam połączył się z launcherem przez LBK Bridge.',
    offlineDone:
      'Millennium jest zainstalowane. LBK Bridge połączy się po uruchomieniu Steam.',
    queued:
      'Millennium zostanie zainstalowane po zamknięciu Steam. Jeśli launcher będzie wtedy zamknięty, instalacja nastąpi przy jego następnym otwarciu, gdy Steam nie będzie uruchomiony.',
    macQueued: 'Następnie uruchom Steam z launchera lub przez „Steam Millennium”.',
    steamNotBack:
      'Steam nie uruchomił się po zainstalowaniu Millennium. Ta wersja Millennium może jeszcze nie obsługiwać Twojej wersji Steam.',
    envMissing:
      'Steam nie został uruchomiony z launchera, więc Millennium jest nieaktywne. Uruchom Steam ponownie z launchera albo wyloguj się z systemu i zaloguj ponownie.',
    external:
      'Millennium jest już zainstalowane. Launcher doda LBK Bridge automatycznie.',
    openSite: 'Otwórz stronę Millennium',
    startSteam: 'Uruchom Steam',
    uninstall: 'Odinstaluj Millennium',
    restartSteam: 'Uruchom Steam ponownie',
    recheck: 'Sprawdź ponownie',
    restartToFinish:
      'Steam musi się zamknąć i uruchomić ponownie, aby dokończyć instalację.',
    install: 'Zainstaluj',
    update: 'Zaktualizuj Millennium',
    repair: 'Napraw Millennium',
    updateTitle: 'Aktualizacja Millennium',
    repairTitle: 'Naprawa Millennium',
    updateAvailable: 'Dostępna aktualizacja Millennium: {{version}}.',
    filesBroken: 'Pliki Millennium w folderze Steam są uszkodzone lub ich brakuje.',
    restartNeeded: 'Steam będzie musiał się zamknąć i uruchomić ponownie.',
    offer: {
      intro:
        'Millennium to darmowy, niezależny mod do klienta Steam, nie pochodzi od Valve. Launcher może zainstalować go razem z LBK Bridge.',
      benefitsMac:
        'Co zyskujesz:\n• LBK Bridge będzie wyświetlać przetłumaczone nazwy osiągnięć w bibliotece Steam, powiadomieniach i nakładce.',
      benefits:
        'Co zyskujesz:\n• LBK Bridge będzie wyświetlać przetłumaczone nazwy osiągnięć w bibliotece Steam, powiadomieniach i nakładce;\n• launcher będzie mógł współpracować ze Steam bez otwartego portu debugowania i powtarzanych próśb o ponowne uruchomienie Steam.',
      withoutMillennium:
        'Co działa bez Millennium: opcje uruchamiania, subskrypcje warsztatu, kolekcja „Z ukraińskimi lokalizacjami”, skrót launchera i grafiki Steam, przez port debugowania Steam (po jednym ponownym uruchomieniu Steam).',
      sourceMac: 'Pliki są pobierane z naszej wersji Millennium na GitHub.',
      source: 'Pliki Millennium są pobierane z oficjalnej strony projektu na GitHub.',
      caveatWindows:
        'Uwaga: po aktualizacjach Steam Millennium może przestać działać do czasu wydania zgodnej aktualizacji. Program antywirusowy może też omyłkowo zablokować jego pliki.',
      caveat:
        'Uwaga: po aktualizacjach Steam Millennium może przestać działać do czasu wydania zgodnej aktualizacji.',
      linux:
        'Millennium zostanie zainstalowane tylko dla Twojego konta użytkownika, bez hasła administratora. Jeśli uruchomisz Steam poza launcherem, Millennium zadziała po wylogowaniu z systemu i ponownym zalogowaniu.',
      macos:
        'W macOS launcher instaluje własną wersję Millennium. Działa ona tylko wtedy, gdy Steam jest uruchomiony przez „Steam Millennium” w folderze Aplikacje użytkownika. Launcher uruchamia Steam w ten sposób automatycznie.',
      restart: 'Do instalacji Steam będzie musiał się zamknąć i uruchomić ponownie.',
    },
  },
  millenniumUninstall: {
    title: 'Odinstaluj Millennium',
    restartNeeded:
      'Steam musi się zamknąć i uruchomić ponownie, aby odinstalować Millennium.',
    cannotRestart:
      'Launcher nie może teraz uruchomić Steam ponownie. Zamknij Steam ręcznie.',
    confirm:
      'Millennium zostanie usunięte z folderu Steam. Jego wtyczki i motywy pozostaną, chyba że zaznaczysz „Usuń również wtyczki i ustawienia Millennium”.',
    purge: 'Usuń również wtyczki i ustawienia Millennium',
    action: 'Odinstaluj Millennium',
    queued: 'Millennium zostanie usunięte po zamknięciu Steam.',
    done: 'Millennium zostało usunięte.',
    filesLocked:
      'Pliki Steam są nadal używane. Millennium zostanie usunięte przy następnym zamknięciu Steam.',
    failed: 'Nie udało się odinstalować Millennium.',
    failedWithError: 'Nie udało się odinstalować Millennium: {{error}}',
    progress: 'Odinstalowywanie Millennium…',
  },
  ratings: {
    title: 'Ranking ukraińskich lokalizacji',
    subtitle: 'Zespoły tłumaczy i gry według ocen graczy',
    tab: {
      teams: 'Zespoły',
      games: 'Gry',
    },
    caption: {
      teams: 'Zespoły według liczby polubień',
      games: 'Gry według liczby polubień',
    },
    column: {
      rank: 'Nr',
      team: 'Zespół',
      game: 'Gra',
      likes: 'Polubienia',
      translations: 'Lokalizacje',
      downloads: 'Pobrania',
      status: 'Status lokalizacji',
      details: 'Działania',
    },
    details: 'Szczegóły',
    loadFailed: 'Nie udało się załadować rankingu. Spróbuj ponownie później.',
    empty: 'Na razie brak danych.',
    pages: 'Strony: {{caption}}',
    search: {
      placeholder: {
        teams: 'Szukaj zespołów...',
        games: 'Szukaj gier...',
      },
      allResults: '– wszystkie wyniki',
      noResults: 'Nic nie znaleziono',
      noResultsHint: 'Sprawdź pisownię lub spróbuj innej nazwy',
      clear: 'Wyczyść wyszukiwanie',
    },
  },
  pagination: {
    first: 'Pierwsza strona',
    previous: 'Poprzednia strona',
    next: 'Następna strona',
    last: 'Ostatnia strona',
  },
  newsFeed: {
    title: 'Wiadomości',
    tab: { sales: 'Gry w promocji', 'games-80': 'Gry za 80', news: 'Wiadomości' },
    empty: 'Nie znaleziono wiadomości',
    open: 'Czytaj wiadomość',
    discuss: 'Dyskutuj na Telegramie',
  },
  notificationCenter: {
    title: 'Powiadomienia',
    settingsTitle: 'Ustawienia powiadomień',
    justNow: 'Przed chwilą',
    statusChange: 'Status zmienił się z „{{from}}” na „{{to}}”',
    versionUpdate: 'Wersja zaktualizowana z {{from}} do {{to}}',
    appUpdate: 'Dostępna jest nowa wersja aplikacji: {{version}}',
    teamNewGame: 'Nowa lokalizacja zespołu <team/>',
    teamStatusChange: '<team/>: status zmienił się na „<status/>”',
    progressChange: '{{kind}}: {{to}}%',
    feedbackReply: 'Nowa odpowiedź:',
    reviewRejected: 'Wpis nie został przyjęty:',
    appUpdatesTitle: 'Aktualizacje aplikacji',
    appUpdatesDescription: 'Powiadomienia o nowych wersjach LBK Launcher',
    gameUpdatesTitle: 'Aktualizacje ukraińskich lokalizacji',
    gameUpdatesDescription:
      'Powiadomienia o nowych wersjach zainstalowanych ukraińskich lokalizacji',
    empty: 'Brak powiadomień',
    emptyHint:
      'Subskrybuj planowane lokalizacje,<br/>aby otrzymywać powiadomienia o zmianie ich statusu',
    markAllRead: 'Oznacz wszystkie jako przeczytane',
    clearAll: 'Wyczyść wszystko',
    clearConfirmTitle: 'Usunąć wszystkie powiadomienia?',
    clearConfirmBody:
      'Tej operacji nie można cofnąć. Wszystkie powiadomienia zostaną trwale usunięte.',
    delete: 'Usuń',
  },
  notificationMessage: {
    statusChange: 'Status zmienił się na „{{status}}”',
    progressChange: 'Postęp zaktualizowany: {{progress}}',
    firstFavorite: 'Kliknij, aby przefiltrować listę po ulubionych',
    feedbackReply: 'Nowa odpowiedź',
    reviewPublished:
      'Twój wpis przeszedł moderację i jest teraz widoczny dla wszystkich.',
  },
  notificationToast: {
    'status-change': 'Status zmieniony',
    'version-update': 'Dostępna aktualizacja',
    'app-update': 'Aktualizacja aplikacji',
    'first-favorite': 'Dodano do ulubionych',
    'progress-change': 'Postęp zaktualizowany',
    'feedback-reply': 'Nowa odpowiedź',
    'team-new-game': 'Powiadomienie',
    'team-status-change': 'Powiadomienie',
    'review-rejected': 'Wpis nie został przyjęty',
    'review-published': 'Wpis opublikowany',
  },
  notifications: {
    versionAvailable: 'Dostępna wersja {{version}}',
    teamNewGame: 'Nowa lokalizacja zespołu {{team}}',
    teamStatusChange: '{{team}}: status zmienił się na „{{status}}”',
    feedbackReplyTitle: 'Nowa odpowiedź: {{game}}',
    replyBy: '{{name}}: {{message}}',
    progressChange: '{{kind}}: {{from}}% → {{to}}%',
  },
  pendingLaunchOptions: {
    queued_one: 'Oczekiwanie na zamknięcie Steam: opcje uruchamiania dla {{count}} gry.',
    queued_few: 'Oczekiwanie na zamknięcie Steam: opcje uruchamiania dla {{count}} gier.',
    queued_many:
      'Oczekiwanie na zamknięcie Steam: opcje uruchamiania dla {{count}} gier.',
    queued_other:
      'Oczekiwanie na zamknięcie Steam: opcje uruchamiania dla {{count}} gry.',
    gameName: '„{{name}}”',
    games_one: '{{count}} gry',
    games_few: '{{count}} gier',
    games_many: '{{count}} gier',
    games_other: '{{count}} gry',
    bridgeReady: 'Steam połączył się z launcherem',
    steamClosed: 'Steam został zamknięty',
    appliedTitle: 'Opcje uruchamiania zastosowane',
    appliedBody:
      '{{lead}} — opcje uruchamiania dla {{target}} zostały zapisane. Możesz uruchomić grę.',
  },
  platformName: {
    steam: 'Steam',
    epic: 'Epic Games Store',
    gog: 'GOG',
    rockstar: 'Rockstar Games Launcher',
    xbox: 'Aplikacja Xbox',
    uplay: 'Ubisoft Connect',
    ea: 'EA App',
    emulator: 'Emulator',
    other: 'Inne',
  },
  pluginEntries: {
    deckyPluginDisabled:
      'LBK Bridge jest wyłączony w Decky Loader. Włącz go w ustawieniach Decky.',
    recommend:
      'Wskazówka: z Millennium launcher może też wyświetlać tłumaczenia osiągnięć w Steam.',
    noDeckyCanInstall:
      'LBK Bridge dla Decky Loader wyświetla tłumaczenia osiągnięć w Steam. Launcher może zainstalować Decky Loader razem z wtyczką.',
    noDecky:
      'LBK Bridge dla Decky Loader wyświetla tłumaczenia osiągnięć w Steam. Najpierw zainstaluj Decky Loader.',
    deckyPlugin:
      'LBK Bridge dla Decky Loader wyświetla przetłumaczone osiągnięcia w Steam.',
    deckyOutdated: 'Dostępna jest aktualizacja LBK Bridge dla Decky.',
    pending: {
      activate: 'Millennium zostanie zainstalowane po zamknięciu Steam.',
      deactivate: 'Millennium zostanie usunięte po zamknięciu Steam.',
    },
    installedVersion: 'Zainstalowano Millennium {{version}}.',
    repair: 'Pliki Millennium w folderze Steam są uszkodzone lub ich brakuje.',
    update: 'Dostępna aktualizacja Millennium: {{version}}.',
    unsupported: 'Tłumaczenia osiągnięć są niedostępne w Steam: {{reason}}',
    bridgeUpdate:
      'Aktualizacja LBK Bridge zacznie działać po ponownym uruchomieniu Steam.',
  },
  pluginOffer: {
    installMillennium: 'Zainstaluj Millennium',
    repairMillennium: 'Napraw Millennium',
    uninstallMillennium: 'Odinstaluj Millennium',
    millenniumInfo: 'Czym jest Millennium?',
    millenniumSite: 'Otwórz stronę Millennium',
    installDeckyLoader: 'Zainstaluj Decky Loader',
    installDeckyPlugin: 'Zainstaluj wtyczkę Decky',
    updateDeckyPlugin: 'Zaktualizuj wtyczkę Decky',
    deckyInfo: 'Czym jest Decky Loader?',
    openSettings: 'Otwórz ustawienia',
    restartSteam: 'Uruchom Steam ponownie',
    updateMillennium: 'Zaktualizuj Millennium do {{version}}',
  },
  promoModal: {
    imageAlt: 'Wesprzyj ukraiński launcher!',
    title: 'Małe wsparcie dla launchera?',
    body: 'Tworzymy ten launcher, aby ułatwić znajdowanie i pobieranie lokalizacji. Wciąż poprawiamy jego szybkość i stabilność oraz dodajemy nowe funkcje.',
    everyBitCounts: 'Nawet niewielki wkład ma znaczenie ✨',
    dontShowAgain: 'Nie pokazuj ponownie',
    donate: 'Wesprzyj',
  },
  reviewAuthorPicker: {
    title: 'Twoje imię w opiniach',
    intro:
      'Publiczne opinie i odpowiedzi są podpisywane imieniem i awatarem. Zakręć bębnami, przytrzymaj to, co Ci się podoba, i wybierz.',
    permanent: 'Imię i awatar wybierasz raz: nie można ich później zmienić.',
    reel: {
      avatar: 'Awatar',
      adjective: 'Pierwsze słowo',
      noun: 'Drugie słowo',
    },
    reelValue: '{{reel}}: {{value}}',
    hold: 'Przytrzymaj',
    held: 'Przytrzymano',
    lever: 'Zakręć',
    spins: 'Losowania',
    generating: 'Generowanie imienia…',
    releaseOne: 'Zwolnij jeden z bębnów',
    claim: 'Wybierz to imię',
    notice: {
      nameTaken: 'Ktoś właśnie zajął to imię, więc bębny zakręciły się ponownie.',
      nameExpired:
        'Tego imienia nie można już wybrać, więc bębny zakręciły się ponownie.',
      holdsReleased: 'Przytrzymania zwolnione: poprzednie losowanie nie jest już ważne.',
      wordsReleased:
        'Nie ma już wolnych imion z przytrzymanymi słowami, więc ich przytrzymanie zostało zwolnione.',
      exhausted: 'Tym razem nie wypadło żadne wolne imię. Zakręć ponownie.',
      rateLimit: 'Zbyt wiele prób. Spróbuj ponownie za chwilę.',
      captchaFailed: 'Weryfikacja nie powiodła się. Spróbuj ponownie.',
      captchaUnavailable:
        'Weryfikacja jest teraz niedostępna. Spróbuj ponownie za minutę.',
      offline: 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.',
      failed: 'Coś poszło nie tak. Spróbuj ponownie.',
    },
  },
  runInstaller: {
    exeTitle: 'Uruchom instalator',
    scriptTitle: 'Uruchom skrypt',
    exeProtonMessage:
      'Ukraińska lokalizacja „{{name}}” została pobrana i rozpakowana. Instalator dla Windows zostanie uruchomiony przy użyciu wybranej wersji Proton.\n\nŚcieżka do folderu zostanie skopiowana do schowka.',
    scriptProtonMessage:
      'Ukraińska lokalizacja „{{name}}” została pobrana i rozpakowana. Skrypt dla Windows zostanie uruchomiony przy użyciu wybranej wersji Proton.\n\nŚcieżka do folderu zostanie skopiowana do schowka.',
    exeAskMessage:
      'Ukraińska lokalizacja „{{name}}” została pobrana i rozpakowana.\n\nUruchomić instalator teraz?',
    scriptAskMessage:
      'Ukraińska lokalizacja „{{name}}” została pobrana i rozpakowana.\n\nUruchomić skrypt teraz?',
    protonPlaceholder: 'Wybierz wersję Proton',
    openFolder: 'Otwórz folder',
    run: 'Tak, uruchom',
    skip: 'Nie',
    confirmMessage:
      'Po pobraniu i rozpakowaniu ukraińskiej lokalizacji zostanie uruchomiony jej instalator lub skrypt.\n\nKontynuować instalację?',
    confirm: 'Kontynuuj',
    finishedTitle: 'Instalator zakończył działanie',
    finishedMessage: 'Instalator zakończył pracę',
    failed: 'Nie udało się uruchomić instalatora',
  },
  selectDropdown: { placeholder: 'Wybierz opcję', empty: 'Brak opcji' },
  sendLogs: {
    titleCrash: 'Raport o błędzie',
    title: 'Wyślij logi',
    submit: 'Wyślij logi',
    consent: 'Wysyłając logi, wyrażasz zgodę na przetwarzanie swoich danych osobowych.',
    crashReason: 'Przyczyna błędu:',
    descriptionLabel: 'Opis (opcjonalnie)',
    placeholder: 'Opisz, co się stało, aby pomóc nam to zbadać...',
    rateLimit: 'Poczekaj kilka minut przed wysłaniem kolejnego raportu',
    sendFailed: 'Nie udało się wysłać logów',
    networkError: 'Błąd sieci. Spróbuj ponownie później',
  },
  settings: {
    title: 'Ustawienia',
    language: {
      title: 'Język',
      description: 'Język interfejsu launchera',
    },
    feedback: { title: 'Kontakt', description: 'Napisz do nas na Telegramie' },
    performance: {
      title: 'Tryb wydajności',
      weakHardware:
        'Włączony: to urządzenie nie ma wystarczających zasobów do płynnych animacji, dlatego trybu wydajności nie można wyłączyć',
      description: 'Wyłącza animacje i rozmycie interfejsu dla lepszej wydajności',
    },
    liquidGlass: {
      title: 'Motyw Liquid Glass',
      weakHardware:
        'Wyłączony: to urządzenie nie ma wystarczających zasobów do efektów przezroczystości',
      description: 'Włącz przezroczystość i rozmycie okna (macOS 26+)',
    },
    backup: {
      title: 'Twórz kopie zapasowe',
      description:
        'Zapisuj oryginalne pliki gry przed zainstalowaniem ukraińskiej lokalizacji',
    },
    steamCef: {
      title: 'Natychmiast stosuj opcje uruchamiania Steam',
      description:
        'Pozwala launcherowi od razu zmieniać opcje uruchamiania, subskrypcje warsztatu, kolekcję „Z ukraińskimi lokalizacjami” i grafiki Steam. Po pierwszym włączeniu Steam musi zostać uruchomiony ponownie jeden raz. Do bezpośredniego połączenia launcher używa portu debugowania Steam lub wtyczki LBK Bridge w Millennium albo Decky Loader; LBK Bridge wyświetla też przetłumaczone nazwy osiągnięć. Gdy opcja jest wyłączona, opcje uruchamiania są stosowane dopiero po zamknięciu Steam.',
    },
    steamArtwork: {
      title: 'Ukraińskie grafiki w Steam',
      description:
        'Domyślnie proponuj zastąpienie banera, logo i poziomej grafiki gry w bibliotece Steam ukraińskimi wersjami z lokalizacji. Możesz to zmienić dla każdej gry w opcjach instalacji. Grafika pionowa pozostaje bez zmian. Oryginalne grafiki zostaną przywrócone po odinstalowaniu lokalizacji',
    },
    adultGames: {
      title: 'Pokazuj gry z treściami pornograficznymi',
      description:
        'Pokazuj gry z treściami pornograficznymi lub erotycznymi (hentai, powieści wizualne dla dorosłych itp.)',
    },
    aiTranslations: {
      title: 'Ukryj tłumaczenia AI',
      description: 'Ukryj tłumaczenia stworzone za pomocą sztucznej inteligencji',
    },
    recommendations: {
      title: 'Rekomendacje gier',
      description: 'Pokazuj sekcję „Może Ci się spodobać” na stronach gier',
    },
    notificationSounds: {
      title: 'Dźwięki powiadomień',
      description: 'Odtwarzaj dźwięki powiadomień o aktualizacjach',
    },
    uiSounds: {
      title: 'Dźwięki interfejsu',
      description:
        'Odtwarzaj dźwięki podczas nawigacji kontrolerem i automatu, który losuje Twoje imię w opiniach',
    },
    productAnalytics: {
      title: 'Analityka produktu',
      description:
        'Sesje aplikacji i interakcje z interfejsem pomagają nam wykrywać problemy z użytecznością',
    },
    localizationAnalytics: {
      title: 'Analityka rozwoju lokalizacji',
      description:
        'Wsparcie twórców, wyszukiwania bez wyników, odinstalowania i czas gry pomagają nam zrozumieć, jakie lokalizacje są potrzebne',
    },
    crashDiagnostics: {
      title: 'Raporty o awariach',
      description:
        'Automatyczne raporty o błędach aplikacji. Wyłączenie działa natychmiast; włączenie wymaga ponownego uruchomienia',
    },
    collection: {
      title: 'Kolekcja Steam „Z ukraińskimi lokalizacjami”',
      description:
        'Utwórz lub zaktualizuj kolekcję w bibliotece Steam z grami, dla których dostępne są lokalizacje',
      updatedTitle: 'Kolekcja zaktualizowana',
      updatedEmpty: 'Kolekcja „Z ukraińskimi lokalizacjami” jest teraz pusta.',
      updated_one: 'Kolekcja „Z ukraińskimi lokalizacjami” zawiera teraz {{count}} grę.',
      updated_few: 'Kolekcja „Z ukraińskimi lokalizacjami” zawiera teraz {{count}} gry.',
      updated_many:
        'Kolekcja „Z ukraińskimi lokalizacjami” zawiera teraz {{count}} gier.',
      updated_other:
        'Kolekcja „Z ukraińskimi lokalizacjami” zawiera teraz {{count}} gry.',
      failedTitle: 'Nie udało się zaktualizować kolekcji',
    },
    kurin: {
      title: 'Synchronizacja z Kurin',
      description: 'Znajdź i zaimportuj zainstalowane gry dodane przez Kurin',
      failedTitle: 'Nie udało się zsynchronizować',
      doneTitle: 'Synchronizacja zakończona',
      synced_one: 'Zsynchronizowano {{count}} grę: {{games}}',
      synced_few: 'Zsynchronizowano {{count}} gry: {{games}}',
      synced_many: 'Zsynchronizowano {{count}} gier: {{games}}',
      synced_other: 'Zsynchronizowano {{count}} gry: {{games}}',
      none: 'Nie znaleziono gier zainstalowanych przez Kurin lub Kurin nie jest zainstalowany.',
    },
    lbkShortcut: {
      title: 'LBK Launcher w bibliotece Steam',
      description: 'Dodaj launcher jako grę w Steam',
      addedTitle: 'Gotowe',
      addedMessage: 'LBK Launcher został dodany do Twojej biblioteki Steam.',
      failedTitle: 'Nie udało się dodać do Steam',
      errorTitle: 'Wystąpił błąd',
      errorMessage: 'Spróbuj ponownie później.',
    },
    unexpectedError: 'Wystąpił nieoczekiwany błąd.',
    clearCache: {
      title: 'Wyczyść pamięć podręczną',
      description: 'Usuń pliki tymczasowe (zachowuje ustawienia)',
      confirmMessage:
        'Pliki tymczasowe i baza danych zostaną usunięte. Ustawienia zostaną zachowane. Aplikacja uruchomi się ponownie.',
      confirmAction: 'Wyczyść',
    },
    clearAll: {
      title: 'Wyczyść wszystkie dane',
      description: 'Usuń ustawienia, subskrypcje i wszystkie dane',
      confirmMessage:
        'Wszystkie dane, w tym ustawienia i subskrypcje, zostaną usunięte. Aplikacja uruchomi się ponownie.',
      confirmAction: 'Usuń wszystko',
    },
    dev: {
      title: 'Ustawienia deweloperskie',
      notificationSounds: 'Dźwięki powiadomień:',
      soundStatus: 'Status',
      soundVersion: 'Wersja',
      soundApp: 'Aplikacja',
      soundProgress: 'Postęp',
      soundNewGame: 'Nowa gra',
      soundTeam: 'Zespół',
      uiSounds: 'Dźwięki interfejsu:',
      navigate: 'Nawigacja',
      confirm: 'Potwierdź',
      back: 'Wstecz',
      promoMode: 'Tryb wyświetlania banera promocyjnego:',
      promoNormal: 'Normalny (24 godziny + pole wyboru)',
      promoAlways: 'Zawsze pokazuj',
      promoNever: 'Nigdy nie pokazuj',
      promoPlaceholder: 'Wybierz tryb',
    },
    logs: {
      title: 'Logi',
      description: 'Wyświetl lub wyślij pliki logów',
      open: 'Otwórz folder',
      send: 'Wyślij plik',
    },
    unlock: {
      title: 'Odblokuj ukrytą lokalizację',
      placeholder: 'Kod lokalizacji',
      action: 'Odblokuj',
    },
    changelog: {
      title: 'Co nowego',
      description: 'Historia aktualizacji · v{{version}}',
    },
    legal: { terms: 'Warunki korzystania', privacy: 'Polityka prywatności' },
    credits: {
      title: 'Podziękowania',
      description:
        'Specjalne podziękowania dla tłumaczy, którzy pomagają testować launcher od samego początku i nadal kształtują go takim, jaki jest dziś:',
    },
    bridgeCard: {
      title: 'Integracja ze Steam',
      steamElevated:
        'Steam działa jako administrator, więc launcher nie może go uruchomić ponownie.',
      restart: 'Uruchom Steam ponownie',
      recheck: 'Sprawdź ponownie',
    },
  },
  shareModal: {
    title: 'Udostępnij',
    text: 'Zainstaluj ukraińską lokalizację gry {{game}} od {{team}} łatwo z LBK Launcher',
    shareIn: 'Udostępnij w:',
    copyHint: 'Lub skopiuj link albo tekst:',
    copyText: 'Kopiuj tekst',
    copied: 'Skopiowano!',
  },
  sidebarNav: {
    guides: 'Otwórz poradniki i narzędzia',
    donators: 'Otwórz stronę wspierających',
    ratings: 'Otwórz ranking',
    news: 'Otwórz wiadomości',
    home: 'Otwórz stronę główną',
    uiSoundsOff: 'Wyłącz dźwięki interfejsu',
    uiSoundsOn: 'Włącz dźwięki interfejsu',
    notifications: 'Powiadomienia',
    settings: 'Ustawienia',
  },
  specialTranslators: {
    earlySupporter: 'Pomaga rozwijać LBK Launcher od samego początku',
    launcherTeam: 'Zespół launchera',
  },
  statusBadge: { unknown: 'Nieznany' },
  steamActionErrors: {
    steamNotRunning: 'Steam nie jest uruchomiony. Uruchom Steam i spróbuj ponownie.',
    cefUnavailable:
      'Włącz „Natychmiast stosuj opcje uruchamiania Steam” i uruchom Steam ponownie, aby launcher mógł {{purpose}}.',
    cefBlocked:
      'Steam nie otworzył połączenia dla launchera, nawet po ponownym uruchomieniu. Aby launcher mógł {{purpose}}, sprawdź, czy połączenia nie blokuje inny mod do Steam, a następnie wybierz „Sprawdź ponownie” w ustawieniach.',
    millenniumPluginPending:
      'Millennium zamyka połączenie, którego launcher używa do komunikacji ze Steam. LBK Bridge zostanie włączony przy następnym zamknięciu Steam, dzięki czemu launcher będzie mógł {{purpose}}. Możesz też włączyć go teraz w ustawieniach Millennium (Plugins).',
    millenniumOutdated:
      'Twoja wersja Millennium jest przestarzała. Zaktualizuj do Millennium 3, aby launcher mógł {{purpose}}.',
    libraryUnavailable:
      'Twoja biblioteka Steam wciąż się ładuje. Spróbuj ponownie za kilka sekund.',
    noTranslatedGames:
      'W katalogu nie ma lokalizacji dla gier ze Steam. Jeśli katalog wciąż się synchronizuje, spróbuj ponownie za minutę.',
    noMatches: 'Żadna z gier w Twojej bibliotece Steam nie ma dostępnej lokalizacji.',
    failed: 'Spróbuj ponownie później.',
  },
  steamActionPurposes: {
    manageCollections: 'zarządzać kolekcjami',
    addShortcut: 'dodać skrót do biblioteki',
  },
  steamCollection: { name: 'Z ukraińskimi lokalizacjami' },
  steamRestart: {
    steamNotStarted: 'Steam nie uruchomił się',
    failed: 'Nie udało się uruchomić Steam ponownie',
    progressTitle: 'Ponowne uruchamianie Steam',
    progressMessage:
      'Launcher zamyka i ponownie uruchamia Steam. Może to potrwać do dwóch minut.',
    unknownError: 'Nieznany błąd',
    failedTitle: 'Steam nie został uruchomiony ponownie',
    restartedTitle: 'Steam uruchomiony ponownie',
  },
  steamRestartFailure: {
    'launch-failed':
      'Steam został zamknięty, ale nie udało się go ponownie uruchomić. Uruchom Steam ręcznie.',
    'access-denied': {
      launchOptions:
        'Steam działa jako administrator, więc launcher nie może go uruchomić ponownie. Zamknij Steam ręcznie; opcje uruchamiania zostaną zastosowane automatycznie.',
      plain:
        'Steam działa jako administrator, więc launcher nie może go uruchomić ponownie. Uruchom Steam ponownie ręcznie.',
    },
    gamescope: {
      launchOptions:
        'Launcher nie uruchamia ponownie Steam w trybie gamingowym. Opcje uruchamiania zostaną zastosowane po zamknięciu Steam, na przykład przy przełączeniu na tryb pulpitu.',
      plain:
        'Launcher nie uruchamia ponownie Steam w trybie gamingowym. Zrób to samodzielnie, na przykład przełączając się na tryb pulpitu.',
    },
    'game-running': {
      launchOptions:
        'Zamknij grę, aby uruchomić Steam ponownie. Opcje uruchamiania zostaną zastosowane po zamknięciu Steam.',
      plain: 'Zamknij grę, aby uruchomić Steam ponownie.',
    },
    timeout: {
      launchOptions:
        'Steam nie zamknął się na czas. Zamknij go ręcznie; opcje uruchamiania zostaną zastosowane automatycznie.',
      plain: 'Steam nie zamknął się na czas. Uruchom go ponownie ręcznie.',
    },
    'unknown-state': {
      launchOptions:
        'Nie udało się sprawdzić, czy Steam jest uruchomiony, więc launcher nie uruchamia go ponownie. Zamknij Steam ręcznie; opcje uruchamiania zostaną zastosowane automatycznie.',
      plain:
        'Nie udało się sprawdzić, czy Steam jest uruchomiony, więc launcher nie uruchamia go ponownie. Uruchom Steam ponownie ręcznie.',
    },
    generic: 'Nie udało się uruchomić Steam ponownie.',
  },
  steamRestartPrompt: {
    title: 'Uruchom Steam ponownie',
    message:
      'Steam musi zostać uruchomiony ponownie, aby zmiany zaczęły działać. Możesz to zrobić później; Twoje ustawienia są już zapisane.',
    restartAction: 'Uruchom Steam ponownie',
  },
  storeSale: {
    discount: 'Zniżka {{percent}}% w {{store}}',
  },
  teamSubscribe: {
    subscribedTitle: 'Obserwujesz aktualizacje od „{{team}}”',
    followTitle_single: 'Obserwuj twórcę „{{team}}”',
    followTitle_multiple: 'Obserwuj twórców „{{team}}”',
    follow_team: 'Obserwuj {{team}}',
    follow_single: 'Obserwuj twórcę',
    follow_multiple: 'Obserwuj twórców',
    unfollow_team: 'Przestań obserwować {{team}}',
    unfollow_single: 'Przestań obserwować twórcę',
    unfollow_multiple: 'Przestań obserwować twórców',
  },
  termsOfService: {
    title: 'Warunki korzystania',
    subtitle: 'Warunki korzystania',
    intro:
      'Niniejsze Warunki regulują korzystanie ze strony <site>lbklauncher.com</site> i aplikacji komputerowej <b>LBK Launcher</b>.',
    parties:
      '<b>Strony:</b> LBK Team (GameGlobe Localization i Little Bit) oraz użytkownik („Ty”), który korzysta z produktów LBK Team: strony internetowej i aplikacji komputerowej (launchera).',
    lastUpdated: 'Zaktualizowano: 22 października 2026',
    sections: {
      definitions: {
        title: 'Definicje i kluczowe pojęcia',
        country:
          '<b>Kraj:</b> kraj, w którym siedzibę mają LBK Team lub jego właściciele/założyciele; w tym przypadku Ukraina.',
        service:
          '<b>Usługa:</b> strona internetowa i aplikacja LBK Launcher udostępniane przez GameGlobe Localization (ul. Metalistiv 4, Kijów, 02000) i Little Bit na podstawie niniejszych Warunków.',
        website:
          '<b>Strona:</b> strona internetowa GameGlobe Localization dostępna pod adresem <site>https://ggloc.org/</site>.',
        you: '<b>Ty:</b> osoba fizyczna lub prawna korzystająca z Usługi.',
      },
      licensing: {
        title: 'Licencjonowanie i własność intelektualna',
        frontend:
          '<b>Klient:</b> kod źródłowy interfejsu graficznego i klienta jest otwarty i rozpowszechniany na licencji <b>GNU GPL v3</b>. Możesz go modyfikować i rozpowszechniać na warunkach tej licencji.',
        backend:
          '<b>Serwer i API:</b> kod serwera, bazy danych i logika API są wyłączną własnością intelektualną <b>LBK Team</b>. Nieautoryzowany dostęp, automatyczne zbieranie danych, inżynieria wsteczna protokołów serwera i ingerencja w infrastrukturę są <b>surowo zabronione</b>.',
        content:
          '<b>Treści (lokalizacje):</b> wszystkie lokalizacje dostępne w launcherze są udostępniane użytkownikom końcowym wyłącznie do prywatnego, niekomercyjnego użytku. Nie wolno odsprzedawać tych plików ani używać ich w produktach komercyjnych bez zgody właścicieli praw.',
      },
      liability: {
        title: 'Ograniczenie odpowiedzialności',
        text: 'Oprogramowanie jest dostarczane „takie, jakie jest”. LBK Team nie odpowiada za konflikty z systemami ochrony gier, awarie techniczne ani utratę postępów w grze spowodowaną instalacją lokalizacji.',
        risk: 'KORZYSTASZ Z LAUNCHERA NA WŁASNE RYZYKO. NIE GWARANTUJEMY, ŻE NIE ZOSTANIESZ ZBANOWANY W GRACH ONLINE.',
      },
      contacts: {
        title: 'Skontaktuj się z nami',
        intro: 'Jeśli masz pytania, napisz do nas:',
      },
    },
  },
  titleBar: { offlineSuffix: ' · offline' },
  translationAwards: {
    mostAnticipated2026:
      'Najbardziej wyczekiwana przez społeczność lokalizacja 2026 roku',
    bestText2025: 'Najlepsze tłumaczenie tekstu 2025 roku według społeczności',
  },
  translationPicker: { title: 'Wybierz lokalizację', unknownAuthor: 'Nieznany twórca' },
  translationProgress: {
    translation: 'Tłumaczenie',
    editing: 'Redakcja',
    voice: 'Dubbing',
    textures: 'Tekstury',
    fonts: 'Czcionki',
  },
  translationStatusCard: { title: 'Postęp lokalizacji', inProgress: 'W toku' },
  translationStatusIcons: {
    updateAvailable: 'Dostępna aktualizacja lokalizacji',
    upToDate: 'Lokalizacja jest aktualna',
    availableToInstall: 'Lokalizacja dostępna do instalacji',
    aiEdited: 'AI + redakcja przez człowieka',
    aiOnly: 'Tłumaczenie AI',
    favorite: 'W ulubionych',
  },
  tray: { open: 'Otwórz', quit: 'Zakończ' },
  uninstall: {
    title: 'Odinstaluj ukraińską lokalizację',
    message:
      'Czy na pewno chcesz odinstalować ukraińską lokalizację „{{name}}”?\n\n{{backupWarning}}',
    noBackupWarning:
      'UWAGA: podczas instalacji nie utworzono kopii zapasowej. Oryginalne pliki NIE zostaną przywrócone!',
    backupWarning: 'Oryginalne pliki gry zostaną przywrócone z kopii zapasowej.',
    confirm: 'Odinstaluj',
    doneTitle: 'Ukraińska lokalizacja odinstalowana',
    doneMessage: 'Ukraińska lokalizacja „{{name}}” została odinstalowana',
    notInstalled: 'Ukraińska lokalizacja nie jest zainstalowana',
    failed: 'Nie udało się odinstalować: {{error}}',
    removeComponentsFailed: 'Nie udało się usunąć komponentów: {{error}}',
  },
  updateNotice: {
    downloaded: 'Aktualizacja została pobrana i jest gotowa do instalacji',
    versionAvailable: 'Wersja {{version}} jest dostępna do pobrania',
    newVersionAvailable: 'Nowa wersja jest dostępna do pobrania',
    downloading: 'Pobieranie...',
    openDownloadPage: 'Pobierz nową wersję',
    restart: 'Uruchom ponownie',
    download: 'Pobierz',
    later: 'Później',
    readyTitle: 'Aktualizacja gotowa!',
    availableTitle: 'Dostępna aktualizacja',
  },
  workshopButton: {
    tombstoned: 'Ta lokalizacja nie jest już dostępna w katalogu',
    offline: 'Brak połączenia z internetem',
    gameNotInstalled: 'Gra nie jest zainstalowana na tym urządzeniu',
    progressInSteam: 'Postęp jest widoczny w kliencie Steam',
    install: 'Zainstaluj ze Steam',
    openPageTitle: 'Otwórz stronę warsztatu',
    openPage: 'Warsztat',
    unsubscribeTitle: 'Zrezygnuj z subskrypcji w Steam',
  },
  privacyPolicy: {
    title: 'Polityka prywatności',
    updated: 'Zaktualizowano: 9 listopada 2026',
    intro:
      'LBK Launcher to usługa do wyszukiwania, instalowania i aktualizowania ukraińskich lokalizacji.',
    openSource:
      'Strona internetowa i aplikacja mają otwarty kod. Ta polityka opisuje dane przetwarzane lokalnie, wysyłane do infrastruktury LBK lub udostępniane usługom zewnętrznym.',
    sections: {
      controller: {
        title: '1. Kto przetwarza Twoje dane',
        responsible:
          'Za przetwarzanie danych odpowiada <b>LBK Team, w skład którego wchodzą GameGlobe Localization i Little Bit</b>.',
        contactsIntro: 'W sprawach prywatności skontaktuj się z nami:',
        email: 'e-mailem na adres <mail>pr@gameglobe-localisation.com</mail>',
        telegram: 'lub przez <tg>bota wsparcia na Telegramie</tg>',
      },
      categories: {
        title: '2. Kategorie przetwarzanych danych',
        intro:
          'LBK rozróżnia operacje na danych potrzebne do działania usługi oraz kategorie analityki.',
        essentialTitle: 'Podstawowe funkcje LBK',
        essentialText:
          'Te operacje są potrzebne do funkcji, z których korzystasz: pobierania, instalowania i aktualizowania lokalizacji, ochrony usługi przed nadużyciami oraz zarządzania kontami tłumaczy.',
        essentialListIntro: 'Należą do nich:',
        essential1: 'udostępnianie wymaganego archiwum lokalizacji;',
        essential2: 'instalowanie, aktualizowanie i lokalne usuwanie lokalizacji;',
        essential3: 'przechowywanie Twojej subskrypcji lokalizacji;',
        essential4:
          'ochrona usługi przed nadużyciami i egzekwowanie technicznych limitów pobierania;',
        essential5: 'konta tłumaczy, zespołów i moderatorów.',
        improveTitle: 'Pomoc w ulepszaniu LBK',
        improveText:
          'Analityka produktu pomaga nam zrozumieć, jak korzystasz z aplikacji i jak łatwo jest znaleźć i zainstalować lokalizacje.',
        improveListIntro: 'Obejmuje to:',
        improve1: 'rozpoczęcie i zakończenie sesji aplikacji;',
        improve2: 'to, czy zainstalowano lokalizację podczas pierwszej sesji aplikacji;',
        improve3: 'analitykę produktu Mixpanel;',
        improve4: 'wyświetlenia i kliknięcia banerów informacyjnych w aplikacji.',
        developTitle: 'Pomoc w rozwoju ukraińskich lokalizacji',
        developText:
          'Analityka zapotrzebowania na lokalizacje i korzystania z nich pomaga nam zrozumieć, jakich tłumaczeń chcą gracze i jak używają istniejących lokalizacji.',
        developListIntro: 'Obejmuje to:',
        develop1: 'kliknięcia przycisku Wesprzyj;',
        develop2:
          'wyszukiwania bez wyników, aby ustalić, jakich tłumaczeń szukają gracze;',
        develop3: 'zdarzenia odinstalowania lokalizacji, aby ocenić korzystanie z nich;',
        develop4:
          'czas spędzony w grach z zainstalowanymi lokalizacjami, do materiałów promocyjnych na stronie („Czas gry z naszym launcherem”) i w społeczności.',
        diagnosticsTitle: 'Diagnostyka i raporty o błędach',
        diagnosticsText:
          'Automatyczne raporty pomagają nam znajdować i naprawiać błędy oraz awarie aplikacji. Opinie, zrzuty ekranu i logi są wysyłane oddzielnie, wyłącznie na wyraźne żądanie użytkownika.',
        optOut:
          'Analityka produktu, analityka rozwoju lokalizacji i automatyczna diagnostyka nie są wymagane do instalowania ani aktualizowania lokalizacji. Każdą kategorię możesz wyłączyć osobno w ustawieniach aplikacji. Nie ogranicza to podstawowych funkcji launchera.',
        publicTitle: 'Publiczne i partnerskie wykorzystanie statystyk',
        publicText:
          'Zagregowane dane mogą być wykorzystywane w statystykach publicznych, materiałach promocyjnych i prezentacjach dla partnerów bez MachineID ani innych identyfikatorów pojedynczych instalacji.',
        noTracking:
          'Aplikacja i strona nie korzystają z sieci reklamowych, pikseli śledzących, nagrywania sesji ani identyfikacji urządzenia/przeglądarki do śledzenia. Nie sprzedajemy danych osobowych ani nie udostępniamy ich pośrednikom danych.',
      },
      localOnly: {
        title: '3. Dane przetwarzane wyłącznie na Twoim urządzeniu',
        intro:
          'Niektóre funkcje działają na Twoim urządzeniu bez wysyłania ich zawartości na serwery LBK.',
        gameDetection:
          '<b>Wyszukiwanie zainstalowanych gier.</b> Aplikacja odczytuje pliki usługowe Steam, Epic Games, GOG, EA, Xbox, Ubisoft Connect, Rockstar, Heroic i Lutris, aby rozpoznać zainstalowane gry i ich lokalizację. W systemie Windows aplikacja może też wykrywać te platformy po wpisach w rejestrze systemowym.',
        platformAccounts:
          '<b>Dane kont platform gamingowych.</b> Z danych profilu Steam aplikacja odczytuje tylko identyfikator liczbowy potrzebny do dopasowania Twojej biblioteki gier do katalogu lokalizacji. Nie odczytuje loginu, pseudonimu, listy znajomych, historii zakupów, danych płatniczych ani wiadomości, nawet jeśli znajdują się w tym samym pliku. Z plików usługowych innych platform gamingowych aplikacja odczytuje tylko dane potrzebne do znalezienia zainstalowanych gier i ich lokalizacji na dysku.',
        steamLibrary:
          '<b>Zmiany w bibliotece Steam.</b> Gdy aplikacja jest otwarta, monitoruje zmiany w plikach usługowych Steam, aby aktualizować lokalną listę gier. Nie odczytuje zawartości pliku z listą Twoich licencji; monitoruje tylko zmiany jego rozmiaru.',
        localDb:
          '<b>Lokalna baza danych.</b> Katalog lokalizacji, historia instalacji, ulubione i ustawienia są przechowywane w pliku bazy danych na Twoim komputerze. Wszystkie te lokalne dane możesz usunąć w ustawieniach aplikacji.',
        backups:
          '<b>Kopie zapasowe.</b> Przed zainstalowaniem lokalizacji oryginalne pliki gry mogą być lokalnie skopiowane, aby można je było później przywrócić.',
        search:
          '<b>Wyszukiwanie, filtry i kolekcje.</b> Są tworzone na podstawie lokalnej bazy danych. Nie tworzymy po stronie serwera profilu Twoich preferencji ani nie dostosowujemy katalogu do Twojego urządzenia.',
        thirdPartySync:
          '<b>Synchronizacja z aplikacją zewnętrzną.</b> To Ty inicjujesz to działanie, a informacje o zainstalowanych lokalizacjach są przekazywane lokalnie.',
        playtime:
          '<b>Lokalny odczyt czasu gry w Steam.</b> Odbywa się tylko dla gier z zainstalowanymi lokalizacjami, aby obliczać zmiany czasu gry.',
        outro:
          'Aplikacja nie robi zrzutów ekranu, nie odczytuje schowka i nie zbiera oddzielnie nazwy komputera ani nazwy konta systemu operacyjnego. Do wyszukiwania gier odczytuje tylko pliki w folderach gier i platform gamingowych. Nazwa Twojego konta może pojawić się w ścieżkach plików w logach diagnostycznych, które wysyłasz ręcznie (zob. punkt 7).',
      },
      network: {
        title: '4. Podstawowe operacje sieciowe',
        downloadTitle: 'Pobieranie lokalizacji',
        downloadIntro:
          'Aby dostarczyć właściwy plik, aplikacja wysyła do serwera co najmniej:',
        download1: 'identyfikator gry;',
        download2: 'ścieżkę/identyfikator archiwum;',
        download3: 'typ archiwum;',
        download4:
          'MachineID, techniczny identyfikator, za pomocą którego usługa odróżnia urządzenia.',
        downloadPurpose:
          'Te pola wskazują wymagany plik, pozwalają zrealizować żądanie pobrania, egzekwować limity pobrań i liczyć unikalne pobrania. W jednym żądaniu serwer udostępnia plik, sprawdza limit i zapisuje pobranie w statystykach.',
        workshopTitle: 'Otwieranie warsztatu Steam',
        workshopText:
          'Niektóre lokalizacje instaluje się przez subskrypcję w warsztacie Steam. Otwarcie jednej z nich wlicza się do ogólnych statystyk pobrań. W tym celu aplikacja wysyła identyfikator lokalizacji i MachineID. Dla każdej lokalizacji liczona jest tylko pierwsza wizyta z Twojego urządzenia.',
        subscriptionTitle: 'Subskrypcja lokalizacji',
        subscriptionText:
          'Subskrypcja tłumaczenia pozwala otrzymywać powiadomienia o nowych wersjach. Aplikacja generuje te powiadomienia na Twoim urządzeniu. Oddzielnie serwer LBK przechowuje identyfikator lokalizacji i MachineID, aby zespół tłumaczy mógł zobaczyć, ilu użytkowników czeka na aktualizacje. Ten zapis na serwerze nie jest potrzebny do generowania powiadomień. Subskrypcję możesz anulować w aplikacji w dowolnej chwili, a zapis na serwerze zostanie natychmiast usunięty.',
      },
      productAnalytics: {
        title: '5. Analityka produktu',
        intro: 'Na potrzeby analityki produktu aplikacja wysyła:',
        sessions:
          '<b>Początek i koniec sesji</b> — wersję aplikacji, czas/długość sesji, MachineID oraz informację, czy to pierwsze uruchomienie. Te dane pomagają liczyć unikalne uruchomienia i ustalać, jakie wersje aplikacji są używane;',
        firstSession:
          '<b>Informację, czy to pierwsza sesja</b> — wysyłaną wraz z żądaniem pobrania, aby ustalić, czy użytkownicy instalują lokalizację podczas pierwszej sesji aplikacji;',
        mixpanel:
          '<b>Zdarzenia interfejsu Mixpanel</b> — otwieranie sekcji, korzystanie z elementów sterujących oraz instalowanie, aktualizowanie i usuwanie lokalizacji. Wraz z tymi zdarzeniami wysyłane są tytuł gry, wersja aplikacji i MachineID;',
        banners:
          '<b>Wyświetlenia i kliknięcia banerów</b> — identyfikator kampanii, typ zdarzenia i MachineID.',
      },
      localizationAnalytics: {
        title: '6. Analityka wspierająca ukraińskie lokalizacje',
        intro: 'Na potrzeby analityki rozwoju lokalizacji aplikacja wysyła:',
        support:
          '<b>Kliknięcia przycisku Wesprzyj</b> — identyfikator gry/lokalizacji i MachineID, aby zespoły mogły zobaczyć, ile osób chciało je wesprzeć;',
        emptySearch:
          '<b>Wyszukiwania bez wyników</b> — tekst wyszukiwania, źródło żądania i MachineID;',
        uninstall:
          '<b>Usunięcie lokalizacji</b> — identyfikator lokalizacji i MachineID;',
        playtime:
          '<b>Czas gry</b> — tylko dla gier z zainstalowaną lokalizacją: identyfikator gry, dodatkowy czas gry w minutach i MachineID.',
      },
      feedback: {
        title: '7. Opinie, zrzuty ekranu i logi',
        intro: 'Te dane są wysyłane wyłącznie po wyraźnym działaniu użytkownika.',
        feedbackTitle: 'Opinie o lokalizacji',
        feedbackIntro: 'Podczas wysyłania opinii mogą zostać przesłane:',
        feedback1: 'identyfikator gry;',
        feedback2: 'typ zgłoszenia;',
        feedback3: 'treść wiadomości;',
        feedback4: 'wersja aplikacji;',
        feedback5: 'system operacyjny/platforma i architektura;',
        feedback6:
          'MachineID, używany do dostarczenia odpowiedzi na Twoje konkretne zgłoszenie.',
        screenshotsTitle: 'Zrzuty ekranu',
        screenshotsText:
          'Zrzuty ekranu są dołączane tylko wtedy, gdy wyraźnie je wybierzesz. Przed przesłaniem możesz zobaczyć, który plik zostanie wysłany. Zrzut ekranu może przypadkowo zawierać dane osobowe; LBK Team nie odpowiada za jego zawartość. Zrzuty ekranu są wysyłane bez zmian: aplikacja nie kompresuje ich, nie zmienia ich rozmiaru ani nie usuwa metadanych (dodatkowych informacji zapisanych w pliku). Do jednego zgłoszenia możesz dołączyć do pięciu zrzutów ekranu.',
        logsTitle: 'Logi diagnostyczne',
        logsText:
          'Log może zawierać komunikaty techniczne, ścieżki plików (które mogą zawierać nazwę Twojego konta systemu operacyjnego), tytuły zainstalowanych gier, numeryczne identyfikatory platform i komunikaty o błędach. Aplikacja nie usuwa pojedynczych wierszy logu przed wysłaniem, ponieważ mogą być potrzebne do zdiagnozowania problemu. Logi nie są wysyłane automatycznie; wysłanie wymaga Twojego wyraźnego potwierdzenia.',
      },
      crashReports: {
        title: '8. Automatyczna diagnostyka awarii',
        text: 'Gdy wystąpi błąd, aplikacja może wysłać jego opis, ciąg wywołań prowadzący do błędu (ślad stosu), wersję aplikacji i inne informacje techniczne potrzebne do diagnozy, w tym wersję systemu operacyjnego i ostatnie działania w aplikacji przed błędem.',
        optIn:
          'Raporty o awariach są wysyłane tylko wtedy, gdy odpowiednia opcja jest włączona w ustawieniach aplikacji.',
        glitchTip:
          'Raporty korzystają z <b>GlitchTip</b>, hostowanego w infrastrukturze LBK.',
      },
      website: {
        title: '9. Dane zbierane przez stronę internetową',
        publicTitle: 'Publiczna strona internetowa',
        zaraz:
          'Publiczna strona korzysta z <b>Cloudflare Zaraz</b> do analizy wyświetleń stron i niektórych zdarzeń, w tym otwarcia katalogu, wyświetlenia strony lokalizacji i użycia wyszukiwarki.',
        emptySearch:
          'Wyszukiwania bez wyników na stronie zapisują tekst zapytania wraz z losowym identyfikatorem wygenerowanym w pamięci przeglądarki. Ten identyfikator nie jest powiązany z Twoim urządzeniem ani tożsamością.',
        videoTitle: 'Osadzone wideo',
        videoText:
          'Strony lokalizacji mogą zawierać osadzone filmy z YouTube. Gdy odtwarzacz się ładuje, Twoja przeglądarka łączy się z usługami Google/YouTube i wysyła techniczne dane połączenia.',
        releasesTitle: 'Pobieranie wydań',
        releasesText:
          'Pliki wydań mogą być pobierane z GitHub. Podczas pobierania GitHub otrzymuje standardowe techniczne dane żądania sieciowego.',
      },
      accounts: {
        title: '10. Konta tłumaczy, zespołów i moderatorów',
        intro:
          'Do instalowania lokalizacji nie potrzebujesz konta. Tłumacze, zespoły i moderatorzy korzystają z kont w panelu pod adresem https://admin.lbklauncher.com/',
        dataIntro: 'Podczas tworzenia i używania konta mogą być przetwarzane:',
        data1: 'imię;',
        data2: 'adres e-mail;',
        data3: 'dane profilu Google, jeśli zdecydujesz się zalogować przez Google;',
        data4: 'dane serwisowe potrzebne do uwierzytelniania i ról dostępu.',
        googleAnalytics:
          'Panel korzysta z Google Analytics, które zbiera informacje o wyświetleniach stron panelu i używa własnych plików cookie. Gdy kopiujesz tekst promocyjny dla Steam, panel wysyła to zdarzenie i tytuł gry do Google Analytics. Twój adres e-mail i identyfikator konta nie są wysyłane. Tę analitykę możesz wyłączyć w ustawieniach panelu.',
      },
      legalBasis: {
        title: '11. Cele i podstawy prawne przetwarzania',
        columns: {
          purpose: 'Cel',
          category: 'Kategoria',
          basis: 'Podstawa prawna',
        },
        purposes: {
          delivery: 'Udostępnianie i instalowanie lokalizacji',
          subscription: 'Przechowywanie statusu subskrypcji',
          abuse:
            'Zapobieganie nadużyciom, egzekwowanie limitów technicznych i liczenie unikalnych pobrań',
          improve:
            'Sesje aplikacji, interakcje z interfejsem, wyświetlenia i kliknięcia banerów oraz informacje o pierwszej sesji',
          develop:
            'Kliknięcia Wesprzyj, nieudane wyszukiwania, usunięcia lokalizacji i czas gry',
          diagnostics: 'Automatyczna diagnostyka',
          feedback: 'Opinie, zrzuty ekranu i logi',
          account: 'Działanie konta',
        },
        categories: {
          essential: 'Podstawowe funkcje LBK',
          improve: '„Pomoc w ulepszaniu LBK”',
          develop: '„Pomoc w rozwoju ukraińskich lokalizacji”',
          diagnostics: '„Diagnostyka i raporty o błędach”',
          userAction: 'Wyraźne działanie użytkownika',
          account: 'Podstawowe funkcje konta',
        },
        bases: {
          requestOrTerms: 'Realizacja żądania użytkownika / Warunki korzystania',
          request: 'Realizacja żądania użytkownika',
          stability:
            'Prawnie uzasadniony interes w utrzymaniu stabilności usługi i dokładności statystyk publicznych',
          legitimateInterest: 'Prawnie uzasadniony interes',
          consent: 'Zgoda użytkownika w chwili wysłania',
        },
        objection:
          'Możesz sprzeciwić się przetwarzaniu opartemu na prawnie uzasadnionym interesie. Punkt 16 wyjaśnia, jak to zrobić.',
      },
      retention: {
        title: '12. Okresy przechowywania',
        text: 'Dane przechowujemy tak długo, jak jest to konieczne do celów opisanych w tej polityce.',
        details:
          'Zapisy subskrypcji są przechowywane do momentu anulowania subskrypcji i natychmiast po tym usuwane. Dane konta są przechowywane, dopóki konto istnieje. Po usunięciu konta jego dane i przesłane pliki są natychmiast usuwane.',
      },
      recipients: {
        title: '13. Odbiorcy i infrastruktura',
        infraTitle: 'Infrastruktura LBK',
        supabase:
          '<b>Zaplecze oparte na Supabase</b> — baza danych, magazyn plików i funkcje usługowe LBK, hostowane na naszych własnych serwerach. Przechowują one po stronie serwera zapisy pobrań i subskrypcji, opinie, zrzuty ekranu, logi diagnostyczne i statystyki zbierane w infrastrukturze LBK. Usługi zewnętrzne opisano osobno poniżej.',
        glitchTip:
          '<b>GlitchTip</b> — raporty o błędach i awariach. Usługa działa na własnych serwerach LBK, gdzie te raporty są przechowywane.',
        coolify: 'Do zarządzania wdrożeniami usługi używamy Coolify.',
        externalTitle: 'Usługi zewnętrzne',
        mixpanel: '<b>Mixpanel</b> — analityka produktu aplikacji;',
        zaraz: '<b>Cloudflare Zaraz</b> — analityka publicznej strony;',
        turnstile:
          '<b>Cloudflare Turnstile</b> — ochrona przed botami w formularzach panelu administracyjnego i przy publikowaniu opinii w aplikacji (<turnstile>Dodatek o prywatności Turnstile</turnstile>);',
        googleAnalytics: '<b>Google Analytics</b> — analityka panelu;',
        amazonSes:
          '<b>Amazon SES</b> — dostarczanie e-maili kont i powiadomień serwisowych, wysyłanych przez useSend hostowany na własnych serwerach LBK;',
        youtube: '<b>YouTube / Google</b> — osadzone filmy;',
        steam: '<b>Steam</b> — dane potrzebne do integracji ze Steam;',
        github: '<b>GitHub</b> — dystrybucja wydań i sprawdzanie aktualizacji;',
        teamChannels:
          '<b>Wewnętrzne kanały powiadomień zespołu</b> — alerty o nowych zgłoszeniach, aby LBK Team mógł je szybko przejrzeć i odpowiedzieć.',
        partners:
          'Katalog lokalizacji jest codziennie synchronizowany z usługą partnerską. Podczas synchronizacji nie są udostępniane żadne dane graczy. Przed publikacją archiwa przesłane przez tłumaczy są skanowane pod kątem wirusów za pomocą zewnętrznej usługi MetaDefender. Do tego skanowania nie są wysyłane żadne dane graczy.',
      },
      steamFallback: {
        title:
          '14. Steam: lokalne wykrywanie biblioteki i zapasowe rozwiązanie serwerowe',
        text: 'Aplikacja zwykle rozpoznaje Twoją bibliotekę Steam na podstawie danych na Twoim urządzeniu. Jeśli te dane są niewystarczające, serwer LBK żąda listy gier przez Steam Web API, używając Twojego numerycznego identyfikatora profilu Steam i klucza dostępu LBK. Żądanie do Steam wysyła serwer LBK.',
        notStored: 'Zwrócona lista gier nie jest przechowywana na serwerze.',
      },
      location: {
        title: '15. Gdzie przetwarzane są dane',
        servers: 'Własne serwery LBK znajdują się w <b>Niemczech</b>.',
        external:
          'Niektóre usługi zewnętrzne mogą przetwarzać dane w innych krajach, w tym w Stanach Zjednoczonych. Należą do nich Cloudflare, Mixpanel, Amazon (AWS), Google/YouTube, GitHub i Steam.',
      },
      rights: {
        title: '16. Twoje prawa i zarządzanie zgodą',
        intro: 'Możesz:',
        access:
          'zapytać LBK Team, jakie dane są z Tobą powiązane, i poprosić o ich kopię;',
        rectify: 'poprawić nieprawidłowe dane;',
        erase:
          'zażądać usunięcia, gdy dane nie są już potrzebne lub muszą zostać usunięte;',
        object:
          'sprzeciwić się przetwarzaniu opartemu na prawnie uzasadnionym interesie.',
        identification:
          'Jeśli masz konto, zapisy można odnaleźć na podstawie danych konta. Bez konta do odnalezienia zanonimizowanych zdarzeń może być potrzebny Twój MachineID.',
        requests:
          'Wysyłaj żądania na adres <mail>pr@gameglobe-localisation.com</mail> lub przez <tg>bota wsparcia na Telegramie</tg>. Odpowiemy w ciągu 30 dni.',
      },
      security: {
        title: '17. Ochrona danych',
        roles:
          'Dostęp do tabel i magazynu na serwerze jest ograniczony według ról. Klucz dostępu zawarty w aplikacji i na stronie nie może odczytywać opinii, logów ani statystyk. Te dane są dostępne tylko przez serwer z odpowiednimi uprawnieniami.',
        storage:
          'Opinie, logi i zrzuty ekranu są przechowywane w prywatnym magazynie; tymczasowe linki dostępu są generowane tylko dla LBK Team.',
        passwords:
          'Platforma uwierzytelniania przechowuje hasła jako skróty, czyli wyniki przekształcenia jednokierunkowego. Kod LBK nie ma dostępu do haseł w postaci jawnej.',
        tokens:
          'Tokeny automatycznej publikacji są przechowywane wyłącznie jako skróty, z których nie można odzyskać oryginalnego tokenu.',
        secrets: 'Tokeny i sekrety nie są wysyłane do usług analitycznych.',
        encryption: 'Połączenia sieciowe strony i aplikacji korzystają z szyfrowania.',
      },
      limits: {
        title: '18. Czego LBK nie robi',
        sell: 'nie sprzedaje danych osobowych użytkowników;',
        account: 'nie wymaga konta do zwykłej instalacji lokalizacji;',
        screenshots: 'nie robi zrzutów ekranu bez działania użytkownika;',
        clipboard: 'nie odczytuje schowka;',
        machineId:
          'nie umieszcza MachineID w statystykach publicznych ani zagregowanych;',
        ads: 'nie wyświetla reklam opartych na zachowaniu;',
        fingerprinting:
          'nie używa identyfikacji przeglądarki do śledzenia ani nie rejestruje aktywności na ekranie.',
      },
      changes: {
        title: '19. Zmiany tej polityki',
        text: 'Jeśli zmienią się kategorie danych, cele, odbiorcy lub podstawy prawne przetwarzania, ta polityka i data jej aktualizacji muszą zostać zmienione przed odpowiednią zmianą funkcjonalności lub jednocześnie z nią.',
      },
      contacts: {
        title: '20. Kontakt',
      },
    },
  },
} as const satisfies Messages;
