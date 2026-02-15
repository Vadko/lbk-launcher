import { Shield } from 'lucide-react';
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
        className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-color-accent to-color-main text-text-dark font-semibold hover:opacity-90 transition-opacity"
      >
        Зрозуміло
      </button>
    }
  >
    <div className="space-y-4 text-text-main">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
          <Shield size={24} className="text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">LBK Launcher</h3>
          <p className="text-sm text-text-muted">Політика приватності</p>
        </div>
      </div>

      <section className="space-y-3">
        <p className="text-sm text-text-muted leading-relaxed">
          GameGlobe Localization та Little Bit («ми», «наш» або «нас») прагне захищати
          вашу приватність. Цей документ пояснює, як GameGlobe Localization та Little Bit
          збирає, використовує та розкриває вашу особисту інформацію.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Ця Політика конфіденційності поширюється на наш застосунок та пов’язані
          субдомени (разом — наш «Сервіс»), а також на наш застосунок LBK Launcher та
          kurin’. Отримуючи доступ чи користуючись нашим Сервісом, ви підтверджуєте, що
          прочитали, зрозуміли та погоджуєтесь із збором, зберіганням, використанням і
          розкриттям вашої особистої інформації, як описано в цій Політиці
          конфіденційності та в наших Умовах користування.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Визначення та ключові терміни</h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Щоб пояснити положення цієї Політики максимально зрозуміло, кожен із наведених
          нижче термінів використовується у строгому значенні:
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            <strong className="text-text-main">Cookie (кукі):</strong> невеликий обсяг
            даних, згенерований застосунком і збережений вашим браузером. Використовується
            для ідентифікації браузера, збору аналітики, запам’ятовування інформації
            (наприклад, мовних налаштувань чи даних для входу).
          </li>
          <li>
            <strong className="text-text-main">Компанія:</strong> коли у цій Політиці
            згадується «Компанія», «ми», «наш» або «нас», мається на увазі GameGlobe
            Localization LTD (вул. Металістів, 4, Київ, 02000), яка відповідає за вашу
            інформацію згідно з цією Політикою.
          </li>
          <li>
            <strong className="text-text-main">Країна:</strong> місце реєстрації GameGlobe
            Localization або її власників/засновників — у даному випадку Україна.
          </li>
          <li>
            <strong className="text-text-main">Клієнт:</strong> компанія, організація або
            фізична особа, яка зареєструвалась для користування Сервісом GameGlobe
            Localization та Little Bit для управління взаєминами зі своїми споживачами або
            користувачами послуг.
          </li>
          <li>
            <strong className="text-text-main">Пристрій:</strong> будь-який пристрій із
            доступом до Інтернету (телефон, планшет, комп’ютер тощо), за допомогою якого
            можна відвідати GameGlobe Localization та Little Bit та користуватися
            сервісами.
          </li>
          <li>
            <strong className="text-text-main">IP-адреса:</strong> номер, який отримує
            кожен пристрій, підключений до Інтернету. IP-адреси зазвичай призначаються
            блоками за географічним принципом і можуть вказувати на місцезнаходження
            пристрою.
          </li>
          <li>
            <strong className="text-text-main">Персонал:</strong> особи, які працюють у
            GameGlobe Localization та Little Bit або залучені за контрактом для надання
            послуг від імені компанії.
          </li>
          <li>
            <strong className="text-text-main">Персональні дані:</strong> будь-яка
            інформація, яка прямо чи опосередковано дозволяє ідентифікувати фізичну особу
            (включно з ідентифікаційним номером).
          </li>
          <li>
            <strong className="text-text-main">Сервіс:</strong> послуги, які
            надаєGameGlobe Localization та Little Bit, як описано у відповідних умовах
            (якщо є) та на цій платформі.
          </li>
          <li>
            <strong className="text-text-main">Сторонній сервіс:</strong> рекламодавці,
            партнери з акцій, маркетингові партнери та інші, хто надає нам контент або чиї
            товари чи послуги можуть вас зацікавити.
          </li>
          <li>
            <strong className="text-text-main">Застосунок:</strong> сайт GameGlobe
            Localization, доступний за адресою
            <a
              href="https://ggloc.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-color-accent hover:text-color-main transition-colors underline"
            >
              https://ggloc.org/
            </a>
            .
          </li>
          <li>
            <strong className="text-text-main">Ви:</strong> фізична чи юридична особа,
            зареєстрована в GameGlobe Localization та Little Bit для користування
            Сервісами.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Яку інформацію ми збираємо?</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Ми збираємо інформацію від вас, коли ви відвідуєте наш застосунок, реєструєтеся,
          робите замовлення, підписуєтеся на нашу розсилку, відповідаєте на опитування чи
          заповнюєте форму.
        </p>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Ми можемо збирати такі дані:
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>Ім’я / логін</li>
          <li>Адреси електронної пошти</li>
          <li>Платіжні адреси</li>
          <li>Номери дебетових/кредитних карт</li>
          <li>Вік</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">
          Як ми використовуємо зібрану інформацію?
        </h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Будь-які дані, які ми отримуємо від вас, можуть бути використані наступним
          чином:
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            <strong className="text-text-main">Персоналізація вашого досвіду</strong>{' '}
            (ваші дані допомагають нам краще реагувати на ваші потреби).
          </li>
          <li>
            <strong className="text-text-main">Покращення нашого застосунку</strong> (ми
            постійно вдосконалюємо пропозиції, ґрунтуючись на ваших відгуках та
            інформації).
          </li>
          <li>
            <strong className="text-text-main">Покращення обслуговування клієнтів</strong>{' '}
            (ваші дані допомагають нам ефективніше відповідати на запити та надавати
            підтримку).
          </li>
          <li>
            <strong className="text-text-main">Обробка транзакцій.</strong>
          </li>
          <li>
            <strong className="text-text-main">
              Адміністрування конкурсів, акцій, опитувань або інших функцій сайту.
            </strong>
          </li>
          <li>
            <strong className="text-text-main">
              Надсилання періодичних електронних листів.
            </strong>
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">
          Коли GameGlobe Localization та Little Bit збирає інформацію кінцевих
          користувачів від третіх сторін?
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          GameGlobe Localization та Little Bit збирає дані кінцевих користувачів,
          необхідні для надання послуг GameGlobe Localization та Little Bit нашим
          клієнтам.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Кінцеві користувачі можуть добровільно надати нам інформацію, яку вони зробили
          доступною на сайтах соціальних мереж. Якщо ви надаєте нам такі дані, ми можемо
          збирати публічну інформацію із соціальних мереж, які ви вказали. Ви можете
          контролювати обсяг інформації, яку соцмережі роблять доступною, відвідуючи ці
          сайти та змінюючи налаштування конфіденційності.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">
          Коли GameGlobe Localization та Little Bit використовує інформацію клієнтів від
          третіх сторін?
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Ми отримуємо певну інформацію від третіх сторін, коли ви зв’язуєтеся з нами.
          Наприклад, коли ви надсилаєте нам свою електронну адресу, щоб висловити
          зацікавленість у тому, щоб стати клієнтом GameGlobe Localization, ми можемо
          отримати дані від стороннього сервісу, який надає автоматизовані послуги з
          виявлення шахрайства.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Іноді ми також збираємо публічно доступну інформацію із соціальних мереж. Ви
          можете керувати тим, яка саме інформація стає публічною, у налаштуваннях своєї
          соцмережі.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">
          Чи ділимося ми зібраною інформацією з третіми сторонами?
        </h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Так, ми можемо ділитися як особистою, так і неособистою інформацією з третіми
          сторонами, зокрема:
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>рекламодавцями,</li>
          <li>спонсорами конкурсів,</li>
          <li>партнерами з просування та маркетингу,</li>
          <li>
            іншими сторонами, які надають наш контент або чиї товари/послуги, на нашу
            думку, можуть бути для вас цікавими.
          </li>
        </ul>
        <p className="text-sm text-text-muted leading-relaxed">
          Ми також можемо передавати дані нашим нинішнім та майбутнім афілійованим
          компаніям і бізнес-партнерам. У разі злиття, продажу активів або іншої
          бізнес-реорганізації ми можемо передати вашу особисту та неособисту інформацію
          правонаступникам.
        </p>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Ми можемо залучати надійних постачальників послуг для:
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>хостингу та підтримки наших серверів, вебсайту, і застосунку</li>
          <li>зберігання та управління базами даних,</li>
          <li>управління електронною поштою,</li>
          <li>маркетингу,</li>
          <li>обробки платежів,</li>
          <li>обслуговування клієнтів,</li>
          <li>виконання замовлень.</li>
        </ul>
        <p className="text-sm text-text-muted leading-relaxed">
          У таких випадках ми можемо ділитися вашими персональними та деякими
          неперсональними даними, щоб ці провайдери могли надавати послуги нам і вам.
        </p>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Також ми можемо ділитися частиною даних із логів (включно з IP-адресами) для
          аналітики з:
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>партнерами з веб-аналітики,</li>
          <li>розробниками застосунків,</li>
          <li>рекламними мережами.</li>
        </ul>
        <p className="text-sm text-text-muted leading-relaxed">
          Ці дані можуть використовуватись для оцінки вашого загального місцезнаходження,
          швидкості з’єднання, типу пристрою тощо. Вони також можуть бути агреговані для
          підготовки звітів і досліджень для нас та наших рекламодавців.
        </p>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Ми можемо розкривати особисту та неособисту інформацію державним органам,
          правоохоронцям або приватним особам, якщо вважаємо це необхідним:
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>для відповіді на юридичні запити (включно з повістками),</li>
          <li>для захисту наших прав і інтересів або прав третіх сторін,</li>
          <li>для захисту громадської безпеки чи безпеки будь-якої особи,</li>
          <li>
            для запобігання незаконній, неетичній чи юридично переслідуваній діяльності,
          </li>
          <li>для виконання чинних законів і судових рішень.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">
          Де і коли збирається інформація від користувачів?
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          GameGlobe Localization та Little Bit буде збирати особисту інформацію, яку ви
          нам надаєте. Ми також можемо отримувати додаткову інформацію від вас чи про вас
          від інших джерел, якщо ви надаєте таку згоду.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">
          Як довго ми зберігаємо ваші дані?
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Ми зберігаємо вашу інформацію тільки стільки, скільки потрібно для надання
          послуг GameGlobe Localization та Little Bit і виконання цілей, описаних у цій
          Політиці.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Це також стосується будь-яких третіх сторін, з якими ми ділимося вашими даними і
          які надають послуги від нашого імені. Якщо нам більше не потрібна ваша
          інформація і немає законної чи регуляторної потреби її зберігати, ми або
          видаляємо її з наших систем, або деперсоналізуємо так, щоб неможливо було вас
          ідентифікувати.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Як ми захищаємо інформацію?</h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Ми впроваджуємо різні заходи безпеки, щоб захистити вашу особисту інформацію при
          замовленні або під час введення, подачі чи доступу до ваших персональних даних.
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            Ми використовуємо безпечний сервер (SSL) для передавання конфіденційної
            інформації.
          </li>
        </ul>
        <p className="text-sm text-text-muted leading-relaxed">
          Ми не можемо гарантувати абсолютну безпеку даних, переданих через Сервіс, і не
          несемо відповідальності за доступ, розкриття, зміну чи знищення інформації у
          разі порушення фізичних, технічних чи організаційних заходів безпеки.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">
          Як ми використовуємо вашу електронну адресу?
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Надаючи свою електронну адресу, як перекладач, на цьому сервісі, ви погоджуєтесь
          отримувати від нас електронні листи. Ви можете відмовитися від участі у
          будь-яких наших розсилках у будь-який час, натиснувши на посилання для відписки,
          яке міститься в кожному листі.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Ми надсилаємо електронні листи тільки тим, хто дав нам дозвіл на контакт —
          безпосередньо або через третю сторону. Ми не розсилаємо небажану комерційну
          пошту (спам).
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Якщо ви надали електронну адресу через сторінку оформлення замовлення, вона буде
          використовуватися лише для інформування про ваше замовлення. Якщо ж ви надали ту
          ж адресу іншим способом, ми можемо використовувати її для будь-яких цілей,
          зазначених у цій Політиці.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          <strong className="text-text-main">Примітка:</strong> якщо ви хочете відписатися
          від майбутніх листів, інструкції для цього завжди додаються внизу кожного листа.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">
          Чи можуть мої дані передаватися в інші країни?
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          GameGlobe Localization зареєстрована в Україні. Інформація, зібрана через наш
          вебсайт, під час прямої взаємодії з вами або через наші служби підтримки, може
          час від часу передаватися нашим офісам, персоналу або третім сторонам,
          розташованим у різних країнах світу.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Дані можуть зберігатися та оброблятися в будь-якій країні, включаючи ті, де
          відсутнє загальне законодавство про захист даних. У межах чинного законодавства,
          використовуючи наш Сервіс, ви добровільно погоджуєтесь на трансграничну передачу
          та зберігання таких даних.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">
          Чи безпечна інформація, зібрана через Сервіс GameGlobe Localization та Little
          Bit?
        </h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Ми застосовуємо фізичні, електронні та організаційні заходи для захисту ваших
          даних.
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            Наші системи безпеки допомагають запобігати несанкціонованому доступу та
            забезпечувати правильне використання інформації.
          </li>
          <li>
            Незважаючи на ці заходи, жодна система або людина не можуть гарантувати
            абсолютну безпеку.
          </li>
          <li>
            Дані можуть бути втрачені або використані неправомірно через злочинні дії,
            помилки чи недотримання політик.
          </li>
        </ul>
        <p className="text-sm text-text-muted leading-relaxed">
          Таким чином, ми докладаємо розумних зусиль для захисту вашої інформації, але не
          можемо гарантувати її абсолютну безпеку.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">
          Оновлення та виправлення вашої інформації
        </h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Ваші права на оновлення або виправлення даних, що збирає GameGlobe Localization,
          залежать від вашого статусу користувача або клієнта.
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            <strong className="text-text-main">Персонал</strong> може оновлювати або
            виправляти свої дані згідно з внутрішніми політиками компанії.
          </li>
          <li>
            <strong className="text-text-main">Клієнти</strong> мають право вимагати
            обмеження певного використання або розкриття особистих даних.
          </li>
        </ul>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Ви можете звернутися до нас, щоб:
        </p>
        <ol className="list-decimal list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>Оновити або виправити свої персональні дані,</li>
          <li>Змінити налаштування отримання повідомлень та іншої інформації,</li>
          <li>
            Видалити персональні дані з наших систем (залежно від обставин), наприклад,
            через скасування акаунту.
          </li>
        </ol>
        <p className="text-sm text-text-muted leading-relaxed">
          Ми можемо попросити підтвердження особи (наприклад, унікальний пароль) перед
          наданням доступу або внесенням змін. Ви відповідаєте за збереження
          конфіденційності свого пароля та акаунту.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Зверніть увагу, що повністю видалити всі копії інформації технічно неможливо
          через резервні копії, але ми оновлюємо, виправляємо або видаляємо дані в
          активних системах якнайшвидше.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Персонал</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Якщо ви є співробітником або кандидатом на роботу в GameGlobe Localization, ми
          збираємо інформацію, яку ви добровільно надаєте.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Ми використовуємо ці дані для управління персоналом та надання пільг, а також
          для відбору кандидатів.
        </p>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Ви можете звернутися до нас, щоб:
        </p>
        <ol className="list-decimal list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>Оновити або виправити ваші дані,</li>
          <li>Змінити налаштування отримання інформації,</li>
          <li>Отримати запис даних, що стосуються вас.</li>
        </ol>
        <p className="text-sm text-text-muted leading-relaxed">
          Оновлення або виправлення не впливають на іншу інформацію, яку ми зберігали або
          передавали третім сторонам до внесення змін.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Продаж бізнесу</h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Ми залишаємо за собою право передавати інформацію третім сторонам у разі:
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            продажу, злиття або іншої передачі більшої частини активів GameGlobe
            Localization або її корпоративних афілійованих компаній,
          </li>
          <li>припинення діяльності, банкрутства чи реорганізації.</li>
        </ul>
        <p className="text-sm text-text-muted leading-relaxed">
          У такому випадку третя сторона зобов’язується дотримуватись умов цієї Політики
          конфіденційності.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Афілійовані компанії</h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Ми можемо розкривати інформацію (включно з персональною) нашим корпоративним
          афілійованим компаніям.
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            <strong className="text-text-main">Корпоративна афілійована компанія</strong>{' '}
            — будь-яка особа або організація, яка прямо або опосередковано контролює,
            перебуває під контролем або під спільним контролем з GameGlobe Localization.
          </li>
          <li>
            Будь-яка інформація, яку ми передаємо афілійованим компаніям, обробляється
            ними відповідно до цієї Політики конфіденційності.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Законодавство та юрисдикція</h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Ця Політика конфіденційності регулюється законами України без урахування
          колізійних норм.
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            Ви погоджуєтесь із виключною юрисдикцією українських судів для вирішення
            спорів, що виникають у зв’язку з цією Політикою, за винятком випадків, коли
            особи мають права відповідно до Privacy Shield або швейцарсько-американських
            угод.
          </li>
          <li>
            Використання вами вебсайту може також підпадати під інші локальні, державні,
            національні або міжнародні закони.
          </li>
        </ul>
        <p className="text-sm text-text-muted leading-relaxed">
          Використовуючи GameGlobe Localization та Little Bit або зв’язуючись з нами, ви
          підтверджуєте прийняття цієї Політики конфіденційності. Якщо ви не погоджуєтесь
          з нею, не використовуйте наш вебсайт та сервіси.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Ваша згода</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Ми оновили нашу Політику конфіденційності, щоб забезпечити повну прозорість щодо
          того, що відбувається з вашими даними під час використання нашого вебсайту.
          Використовуючи наш сайт, реєструючи акаунт або здійснюючи покупку, ви тим самим
          погоджуєтесь з умовами цієї Політики конфіденційності.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Посилання на інші вебсайти</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Ця Політика конфіденційності поширюється тільки на наші Сервіси. Сервіси можуть
          містити посилання на інші вебсайти, які не контролюються GameGlobe Localization.
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            Ми не несемо відповідальності за зміст, точність або думки, висловлені на цих
            сайтах.
          </li>
          <li>Ці сайти не перевіряються нами на повноту чи достовірність.</li>
          <li>
            Використовуючи посилання для переходу на сторонні сайти, наша Політика
            конфіденційності більше не діє.
          </li>
          <li>
            Ваша взаємодія на інших сайтах підпорядковується їх власним правилам і
            політикам.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Кукі та схожі технології</h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          GameGlobe Localization використовує «Cookies» для визначення відвіданих вами
          розділів вебсайту.
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            Cookie — це невеликий файл, збережений у вашому браузері або на пристрої.
          </li>
          <li>
            Ми використовуємо Cookies для покращення продуктивності та функціональності
            сайту.
          </li>
          <li>
            Без Cookies деякі функції (наприклад, відтворення відео або запам’ятовування
            входу) можуть бути недоступні.
          </li>
          <li>
            Більшість браузерів дозволяють відключати Cookies, але це може обмежити роботу
            вебсайту.
          </li>
          <li>Ми ніколи не зберігаємо персональні дані у Cookies.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">
          Блокування та відключення кукі та схожих технологій
        </h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Ви можете налаштувати свій браузер на блокування кукі та схожих технологій.
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            Зверніть увагу, що блокування деяких кукі може завадити правильній роботі
            вебсайту та обмежити доступ до його функцій.
          </li>
          <li>
            Деякі збережені дані (наприклад, логіни або налаштування сайту) можуть бути
            втрачені при блокуванні кукі.
          </li>
          <li>Різні браузери надають різні інструменти для керування кукі.</li>
          <li>
            Відключення кукі не видаляє їх автоматично, це потрібно робити вручну через
            браузер.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Ремаркетинг</h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Ми використовуємо ремаркетинг.
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            <strong className="text-text-main">Що таке ремаркетинг?</strong> Це практика
            показу реклами користувачам, які вже відвідували ваш сайт, на інших вебсайтах
            та платформах.
          </li>
          <li>
            Це дозволяє нашій компанії «надавати рекламу» користувачам на основі їх
            попередньої взаємодії з сайтом.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Деталі платежів</h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Що стосується кредитних карток або інших платіжних даних, які ви нам надали:
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            Ми гарантуємо зберігання цієї конфіденційної інформації у найнадійніший
            спосіб.
          </li>
          <li>
            Дані передаються та зберігаються з використанням сучасних технологій безпеки
            (шифрування, захищені сервери тощо).
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Конфіденційність дітей</h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Ми не надаємо послуги особам віком до 13 років.
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>Ми свідомо не збираємо персональні дані дітей до 13 років.</li>
          <li>
            Якщо ви є батьком або опікуном і знаєте, що ваша дитина надала нам персональні
            дані, будь ласка, зв’яжіться з нами.
          </li>
          <li>
            Якщо ми виявимо, що випадково зібрали персональні дані дитини до 13 років без
            підтвердження згоди батьків, ми видаляємо ці дані зі своїх серверів.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">
          Зміни у Політиці конфіденційності
        </h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Ми можемо змінювати Сервіс та політики, включно з цією Політикою
          конфіденційності.
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            Зміни будуть повідомлені заздалегідь (наприклад, через Сервіс), щоб ви могли
            їх переглянути до набуття чинності.
          </li>
          <li>
            Продовження використання Сервісу після змін означає вашу згоду з оновленою
            Політикою.
          </li>
          <li>Якщо ви не погоджуєтесь із змінами, ви можете видалити свій акаунт.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Сторонні сервіси</h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Ми можемо відображати, включати або надавати сторонній контент (дані,
          застосунки, послуги) та посилання на сторонні вебсайти чи сервіси («Сторонні
          сервіси»).
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            Ви погоджуєтесь, що GameGlobe Localization та Little Bit не несе
            відповідальності за Сторонні сервіси, включно з їх точністю, повнотою,
            законністю, якістю або відповідністю авторським правом.
          </li>
          <li>
            Сторонні сервіси надаються лише для вашої зручності, і ви користуєтесь ними на
            власний ризик, дотримуючись умов цих сторонніх ресурсів.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Facebook Pixel</h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Facebook Pixel — це аналітичний інструмент, який дозволяє вимірювати
          ефективність реклами, аналізуючи дії користувачів на вашому вебсайті.
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            Pixel допомагає показувати рекламу саме тим користувачам, які можуть бути
            зацікавлені.
          </li>
          <li>
            Facebook Pixel може збирати інформацію з вашого пристрою під час використання
            сервісу.
          </li>
          <li>
            Дані, зібрані Pixel, обробляються відповідно до Політики конфіденційності
            Facebook.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Технології відстеження</h4>
        <h5 className="text-sm font-semibold text-text-main mb-2">Cookies</h5>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2 mb-3">
          <li>
            Ми використовуємо Cookies для підвищення продуктивності та функціональності
            вебсайту.
          </li>
          <li>
            Без Cookies деякі функції (наприклад, відтворення відео чи автоматичний вхід)
            можуть бути недоступні.
          </li>
        </ul>
        <h5 className="text-sm font-semibold text-text-main mb-2">Сесії (Sessions)</h5>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            GameGlobe Localization та Little Bit використовує «Сесії» для визначення
            відвіданих вами розділів вебсайту.
          </li>
          <li>Сесія — це невеликий файл, збережений браузером на вашому пристрої.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">
          Інформація про Загальний регламент захисту даних (GDPR)
        </h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Ми можемо збирати та використовувати ваші дані, якщо ви перебуваєте в
          Європейській економічній зоні (EEA). У цьому розділі пояснюється, як і навіщо ми
          збираємо ці дані та як захищаємо їх від неправомірного використання.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Що таке GDPR?</h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          GDPR — це закон ЄС про конфіденційність та захист даних, який регулює, як
          компанії повинні захищати дані жителів ЄС, і підвищує контроль, який жителі ЄС
          мають над своїми персональними даними.
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            GDPR стосується будь-якої глобальної компанії, а не тільки тих, що базуються в
            ЄС.
          </li>
          <li>
            Дані наших клієнтів важливі незалежно від місця їхнього знаходження, тому ми
            впровадили стандарти GDPR у всіх операціях.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Що таке персональні дані?</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Персональні дані — це будь-яка інформація, що стосується ідентифікованої або
          ідентифіковної особи.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          GDPR охоплює широкий спектр даних, які можна використовувати окремо або в
          комбінації з іншою інформацією для ідентифікації особи.
        </p>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          <strong className="text-text-main">Приклади персональних даних:</strong>
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>фінансова інформація,</li>
          <li>політичні погляди,</li>
          <li>генетичні або біометричні дані,</li>
          <li>IP-адреси, фізичні адреси,</li>
          <li>сексуальна орієнтація, етнічність.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Принципи захисту даних</h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Вимоги GDPR включають:
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>Персональні дані мають збиратися законно, справедливо та прозоро.</li>
          <li>
            Дані збираються тільки для конкретної мети і використовуються лише для цієї
            мети.
          </li>
          <li>Дані не зберігаються довше, ніж необхідно для цілі збору.</li>
          <li>
            Люди мають право доступу до своїх персональних даних, отримувати копії,
            оновлювати, видаляти або переносити їх.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Чому GDPR важливий?</h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          GDPR встановлює нові вимоги щодо того, як компанії повинні захищати персональні
          дані користувачів, яких вони збирають і обробляють.
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>Підвищує відповідальність компаній і збільшує штрафи за порушення.</li>
          <li>Забезпечує прозорість та контроль користувачів над їхніми даними.</li>
          <li>
            Для GameGlobe Localization та Little Bit дотримання GDPR — це не лише вимога
            закону, а й частина нашої політики забезпечення приватності.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">
          Права суб’єктів даних — доступ, перенесення, видалення
        </h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Ми зобов’язані допомагати нашим клієнтам відповідати на вимоги GDPR щодо прав
          суб’єктів даних.
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            Всі персональні дані обробляються та зберігаються у перевірених постачальників
            послуг, сумісних із DPA.
          </li>
          <li>
            Ми зберігаємо всі розмови та персональні дані до 6 років, якщо акаунт не
            видалено.
          </li>
          <li>
            У разі видалення акаунту, всі дані знищуються відповідно до наших умов, проте
            не довше ніж 60 днів.
          </li>
        </ul>
        <p className="text-sm text-text-muted leading-relaxed">
          Клієнти з ЄС можуть отримувати доступ до даних, оновлювати їх, видаляти або
          переносити. GameGlobe Localization та Little Bit забезпечує можливість
          самостійного управління даними та підтримку служби клієнтської підтримки.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Ми відповідаємо на такі запити протягом одного місяця. Ми{' '}
          <strong className="text-text-main">
            не продаємо персональні дані користувачів
          </strong>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Контакти</h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Якщо у вас є будь-які питання, звертайтесь:
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            <strong className="text-text-main">Email: </strong>
            <a
              href="mailto:pr@gameglobe-localisation.com"
              className="text-color-accent hover:text-color-main transition-colors underline"
            >
              pr@gameglobe-localisation.com
            </a>
          </li>
          <li>
            <strong className="text-text-main">Telegram: </strong>
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

      <div className="mt-6 p-4 rounded-lg bg-glass border border-border">
        <p className="text-xs text-text-muted text-center">
          Останнє оновлення: {new Date().toLocaleDateString('uk-UA')}
        </p>
      </div>
    </div>
  </Modal>
);
