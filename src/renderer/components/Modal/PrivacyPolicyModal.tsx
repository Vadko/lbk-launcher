import { ShieldIcon } from 'lucide-react';
import React from 'react';
import { Modal } from './Modal';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({
  isOpen,
  onClose,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title="Політика приватності"
    footer={
      <button
        onClick={onClose}
        data-gamepad-confirm
        className="w-full px-6 py-3 rounded-xl bg-linear-to-r/srgb from-color-accent to-color-main text-text-dark font-semibold hover:opacity-90 transition-opacity"
      >
        Зрозуміло
      </button>
    }
  >
    <div className="space-y-5 text-text-main">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-linear-to-br/srgb from-blue-500 to-blue-600 flex items-center justify-center shrink-0">
          <ShieldIcon size={24} className="text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">LBK Launcher</h3>
          <p className="text-sm text-text-muted">Оновлено: 10 жовтня 2026</p>
        </div>
      </div>

      <section className="space-y-3">
        <p className="text-sm text-text-muted leading-relaxed">
          LBK Launcher — сервіс для пошуку, встановлення та оновлення українських
          локалізацій.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Сайт і застосунок мають відкритий вихідний код. Ця політика описує дані, які
          обробляються локально, надсилаються на інфраструктуру LBK або передаються
          зовнішнім сервісам.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">1. Хто обробляє дані</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          За оброблення даних відповідає{' '}
          <strong className="text-text-main">
            LBK Team — що складається із двох спілок GameGlobe Localization та Little Bit
          </strong>
          .
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Питання щодо приватності можна надсилати на:
        </p>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>
            пошту{' '}
            <a
              href="mailto:pr@gameglobe-localisation.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-color-accent hover:text-color-main transition-colors underline"
            >
              pr@gameglobe-localisation.com
            </a>
          </li>
          <li>
            або через{' '}
            <a
              href="https://t.me/lbk_launcher_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-color-accent hover:text-color-main transition-colors underline"
            >
              Telegram-бот підтримки
            </a>
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          2. Категорії даних, що обробляються
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          LBK розділяє дані на необхідні для роботи сервісу операції та аналітичні
          категорії.
        </p>
        <h5 className="text-sm font-semibold text-text-main">Необхідні функції LBK</h5>
        <p className="text-sm text-text-muted leading-relaxed">
          Ці операції потрібні для роботи функцій, якими ви користуєтеся: завантаження,
          встановлення й оновлення локалізацій, захисту сервісу від зловживань та роботи
          акаунту перекладача.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">До них належать:</p>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>отримання потрібного архіву локалізації;</li>
          <li>встановлення, оновлення та локальне видалення локалізації;</li>
          <li>збереження інформації про вашу підписку на локалізацію;</li>
          <li>
            захист сервісу від зловживань та застосування технічних обмежень завантажень;
          </li>
          <li>робота акаунта для перекладачів, команд і модераторів.</li>
        </ul>
        <h5 className="text-sm font-semibold text-text-main">
          Те, що допомагає покращувати LBK
        </h5>
        <p className="text-sm text-text-muted leading-relaxed">
          Продуктова аналітика допомагає нам зрозуміти, як ви користуєтеся застосунком і
          наскільки зручно в ньому знаходити та встановлювати локалізації.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">До неї належать:</p>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>запуск і завершення сесії застосунку;</li>
          <li>
            інформація про те, чи встановили ви локалізацію під час першого запуску
            застосунку;
          </li>
          <li>продуктова аналітика Mixpanel;</li>
          <li>перегляди інформаційних банерів у застосунку та натискання на них.</li>
        </ul>
        <h5 className="text-sm font-semibold text-text-main">
          Те, що допомагає розвивати українські локалізації
        </h5>
        <p className="text-sm text-text-muted leading-relaxed">
          Аналітика попиту та використання локалізацій. Вона допомагає зрозуміти, які
          переклади потрібні гравцям і як вони користуються наявними локалізаціями.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">До неї належать:</p>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>натискання кнопки «Підтримати»;</li>
          <li>
            пошукові запити, за якими нічого не знайдено задля оформлення списку
            задоволення попиту на переклад;
          </li>
          <li>
            інформація про видалення локалізацій, яка допомагає оцінювати їх використання;
          </li>
          <li>
            вимірювання часу в іграх із встановленими локалізаціями задля промо матеріалів
            на сайті «Скільки часу награно з нашим лаунчером» та у спільноті.
          </li>
        </ul>
        <h5 className="text-sm font-semibold text-text-main">
          Діагностика та звіти про помилки
        </h5>
        <p className="text-sm text-text-muted leading-relaxed">
          Автоматичні звіти допомагають нам знаходити й виправляти помилки та збої
          застосунку. Ручні відгуки, знімки екрана та журнали надсилаються окремою дією
          користувача.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Продуктова аналітика, аналітика розвитку локалізацій та автоматична діагностика
          не потрібні для встановлення й оновлення локалізацій. Ми працюємо над
          налаштуваннями, які дозволять вимикати кожну з цих категорій окремо в
          застосунку. Поки ці налаштування недоступні, ви можете написати нам і заперечити
          проти такого оброблення даних. Контакти та порядок звернення наведено в розділі
          16.
        </p>
        <h5 className="text-sm font-semibold text-text-main">
          Публічне та партнерське використання статистики
        </h5>
        <p className="text-sm text-text-muted leading-relaxed">
          Агреговані показники можуть використовуватися у публічній статистиці,
          промо-матеріалах і партнерських презентаціях без MachineID та інших
          ідентифікаторів деперсоналізаційного встановлення.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Застосунок і сайт не використовують рекламних мереж, пікселів відстеження,
          запису дій на екрані чи цифрових відбитків пристрою або браузера. Ми не продаємо
          персональних даних і не передаємо їх компаніям, що займаються збиранням і
          продажем таких даних.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          3. Що застосунок обробляє лише локально
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Частина функцій працює на пристрої користувача без надсилання їхнього вмісту на
          сервер LBK.
        </p>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>
            <strong className="text-text-main">Пошук установлених ігор.</strong>{' '}
            Застосунок читає службові файли Steam, Epic Games, GOG, EA, Xbox, Ubisoft
            Connect, Rockstar, Heroic і Lutris, щоб визначити встановлені ігри та їх
            розташування. У Windows застосунок також може визначати ці платформи за їхніми
            записами в системному реєстрі.
          </li>
          <li>
            <strong className="text-text-main">
              Дані облікових записів ігрових платформ.
            </strong>{' '}
            Із даних профілю Steam застосунок зчитує лише числовий ідентифікатор, щоб
            зіставити вашу бібліотеку ігор із каталогом локалізацій. Він не зчитує логін,
            нікнейм, список друзів, історію покупок, платіжні дані чи листування, навіть
            якщо вони містяться в тому самому файлі. Із службових файлів інших ігрових
            платформ застосунок зчитує лише дані, потрібні для пошуку встановлених ігор та
            їхнього розташування на диску.
          </li>
          <li>
            <strong className="text-text-main">Зміни в бібліотеці Steam.</strong> Поки
            застосунок відкритий, він відстежує зміни службових файлів Steam, щоб оновити
            локальний перелік ігор. Застосунок не читає вмісту файлу з переліком ваших
            ліцензій, а лише відстежує зміну його розміру.
          </li>
          <li>
            <strong className="text-text-main">Локальна база.</strong> Каталог перекладів,
            історія встановлень, улюблене й налаштування зберігаються у файлі бази даних
            на вашому компʼютері. Усі ці локальні дані можна видалити через налаштування
            застосунку.
          </li>
          <li>
            <strong className="text-text-main">Резервні копії.</strong> Перед
            встановленням локалізації оригінальні файли гри можуть копіюватися локально
            для подальшого відновлення.
          </li>
          <li>
            <strong className="text-text-main">Пошук, фільтри та добірки.</strong>{' '}
            Формуються з локальної бази. Ми не створюємо на сервері профілю ваших
            уподобань і не підлаштовуємо каталог під ваш пристрій.
          </li>
          <li>
            <strong className="text-text-main">
              Синхронізація зі стороннім застосунком.
            </strong>{' '}
            Запускається дією користувача та переносить інформацію про встановлені
            локалізації локально.
          </li>
          <li>
            <strong className="text-text-main">Локальне читання Steam playtime.</strong>{' '}
            Виконується лише для ігор із встановленими локалізаціями, щоб розрахувати
            зміну часу в грі.
          </li>
        </ul>
        <p className="text-sm text-text-muted leading-relaxed">
          Застосунок не робить знімків екрана, не читає буфер обміну й не збирає окремо
          імені компʼютера чи облікового запису операційної системи. Для пошуку ігор він
          читає лише файли в теках ігор та ігрових платформ. Назва облікового запису може
          траплятися у шляхах до файлів у діагностичних журналах, які ви надсилаєте вручну
          (див. розділ 7).
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          4. Необхідні мережеві операції застосунку
        </h4>
        <h5 className="text-sm font-semibold text-text-main">Завантаження локалізації</h5>
        <p className="text-sm text-text-muted leading-relaxed">
          Для видачі потрібного файлу застосунок передає на сервер щонайменше:
        </p>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>ID гри;</li>
          <li>шлях/ідентифікатор архіву;</li>
          <li>тип архіву;</li>
          <li>MachineID — технічний ідентифікатор, за яким сервіс розрізняє пристрої.</li>
        </ul>
        <p className="text-sm text-text-muted leading-relaxed">
          Ці поля використовуються для визначення потрібного файлу та виконання запиту на
          завантаження, обмеження кількості завантажень і підрахунку унікальних
          завантажень. Під час одного запиту сервер надає файл, перевіряє ліміт і враховує
          завантаження у статистиці.
        </p>
        <h5 className="text-sm font-semibold text-text-main">
          Перехід у Майстерню Steam
        </h5>
        <p className="text-sm text-text-muted leading-relaxed">
          Деякі локалізації встановлюються через підписку в Майстерні Steam. Перехід до
          такої локалізації враховується в загальній статистиці завантажень. Для цього
          застосунок передає ID локалізації та MachineID. Для кожної локалізації
          враховується лише перший перехід із вашого пристрою.
        </p>
        <h5 className="text-sm font-semibold text-text-main">Підписка на локалізацію</h5>
        <p className="text-sm text-text-muted leading-relaxed">
          Підписка на переклад дає змогу отримувати сповіщення про його нові версії. Ці
          сповіщення формує застосунок на вашому пристрої. Окремо сервер LBK зберігає
          ідентифікатор локалізації та MachineID, щоб команда перекладачів бачила, скільки
          користувачів чекають на оновлення її перекладу. Цей серверний запис не потрібен
          для створення сповіщень. Ви можете будь-коли скасувати підписку в застосунку —
          запис на сервері буде видалено одразу.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          5. Продуктова аналітика
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Для продуктової аналітики застосунок надсилає такі дані:
        </p>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>
            <strong className="text-text-main">початок і завершення сесії</strong> —
            версію застосунку, час/тривалість сесії, MachineID та ознаку першого запуску.
            Ці дані допомагають підраховувати унікальні запуски й визначати, якими
            версіями застосунку користуються;
          </li>
          <li>
            <strong className="text-text-main">
              інформацію про те, чи це перша сесія
            </strong>{' '}
            — передається разом із запитом на завантаження й допомагає визначити, чи
            встановлюють користувачі локалізацію під час першого запуску застосунку;
          </li>
          <li>
            <strong className="text-text-main">події інтерфейсу Mixpanel</strong> —
            відкриття розділів, взаємодії з елементами, встановлення, оновлення та
            видалення локалізацій. Разом із подіями передаються назва гри, версія
            застосунку та MachineID;
          </li>
          <li>
            <strong className="text-text-main">
              перегляди банерів і натискання на них
            </strong>{' '}
            — ідентифікатор кампанії, тип події та MachineID.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          6. Аналітика розвитку українських локалізацій
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Для аналітики розвитку локалізацій застосунок надсилає такі дані:
        </p>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>
            <strong className="text-text-main">натискання «Підтримати»</strong> — ID
            гри/локалізації та MachineID, щоб команди бачили, скільки людей захотіли їх
            підтримати;
          </li>
          <li>
            <strong className="text-text-main">пошук без результатів</strong> — текст
            пошукового запиту, джерело запиту та MachineID;
          </li>
          <li>
            <strong className="text-text-main">видалення локалізації</strong> — ID
            локалізації та MachineID;
          </li>
          <li>
            <strong className="text-text-main">час у грі</strong> — лише для ігор із
            встановленою локалізацією: ID гри, приріст часу в хвилинах та MachineID.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          7. Відгуки, знімки екрана та журнали
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Ці дані надсилаються лише після окремої дії користувача.
        </p>
        <h5 className="text-sm font-semibold text-text-main">Відгук про локалізацію</h5>
        <p className="text-sm text-text-muted leading-relaxed">
          Під час відправлення відгуку можуть передаватися:
        </p>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>ID гри;</li>
          <li>тип звернення;</li>
          <li>текст повідомлення;</li>
          <li>версія застосунку;</li>
          <li>операційна система/платформа та архітектура;</li>
          <li>MachineID — за ним ви отримаєте відповідь саме на своє звернення.</li>
        </ul>
        <h5 className="text-sm font-semibold text-text-main">Знімки екрана</h5>
        <p className="text-sm text-text-muted leading-relaxed">
          Знімки додаються лише через явний вибір користувача. Перед завантаженням
          користувач має бачити, який файл буде відправлено. Знімок може містити особисту
          інформацію, яка випадково потрапила в кадр, — за це LBK Team відповідальності не
          несе. Знімки надсилаються без змін: застосунок не стискає їх, не змінює розміру
          й не видаляє метаданих — додаткової інформації, збереженої у файлі. До одного
          звернення можна додати до пʼяти знімків.
        </p>
        <h5 className="text-sm font-semibold text-text-main">Діагностичні журнали</h5>
        <p className="text-sm text-text-muted leading-relaxed">
          Журнал може містити технічні повідомлення, шляхи до файлів (вони можуть містити
          назву вашого облікового запису в операційній системі), назви встановлених ігор,
          числові ідентифікатори платформ та тексти помилок. Перед надсиланням застосунок
          не видаляє окремих рядків із журналу: вони можуть містити інформацію, потрібну
          для зʼясування причини проблеми. Журнал не надсилається автоматично; передавання
          відбувається лише після окремого підтвердження користувача.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          8. Автоматична діагностика збоїв
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          У разі помилки застосунок автоматично надсилає її опис, послідовність викликів,
          що призвели до помилки (стек викликів), версію застосунку та інші технічні дані,
          потрібні для діагностики (операційна система та її версія, останні дії в
          застосунку перед помилкою).
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Звіти про збої надсилаються лише тоді, коли в налаштуваннях застосунку ввімкнено
          відповідну опцію.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Для звітів використовується{' '}
          <strong className="text-text-main">GlitchTip</strong>, розгорнутий на
          інфраструктурі LBK.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">9. Що збирає сайт</h4>
        <h5 className="text-sm font-semibold text-text-main">Публічна частина сайту</h5>
        <p className="text-sm text-text-muted leading-relaxed">
          Публічний сайт використовує{' '}
          <strong className="text-text-main">Cloudflare Zaraz</strong> для аналітики
          переглядів і окремих подій, зокрема відкриття каталогу, сторінки локалізації та
          використання пошуку.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Пошук без результатів на сайті зберігає текст запиту разом із випадковим
          ідентифікатором, створеним у памʼяті браузера. Цей ідентифікатор не повʼязаний
          із вашим пристроєм або особою.
        </p>
        <h5 className="text-sm font-semibold text-text-main">Вбудоване відео</h5>
        <p className="text-sm text-text-muted leading-relaxed">
          На сторінках локалізацій можуть бути вбудовані відео YouTube. При завантаженні
          програвача браузер встановлює зʼєднання із сервісами Google/YouTube і передає їм
          технічні дані зʼєднання.
        </p>
        <h5 className="text-sm font-semibold text-text-main">Завантаження релізів</h5>
        <p className="text-sm text-text-muted leading-relaxed">
          Файли релізів можуть завантажуватися з GitHub. При такому завантаженні GitHub
          отримує стандартні технічні дані мережевого запиту.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          10. Акаунти перекладачів, команд і модераторів
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Для звичайного встановлення локалізацій акаунт не потрібен. Акаунти
          використовуються перекладачами, командами та модераторами за шляхом —
          https://admin.lbklauncher.com/
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          При створенні та використанні акаунта можуть оброблятися:
        </p>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>імʼя;</li>
          <li>електронна пошта;</li>
          <li>дані профілю Google, якщо користувач обирає вхід через Google;</li>
          <li>службові дані, необхідні для автентифікації та ролей доступу.</li>
        </ul>
        <p className="text-sm text-text-muted leading-relaxed">
          В адміністративній панелі використовується Google Analytics: сервіс збирає
          інформацію про перегляди сторінок панелі та використовує власні cookie. Коли ви
          натискаєте кнопку копіювання промотексту для Steam, панель надсилає до Google
          Analytics цю подію та назву відповідної гри. Електронна пошта та ідентифікатор
          акаунта не передаються. Ми працюємо над налаштуванням, яке дозволить вимкнути цю
          аналітику в адміністративній панелі.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          11. Мета та правові підстави оброблення
        </h4>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>
            <strong className="text-text-main">Видача та встановлення локалізації</strong>{' '}
            — Необхідні функції LBK; підстава: Виконання запиту користувача / Умов
            користування
          </li>
          <li>
            <strong className="text-text-main">Збереження стану підписки</strong> —
            Необхідні функції LBK; підстава: Виконання запиту користувача
          </li>
          <li>
            <strong className="text-text-main">
              Захист від зловживань, технічні ліміти та облік унікальних завантажень
            </strong>{' '}
            — Необхідні функції LBK; підстава: Законний інтерес у забезпеченні стабільної
            роботи сервісу та достовірності публічної статистики
          </li>
          <li>
            <strong className="text-text-main">
              Сесії застосунку, взаємодії з інтерфейсом, перегляди банерів і натискання на
              них, інформація про першу сесію
            </strong>{' '}
            — «Допомагати покращувати LBK»; підстава: Законний інтерес
          </li>
          <li>
            <strong className="text-text-main">
              Натискання «Підтримати», пошук без результатів, видалення локалізації, час у
              грі
            </strong>{' '}
            — «Допомагати розвивати українські локалізації»; підстава: Законний інтерес
          </li>
          <li>
            <strong className="text-text-main">Автоматична діагностика</strong> —
            «Діагностика та звіти про помилки»; підстава: Законний інтерес
          </li>
          <li>
            <strong className="text-text-main">Відгуки, знімки екрана, журнали</strong> —
            Окрема дія користувача; підстава: Згода користувача під час надсилання
          </li>
          <li>
            <strong className="text-text-main">Робота акаунта</strong> — Необхідні функції
            акаунта; підстава: Виконання запиту користувача / Умов користування
          </li>
        </ul>
        <p className="text-sm text-text-muted leading-relaxed">
          Ви можете заперечити проти оброблення даних на підставі законного інтересу. Як
          це зробити, описано в розділі 16.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">12. Строки зберігання</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Ми зберігаємо дані стільки часу, скільки потрібно для цілей, описаних у цій
          політиці.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Запис про підписку зберігається до її скасування й видаляється одразу після
          того, як ви відпишетеся. Дані акаунта зберігаються, поки він існує. Після
          видалення акаунта його дані та завантажені файли видаляються одразу.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          13. Одержувачі та інфраструктура
        </h4>
        <h5 className="text-sm font-semibold text-text-main">Інфраструктура LBK</h5>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>
            <strong className="text-text-main">Backend на базі Supabase</strong> — база
            даних, сховище файлів та службові функції LBK. Розгорнутий на власних серверах
            LBK. Тут зберігаються серверні записи про завантаження й підписки, відгуки,
            знімки екрана, діагностичні журнали та статистика, яку LBK збирає на власній
            інфраструктурі. Ці дані зберігаються в межах інфраструктури LBK; використання
            зовнішніх сервісів описано окремо нижче.
          </li>
          <li>
            <strong className="text-text-main">GlitchTip</strong> — звіти про помилки та
            збої. Сервіс розгорнутий на власних серверах LBK, де й зберігаються ці звіти.
          </li>
        </ul>
        <p className="text-sm text-text-muted leading-relaxed">
          Для керування розгортанням сервісів використовується Coolify.
        </p>
        <h5 className="text-sm font-semibold text-text-main">Зовнішні сервіси</h5>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>
            <strong className="text-text-main">Mixpanel</strong> — продуктова аналітика
            застосунку;
          </li>
          <li>
            <strong className="text-text-main">Cloudflare Zaraz</strong> — аналітика
            публічного сайту;
          </li>
          <li>
            <strong className="text-text-main">Google Analytics</strong> — аналітика
            адміністративної панелі;
          </li>
          <li>
            <strong className="text-text-main">Resend</strong> — доставка листів для
            акаунтів/службових повідомлень;
          </li>
          <li>
            <strong className="text-text-main">YouTube / Google</strong> — вбудоване
            відео;
          </li>
          <li>
            <strong className="text-text-main">Steam</strong> — дані, потрібні для роботи
            інтеграції Steam;
          </li>
          <li>
            <strong className="text-text-main">GitHub</strong> — розповсюдження релізів та
            перевірка оновлень;
          </li>
          <li>
            <strong className="text-text-main">внутрішні канали сповіщень команди</strong>{' '}
            — сповіщення про нові звернення, щоб LBK Team могла оперативно їх розглянути
            та відповісти.
          </li>
        </ul>
        <p className="text-sm text-text-muted leading-relaxed">
          Каталог локалізацій щодня синхронізується з партнерським сервісом. Під час цієї
          синхронізації дані гравців не передаються. Архіви, які завантажують перекладачі,
          перед публікацією перевіряються на віруси за допомогою зовнішнього сервісу
          Metadefender. Дані гравців для цієї перевірки не передаються.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          14. Steam: локальне визначення бібліотеки та серверний fallback
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Зазвичай застосунок визначає вашу бібліотеку Steam за даними на пристрої. Якщо
          цих даних недостатньо, сервер LBK запитує список ігор через Steam Web API. Для
          запиту використовуються числовий ідентифікатор вашого профілю Steam та ключ
          доступу LBK. Запит до Steam надсилає сервер LBK.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Отриманий список ігор на сервері не зберігається.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          15. Де обробляються дані
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Власні сервери LBK розташовані в{' '}
          <strong className="text-text-main">Німеччині</strong>.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Частина зовнішніх сервісів може обробляти дані в інших країнах, зокрема у США —
          це стосується Mixpanel, Resend, Google/YouTube, GitHub і Steam.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">
          16. Права та керування згодою
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">Користувач може:</p>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>
            дізнатися, які дані з ним повʼязані, й отримати їхню копію за зверненням до
            LBK Team;
          </li>
          <li>виправити неточні дані;</li>
          <li>
            вимагати видалення даних у випадках, коли вони більше не потрібні або
            підлягають видаленню;
          </li>
          <li>заперечити проти оброблення даних на підставі законного інтересу.</li>
        </ul>
        <p className="text-sm text-text-muted leading-relaxed">
          Запити можна надсилати на{' '}
          <a
            href="mailto:pr@gameglobe-localisation.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-color-accent hover:text-color-main transition-colors underline"
          >
            pr@gameglobe-localisation.com
          </a>{' '}
          або через{' '}
          <a
            href="https://t.me/lbk_launcher_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="text-color-accent hover:text-color-main transition-colors underline"
          >
            Telegram-бот підтримки
          </a>
          . Ми відповімо на ваш запит протягом 30 днів.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Якщо користувач має акаунт, записи можуть бути знайдені за даними акаунта. Якщо
          акаунта немає, для пошуку деперсоналізованих подій може знадобитися MachineID.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">17. Захист даних</h4>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>
            Доступ до серверних таблиць та сховищ обмежений ролями. Ключ доступу, який
            міститься в застосунку та на сайті, не дає змоги читати відгуки, журнали чи
            статистику. Доступ до цих даних надається лише через сервер із відповідними
            правами доступу.
          </li>
          <li>
            Відгуки, журнали й знімки екрана зберігаються в закритих сховищах; тимчасові
            посилання для доступу до них створюються лише для LBK Team.
          </li>
          <li>
            Платформа входу в акаунт зберігає паролі у вигляді хешів — результатів
            одностороннього перетворення. Код LBK не має доступу до паролів у відкритому
            вигляді.
          </li>
          <li>
            Токени для автоматичної публікації зберігаються лише у вигляді хешів, з яких
            неможливо відновити початковий токен.
          </li>
          <li>Токени та секрети не передаються до аналітичних сервісів.</li>
          <li>Мережеві зʼєднання сайту та застосунку використовують шифрування.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">18. Чого LBK не робить</h4>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>не продає персональні дані користувачів;</li>
          <li>не вимагає акаунта для звичайного встановлення локалізацій;</li>
          <li>не створює знімки екрана без дії користувача;</li>
          <li>не читає буфер обміну;</li>
          <li>не передає MachineID у публічну або агреговану статистику;</li>
          <li>не показує реклами на основі вашої поведінки;</li>
          <li>не використовує цифрових відбитків браузера й не записує дій на екрані.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">19. Зміни до політики</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Якщо змінюються категорії даних, цілі, одержувачі або правові підстави
          оброблення, політика та дата її оновлення мають бути змінені до або одночасно з
          відповідною зміною функціоналу.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold text-text-main">20. Контакти</h4>
        <ul className="list-disc list-outside ml-5 text-sm text-text-muted space-y-1">
          <li>
            <strong className="text-text-main">Email:</strong>{' '}
            <a
              href="mailto:pr@gameglobe-localisation.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-color-accent hover:text-color-main transition-colors underline"
            >
              pr@gameglobe-localisation.com
            </a>
          </li>
          <li>
            <strong className="text-text-main">Telegram:</strong>{' '}
            <a
              href="https://t.me/lbk_launcher_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-color-accent hover:text-color-main transition-colors underline"
            >
              https://t.me/lbk_launcher_bot
            </a>
          </li>
        </ul>
      </section>
    </div>
  </Modal>
);
