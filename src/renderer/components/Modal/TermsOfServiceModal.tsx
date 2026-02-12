import { FileText } from 'lucide-react';
import React from 'react';
import { Modal } from './Modal';

interface TermsOfServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsOfServiceModal: React.FC<TermsOfServiceModalProps> = ({
  isOpen,
  onClose,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title="Умови використання"
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
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-color-accent to-color-main flex items-center justify-center flex-shrink-0">
          <FileText size={24} className="text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">LBK Launcher</h3>
          <p className="text-sm text-text-muted">Умови використання послуги</p>
        </div>
      </div>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Загально</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Використовуючи сервіс та послуги від GameGlobe Localization та Little Bit, ви
          підтверджуєте, що погоджуєтесь із умовами обслуговування та зобов’язані
          дотримуватись їх, як зазначено в розділі «Умови та положення» нижче. Ці умови
          застосовуються до всього застосунку та будь-якої електронної або іншої форми
          комунікації між вами та GameGlobe Localization, та Little Bit.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Ні за яких обставин команди GameGlobe Localization та Little Bit не несуть
          відповідальності за будь-які прямі, непрямі, спеціальні, випадкові або непрямі
          збитки, включаючи, але не обмежуючись, втрату даних або прибутку, що виникли
          внаслідок використання або неможливості використання матеріалів сервісів, навіть
          якщо команди GameGlobe Localization та Little Bit або уповноважений представник
          були попереджені про можливість таких збитків. Якщо використання матеріалів із
          сервісів призведе до необхідності обслуговування, ремонту або виправлення
          обладнання чи даних, ви несете відповідні витрати.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          GameGlobe Localization та Little Bit не несуть відповідальності за будь-які
          наслідки, що можуть виникнути під час використання наших ресурсів. Ми залишаємо
          за собою право змінювати ціни та переглядати політику використання ресурсів у
          будь-який момент.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Ліцензія</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          GameGlobe Localization та Little Bit надає вам невиключну, непередавану,
          обмежену ліцензію на завантаження, встановлення та використання продукту
          лаунчеру LBK Launcher строго відповідно до умов цього Договору.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Ці «Умови та положення» є договором між вами та GameGlobe Localization та Little
          Bit (у цих Умовах та положеннях іменується як «LBK Team», «ми», «наш» або
          «нас»), лаунчером LBK, доступних через цей продукт (які разом у цих Умовах та
          положеннях називаються «Сервіс GameGlobe Localization та Little Bit»).
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Ви погоджуєтесь дотримуватися цих Умов та положень. Якщо ви не погоджуєтесь із
          цими Умовами та положеннями, будь ласка, не використовуйте Сервіс GameGlobe
          Localization та Little Bit.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          У цих Умовах та положеннях «ви» означає як вас як фізичну особу, так і юридичну
          особу, яку ви представляєте. Якщо ви порушите будь-які з цих Умов та положень,
          ми залишаємо за собою право скасувати ваш акаунт або заблокувати доступ до нього
          без попереднього повідомлення.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Значення термінів</h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          У цих Умовах та положеннях:
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            <strong className="text-text-main">Cookie</strong>: невелика кількість даних,
            створених застосунком та збережених вашим браузером. Використовується для
            ідентифікації браузера, аналітики, запам’ятовування інформації про вас,
            наприклад, мови або даних для входу.
          </li>
          <li>
            <strong className="text-text-main">Компанія</strong>: коли в політиці
            згадуються «Компанія», «ми», «нас» або «наш», мається на увазі
            <strong className="text-text-main">GameGlobe Localization LTD</strong> (вул.
            Металістів, 4, Київ, 02000), яка відповідає за ваші дані відповідно до цих
            Умов та положень.
          </li>
          <li>
            <strong className="text-text-main">Країна</strong>: країна, де розташована
            GameGlobe Localization або її власники/засновники, у цьому випадку — Україна.
          </li>
          <li>
            <strong className="text-text-main">Пристрій</strong>: будь-який пристрій з
            доступом до інтернету, наприклад, телефон, планшет, комп’ютер або інший
            пристрій, що може використовуватися для відвідування GameGlobe Localization та
            використання сервісів.
          </li>
          <li>
            <strong className="text-text-main">Сервіс</strong>: послуга, яку надає
            GameGlobe Localization, як описано у відповідних умовах (якщо доступно) та на
            цій платформі.
          </li>
          <li>
            <strong className="text-text-main">Сторонній сервіс</strong>: рекламодавці,
            спонсори конкурсів, партнери з промоції та маркетингу та інші, які надають наш
            контент або чиї продукти та послуги можуть вас зацікавити.
          </li>
          <li>
            <strong className="text-text-main">Вебсайт</strong>: сайт GameGlobe
            Localization, доступний за URL:
            <a
              href="https://ggloc.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-color-accent hover:text-color-main transition-colors underline"
            >
              https://ggloc.org/
            </a>
          </li>
          <li>
            <strong className="text-text-main">Ви</strong>: особа або організація, що
            користуються сервісами від GameGlobe Localization та Little Bit для
            використання Сервісів.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Обмеження</h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Ви погоджуєтесь не робити і не дозволяти іншим робити:
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            Ліцензувати, продавати, здавати в оренду, передавати, розповсюджувати,
            транслювати, хостити, залучати сторонніх підрядників, розкривати або іншим
            чином комерційно використовувати застосунок чи робити платформу доступною для
            третіх осіб.
          </li>
          <li>
            Модифікувати, створювати похідні твори, розбирати, декодувати, компілювати у
            зворотному порядку або здійснювати реверс-інжиніринг будь-якої частини
            застосунку.
          </li>
          <li>
            Видаляти, змінювати або приховувати будь-які власницькі позначки (включно з
            повідомленнями про авторське право або торговельну марку) GameGlobe
            Localization та Little Bit, її афілійованих осіб, партнерів, постачальників
            або ліцензіарів застосунку.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Ваші пропозиції</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Будь-які відгуки, коментарі, ідеї, покращення або пропозиції (разом —
          «Пропозиції»), надані вами GameGlobe Localization та Little Bit щодо застосунку,
          залишаються виключною власністю GameGlobe Localization та Little Bit.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          GameGlobe Localization та Little Bit має право використовувати, копіювати,
          модифікувати, публікувати або розповсюджувати Пропозиції для будь-яких цілей
          будь-яким способом без надання вам авторства або компенсації.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Ваша згода</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Ми оновили наші Умови та положення, щоб забезпечити вам повну прозорість щодо
          того, що встановлюється під час відвідування нашого сайту та як це
          використовується. Використовуючи наш застосунок, реєструючи акаунт або
          здійснюючи покупку, ви погоджуєтесь із цими Умовами та положеннями.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Посилання на інші ресурси</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Ці Умови та положення застосовуються лише до наших Сервісів. Сервіси можуть
          містити посилання на інші вебсайти, які не контролюються GameGlobe Localization
          та Little Bit. Ми не несемо відповідальності за контент, точність або думки,
          представлені на таких сайтах. Використовуючи посилання на інші сайти, ви
          погоджуєтесь із правилами та політиками тих сайтів. Треті сторони можуть
          використовувати власні cookie або інші методи збору інформації про вас.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Cookies</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          GameGlobe Localization та Little Bit використовує Cookies, щоб визначити, які
          частини нашого сайту ви відвідали. Cookie — це невеликий фрагмент даних,
          збережений вашим браузером на комп’ютері або мобільному пристрої. Ми
          використовуємо Cookies для покращення функціональності сайту, але вони не є
          обов’язковими для використання. Без цих cookie деякі функції, наприклад відео,
          можуть бути недоступні або вам доведеться вводити дані для входу щоразу при
          відвідуванні сайту. Більшість браузерів дозволяють відключати Cookies, але це
          може обмежити функціональність сайту. Ми ніколи не зберігаємо персональні дані у
          Cookies.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Зміни до Умов та положень</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Ви визнаєте, що GameGlobe Localization та Little Bit може припинити (тимчасово
          або постійно) надання Сервісу або його функцій на власний розсуд без
          попереднього повідомлення. Ви можете припинити користування Сервісом у будь-який
          час. Якщо GameGlobe Localization заблокує ваш акаунт, доступ до Сервісу, акаунту
          або файлів у ньому може бути обмежений.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Якщо ми змінюємо Умови та положення, ці зміни будуть опубліковані на цій
          сторінці, і/або оновлено дату зміни Умов та положень.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Модифікації лаунчеру</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          GameGlobe Localization та Little Bit залишає за собою право змінювати,
          призупиняти або припиняти роботу сайту чи будь-якої пов’язаної послуги тимчасово
          або постійно, з повідомленням або без нього, без відповідальності перед вами.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Оновлення лаунчеру</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          GameGlobe Localization та Little Bit може періодично надавати покращення
          функціональності сайту, включаючи патчі, виправлення помилок, оновлення або
          модернізації (Оновлення).
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Оновлення можуть змінювати або видаляти певні функції сайту. Ви погоджуєтесь, що
          GameGlobe Localization та Little Bit не зобов’язана надавати будь-які Оновлення
          або підтримувати конкретні функції сайту.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Всі Оновлення є невід’ємною частиною сайту та підпорядковуються цим Умовам та
          положенням.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Сторонні послуги</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Ми можемо відображати, включати або надавати контент третіх сторін (дані,
          інформацію, додатки та інші продукти чи послуги) або посилання на вебсайти чи
          сервіси третіх сторін («Сторонні послуги»).
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Ви погоджуєтесь, що GameGlobe Localization та Little Bit не несе
          відповідальності за будь-які Сторонні послуги, включаючи їх точність, повноту,
          своєчасність, дійсність, дотримання авторських прав, законність, якість або
          будь-які інші аспекти. GameGlobe Localization та Little Bit не несе жодної
          відповідальності перед вами або іншими особами за ці Сторонні послуги.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Сторонні послуги та посилання на них надаються лише для зручності, і ви
          використовуєте їх на власний ризик, дотримуючись правил і умов третьої сторони.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Термін дії та припинення</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Ця Угода діє до її припинення вами або GameGlobe Localization та Little Bit.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          GameGlobe Localization та Little Bit може у будь-який час, з будь-якої причини
          або без неї, призупинити або припинити цю Угоду з попередженням або без нього.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Ця Угода автоматично припиняється без попередження, якщо ви не виконуєте
          будь-яку її умову. Ви також можете припинити Угоду, видаливши сайт і всі його
          копії з вашого пристрою.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Після припинення Угоди ви повинні припинити використання сайту і видалити всі
          його копії. Припинення не обмежує права або засоби захисту GameGlobe
          Localization та Little Bit у випадку порушення вами умов Угоди.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">
          Повідомлення про порушення авторських прав
        </h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Якщо ви є власником авторських прав або уповноваженим представником і вважаєте,
          що будь-який матеріал на нашому сайті порушує ваші авторські права, будь ласка,
          зв’яжіться з нами та надайте:
        </p>
        <ol className="list-decimal list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            Фізичний або електронний підпис власника авторських прав або уповноваженої
            особи.
          </li>
          <li>Ідентифікацію матеріалу, який нібито порушує права.</li>
          <li>Ваші контактні дані (адреса, телефон, email).</li>
          <li>
            Заяву, що у вас є добросовісна впевненість у незаконності використання
            матеріалу.
          </li>
          <li>
            Заяву про точність наданої інформації та ваше уповноваження діяти від імені
            власника.
          </li>
        </ol>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Відшкодування збитків</h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Ви погоджуєтесь відшкодовувати збитки GameGlobe Localization та Little Bit та її
          материнським компаніям, філіям, співробітникам, партнерам і ліцензіарам у разі
          претензій через:
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>використання сайту вами;</li>
          <li>порушення Угоди або закону;</li>
          <li>порушення прав третьої сторони.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Відсутність гарантій</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Сайт надається «ЯК Є» та «З НАЯВНІСТЮ ВСІХ ПОМИЛОК».
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          GameGlobe Localization та Little Bit не надає гарантій щодо відповідності сайту
          вашим вимогам, безперебійної роботи, сумісності з іншими програмами чи
          системами, відсутності помилок або вірусів.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Деякі юрисдикції не дозволяють обмежувати гарантії, тому частина вищезазначеного
          може не застосовуватися до вас.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Обмеження відповідальності</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Незалежно від можливих збитків, відповідальність GameGlobe Localization та
          Little Bit і постачальників обмежується сумою, фактично сплаченою вами за сайт.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          GameGlobe Localization та Little Bit не несе відповідальності за спеціальні,
          побічні, непрямі або наслідкові збитки, навіть якщо її попереджали про
          можливість таких збитків.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Деякі юрисдикції не дозволяють обмежувати побічні або непрямі збитки, тому це
          обмеження може не застосовуватися.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Вирішення конфліктів</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Якщо будь-яка частина цієї Угоди визнається недійсною або невиконуваною, ця
          частина буде змінена і тлумачитися так, щоб максимально досягти її мети, а решта
          положень залишатиметься в силі.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Ця Угода разом із Політикою конфіденційності та іншими юридичними повідомленнями
          GameGlobe Localization та Little Bit становить повну угоду між вами та GameGlobe
          Localization та Little Bit щодо Послуг.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Якщо будь-який пункт Угоди визнається недійсним судом, це не впливає на чинність
          інших положень. Невиконання будь-якого права не є його відмовою.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Ви та GameGlobe Localization та Little Bit погоджуєтеся, що будь-який позов,
          пов’язаний із Послугами, повинен бути поданий протягом одного (1) року після
          виникнення підстави для позову. Інакше позов вважається остаточно закритим.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Відмова</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          За винятком передбаченого цим документом, невиконання права або вимоги виконання
          зобов’язання не впливає на здатність сторони здійснювати це право пізніше.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Невиконання або затримка здійснення будь-якого права або повноваження не є
          відмовою від нього.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          У випадку конфлікту цієї Угоди з іншими умовами придбання чи використання,
          перевага надається цим умовам.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Зміни цієї Угоди</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          GameGlobe Localization залишає за собою право змінювати або замінювати цю Угоду
          на власний розсуд у будь-який час.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Якщо зміни суттєві, ми надамо повідомлення принаймні за 30 днів до набрання
          чинності нових умов. <br /> Продовжуючи користування сайтом після внесення змін,
          ви погоджуєтеся з новими умовами. Якщо ні, ви більше не маєте права
          користуватися GameGlobe Localization та Little Bit.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Повна Угода</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Ця Угода є повною угодою між вами та GameGlobe Localization та Little Bit щодо
          користування сайтом і замінює всі попередні усні чи письмові домовленості.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Ви можете підпадати під додаткові умови при використанні або купівлі інших
          послуг GameGlobe Localization та Little Bit, які надаватимуться вам під час
          використання або покупки.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Оновлення наших умов</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Ми можемо змінювати наші Послуги та політики, а також ці умови, щоб вони
          відповідали дійсності.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Якщо зміни відбудуться, ми повідомимо вас (наприклад, через Послугу) до їх
          вступу в силу, і ви зможете ознайомитися з ними. Продовження користування
          означає вашу згоду з оновленими умовами.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Інтелектуальна власність</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Сайт та його вміст, функції та функціональність (включно з інформацією,
          програмним забезпеченням, текстами, зображеннями, відео та аудіо, а також
          дизайном та організацією матеріалів) належать GameGlobe Localization та Little
          Bit, її ліцензіарам або іншим постачальникам і захищені законами про авторське
          право, торгові марки, патенти та інші права.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Матеріали не можна копіювати, змінювати, розповсюджувати або завантажувати без
          письмової згоди GameGlobe Localization та Little Bit, якщо це прямо не дозволено
          цією Угодою.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Згода на арбітраж</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Цей розділ застосовується до будь-якого спору,{' '}
          <strong className="text-text-main">
            окрім спорів щодо забезпечувальних чи справедливих засобів захисту щодо прав
            інтелектуальної власності вас або GameGlobe Localization та Little Bit
          </strong>
          .
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Термін «спір» означає будь-який конфлікт, позов або іншу суперечку між вами та
          GameGlobe Localization та Little Bit щодо Послуг або цієї Угоди, незалежно від
          того, чи це контракт, гарантія, делікт, закон чи будь-яка інша правова або
          справедлива підстава.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Повідомлення про спір</h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          У випадку спору ви або GameGlobe Localization повинні надати іншій стороні{' '}
          <strong className="text-text-main">Повідомлення про спір</strong> — письмове
          повідомлення із зазначенням:
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>імені, адреси та контактної інформації сторони, яка подає повідомлення;</li>
          <li>фактів, що стали причиною спору;</li>
          <li>вимог щодо вирішення.</li>
        </ul>
        <p className="text-sm text-text-muted leading-relaxed mt-2">
          Повідомлення слід надіслати електронною поштою на:{' '}
          <strong className="text-text-main">pr@gameglobe-localisation.com</strong>.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          GameGlobe Localization надішле вам Повідомлення поштою на вашу адресу, якщо вона
          відома, або електронною поштою.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Ви та GameGlobe Localization намагатиметесь вирішити спір через{' '}
          <strong className="text-text-main">
            неформальні переговори протягом 60 днів
          </strong>
          від дати надсилання повідомлення. Після 60 днів будь-яка сторона може почати
          арбітраж.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Обов’язковий арбітраж</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Якщо спір не вирішено через неформальні переговори, будь-які подальші дії будуть
          здійснюватися
          <strong className="text-text-main">
            винятково через обов’язковий арбітраж
          </strong>
          .
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Ви відмовляєтесь від права судитися в суді або брати участь у груповому позові.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Арбітраж проводиться відповідно до правил{' '}
          <strong className="text-text-main">American Arbitration Association</strong>.
          Будь-які тимчасові заходи для захисту прав чи майна можуть надаватися
          компетентним судом до завершення арбітражу.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Витрати на арбітраж, включно з юридичними та іншими витратами, несе сторона, що
          не перемогла.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">
          Подання матеріалів та конфіденційність
        </h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Якщо ви надсилаєте ідеї, пропозиції, фотографії, інформацію або інші матеріали,
          включно з ідеями щодо продуктів, послуг або промоцій, ви погоджуєтеся, що:
        </p>
        <ul className="list-disc list-inside text-sm text-text-muted space-y-1 ml-2">
          <li>
            Всі такі матеріали вважаються
            <strong className="text-text-main">
              неконфіденційними та не є власністю автора
            </strong>
            ;
          </li>
          <li>
            Вони стають{' '}
            <strong className="text-text-main">
              власністю GameGlobe Localization та Little Bit без будь-якої компенсації
            </strong>
            ;
          </li>
          <li>
            <strong className="text-text-main">GameGlobe Localization</strong> може
            використовувати ці ідеї у будь-яких цілях назавжди.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Проведення розіграшів</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          GameGlobe Localization та Little Bit може час від часу проводити конкурси,
          акції, розіграші або інші заходи («Промоції»), які вимагають від вас надання
          матеріалів або інформації про себе.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Зверніть увагу:{' '}
          <strong className="text-text-main">
            всі Промоції можуть регулюватися окремими правилами
          </strong>
          , які можуть включати вимоги щодо віку або географічного розташування.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Ви несете відповідальність за те, щоб ознайомитися з правилами Промоцій і
          визначити, чи можете брати участь. Якщо ви берете участь у будь-якій Промоції,
          ви погоджуєтеся дотримуватися всіх правил цієї Промоції.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Додаткові умови</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          До придбання товарів або послуг через Сервіси можуть застосовуватися додаткові
          умови, які стають частиною цієї Угоди.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Різне</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Якщо будь-який пункт цих Умов буде визнаний недійсним, інші пункти залишаються в
          силі. Відмова від будь-якого права чи положення діє лише письмово і лише якщо
          підписана уповноваженим представником GameGlobe Localization та Little Bit.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          GameGlobe Localization та Little Bit керує Сервісом із офісів в Україні. Сервіс{' '}
          <strong className="text-text-main">
            не призначений для використання в юрисдикціях
          </strong>
          , де це суперечить закону.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Загальні положення цієї Угоди включають{' '}
          <strong className="text-text-main">
            Політику конфіденційності GameGlobe Localization та Little Bit
          </strong>{' '}
          і замінюють усі попередні домовленості.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Відмова від відповідальності</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          <strong className="text-text-main">
            GameGlobe Localization та Little Bit не несе відповідальності за точність
            контенту, коду чи іншої інформації
          </strong>
          .
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          Сервіс надається
          <strong className="text-text-main">«як є» та «як доступно»</strong>, без
          гарантій будь-якого виду.
        </p>
        <p className="text-sm text-text-muted leading-relaxed">
          GameGlobe Localization та Little Bit{' '}
          <strong className="text-text-main">
            не гарантує безперебійності, точності або відповідності Сервісу вашим
            очікуванням
          </strong>
          . Ми не гарантуємо, що Сервіс буде сумісним з будь-яким іншим програмним
          забезпеченням чи пристроями, або що помилки будуть виправлені.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className="text-base font-semibold mb-2">Контакти</h4>
        <p className="text-sm text-text-muted leading-relaxed mb-2">
          Якщо у вас є запитання, не вагайтеся зв’язатися з нами:
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
