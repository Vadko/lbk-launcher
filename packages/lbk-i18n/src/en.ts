import type { Messages } from './uk';

export const en = {
  achievementsBadge: {
    settingOffDetail:
      '“Apply Steam launch options instantly” is disabled in settings. Without it, the launcher cannot connect to LBK Bridge.',
    hidden: 'Will not appear in Steam',
    millennium: 'Will appear through Millennium',
    decky: 'Will appear through Decky Loader',
    afterRestart: 'Available after restarting Steam',
    needsMillennium: 'Requires Millennium',
    needsDeckyPlugin: 'Requires LBK Bridge for Decky Loader',
    needsDecky: 'Requires Decky Loader',
  },
  achievementsNote: {
    needsMillennium:
      'Steam does not read translated achievement names from ordinary game files. Install Millennium to see them in the Steam library, notifications and overlay. Achievements in the game’s own interface may remain in the developer’s language.',
    needsDeckyPlugin:
      'Steam does not read translated achievement names from ordinary game files. Install the LBK Bridge plugin for Decky Loader to see them in the Steam library, notifications and overlay. Achievements in the game’s own interface may remain in the developer’s language.',
    needsDecky:
      'Steam does not read translated achievement names from ordinary game files. On Steam Deck, these are displayed by the LBK Bridge plugin, which requires Decky Loader. Achievements in the game’s own interface may remain in the developer’s language.',
    settingOff:
      'Achievement translations are unavailable while Steam integration is disabled. {{detail}}',
    unsupported:
      'Achievement translations are unavailable: Steam cannot display them on this system. {{detail}}',
  },
  achievementsOption: {
    title: 'Steam achievements',
    checking: 'Checking…',
    description: 'Steam achievement translations.',
    thirdPartyAuthor: 'Achievement translations by:',
  },
  adultWarning: {
    title: 'Adult content',
    message:
      'This game contains adult content (18+). Enable adult content in settings to view it.',
    openSettings: 'Open settings',
  },
  aiTranslationBadge: { edited: 'AI + human editing', ai: 'AI translation' },
  appLoader: {
    tagline: 'Ukrainian game localizations',
    restartApp: 'Restart the app',
    status: {
      syncing: 'Syncing',
      error: 'Connection error',
      loading: 'Loading',
      ready: 'Loading',
    },
  },
  archiveDownload: {
    archiveNotFound: '{{type}} archive not found',
    fetchingUrl: 'Getting download link...',
    urlFailed: 'Could not get the download link: {{error}}',
    refreshingUrl: 'Refreshing download link...',
    verifying: 'Verifying file integrity...',
    corrupted: 'The file is corrupted. Try downloading it again.',
    completed: 'Download complete!',
  },
  authorSubscription: {
    title: 'Follow creators',
    singleAuthor: 'Localization creator',
    authorsCount_one: '{{count}} localization creator',
    authorsCount_few: '{{count}} localization creators',
    authorsCount_many: '{{count}} localization creators',
    authorsCount_other: '{{count}} localization creators',
    description_single:
      'Would you like to be notified about new localizations from this creator? You can change your subscriptions at any time.',
    description_multiple:
      'Would you like to be notified about new localizations from these creators? You can change your subscriptions at any time.',
    subscribed: 'following',
    skip: 'Skip',
    subscribe: 'Follow',
    subscribeSelected: 'Follow ({{selected}})',
  },
  authorsList: { others: 'Other creators:' },
  bridgeStatus: {
    connected: 'Connected to Steam.',
    connectedDecky: 'Connected to Steam through LBK Bridge for Decky Loader.',
    connectedMillennium: 'Connected to Steam through LBK Bridge for Millennium.',
    steamNotRunning: 'Steam is not running.',
    restartPending: 'Restart Steam once to enable instant changes.',
    cefBlocked:
      'Steam did not open a connection for the launcher, even after restarting. The launcher will not ask you to restart Steam again. Launch options will be applied after Steam closes. Another Steam mod may be blocking the connection.',
    millenniumOutdated:
      'Outdated Millennium 2.x detected. Update Millennium to version 3 so the launcher can connect through its plugin. Until then, launch options will be applied after Steam closes.',
  },
  catalogFilters: {
    title: 'Filter and sort',
    apply: 'Show results',
    activeFilters: 'Active filters',
    removeFilter: 'Remove filter',
    statusSection: 'Status',
    contentTypeSection: 'Content type',
    translationTypeSection: 'Translation type',
    librarySection: 'Library',
    authorsSection: 'Creators',
    tagsSection: 'Tags',
    searchAuthor: 'Search creators...',
    authorNotFound: 'Creator not found',
    searchTag: 'Search categories...',
    tagNotFound: 'Category not found',
  },
  changelog: {
    title: 'What’s new',
    upcoming: 'Coming in the update',
    yourVersion: 'Your version — v{{version}}',
    olderVersions: 'Previous versions ({{total}})',
    fullList: 'Full changelog on GitHub',
  },
  common: {
    cancel: 'Cancel',
    selectFolder: 'Select folder',
    error: 'Error',
    unknownError: 'Unknown error',
    installError: 'Installation error',
    uninstallError: 'Uninstallation error',
    close: 'Close',
    ok: 'Got it',
    notNow: 'Not now',
    dontOfferAgain: 'Do not ask again',
    tryAgain: 'Try again',
    checkingSystem: 'Checking system…',
    restartSteamNow: 'Restart Steam now',
    afterSteamExit: 'After Steam closes',
  },
  confirmModal: { confirm: 'Confirm' },
  crashScreen: {
    uncaughtError: 'Unhandled error',
    unhandledRejection: 'Unhandled promise rejection',
    intro: 'Sorry, a critical error occurred. Send a report to help us fix it sooner.',
    sendReport: 'Send an error report',
    messagePlaceholder: 'Describe what happened (optional)...',
    send: 'Send',
    sending: 'Sending...',
    sent: '✅ Report sent. Thank you!',
    rateLimited: 'Please wait a few minutes',
    sendFailed: 'Could not send the report. Try again later',
    networkError: 'Network error',
    reload: '1. Reload',
    reloadHint: 'Quick fix (keeps all data)',
    clearCache: '2. Clear cache',
    clearCacheHint: 'Deletes temporary files (keeps settings)',
    clearAll: '3. Clear all data ⚠️',
    clearAllHint: 'Deletes settings, subscriptions and all data',
    techInfo: 'Technical details',
    errorLabel: 'Error:',
  },
  deckyLoader: {
    offerIntro:
      'Decky Loader is a free third-party plugin loader for Steam Deck, not made by Valve. The launcher can install it together with LBK Bridge.',
    offerBenefits:
      'What it adds:\n• Translated achievements in the Steam library, notifications and overlay.',
    offerWithout:
      'What works without Decky Loader: launch options, workshop subscriptions, the “With Ukrainian patches” collection, the launcher shortcut and Steam artwork.',
    offerInstaller:
      'The launcher will download and run the official Decky Loader installer from GitHub. The installer asks for your administrator (sudo) password in its own window; the launcher cannot see it. If you have not set a password, the installer will offer a temporary one and remove it after installation.',
    offerCaveat:
      'Please note: major SteamOS updates may require you to reinstall Decky Loader.',
    repair:
      'Decky Loader is installed but not working. Its previous installation may not have finished. The launcher can run the official Decky Loader installer again.',
    gameMode:
      'The Decky Loader installer only works in Desktop Mode. Switch to it from Steam’s power menu, open the launcher and select “Install Decky Loader” again.',
    installing:
      'The Decky Loader installer is open. Enter your administrator password in the “Decky Installer” window and select “release”. If you cannot see the window, look for it on the taskbar.',
    failure: {
      'download-failed':
        'Could not download the Decky Loader installer. Check your internet connection and try again.',
      'checksum-mismatch':
        'The downloaded Decky Loader installer does not match the verified version. Installation canceled.',
      unsupported:
        'The launcher cannot install Decky Loader on this system. Follow the instructions on the Decky Loader website to install it.',
      'not-running':
        'Decky Loader is installed but did not start. Try again to reinstall it.',
      'not-installed':
        'Decky Loader was not installed. If the installer window was closed or the password was incorrect, try again.',
    },
    whatIs: 'What is Decky Loader?',
    repairAction: 'Repair Decky Loader',
    installAction: 'Install Decky Loader',
  },
  deckyPlugin: {
    waiting: 'Waiting for LBK Launcher',
    connected: 'Connected to LBK Launcher',
    viaMillennium: 'Working through Millennium',
  },
  deckySetup: {
    title: 'LBK Bridge for Decky Loader',
    waiting:
      'Confirm the installation of LBK Bridge in the Decky Loader window. If you cannot see the window, press the Steam button.',
    fallback:
      'Could not open the Decky Loader prompt. Save the plugin and install it manually: Decky → Settings → Developer → Install Plugin from ZIP.',
    done: 'LBK Bridge is installed. Achievement translations will appear in Steam.',
    saveZip: 'Save ZIP',
    saved: 'File saved: {{path}}',
    saveFailed: 'Could not save the file.',
    saveFailedWithError: 'Could not save the file: {{error}}',
    intro:
      'The plugin displays translated achievements in the Steam library, notifications and overlay. All other launcher features work without it. Decky Loader will ask you to confirm installation in Steam.',
    noDecky:
      'Decky Loader was not found. Install it first so the launcher can add LBK Bridge.',
    loaderDone: 'Decky Loader is installed.',
    pluginReady: 'LBK Bridge for Decky Loader is already installed.',
    pluginUpdate: 'An update is available for LBK Bridge for Decky.',
    updatePlugin: 'Update Decky plugin',
    installPlugin: 'Install plugin',
  },
  download: {
    paused: 'Download paused',
    pauseFailed: 'Could not pause the download',
    resuming: 'Resuming download...',
    resumeFailed: 'Could not resume the download',
    cancelled: 'Download canceled',
    retryAttempt: 'Attempt {{attempt}}/{{maxRetries}}... Check your internet connection.',
    downloading: 'Downloading Ukrainian language patch...',
    connectionLost: 'Connection lost. Check your internet connection.',
    networkRetry: 'Network error. Attempt {{attempt}}/{{maxRetries}}...',
    failedAfterRetries:
      'Could not download the file after {{maxRetries}} attempts.\n\nLast error: {{error}}\n\nCheck your internet connection and try again.',
    rangeUnsupported: 'The server does not support resuming. Restarting...',
    fileChanged: 'The file on the server has changed. The download needs to restart',
    timeout: 'Connection timed out. Check your internet connection.',
    failed: 'Download failed',
    httpError: 'Download failed: HTTP {{statusCode}} {{statusMessage}}',
    noInternet: 'No internet connection',
    connectFailed: 'Could not connect to the server. Check your internet connection.',
    connectionReset: 'Connection interrupted. Check your internet connection.',
    serverUnavailable: 'Server unavailable',
    serverUnavailableRetry: 'Server unavailable. Try again later.',
    failedCheckConnection: 'Download failed. Check your internet connection.',
    failedWithError: 'Download failed: {{error}}',
  },
  downloadLimit: {
    message: 'Download limit exceeded.\n\n{{used}}\n{{max}}\n\nTry again after {{time}}.',
    used_one: 'You have downloaded this game {{count}} time in the last 24 hours.',
    used_few: 'You have downloaded this game {{count}} times in the last 24 hours.',
    used_many: 'You have downloaded this game {{count}} times in the last 24 hours.',
    used_other: 'You have downloaded this game {{count}} times in the last 24 hours.',
    max_one: 'Limit for large games: {{count}} download per day.',
    max_few: 'Limit for large games: {{count}} downloads per day.',
    max_many: 'Limit for large games: {{count}} downloads per day.',
    max_other: 'Limit for large games: {{count}} downloads per day.',
    unknownTime: 'unknown',
  },
  downloadProgress: {
    downloadingFiles: 'Downloading files...',
    pause: 'Pause',
    resume: 'Resume',
    pauseResumeFailed: 'Could not change the download state',
    cancelFailed: 'Could not cancel the download',
    downloaded: 'Downloaded:',
    speed: 'Speed:',
    speedValue: '{{speed}}/s',
    timeLeft: 'Time remaining:',
  },
  duration: { underSecond: '< 1s' },
  favoriteToggle: { add: 'Add to favorites', remove: 'Remove from favorites' },
  feedbackModal: {
    title: 'Leave feedback',
    type: { feedback: 'Feedback', error: 'Error' },
    typeLabel: 'Type',
    descriptionLabel: 'Description',
    placeholder_feedback: 'Share your feedback and suggestions...',
    placeholder_error:
      'Describe where the error occurs and which language is selected in the game...',
    screenshotsLabel: 'Screenshots (optional)',
    dropzone: '<hl>Choose a file</hl> or drag it here',
    submit: 'Send',
    screenshotsFailed: 'Could not upload screenshots',
    screenshotFailed: 'Could not upload screenshot: {{name}}',
    rateLimit: 'Please wait a few minutes before sending another report',
    sendFailed: 'Could not send the report',
    networkError: 'Network error. Try again later',
    thanks: 'Thank you for your report!',
    sent: 'Your report has been sent to the translation creator',
  },
  filterBar: {
    filters: 'Filters',
    clearAll: 'Clear all filters',
    showInstalled: 'Show downloaded translations',
    hideInstalled: 'Hide downloaded translations',
    showFavorites: 'Show favorites',
    hideFavorites: 'Hide favorites',
    sort: 'Sort',
  },
  filterOptions: {
    status: {
      planned: 'Planned',
      'in-progress': 'Early access',
      completed: 'Complete',
      'tech-improvement': 'Technical updates in progress',
    },
    library: {
      'favorite-translations': 'Favorite Ukrainian patches',
      'installed-translations': 'Installed Ukrainian patches',
      'installed-games': 'Installed games',
      'available-in-steam': 'Available in Steam',
      'owned-gog-games': 'Available in GOG',
      'owned-epic-games': 'Available in Epic',
      'installed-xbox-games': 'Installed via Xbox app',
    },
    contentType: {
      'with-achievements': 'With translated achievements',
      'with-voice': 'With voice acting',
      'from-workshop': 'From the Steam workshop',
    },
    translationType: {
      manual: 'Human translation',
      ai: 'AI translation',
      'ai-edited': 'AI + human editing',
    },
    sort: {
      name: 'Name',
      downloads: 'Popularity',
      subscribers: 'Subscriber count',
      newest: 'Newest',
    },
  },
  fundraising: { title: 'Fundraiser', raised: 'Raised', goal: 'Goal' },
  gameActions: {
    play: 'Play',
    removedFromCatalog: 'This translation is no longer available in the catalog',
    offline: 'No internet connection',
    rerunTitle: 'Run the installer/script again',
    rerun: 'Reinstall',
    uninstallTitle: 'Uninstall Ukrainian patch',
    support: 'Support',
    feedback: 'Leave feedback',
    cancel: 'Cancel',
  },
  gameAuthors: { many: 'Localization creators', one: 'Localization creator' },
  gameCard: {
    unknownAuthor: 'Unknown creator',
    downloadedByPlayers: 'Downloaded by players',
  },
  gameHero: { share: 'Share' },
  gameLike: {
    like: 'Like',
    unlike: 'Remove like',
    needsInstall: 'Install the translation to like it',
  },
  gameInfo: {
    title: 'Details',
    award: 'Award',
    platforms: 'Platforms',
    version: 'Version',
    size: 'Size',
    voice: 'Voice acting',
    achievements: 'Achievements',
    achievementsBy: 'by {{author}}',
    subscribers: 'Subscribers',
    downloads: 'Downloads',
    downloadsUnder20: 'under 20',
    created: 'Created',
    updated: 'Updated',
  },
  gameLanguage: {
    EN: 'English',
    GB: 'British English',
    FR: 'French',
    IT: 'Italian',
    DE: 'German',
    ES: 'Spanish',
    JA: 'Japanese',
    KO: 'Korean',
    PL: 'Polish',
    CS: 'Czech',
    ZH_CN: 'Simplified Chinese',
    ZH_TW: 'Traditional Chinese',
    ZH: 'Chinese',
    PT: 'Portuguese',
    UK: 'Ukrainian',
  },
  gameLaunch: { executableNotFound: 'Could not find the game executable' },
  gameLinks: {
    title: 'Links',
    stores: 'Stores',
    other: 'Other',
    openIn: 'Open in {{store}}',
    steamGuide: 'Steam guide',
    website: 'Website',
  },
  gameList: { loadFailed: 'Could not load games' },
  gameNotice: {
    kind_installer: 'Installer',
    kind_script: 'Script',
    language: 'Select <accent>{{language}}</accent> in the game’s language settings',
  },
  gamePage: {
    tombstone:
      'This translation is no longer available in the catalog. You can uninstall it, but you will not be able to reinstall it.',
    uninstalling: 'Uninstalling Ukrainian patch and restoring original files...',
  },
  gameSearch: { placeholder: 'Search games...' },
  gameSections: {
    aboutTranslation: 'About the Ukrainian patch',
    aboutGame: 'About the game',
  },
  gameStatus: {
    planned: 'Planned',
    inProgress: 'Early access',
    completed: 'Complete',
    techImprovement: 'Technical updates in progress',
  },
  gameSubscribe: {
    subscribedTitle: 'You receive notifications about “{{game}}”',
    subscribeTitle: 'Get notifications about “{{game}}”',
    unsubscribe: 'Turn off notifications',
    subscribe: 'Get notifications',
  },
  gameVideo: {
    title: 'Video',
    watch: 'Watch video',
    trailer: 'Ukrainian localization trailer',
    play: 'Play',
  },
  gamepadHelp: {
    title: 'Controller controls',
    deckKeyboard: 'On Steam Deck, press STEAM + X to open the on-screen keyboard.',
    everywhere: {
      title: 'Everywhere',
      move: 'Move to the next item (hold to move faster)',
      press: 'Select / open',
      back: 'Go back or close the window',
      scroll: 'Smooth scrolling',
      search: 'Search games',
      home: 'Home page',
      settings: 'Settings',
      help: 'This help screen',
    },
    feed: {
      title: 'Translation feed',
      adjacent: 'Previous / next translation',
      page: 'Scroll by one screen',
      ends: 'Go to the start / end of the list',
      header: 'Top menu: search, filters, news',
      content: 'Go to page content',
      home: 'Go home from a translation page',
    },
    gamePage: {
      title: 'Translation page',
      move: 'Move to a button or card in this direction',
      scroll: 'Scroll up / down by one screen',
      adjacent: 'Previous / next translation',
      back: 'At the top of the page: return to the translation feed',
    },
    dialogs: {
      title: 'Dialogs and text fields',
      startTyping: 'On a text field: start typing',
      stopTyping: 'Finish typing; press again to close the window',
      clearSearch: 'On the search field: clear it',
      leaveList: 'In the creator or tag list: leave the list',
      scroll: 'Scroll the dialog by one screen',
    },
  },
  gamepadHints: {
    allButtons: 'All buttons',
    finishInput: 'Finish typing',
    clear: 'Clear',
    select: 'Select',
    items: 'Items',
    navigation: 'Navigate',
    scroll: 'Scroll',
    open: 'Open',
    menu: 'Menu',
    toGames: 'Back to games',
    games: 'Games',
    page: 'Page',
    search: 'Search',
    home: 'Home',
    adjacentTranslation: 'Previous / next translation',
  },
  homeSections: {
    newGames: 'New arrivals',
    newTranslations: 'New translations',
    updates: 'Updates',
    popular: 'Popular with players',
    installedGames: 'Installed games found',
    recommended: 'You might like',
    weeklyPicks: 'Picks of the week',
    viewAll: 'View all',
    noGames: 'No games found',
    back: 'Back',
  },
  install: { rateLimitTitle: 'Download limit' },
  installArchive: {
    extracting: 'Extracting files... {{percent}}%',
    extracted: 'Extraction complete',
    extractFailed: 'Could not extract archive: {{error}}',
  },
  installBackup: {
    backupFailed: 'Could not create backup: {{error}}',
    restoreFailed: 'Could not restore files: {{error}}',
  },
  installButton: {
    offline: 'No internet connection',
    planned: 'Planned',
    techImprovement: 'Technical updates in progress',
    reload: 'Download again (v{{version}})',
    update: 'Update to v{{version}}',
    install: 'Install Ukrainian patch',
  },
  installComponents: {
    removing: 'Removing components...',
    removeFailed: 'Could not remove components',
    removedTitle: 'Components removed',
    removedMessage: 'The selected components have been removed.',
  },
  installConflict: {
    title: 'Another localization is already installed',
    message:
      'Another localization is already installed in the game folder:\n\n“{{name}}”{{team}}\nVersion: {{version}}\n\nTo install a new localization, you must remove the previous one first.\n\nRemove the previous localization?',
    confirm: 'Remove and continue',
    infoNotFound: 'Could not find information about the installed localization.',
    removeFailed: 'Could not remove the previous localization.',
    unknownLocalization: 'Unknown localization',
  },
  installEmulator: {
    title: 'Select the game folder',
    message:
      'For emulators, you need to select the game folder manually.\n\nSelect the game folder now?',
  },
  installFailure: {
    network: 'Could not connect to the server.\n\nCheck your internet connection.',
    permission: 'Insufficient permissions to install.\n\nRun the app as administrator.',
    diskSpace: 'Not enough disk space.\n\nFree up some space and try again.',
    notFound: 'File or folder not found.\n\nMake sure the game is installed.',
    unknown: 'Unknown installation error.\n\nTry again.',
    copyFailed: 'Could not copy files: {{error}}',
    signing: 'Signing the application...',
  },
  installGameNotFound: {
    title: 'Game not found',
    message: '{{error}}\n\nTry selecting the game folder manually',
  },
  installIpc: {
    fileNotFound: 'File not found',
    pickFolderTitle: 'Select the game folder',
    pickFolderButton: 'Select',
    noActiveDownload: 'No active download to pause',
    noPausedDownload: 'No paused download',
  },
  installNetwork: {
    interruptedTitle: 'Connection interrupted',
    interruptedMessage:
      'Could not resume the download automatically.\n\nCheck your internet connection and try again.\nDownload progress has been saved.',
    retry: 'Try again',
    waiting:
      'Connection lost. The download will resume automatically when the connection is restored...',
    resuming: 'Resuming download...',
    offlineTitle: 'No connection',
    offlineMessage: 'Check your internet connection and try again.',
  },
  installOptions: {
    reinstallTitle: 'Manage components',
    installTitle: 'Installation options',
    reinstallIntro: 'Choose components for “{{name}}”:',
    installIntro: 'Choose installation options for the “{{name}}” Ukrainian patch:',
    platformAuto: 'Automatic ({{platform}})',
    platformManual: 'Manual selection ({{platform}})',
    platformFound: 'Found',
    platformNotFound: 'Not found (select manually)',
    platformLabel: 'Game platform',
    platformPlaceholder: 'Select a platform',
    backupTitle: 'Create a backup',
    backupDescription:
      'Save the original game files. Recommended so you can restore them later.',
    backupSize: 'Estimated size: {{size}}',
    textTitle: 'Text localization',
    installed: 'installed',
    textDescription: 'Ukrainian translation of in-game text.',
    size: 'Size: {{size}}',
    willReinstall: 'Will be reinstalled',
    willInstall: 'Will be installed',
    voiceTitle: 'Voice acting',
    unavailable: '(unavailable)',
    voiceWithText: '(included with text)',
    voiceDescription: 'Ukrainian voice acting.',
    willRemove: 'Will be removed',
    willDownload: 'Will be downloaded',
    launchOptions:
      'This translation will set custom <hl>launch options</hl> for the game in Steam.',
    totalDownload: 'Download size:',
    removeList: 'Will be removed: {{items}}',
    removeVoice: 'voice acting',
    removeAchievements: 'achievements',
    confirm: 'Install',
  },
  installPlatform: {
    linuxOnly:
      'This Ukrainian patch is only available for Linux. It cannot be installed on Windows.',
    windowsOnly:
      'This Ukrainian patch is only available for Windows. It cannot be installed on macOS.',
    unsafeCmdPath: 'the path contains characters unsafe for the command line: {{path}}',
    exitFailedOrCancelled: 'Installation failed or was canceled',
    exitCancelled: 'Installation canceled',
    exitCode: 'Installer exited with code {{code}}',
    installerOutput: '\n\nInstaller output:\n{{output}}',
    installerFileNotFound: 'installer file not found: {{path}}',
    launching: 'Starting installer...',
    protonSetup: 'Setting up and starting Proton',
    notCompleted: 'installation was not completed',
    windowsNeedsProton: 'The Windows installer ({{extensions}}) requires Proton.',
    runFailed: 'Could not start installer: {{error}}',
    uninstallerFailed: 'Could not start uninstaller: {{error}}',
    rerunFailed: 'Could not run the installer again',
  },
  installStatus: {
    installing: 'Installing Ukrainian patch...',
    updating: 'Updating Ukrainian patch...',
    offlinePaused: 'No internet connection. Download paused.',
    error: 'Installation error',
    update: 'Update available:',
    installed: 'Ukrainian patch installed:',
  },
  installSteamIntegration: {
    launchOptions: 'Setting Steam launch options...',
    artwork: 'Installing Ukrainian Steam artwork...',
  },
  installSteps: {
    licenseOnlyManual:
      'This translation can only be installed for a licensed copy of the game.\n\nManual folder selection is not allowed.',
    licenseOnlyNotFound:
      'This translation can only be installed for a licensed copy of the game.\n\nGame not found. Make sure a licensed copy is installed through an official store (Steam, GOG, Epic Games, Ubisoft Connect, EA App, etc.).',
    gameNotFound: 'Game not found\n\nCould not automatically locate the folder: {{path}}',
    pathNotSpecified: 'not specified',
    protonMissing:
      'This Ukrainian patch uses a Windows installer that requires Proton, but no Proton versions were found.\n\nInstall Proton in Steam and try again.',
    notEnoughSpace:
      'Not enough disk space.\n\nRequired: {{needed}}\nAvailable: {{available}}\n\nFree up some space and try again.',
    noArchiveForBuild:
      'No translation archive is available for the installed game build ({{build}}).\n\nThe translation is only available for: {{variants}}.',
    voiceStatus: 'Voice acting: {{message}}',
    copying: 'Copying Ukrainian patch files...',
    cleaning: 'Removing temporary files...',
    backingUp: 'Creating backup...',
    awaitingConfirm_installer: 'Waiting for permission to run the installer...',
    awaitingConfirm_script: 'Waiting for permission to run the script...',
    runDeclined_installer:
      'Installation canceled: permission to run the installer was declined.\n\nThe files have been extracted to the game folder. You can run the installer later by selecting “Reinstall”.',
    runDeclined_script:
      'Installation canceled: permission to run the script was declined.\n\nThe files have been extracted to the game folder. You can run the script later by selecting “Reinstall”.',
    macBundleUnresolved:
      'Could not determine the installation location inside the macOS app bundle (.app).\n\nThis game requires a separate macOS translation archive.',
    status: 'Achievements: {{message}}',
  },
  installSuccess: {
    updatedMessage:
      'The {{name}} Ukrainian patch has been updated to version {{version}}!',
    installedMessage: 'The {{name}} Ukrainian patch has been installed!',
    updatedTitle: 'Ukrainian patch updated',
    installedTitle: 'Ukrainian patch installed',
    pluginNextStart: 'Achievement translations will appear the next time Steam starts.',
    needsMillenniumInstallable:
      'Achievement translations have been saved. Millennium is required to display them in Steam. The launcher can install it for you.',
    needsMillennium:
      'Achievement translations have been saved. Millennium is required to display them in Steam.',
    needsDeckyPlugin:
      'Achievement translations have been saved. Install LBK Bridge for Decky Loader to display them in Steam.',
    needsDecky:
      'Achievement translations have been saved. On Steam Deck, LBK Bridge for Decky Loader displays them. The launcher can install Decky Loader for you.',
    unavailable:
      'Achievement translations have been saved, but Steam cannot display them on this system: {{reason}}',
    disabled:
      'Achievement translations have been saved. Enable “Apply Steam launch options instantly” in settings to display them in Steam.',
    launchOptionsQueued:
      'Launch options will be applied automatically when you close Steam. Keep the launcher running; you can minimize it to the tray.',
    launchOptionsError: 'Could not set launch options: {{error}}',
    ok: 'Got it',
    restartSteamNow: 'Restart Steam now',
    restartFailureTitle: 'Launch options not applied',
    restartSuccessTitle: 'Launch options applied',
    restartSuccessMessage: 'Launch options have been saved. You can start the game.',
  },
  installUnavailable: {
    title: 'Unavailable',
    message: 'Installation is only available in the desktop app',
  },
  installedGamesBanner: {
    noTranslationsTitle: 'No translations found for your games',
    noTranslationsText:
      'We found your games, but no translations are available for them yet.<br/>Install a game from our catalog. Open the filter menu to browse available translations.',
    noGamesTitle: 'We cannot find your games',
    noGamesText:
      'We could not find any installed games with available translations.<br/>Make sure you have at least one game from our catalog installed through Steam, GOG, EGS, Ubisoft Connect or EA App. You can also open the filter menu to browse games you have not installed yet.',
  },
  kuliPlacement: {
    supported: 'Translation available with support from KULI',
    beFirst: 'Be <b>among the first</b> to play in Ukrainian!',
    goToKuli: 'Visit KULI →',
  },
  launch: {
    errorTitle: 'Launch error',
    failed: 'Could not start the game',
    gameNotFound: 'Game not found on your computer',
    lutrisFailed: 'Could not start the game through Lutris',
  },
  launchOptions: {
    noAppId: 'The game has no Steam App ID',
    notConfigured: 'No launch options are set for this translation',
    gameDirUnresolved: 'Could not locate the game folder for launch options',
    writeFailed: 'Could not save launch options',
    eglWriteFailed: 'could not change the game settings in Epic Games Launcher',
    eglNeedsShell:
      'they only work through the shell Steam starts them with, and Epic Games Launcher cannot do that',
    eglQueued:
      'Launch options will be applied automatically as soon as you quit Epic Games Launcher from its tray icon (closing the window keeps it running). Keep LBK Launcher open until then; you can minimize it to the tray.',
    eglEnvUnsupported:
      'Epic Games Launcher does not pass environment variables to the game, so the translation may not work without them.',
    eglEnvOnlyFromLbk:
      'Epic Games Launcher does not pass environment variables to the game, so the translation will only work if you start the game with the “Play” button in LBK Launcher.',
  },
  millennium: {
    deckyHost:
      'Millennium is incompatible with Decky Loader, so achievement translations are displayed through LBK Bridge for Decky Loader here.',
    unsupported: {
      'flatpak-steam': 'Millennium does not support Steam installed via Flatpak.',
      'snap-steam': 'Millennium does not support Steam installed via Snap.',
      arch: 'Millennium only supports computers with an x86-64 processor.',
      'steam-rt64':
        'Millennium does not support the 64-bit Steam client beta. Leave the beta program in Steam settings (“Compatibility” / “Betas”).',
      'missing-libssl32':
        'The 32-bit OpenSSL 3 library is missing (libssl3:i386 or lib32-openssl). Install it and try again.',
      'steam-home-link':
        'The ~/.steam/steam link to the Steam folder was not found. Start Steam once and try again.',
      nixos:
        'On NixOS, install Millennium through your system configuration. The launcher will add LBK Bridge automatically.',
      'macos-too-old': 'Millennium requires macOS 13.3 or later.',
      'no-release':
        'Installing Millennium from the launcher is not yet available for this system.',
      'millennium-v2':
        'You have an old version of Millennium. Update to version 3 using the official installer. The launcher will then add LBK Bridge automatically.',
      'no-steam': 'The launcher could not find Steam on this device.',
      unknown: 'Millennium is not supported on this system.',
      noReleaseMac: 'The macOS build of Millennium is not yet available.',
    },
    failure: {
      installFailed: 'Could not install Millennium.',
      'download-failed':
        'Could not download Millennium. Check your internet connection and try again.',
      'checksum-mismatch':
        'The downloaded Millennium file is corrupted or has been tampered with. Installation canceled.',
      'extract-failed': 'Could not extract Millennium.',
      'av-blocked':
        'Your antivirus deleted or blocked Millennium files. Add the Steam folder to your antivirus exclusions and try again.',
      'not-writable':
        'The launcher cannot write to the Steam folder. Use the official installer to install Millennium.',
      conflict:
        'The Steam folder already contains files from another mod that loads in the same way as Millennium. The launcher will not change them.',
      'not-prepared': 'Download Millennium again first.',
      'script-failed': 'Could not install Millennium files.',
      'files-locked':
        'Steam files are still in use. Millennium will be installed the next time Steam closes.',
      cancelled: 'Millennium installation canceled.',
      busy: 'The launcher is already making changes to Millennium. Wait for it to finish.',
      'plugin-not-connected':
        'Millennium is installed, but LBK Bridge has not connected yet. Make sure Steam is running and select “Check again”.',
    },
    phase: {
      download: 'Downloading Millennium…',
      verify: 'Verifying files…',
      extract: 'Extracting…',
      'stop-steam': 'Closing Steam…',
      'install-files': 'Installing files…',
      'start-steam': 'Starting Steam…',
      'wait-plugin': 'Waiting for LBK Bridge to connect…',
      uninstallFiles: 'Removing Millennium files…',
    },
  },
  millenniumPending: {
    notDetected:
      'Steam did not open a connection for the launcher. Launch options will be applied after Steam closes. Another Steam mod may be blocking the connection.',
    unsupported:
      'Millennium was detected, but the launcher could not add LBK Bridge. Launch options will be applied after Steam closes.',
    enabled:
      'LBK Bridge for Millennium is enabled, but Steam has not loaded it yet. The plugin will start working the next time Steam starts.',
    disabled:
      'Millennium was detected. It closes the connection the launcher uses to communicate with Steam, so the launcher installed LBK Bridge for Millennium. The plugin will be enabled automatically when you close Steam. To enable it now, go to Millennium settings → Plugins → LBK Bridge.',
  },
  millenniumSetup: {
    title: 'Millennium and LBK Bridge',
    done: 'Millennium is installed. Steam has connected to the launcher through LBK Bridge.',
    offlineDone: 'Millennium is installed. LBK Bridge will connect when you start Steam.',
    queued:
      'Millennium will be installed when you close Steam. If the launcher is closed at that point, installation will take place the next time you open it while Steam is not running.',
    macQueued: 'Afterwards, start Steam from the launcher or through “Steam Millennium”.',
    steamNotBack:
      'Steam did not start after Millennium was installed. This version of Millennium may not support your Steam version yet.',
    envMissing:
      'Steam was not started from the launcher, so Millennium is inactive. Restart Steam from the launcher or sign out of your system and back in.',
    external:
      'Millennium is already installed. The launcher will add LBK Bridge automatically.',
    openSite: 'Open Millennium website',
    startSteam: 'Start Steam',
    uninstall: 'Uninstall Millennium',
    restartSteam: 'Restart Steam',
    recheck: 'Check again',
    restartToFinish: 'Steam needs to close and restart to finish installation.',
    install: 'Install',
    update: 'Update Millennium',
    repair: 'Repair Millennium',
    updateTitle: 'Update Millennium',
    repairTitle: 'Repair Millennium',
    updateAvailable: 'Millennium update available: {{version}}.',
    filesBroken: 'Millennium files in the Steam folder are damaged or missing.',
    restartNeeded: 'Steam will need to close and restart.',
    offer: {
      intro:
        'Millennium is a free third-party mod for the Steam client, not made by Valve. The launcher can install it together with LBK Bridge.',
      benefitsMac:
        'What it adds:\n• Translated achievements in the Steam library, notifications and overlay.',
      benefits:
        'What it adds:\n• Translated achievements in the Steam library, notifications and overlay;\n• The launcher connects to Steam without an open debugging port or requests to restart Steam.',
      withoutMillennium:
        'What works without Millennium: launch options, workshop subscriptions, the “With Ukrainian patches” collection, the launcher shortcut and Steam artwork, through Steam’s debugging port (after one Steam restart).',
      sourceMac: 'Files are downloaded from our Millennium build on GitHub.',
      source: 'Millennium files are downloaded from the project’s official GitHub page.',
      caveatWindows:
        'Please note: after Steam updates, Millennium may stop working until a compatible update is released. Your antivirus may also block its files by mistake.',
      caveat:
        'Please note: after Steam updates, Millennium may stop working until a compatible update is released.',
      linux:
        'Millennium will be installed for your user account only, without an administrator password. If you start Steam outside the launcher, Millennium will work after you sign out of your system and back in.',
      macos:
        'On macOS, the launcher installs its own build of Millennium. It only works when Steam is started through “Steam Millennium” in your user Applications folder. The launcher starts Steam this way automatically.',
      restart: 'Steam will need to close and restart for installation.',
    },
  },
  millenniumUninstall: {
    title: 'Uninstall Millennium',
    restartNeeded: 'Steam needs to close and restart to uninstall Millennium.',
    cannotRestart: 'The launcher cannot restart Steam right now. Close Steam manually.',
    confirm:
      'Millennium will be removed from the Steam folder. Its plugins and themes will remain unless you select “Also remove Millennium plugins and settings”.',
    purge: 'Also remove Millennium plugins and settings',
    action: 'Uninstall Millennium',
    queued: 'Millennium will be removed when you close Steam.',
    done: 'Millennium has been removed.',
    filesLocked:
      'Steam files are still in use. Millennium will be removed the next time Steam closes.',
    failed: 'Could not uninstall Millennium.',
    failedWithError: 'Could not uninstall Millennium: {{error}}',
    progress: 'Uninstalling Millennium…',
  },
  newsFeed: {
    title: 'News',
    tab: { sales: 'Games on sale', 'games-80': 'Games for 80', news: 'News' },
    empty: 'No news found',
    open: 'Read news',
    discuss: 'Discuss on Telegram',
  },
  notificationCenter: {
    title: 'Notifications',
    settingsTitle: 'Notification settings',
    justNow: 'Just now',
    statusChange: 'Status changed from “{{from}}” to “{{to}}”',
    versionUpdate: 'Version updated from {{from}} to {{to}}',
    appUpdate: 'A new app version is available: {{version}}',
    teamNewGame: 'New localization by <team/>',
    teamStatusChange: '<team/>: status changed to “<status/>”',
    feedbackReply: 'Reply to your feedback:',
    fallback: 'New notification',
    appUpdatesTitle: 'App updates',
    appUpdatesDescription: 'Notifications about new versions of LBK Launcher',
    gameUpdatesTitle: 'Ukrainian patch updates',
    gameUpdatesDescription:
      'Notifications about new versions of installed Ukrainian patches',
    empty: 'No notifications',
    emptyHint:
      'Subscribe to planned translations<br/>to get notified when their status changes',
    markAllRead: 'Mark all as read',
    clearAll: 'Clear all',
    clearConfirmTitle: 'Delete all notifications?',
    clearConfirmBody:
      'This cannot be undone. All notifications will be permanently deleted.',
    delete: 'Delete',
  },
  notificationMessage: {
    statusChange: 'Status changed to “{{status}}”',
    progressChange: 'Progress updated: {{progress}}',
    firstFavorite: 'Click to filter the list by favorites',
    feedbackReply: 'New reply to your feedback',
    fallback: 'New notification',
  },
  notificationToast: {
    'status-change': 'Status changed',
    'version-update': 'Update available',
    'app-update': 'App update',
    'first-favorite': 'Added to favorites',
    'progress-change': 'Progress updated',
    'feedback-reply': 'Reply to feedback',
    'team-new-game': 'Notification',
    'team-status-change': 'Notification',
  },
  notifications: {
    versionAvailable: 'Version {{version}} available',
    teamNewGame: 'New localization by {{team}}',
    teamStatusChange: '{{team}}: status changed to “{{status}}”',
    feedbackReplyTitle: 'Reply to feedback: {{game}}',
  },
  pendingLaunchOptions: {
    queued_one: 'Waiting for Steam to close: launch options for {{count}} game.',
    queued_few: 'Waiting for Steam to close: launch options for {{count}} games.',
    queued_many: 'Waiting for Steam to close: launch options for {{count}} games.',
    queued_other: 'Waiting for Steam to close: launch options for {{count}} games.',
    gameName: '“{{name}}”',
    games_one: '{{count}} game',
    games_few: '{{count}} games',
    games_many: '{{count}} games',
    games_other: '{{count}} games',
    bridgeReady: 'Steam connected to the launcher',
    steamClosed: 'Steam closed',
    appliedTitle: 'Launch options applied',
    appliedBody:
      '{{lead}} — launch options for {{target}} have been saved. You can start the game.',
  },
  platformName: {
    steam: 'Steam',
    epic: 'Epic Games Store',
    gog: 'GOG',
    rockstar: 'Rockstar Games Launcher',
    xbox: 'Xbox app',
    uplay: 'Ubisoft Connect',
    ea: 'EA App',
    emulator: 'Emulator',
    other: 'Other',
  },
  pluginEntries: {
    deckyPluginDisabled:
      'LBK Bridge is disabled in Decky Loader. Enable it in Decky settings.',
    recommend:
      'Tip: with Millennium, the launcher can also display achievement translations in Steam.',
    noDeckyCanInstall:
      'LBK Bridge for Decky Loader displays achievement translations in Steam. The launcher can install Decky Loader together with the plugin.',
    noDecky:
      'LBK Bridge for Decky Loader displays achievement translations in Steam. Install Decky Loader first.',
    deckyPlugin: 'LBK Bridge for Decky Loader displays translated achievements in Steam.',
    deckyOutdated: 'An update is available for LBK Bridge for Decky.',
    pendingActivate: 'Millennium will be installed when you close Steam.',
    pendingDeactivate: 'Millennium will be removed when you close Steam.',
    installedVersion: 'Millennium {{version}} is installed.',
    repair: 'Millennium files in the Steam folder are damaged or missing.',
    update: 'Millennium update available: {{version}}.',
    unsupported: 'Achievement translations are unavailable in Steam: {{reason}}',
    bridgeUpdate: 'The LBK Bridge update will take effect after Steam restarts.',
  },
  pluginOffer: {
    installMillennium: 'Install Millennium',
    repairMillennium: 'Repair Millennium',
    uninstallMillennium: 'Uninstall Millennium',
    millenniumInfo: 'What is Millennium?',
    millenniumSite: 'Open Millennium website',
    installDeckyLoader: 'Install Decky Loader',
    installDeckyPlugin: 'Install Decky plugin',
    updateDeckyPlugin: 'Update Decky plugin',
    deckyInfo: 'What is Decky Loader?',
    openSettings: 'Open settings',
    restartSteam: 'Restart Steam',
    updateMillennium: 'Update Millennium to {{version}}',
  },
  promoModal: {
    imageAlt: 'Support the Ukrainian launcher!',
    title: 'A little support for the launcher?',
    body: 'We’re building this launcher to make finding and downloading translations easy. We keep improving its speed and stability and adding new features.',
    everyBitCounts: 'Even a small contribution makes a difference ✨',
    dontShowAgain: 'Do not show again',
    donate: 'Donate',
  },
  runInstaller: {
    exeTitle: 'Run installer',
    scriptTitle: 'Run script',
    exeProtonMessage:
      'The Ukrainian patch has been downloaded and extracted. The Windows installer will run using your selected Proton version.\n\nThe folder path will be copied to the clipboard.',
    scriptProtonMessage:
      'The Ukrainian patch has been downloaded and extracted. The Windows script will run using your selected Proton version.\n\nThe folder path will be copied to the clipboard.',
    exeAskMessage:
      'The Ukrainian patch has been downloaded and extracted.\n\nRun the installer now?',
    scriptAskMessage:
      'The Ukrainian patch has been downloaded and extracted.\n\nRun the script now?',
    protonPlaceholder: 'Select a Proton version',
    openFolder: 'Open folder',
    run: 'Yes, run',
    skip: 'No',
    confirmMessage:
      'Once the Ukrainian patch is downloaded and extracted, its installer or script will run.\n\nContinue installation?',
    confirm: 'Continue',
    finishedTitle: 'Installer finished',
    finishedMessage: 'The installer finished successfully',
    failed: 'Could not start the installer',
  },
  selectDropdown: { placeholder: 'Select an option', empty: 'No options' },
  sendLogs: {
    titleCrash: 'Error report',
    title: 'Send logs',
    submit: 'Send logs',
    consent: 'By sending logs, you consent to the processing of your personal data.',
    crashReason: 'Error cause:',
    descriptionLabel: 'Description (optional)',
    placeholder: 'Describe what happened to help us investigate...',
    rateLimit: 'Please wait a few minutes before sending another report',
    sendFailed: 'Could not send logs',
    networkError: 'Network error. Try again later',
  },
  settings: {
    title: 'Settings',
    feedback: { title: 'Contact us', description: 'Message us on Telegram' },
    performance: {
      title: 'Performance mode',
      weakHardware:
        'Enabled: this device does not have enough resources for smooth animations, so performance mode cannot be disabled',
      description: 'Disables interface animations and blur for better performance',
    },
    liquidGlass: {
      title: 'Liquid Glass theme',
      weakHardware:
        'Disabled: this device does not have enough resources for transparency effects',
      description: 'Enable window transparency and blur (macOS 26+)',
    },
    backup: {
      title: 'Create backups',
      description: 'Save original game files before installing a Ukrainian patch',
    },
    steamCef: {
      title: 'Apply Steam launch options instantly',
      description:
        'Lets the launcher immediately change launch options, workshop subscriptions, the “With Ukrainian patches” collection and Steam artwork. Steam needs to restart once after this is first enabled. For a direct connection, the launcher uses Steam’s debugging port or the LBK Bridge plugin in Millennium or Decky Loader; LBK Bridge also displays translated achievement names. If disabled, launch options are only applied after Steam closes.',
    },
    steamArtwork: {
      title: 'Ukrainian artwork in Steam',
      description:
        'Replace the game’s banner, logo and horizontal artwork in the Steam library with Ukrainian versions from the patch. Vertical artwork stays unchanged. Original artwork is restored when you uninstall the patch or disable this setting',
    },
    adultGames: {
      title: 'Show games with pornographic content',
      description:
        'Show games with pornographic or erotic content (hentai, adult visual novels, etc.)',
    },
    aiTranslations: {
      title: 'Hide AI translations',
      description: 'Hide translations created using artificial intelligence',
    },
    recommendations: {
      title: 'Game recommendations',
      description: 'Show the “You might like” section on game pages',
    },
    notificationSounds: {
      title: 'Notification sounds',
      description: 'Play sounds for update notifications',
    },
    gamepadSounds: {
      title: 'Controller sounds',
      description: 'Play sounds when navigating with a controller',
    },
    productAnalytics: {
      title: 'Product analytics',
      description:
        'App sessions and interface interactions help us identify usability issues',
    },
    localizationAnalytics: {
      title: 'Localization development analytics',
      description:
        'Creator support, searches with no results, uninstalls and playtime help us understand which translations are needed',
    },
    crashDiagnostics: {
      title: 'Crash reports',
      description:
        'Automatic app error reports. Disabling takes effect immediately; enabling requires a restart',
    },
    collection: {
      title: '“With Ukrainian patches” Steam collection',
      description:
        'Create or update a Steam library collection of games with available translations',
      updatedTitle: 'Collection updated',
      updatedEmpty: 'The “With Ukrainian patches” collection is now empty.',
      updated_one: 'The “With Ukrainian patches” collection now contains {{count}} game.',
      updated_few:
        'The “With Ukrainian patches” collection now contains {{count}} games.',
      updated_many:
        'The “With Ukrainian patches” collection now contains {{count}} games.',
      updated_other:
        'The “With Ukrainian patches” collection now contains {{count}} games.',
      failedTitle: 'Could not update the collection',
    },
    kurin: {
      title: 'Sync with Kurin',
      description: 'Find and import installed games added through Kurin',
      failedTitle: 'Could not sync',
      doneTitle: 'Sync complete',
      synced_one: 'Synced {{count}} game: {{games}}',
      synced_few: 'Synced {{count}} games: {{games}}',
      synced_many: 'Synced {{count}} games: {{games}}',
      synced_other: 'Synced {{count}} games: {{games}}',
      none: 'No games installed through Kurin were found, or Kurin is not installed.',
    },
    lbkShortcut: {
      title: 'LBK Launcher in your Steam library',
      description: 'Add the launcher as a game in Steam',
      addedTitle: 'Done',
      addedMessage: 'LBK Launcher has been added to your Steam library.',
      failedTitle: 'Could not add to Steam',
      errorTitle: 'An error occurred',
      errorMessage: 'Try again later.',
    },
    unexpectedError: 'An unexpected error occurred.',
    clearCache: {
      title: 'Clear cache',
      description: 'Delete temporary files (keeps settings)',
      confirmMessage:
        'Temporary files and the database will be deleted. Settings will be kept. The app will restart.',
      confirmAction: 'Clear',
    },
    clearAll: {
      title: 'Clear all data',
      description: 'Delete settings, subscriptions and all data',
      confirmMessage:
        'All data, including settings and subscriptions, will be deleted. The app will restart.',
      confirmAction: 'Delete everything',
    },
    dev: {
      title: 'Developer settings',
      notificationSounds: 'Notification sounds:',
      soundStatus: 'Status',
      soundVersion: 'Version',
      soundApp: 'App',
      soundProgress: 'Progress',
      soundNewGame: 'New game',
      soundTeam: 'Team',
      gamepadSounds: 'Controller sounds:',
      navigate: 'Navigate',
      confirm: 'Confirm',
      back: 'Back',
      promoMode: 'Promo banner display mode:',
      promoNormal: 'Normal (24 hours + checkbox)',
      promoAlways: 'Always show',
      promoNever: 'Never show',
      promoPlaceholder: 'Select a mode',
    },
    logs: {
      title: 'Open logs folder',
      description: 'View saved log files',
      send: 'Send file',
    },
    unlock: {
      title: 'Unlock a hidden translation',
      placeholder: 'Translation code',
      action: 'Unlock',
    },
    changelog: { title: 'What’s new', description: 'Update history · v{{version}}' },
    legal: { terms: 'Terms of use', privacy: 'Privacy policy' },
    credits: {
      title: 'Acknowledgments',
      description:
        'Special thanks to the translators who have helped test the launcher from the start and continue to shape what it is today:',
    },
    bridgeCard: {
      steamElevated:
        'Steam is running as administrator, so the launcher cannot restart it.',
      restart: 'Restart Steam',
      recheck: 'Check again',
    },
  },
  shareModal: {
    title: 'Share',
    text: 'Install the Ukrainian localization of {{game}} by {{team}} easily with LBK Launcher',
    shareIn: 'Share on:',
    copyHint: 'Or copy the link or text:',
    copyText: 'Copy text',
    copied: 'Copied!',
  },
  sidebarNav: {
    guides: 'Open guides and tools',
    donators: 'Open supporters page',
    news: 'Open news',
    home: 'Open home page',
    gamepadSoundsOff: 'Turn off controller sounds',
    gamepadSoundsOn: 'Turn on controller sounds',
    notifications: 'Notifications',
    settings: 'Settings',
  },
  specialTranslators: {
    earlySupporter: 'Helping develop LBK Launcher from the very beginning',
    launcherTeam: 'Launcher team',
  },
  statusBadge: { unknown: 'Unknown' },
  steamActionErrors: {
    steamNotRunning: 'Steam is not running. Start Steam and try again.',
    cefUnavailable:
      'Enable “Apply Steam launch options instantly” and restart Steam so the launcher can {{purpose}}.',
    cefBlocked:
      'Steam did not open a connection for the launcher, even after restarting. To let the launcher {{purpose}}, check whether another Steam mod is blocking the connection, then select “Check again” in settings.',
    millenniumPluginPending:
      'Millennium closes the connection the launcher uses to communicate with Steam. LBK Bridge will be enabled the next time Steam closes, allowing the launcher to {{purpose}}. You can also enable it now in Millennium settings (Plugins).',
    millenniumOutdated:
      'Your Millennium version is outdated. Update to Millennium 3 so the launcher can {{purpose}}.',
    libraryUnavailable:
      'Your Steam library is still loading. Try again in a few seconds.',
    noTranslatedGames:
      'There are no translations for Steam games in the catalog. If the catalog is still syncing, try again in a minute.',
    noMatches: 'None of the games in your Steam library have an available translation.',
    failed: 'Try again later.',
  },
  steamActionPurposes: {
    manageCollections: 'manage collections',
    addShortcut: 'add a shortcut to your library',
  },
  steamCollection: { name: 'With Ukrainian patches' },
  steamRestart: {
    steamNotStarted: 'Steam did not start',
    failed: 'Could not restart Steam',
    progressTitle: 'Restarting Steam',
    progressMessage:
      'The launcher is closing and restarting Steam. This may take up to two minutes.',
    unknownError: 'Unknown error',
    failedTitle: 'Steam was not restarted',
    restartedTitle: 'Steam restarted',
  },
  steamRestartFailure: {
    launchFailed: 'Steam closed, but could not be started again. Start Steam manually.',
    accessDenied: {
      launchOptions:
        'Steam is running as administrator, so the launcher cannot restart it. Close Steam manually; launch options will be applied automatically.',
      plain:
        'Steam is running as administrator, so the launcher cannot restart it. Restart Steam manually.',
    },
    gamescope: {
      launchOptions:
        'The launcher does not restart Steam in Gaming Mode. Launch options will be applied when Steam closes, for example when switching to Desktop Mode.',
      plain:
        'The launcher does not restart Steam in Gaming Mode. Restart it yourself, for example by switching to Desktop Mode.',
    },
    gameRunning: {
      launchOptions:
        'Close the game to restart Steam. Launch options will be applied when Steam closes.',
      plain: 'Close the game to restart Steam.',
    },
    timeout: {
      launchOptions:
        'Steam did not close in time. Close it manually; launch options will be applied automatically.',
      plain: 'Steam did not close in time. Restart it manually.',
    },
    generic: 'Could not restart Steam.',
  },
  steamRestartPrompt: {
    title: 'Restart Steam',
    message:
      'Steam needs to restart for the changes to take effect. You can do this later; your settings are already saved.',
    restartAction: 'Restart Steam',
  },
  teamSubscribe: {
    subscribedTitle: 'You follow updates from “{{team}}”',
    followTitle_single: 'Follow creator “{{team}}”',
    followTitle_multiple: 'Follow creators “{{team}}”',
    follow_team: 'Follow {{team}}',
    follow_single: 'Follow creator',
    follow_multiple: 'Follow creators',
    unfollow_team: 'Unfollow {{team}}',
    unfollow_single: 'Unfollow creator',
    unfollow_multiple: 'Unfollow creators',
  },
  termsOfService: {
    title: 'Terms of use',
    subtitle: 'Terms of use',
    intro:
      'These Terms govern the use of <site>lbklauncher.com</site> and the <b>LBK Launcher</b> desktop client.',
    parties:
      "<b>Parties:</b> LBK Team (GameGlobe Localization and Little Bit) and the user (“you”) who uses LBK Team's products: the website and desktop client (launcher).",
    lastUpdated: 'Updated: 22 October 2026',
    sections: {
      definitions: {
        title: 'Definitions and key terms',
        country:
          '<b>Country:</b> the country where LBK Team or its owners/founders are based; in this case, Ukraine.',
        service:
          '<b>Service:</b> the LBK Launcher website and application provided by GameGlobe Localization (4 Metalistiv Street, Kyiv, 02000) and Little Bit under these Terms.',
        website:
          '<b>Website:</b> the GameGlobe Localization website available at <site>https://ggloc.org/</site>.',
        you: '<b>You:</b> the individual or legal entity using the Service.',
      },
      licensing: {
        title: 'Licensing and intellectual property',
        frontend:
          '<b>Client:</b> the source code of the graphical interface and client is open source and distributed under <b>GNU GPL v3</b>. You may modify and distribute it under the terms of that license.',
        backend:
          '<b>Server and API:</b> server code, databases and API logic are the exclusive intellectual property of <b>LBK Team</b>. Unauthorized access, automated data collection, reverse engineering of server protocols and interference with the infrastructure are <b>strictly prohibited</b>.',
        content:
          "<b>Content (translations):</b> all localizations available in the launcher are provided to end users solely for private, non-commercial use. You may not resell these files or use them in commercial products without the rights holders' permission.",
      },
      liability: {
        title: 'Limitation of liability',
        text: 'The software is provided “as is”. LBK Team is not liable for conflicts with game protection systems, technical failures or loss of game progress caused by installing translations.',
        risk: 'YOU USE THE LAUNCHER AT YOUR OWN RISK. WE DO NOT GUARANTEE THAT YOU WILL NOT BE BANNED FROM ONLINE GAMES.',
      },
      contacts: {
        title: 'Contact us',
        intro: 'If you have any questions, contact us:',
      },
    },
  },
  titleBar: { offlineSuffix: ' · offline' },
  translationAwards: {
    mostAnticipated2026: 'Community’s most anticipated translation of 2026',
    bestText2025: 'Community’s best text translation of 2025',
  },
  translationPicker: { title: 'Choose a translation', unknownAuthor: 'Unknown creator' },
  translationProgress: {
    translation: 'Translation',
    editing: 'Editing',
    voice: 'Voice acting',
    textures: 'Textures',
    fonts: 'Fonts',
  },
  translationStatusCard: { title: 'Translation progress', inProgress: 'In progress' },
  translationStatusIcons: {
    updateAvailable: 'Translation update available',
    upToDate: 'Translation is up to date',
    availableToInstall: 'Translation available to install',
    aiEdited: 'AI + human editing',
    aiOnly: 'AI translation',
    favorite: 'In favorites',
  },
  tray: { open: 'Open', quit: 'Quit' },
  uninstall: {
    title: 'Uninstall Ukrainian patch',
    message:
      'Are you sure you want to uninstall the Ukrainian patch for “{{name}}”?\n\n{{backupWarning}}',
    noBackupWarning:
      'WARNING: No backup was created during installation. Original files will NOT be restored!',
    backupWarning: 'Original game files will be restored from the backup.',
    confirm: 'Uninstall',
    doneTitle: 'Ukrainian patch uninstalled',
    doneMessage: 'The “{{name}}” Ukrainian patch has been uninstalled!',
    notInstalled: 'Ukrainian patch is not installed',
    failed: 'Uninstallation failed: {{error}}',
    removeComponentsFailed: 'Could not remove components: {{error}}',
  },
  updateNotice: {
    downloaded: 'The update is downloaded and ready to install',
    versionAvailable: 'Version {{version}} is available to download',
    newVersionAvailable: 'A new version is available to download',
    downloading: 'Downloading...',
    openDownloadPage: 'Download new version',
    restart: 'Restart',
    download: 'Download',
    later: 'Later',
    readyTitle: 'Update ready!',
    availableTitle: 'Update available',
  },
  workshopButton: {
    tombstoned: 'This translation is no longer available in the catalog',
    offline: 'No internet connection',
    gameNotInstalled: 'The game is not installed on this device',
    progressInSteam: 'Progress is shown in the Steam client',
    install: 'Install from Steam',
    openPageTitle: 'Open workshop page',
    openPage: 'Workshop',
    unsubscribeTitle: 'Unsubscribe in Steam',
  },
  privacyPolicy: {
    title: 'Privacy policy',
    updated: 'Updated: 22 October 2026',
    intro:
      'LBK Launcher is a service for finding, installing and updating Ukrainian localizations.',
    openSource:
      'The website and app are open source. This policy describes data processed locally, sent to LBK infrastructure or shared with external services.',
    sections: {
      controller: {
        title: '1. Who processes your data',
        responsible:
          '<b>LBK Team, comprising GameGlobe Localization and Little Bit</b>, is responsible for data processing.',
        contactsIntro: 'For privacy questions, contact us:',
        email: 'by email at <mail>pr@gameglobe-localisation.com</mail>',
        telegram: 'or through the <tg>Telegram support bot</tg>',
      },
      categories: {
        title: '2. Categories of data processed',
        intro:
          'LBK distinguishes between data operations needed to run the service and analytics categories.',
        essentialTitle: 'Essential LBK functions',
        essentialText:
          'These operations are needed for the features you use: downloading, installing and updating localizations, protecting the service from abuse and managing translator accounts.',
        essentialListIntro: 'These include:',
        essential1: 'providing the required localization archive;',
        essential2: 'installing, updating and locally removing a localization;',
        essential3: 'storing your localization subscription;',
        essential4:
          'protecting the service from abuse and enforcing technical download limits;',
        essential5: 'accounts for translators, teams and moderators.',
        improveTitle: 'Helping improve LBK',
        improveText:
          'Product analytics help us understand how you use the app and how easy it is to find and install localizations.',
        improveListIntro: 'This includes:',
        improve1: 'starting and ending an app session;',
        improve2: 'whether you installed a localization during your first app session;',
        improve3: 'Mixpanel product analytics;',
        improve4: 'views and clicks on informational banners in the app.',
        developTitle: 'Helping Ukrainian localizations grow',
        developText:
          'Analytics about localization demand and usage help us understand which translations players want and how they use existing localizations.',
        developListIntro: 'This includes:',
        develop1: 'clicks on the Support button;',
        develop2:
          'searches with no results, to identify translations players are looking for;',
        develop3: 'localization uninstall events, to help assess usage;',
        develop4:
          'time spent in games with installed localizations, for promotional materials on the website (“Time spent playing with our launcher”) and in the community.',
        diagnosticsTitle: 'Diagnostics and error reports',
        diagnosticsText:
          'Automatic reports help us find and fix app errors and crashes. Feedback, screenshots and logs are sent separately by an explicit user action.',
        optOut:
          "Product analytics, localization development analytics and automatic diagnostics are not required to install or update localizations. You can disable each category separately in the app settings. Doing so does not restrict the launcher's core features.",
        publicTitle: 'Public and partner use of statistics',
        publicText:
          'Aggregated figures may be used in public statistics, promotional materials and partner presentations without MachineID or other identifiers of individual installations.',
        noTracking:
          'The app and website do not use advertising networks, tracking pixels, session recording or device/browser fingerprinting. We do not sell personal data or share it with data brokers.',
      },
      localOnly: {
        title: '3. Data processed only on your device',
        intro:
          'Some features work on your device without sending their contents to LBK servers.',
        gameDetection:
          '<b>Finding installed games.</b> The app reads service files from Steam, Epic Games, GOG, EA, Xbox, Ubisoft Connect, Rockstar, Heroic and Lutris to identify installed games and their locations. On Windows, the app may also detect these platforms through their system registry entries.',
        platformAccounts:
          "<b>Gaming platform account data.</b> From your Steam profile data, the app reads only the numeric identifier needed to match your game library with the localization catalog. It does not read your login, nickname, friends list, purchase history, payment details or messages, even if they are in the same file. From other gaming platforms' service files, the app reads only the data needed to find installed games and their locations on disk.",
        steamLibrary:
          '<b>Steam library changes.</b> While open, the app monitors changes to Steam service files to update the local game list. It does not read the contents of the file listing your licenses; it only monitors changes to its size.',
        localDb:
          '<b>Local database.</b> The translation catalog, installation history, favorites and settings are stored in a database file on your computer. You can delete all this local data in the app settings.',
        backups:
          '<b>Backups.</b> Before installing a localization, original game files may be copied locally so they can be restored later.',
        search:
          '<b>Search, filters and collections.</b> These are built from the local database. We do not create a server-side profile of your preferences or tailor the catalog to your device.',
        thirdPartySync:
          '<b>Synchronization with a third-party app.</b> You initiate this action, and information about installed localizations is transferred locally.',
        playtime:
          '<b>Reading Steam playtime locally.</b> This happens only for games with installed localizations, to calculate changes in time played.',
        outro:
          'The app does not take screenshots, read the clipboard or separately collect your computer name or operating system account name. To find games, it reads only files in game and gaming platform folders. Your account name may appear in file paths in diagnostic logs you send manually (see section 7).',
      },
      network: {
        title: '4. Essential network operations',
        downloadTitle: 'Downloading a localization',
        downloadIntro:
          'To provide the correct file, the app sends at least the following to the server:',
        download1: 'game ID;',
        download2: 'archive path/identifier;',
        download3: 'archive type;',
        download4:
          'MachineID, a technical identifier the service uses to distinguish devices.',
        downloadPurpose:
          'These fields identify the required file, fulfill the download request, enforce download limits and count unique downloads. In a single request, the server provides the file, checks the limit and records the download in the statistics.',
        workshopTitle: 'Opening Steam Workshop',
        workshopText:
          'Some localizations are installed by subscribing in Steam Workshop. Opening one of these localizations counts toward the overall download statistics. For this, the app sends the localization ID and MachineID. Only the first visit from your device is counted for each localization.',
        subscriptionTitle: 'Subscribing to a localization',
        subscriptionText:
          'Subscribing to a translation lets you receive notifications about new versions. The app generates these notifications on your device. Separately, the LBK server stores the localization ID and MachineID so the translation team can see how many users are waiting for updates. This server record is not needed to generate notifications. You can unsubscribe in the app at any time, and the server record will be deleted immediately.',
      },
      productAnalytics: {
        title: '5. Product analytics',
        intro: 'For product analytics, the app sends:',
        sessions:
          '<b>Session start and end</b> — app version, session time/duration, MachineID and whether this is the first launch. These data help count unique launches and identify which app versions are in use;',
        firstSession:
          '<b>Whether this is the first session</b> — sent with the download request to help determine whether users install a localization during their first app session;',
        mixpanel:
          '<b>Mixpanel interface events</b> — opening sections, interacting with controls, and installing, updating or removing localizations. The game title, app version and MachineID are sent with these events;',
        banners:
          '<b>Banner views and clicks</b> — campaign ID, event type and MachineID.',
      },
      localizationAnalytics: {
        title: '6. Analytics supporting Ukrainian localizations',
        intro: 'For localization development analytics, the app sends:',
        support:
          '<b>Support button clicks</b> — game/localization ID and MachineID, so teams can see how many people wanted to support them;',
        emptySearch:
          '<b>Searches with no results</b> — search text, request source and MachineID;',
        uninstall: '<b>Localization removal</b> — localization ID and MachineID;',
        playtime:
          '<b>Time played</b> — only for games with an installed localization: game ID, additional time played in minutes and MachineID.',
      },
      feedback: {
        title: '7. Feedback, screenshots and logs',
        intro: 'These data are sent only after an explicit user action.',
        feedbackTitle: 'Localization feedback',
        feedbackIntro: 'When you submit feedback, the following may be sent:',
        feedback1: 'game ID;',
        feedback2: 'request type;',
        feedback3: 'message text;',
        feedback4: 'app version;',
        feedback5: 'operating system/platform and architecture;',
        feedback6: 'MachineID, used to deliver the reply to your specific request.',
        screenshotsTitle: 'Screenshots',
        screenshotsText:
          'Screenshots are attached only when you explicitly select them. Before uploading, you can see which file will be sent. A screenshot may accidentally include personal information; LBK Team is not responsible for its contents. Screenshots are sent unchanged: the app does not compress or resize them, or remove metadata (additional information stored in the file). You can attach up to five screenshots to a request.',
        logsTitle: 'Diagnostic logs',
        logsText:
          'A log may contain technical messages, file paths (which may include your operating system account name), installed game titles, numeric platform identifiers and error messages. The app does not remove individual log lines before sending because they may be needed to diagnose the problem. Logs are not sent automatically; transmission requires your explicit confirmation.',
      },
      crashReports: {
        title: '8. Automatic crash diagnostics',
        text: 'When an error occurs, the app may send its description, the sequence of calls leading to it (stack trace), the app version and other technical information needed for diagnosis, including the operating system version and recent actions in the app before the error.',
        optIn:
          'Crash reports are sent only when the corresponding option is enabled in the app settings.',
        glitchTip: 'Reports use <b>GlitchTip</b>, hosted on LBK infrastructure.',
      },
      website: {
        title: '9. Data collected by the website',
        publicTitle: 'Public website',
        zaraz:
          'The public website uses <b>Cloudflare Zaraz</b> to analyze page views and certain events, including opening the catalog, viewing a localization page and using search.',
        emptySearch:
          'Searches with no results on the website store the query text with a random identifier generated in browser storage. This identifier is not linked to your device or identity.',
        videoTitle: 'Embedded video',
        videoText:
          'Localization pages may include embedded YouTube videos. When the player loads, your browser connects to Google/YouTube services and sends technical connection data.',
        releasesTitle: 'Downloading releases',
        releasesText:
          'Release files may be downloaded from GitHub. During a download, GitHub receives standard technical network request data.',
      },
      accounts: {
        title: '10. Translator, team and moderator accounts',
        intro:
          'You do not need an account to install localizations. Translators, teams and moderators use accounts in the dashboard at https://admin.lbklauncher.com/',
        dataIntro: 'When creating and using an account, the following may be processed:',
        data1: 'name;',
        data2: 'email address;',
        data3: 'Google profile data if you choose to sign in with Google;',
        data4: 'service data needed for authentication and access roles.',
        googleAnalytics:
          'The dashboard uses Google Analytics, which collects information about dashboard page views and uses its own cookies. When you copy promotional text for Steam, the dashboard sends this event and the game title to Google Analytics. Your email address and account ID are not sent. You can disable these analytics in the dashboard settings.',
      },
      legalBasis: {
        title: '11. Purposes and legal bases for processing',
        columns: {
          purpose: 'Purpose',
          category: 'Category',
          basis: 'Legal basis',
        },
        purposes: {
          delivery: 'Providing and installing a localization',
          subscription: 'Storing subscription status',
          abuse:
            'Preventing abuse, enforcing technical limits and counting unique downloads',
          improve:
            'App sessions, interface interactions, banner views and clicks, and first-session information',
          develop:
            'Support clicks, unsuccessful searches, localization removals and time played',
          diagnostics: 'Automatic diagnostics',
          feedback: 'Feedback, screenshots and logs',
          account: 'Account operation',
        },
        categories: {
          essential: 'Essential LBK functions',
          improve: '“Help improve LBK”',
          develop: '“Help Ukrainian localizations grow”',
          diagnostics: '“Diagnostics and error reports”',
          userAction: 'Explicit user action',
          account: 'Essential account functions',
        },
        bases: {
          requestOrTerms: 'Fulfilling a user request / Terms of use',
          request: 'Fulfilling a user request',
          stability:
            'Legitimate interest in keeping the service stable and public statistics accurate',
          legitimateInterest: 'Legitimate interest',
          consent: 'User consent at the time of submission',
        },
        objection:
          'You can object to processing based on legitimate interest. Section 16 explains how.',
      },
      retention: {
        title: '12. Retention periods',
        text: 'We retain data for as long as necessary for the purposes described in this policy.',
        details:
          'Subscription records are retained until you unsubscribe and are deleted immediately afterward. Account data are retained while the account exists. When an account is deleted, its data and uploaded files are deleted immediately.',
      },
      recipients: {
        title: '13. Recipients and infrastructure',
        infraTitle: 'LBK infrastructure',
        supabase:
          "<b>Supabase-based backend</b> — LBK's database, file storage and service functions, hosted on our own servers. These store server-side download and subscription records, feedback, screenshots, diagnostic logs and statistics collected on LBK infrastructure. External services are described separately below.",
        glitchTip:
          "<b>GlitchTip</b> — error and crash reports. The service runs on LBK's own servers, where these reports are stored.",
        coolify: 'Coolify is used to manage service deployments.',
        externalTitle: 'External services',
        mixpanel: '<b>Mixpanel</b> — app product analytics;',
        zaraz: '<b>Cloudflare Zaraz</b> — public website analytics;',
        googleAnalytics: '<b>Google Analytics</b> — dashboard analytics;',
        resend: '<b>Resend</b> — account emails and service notifications;',
        youtube: '<b>YouTube / Google</b> — embedded videos;',
        steam: '<b>Steam</b> — data needed for Steam integration;',
        github: '<b>GitHub</b> — release distribution and update checks;',
        teamChannels:
          '<b>Internal team notification channels</b> — alerts about new requests so LBK Team can review and respond promptly.',
        partners:
          'The localization catalog is synchronized with a partner service daily. No player data are shared during synchronization. Before publication, archives uploaded by translators are scanned for viruses using the external MetaDefender service. No player data are sent for this scan.',
      },
      steamFallback: {
        title: '14. Steam: local library detection and server fallback',
        text: "The app usually identifies your Steam library from data on your device. If those data are insufficient, the LBK server requests the game list through the Steam Web API, using your numeric Steam profile ID and LBK's access key. The LBK server sends the request to Steam.",
        notStored: 'The returned game list is not stored on the server.',
      },
      location: {
        title: '15. Where data are processed',
        servers: "LBK's own servers are located in <b>Germany</b>.",
        external:
          'Some external services may process data in other countries, including the United States. These include Mixpanel, Resend, Google/YouTube, GitHub and Steam.',
      },
      rights: {
        title: '16. Your rights and consent management',
        intro: 'You can:',
        access: 'ask LBK Team what data are associated with you and request a copy;',
        rectify: 'correct inaccurate data;',
        erase: 'request deletion when data are no longer needed or must be deleted;',
        object: 'object to processing based on legitimate interest.',
        identification:
          'If you have an account, records can be located using account details. Without an account, your MachineID may be needed to locate de-identified events.',
        requests:
          'Send requests to <mail>pr@gameglobe-localisation.com</mail> or through the <tg>Telegram support bot</tg>. We will respond within 30 days.',
      },
      security: {
        title: '17. Data protection',
        roles:
          'Access to server tables and storage is restricted by role. The access key included in the app and website cannot read feedback, logs or statistics. These data are accessible only through the server with the appropriate permissions.',
        storage:
          'Feedback, logs and screenshots are kept in private storage; temporary access links are generated only for LBK Team.',
        passwords:
          'The authentication platform stores passwords as hashes, the results of a one-way transformation. LBK code does not have access to plaintext passwords.',
        tokens:
          'Automatic publishing tokens are stored only as hashes, from which the original token cannot be recovered.',
        secrets: 'Tokens and secrets are not sent to analytics services.',
        encryption: 'Website and app network connections use encryption.',
      },
      limits: {
        title: '18. What LBK does not do',
        sell: "does not sell users' personal data;",
        account: 'does not require an account for normal localization installation;',
        screenshots: 'does not take screenshots without user action;',
        clipboard: 'does not read the clipboard;',
        machineId: 'does not include MachineID in public or aggregated statistics;',
        ads: 'does not show behavior-based advertising;',
        fingerprinting:
          'does not use browser fingerprinting or record on-screen activity.',
      },
      changes: {
        title: '19. Changes to this policy',
        text: 'If data categories, purposes, recipients or legal bases for processing change, this policy and its update date must be revised before or at the same time as the corresponding functionality changes.',
      },
      contacts: {
        title: '20. Contact',
      },
    },
  },
} as const satisfies Messages;
