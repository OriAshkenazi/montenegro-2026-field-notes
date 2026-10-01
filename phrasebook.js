'use strict';
// Montenegrin phrasebook, written in Latin script, grouped by situation in the order a trip unfolds.
// Each item is [Montenegrin, English, Hebrew, English phonetics, Hebrew phonetics].
// English phonetics: CAPS = stressed syllable, vowels are pure (a as in "father", e as in "bed", i as in "see", o as in "more", u as in "food").
// Hebrew phonetics are unpointed: ו = o/u, ב = v/b, צ׳ = č/ć, ז׳ = ž, ג׳ = đ/dž, ח = h. They are approximations, not a spelling standard.
// Titles and tips are [English, Hebrew]. `compact` groups render as a two-column grid.
const PHRASEBOOK = {
  pronunciation: [
    ['c', 'ts as in “cats”', 'צ, כמו ב״ציפור״'],
    ['č', 'ch as in “church”', 'צ׳ קשה, כמו ב״צ׳יפס״'],
    ['ć', 'softer ch, tongue further forward', 'צ׳ רכה יותר, הלשון קרובה לשיניים'],
    ['š', 'sh as in “shop”', 'ש, כמו ב״שלום״'],
    ['ž', 's as in “measure”', 'ז׳, כמו ב״ז׳קט״'],
    ['đ · dž', 'j as in “jam” (đ is softer)', 'ג׳, כמו ב״ג׳ירפה״ (ב-đ רכה יותר)'],
    ['j', 'y as in “yes”', 'י, כמו ב״יום״'],
    ['h', 'rough h, like the Hebrew ח', 'ח, כמו ב״חלב״'],
    ['lj · nj', 'ly / ny, as in “million” / “canyon”', 'לי / ני, כמו ב״מיליון״ / ״קניון״'],
    ['r', 'rolled; can act as a vowel (Crna, prst)', 'ר מגולגלת; יכולה לשמש כתנועה (Crna, prst)'],
    ['ś · ź', 'Montenegrin-only letters, “sj” / “zj”; most speakers sound like š / ž', 'אותיות מונטנגריות בלבד, ״שי״ / ״זי״; רוב הדוברים מבטאים כמו š / ž']
  ],
  groups: [
    {
      id: 'basics', open: true,
      title: ['Essentials', 'הבסיס'],
      tip: ['Dobar dan works from morning to evening; Ćao is informal and means both hello and bye. Serbian, Croatian and Bosnian speakers understand all of this, and English is usually fine at hotels and restaurants on the coast. In small mountain places, a few words in Montenegrin go a long way.',
        'Dobar dan מתאים מהבוקר עד הערב; Ćao הוא לא רשמי ומשמש גם לשלום וגם להתראות. דוברי סרבית, קרואטית ובוסנית מבינים את כל זה, ואנגלית בדרך כלל עובדת במלונות ובמסעדות בחוף. בכפרי ההר, כמה מילים במונטנגרית עושות רושם גדול.'],
      items: [
        ['Zdravo / Ćao', 'Hello', 'שלום', 'ZDRAH-vo / CHAH-o', 'זדראבו / צ׳או'],
        ['Dobro jutro', 'Good morning', 'בוקר טוב', 'DOH-bro YOO-tro', 'דוברו יוטרו'],
        ['Dobar dan', 'Good day', 'יום טוב', 'DOH-bar DAHN', 'דובר דאן'],
        ['Dobro veče', 'Good evening', 'ערב טוב', 'DOH-bro VEH-cheh', 'דוברו בצ׳ה'],
        ['Laku noć', 'Good night', 'לילה טוב', 'LAH-koo NOHCH', 'לאקו נוץ׳'],
        ['Doviđenja', 'Goodbye', 'להתראות', 'doh-vee-JEH-nya', 'דובי-ג׳ניה'],
        ['Molim', 'Please / You’re welcome', 'בבקשה', 'MOH-leem', 'מולים'],
        ['Hvala', 'Thank you', 'תודה', 'HVAH-lah', 'חבאלה'],
        ['Hvala puno', 'Thank you very much', 'תודה רבה', 'HVAH-lah POO-no', 'חבאלה פונו'],
        ['Izvinite', 'Excuse me / Sorry', 'סליחה', 'eez-VEE-nee-teh', 'איזבי-ניטה'],
        ['Da / Ne', 'Yes / No', 'כן / לא', 'DAH / NEH', 'דה / נה'],
        ['Ne razumijem', 'I don’t understand', 'אני לא מבין/ה', 'neh rah-ZOO-mee-yem', 'נה ראזו-מי-ים'],
        ['Govorite li engleski?', 'Do you speak English?', 'אתם מדברים אנגלית?', 'go-VOH-ree-teh lee EN-gleh-skee', 'גובוריטה לי אנגלסקי'],
        ['Polako, molim', 'Slowly, please', 'לאט, בבקשה', 'poh-LAH-ko MOH-leem', 'פולאקו מולים'],
        ['Možete li ponoviti?', 'Can you repeat that?', 'אפשר לחזור על זה?', 'MOH-zheh-teh lee poh-NOH-vee-tee', 'מוז׳טה לי פונוביטי'],
        ['Gdje je toalet?', 'Where is the toilet?', 'איפה השירותים?', 'GDYEH yeh TOH-ah-let', 'גדיה יה טואלט']
      ]
    },
    {
      id: 'airport',
      title: ['Airport & car pickup', 'שדה תעופה ואיסוף רכב'],
      tip: ['If the flight is delayed, call Europcar Tivat (number in section 05). Bring a physical credit card in the main driver’s name for the deposit (section 02), and photograph any damage before you drive off.',
        'אם הטיסה מתעכבת, מתקשרים ל-Europcar בטיוואט (המספר בחלק 05). להביא כרטיס אשראי פיזי על שם הנהג הראשי עבור הפיקדון (חלק 02), ולצלם כל נזק קיים לפני שיוצאים לדרך.'],
      items: [
        ['Gdje je preuzimanje prtljaga?', 'Where is baggage claim?', 'איפה איסוף המזוודות?', 'GDYEH yeh preh-oo-zee-MAH-nyeh PRT-lyah-gah', 'גדיה יה פרואזימאניה פרטליאגה'],
        ['Gdje je rent-a-kar?', 'Where is the car-rental desk?', 'איפה דלפק השכרת הרכב?', 'GDYEH yeh rent-ah-KAHR', 'גדיה יה רנט-א-קאר'],
        ['Imam rezervaciju za auto', 'I have a car reservation', 'יש לי הזמנה לרכב', 'EE-mahm reh-zer-VAH-tsee-yoo zah OW-toh', 'אימאם רזרבציו זה אוטו'],
        ['Koliko je depozit?', 'How much is the deposit?', 'כמה הפיקדון?', 'KOH-lee-ko yeh DEH-poh-zeet', 'קוליקו יה דפוזיט'],
        ['Ima li oštećenja na autu?', 'Is there any damage on the car?', 'יש נזקים ברכב?', 'EE-mah lee oh-shteh-CHEH-nyah nah OW-too', 'אימה לי אושטצ׳ניה נה אאוטו'],
        ['Gdje da vratim auto?', 'Where do I return the car?', 'איפה מחזירים את הרכב?', 'GDYEH dah VRAH-teem OW-toh', 'גדיה דה ברטים אוטו'],
        ['Let kasni', 'The flight is delayed', 'הטיסה מתעכבת', 'LEHT KAH-snee', 'לט קאסני'],
        ['Gdje mogu promijeniti novac?', 'Where can I change money?', 'איפה אפשר להמיר כסף?', 'GDYEH MOH-goo proh-mee-YEH-nee-tee NOH-vahts', 'גדיה מוגו פרומיינטי נובאץ'],
        ['Bankomat', 'ATM', 'כספומט', 'bahn-KOH-maht', 'בנקומאט'],
        ['Taksi', 'Taxi', 'מונית', 'TAHK-see', 'טאקסי'],
        ['Koliko košta do Kotora?', 'How much to Kotor?', 'כמה עולה עד קוטור?', 'KOH-lee-ko KOSH-tah doh KOH-toh-rah', 'קוליקו קושטה דו קוטורה']
      ]
    },
    {
      id: 'fuel',
      title: ['Petrol station', 'תחנת דלק'],
      tip: ['Pumps label diesel Eurodizel and petrol Eurosuper 95; prices are in section 03. Return the rental full-to-full and keep the receipt (Treba mi račun); refuel within 5 km of the airport.',
        'בתחנות הסולר מסומן Eurodizel והבנזין Eurosuper 95; המחירים בחלק 03. מחזירים את הרכב עם מיכל מלא ושומרים קבלה (Treba mi račun); לתדלק במרחק של עד 5 ק״מ מהשדה.'],
      items: [
        ['Benzinska pumpa', 'Petrol station', 'תחנת דלק', 'BEN-zeen-skah POOM-pah', 'בנזינסקה פומפה'],
        ['Gdje je najbliža pumpa?', 'Where is the nearest petrol station?', 'איפה תחנת הדלק הקרובה?', 'GDYEH yeh NY-blee-zhah POOM-pah', 'גדיה יה נייבליז׳ה פומפה'],
        ['Pun rezervoar, molim', 'Fill it up, please', 'מלא, בבקשה', 'POON reh-zer-VWAR MOH-leem', 'פון רזרבואר מולים'],
        ['Za trideset eura, molim', '€30 worth, please', 'ב-30 יורו, בבקשה', 'ZAH TREE-deh-set EH-oo-rah MOH-leem', 'זה טרידסט אורה מולים'],
        ['Eurodizel / Eurosuper 95', 'Diesel / Petrol 95', 'סולר / בנזין 95', 'EH-oo-ro-DEE-zel / EH-oo-ro-SOO-per', 'אורודיזל / אורוסופר'],
        ['Pumpa broj dva', 'Pump number two', 'משאבה מספר שתיים', 'POOM-pah BROY DVAH', 'פומפה ברוי דבה'],
        ['Plaćam karticom / gotovinom', 'I’ll pay by card / cash', 'אשלם בכרטיס / במזומן', 'PLAH-chahm KAR-tee-tsom / goh-toh-VEE-nom', 'פלאצ׳אם קרטיצום / גוטובינום'],
        ['Treba mi račun', 'I need a receipt', 'אני צריך קבלה', 'TREH-bah mee RAH-choon', 'טרבה מי ראצ׳ון'],
        ['Gdje mogu napumpati gume?', 'Where can I inflate the tyres?', 'איפה אפשר לנפח צמיגים?', 'GDYEH MOH-goo nah-POOM-pah-tee GOO-meh', 'גדיה מוגו נאפומפאטי גומה']
      ]
    },
    {
      id: 'road',
      title: ['On the road', 'בדרכים'],
      tip: ['Closed-road signs read Zatvoreno or Put zatvoren; check AMSCG road status before each mountain drive (section 02).',
        'שלטי דרך סגורה כתובים Zatvoreno או Put zatvoren; לבדוק את מצב הדרכים של AMSCG לפני כל נסיעה בהרים (חלק 02).'],
      items: [
        ['Je li put otvoren?', 'Is the road open?', 'הדרך פתוחה?', 'YEH lee POOT oht-VOH-ren', 'יה לי פוט אוטבורן'],
        ['Otvoreno / Zatvoreno', 'Open / Closed', 'פתוח / סגור', 'oht-VOH-reh-no / zaht-VOH-reh-no', 'אוטבורנו / זטבורנו'],
        ['Desno / Lijevo / Pravo', 'Right / Left / Straight', 'ימינה / שמאלה / ישר', 'DEH-sno / LYEH-vo / PRAH-vo', 'דסנו / ליבו / פראבו'],
        ['Koliko je daleko?', 'How far is it?', 'כמה רחוק זה?', 'KOH-lee-ko yeh dah-LEH-ko', 'קוליקו יה דלקו'],
        ['Gdje mogu parkirati?', 'Where can I park?', 'איפה אפשר לחנות?', 'GDYEH MOH-goo par-KEE-rah-tee', 'גדיה מוגו פרקיראטי'],
        ['Zabranjeno parkiranje', 'No parking', 'אסור לחנות', 'zah-BRAH-nyeh-no par-KEE-rah-nyeh', 'זבראניינו פרקירא-ניה'],
        ['Ulaz / Izlaz', 'Entrance / Exit', 'כניסה / יציאה', 'OO-lahz / EEZ-lahz', 'אולז / איזלז'],
        ['Putarina', 'Road toll', 'אגרת כביש', 'poo-TAH-ree-nah', 'פוטארינה'],
        ['Trajekt', 'Ferry', 'מעבורת', 'TRAH-yekt', 'טראיקט'],
        ['Odron', 'Rockfall / landslide', 'מפולת סלעים', 'OHD-ron', 'אודרון'],
        ['Oprez', 'Caution', 'זהירות', 'OH-prez', 'אופרז'],
        ['Pukla mi je guma', 'I have a flat tyre', 'יש לי תקר', 'POO-klah mee yeh GOO-mah', 'פוקלה מי יה גומה'],
        ['Pokvario mi se auto', 'My car has broken down', 'הרכב שלי התקלקל', 'poh-KVAH-ree-oh mee seh OW-toh', 'פוקבריו מי סה אוטו'],
        ['Treba mi mehaničar', 'I need a mechanic', 'אני צריך מכונאי', 'TREH-bah mee meh-HAH-nee-char', 'טרבה מי מחאניצ׳אר']
      ]
    },
    {
      id: 'mountain',
      title: ['Hiking & mountains', 'טיולים והרים'],
      tip: ['October on Durmitor can bring early snow, fog and cold, so ask locals about the trail and road before you set out, and note sunset (Zalazak sunca) is around 18:20–18:30. The Mountain Rescue number is in section 01; check AMSCG road status (section 02). Greet hikers you pass with Dobar dan.',
        'באוקטובר בדורמיטור עלולים להגיע שלג מוקדם, ערפל וקור, אז כדאי לשאול מקומיים על השביל והדרך לפני היציאה, ולזכור שהשקיעה (Zalazak sunca) סביב 18:20–18:30. מספר חילוץ ההרים בחלק 01; לבדוק את מצב הדרכים של AMSCG (חלק 02). נהוג לברך מטיילים שפוגשים ב-Dobar dan.'],
      items: [
        ['Gdje počinje staza?', 'Where does the trail start?', 'איפה מתחיל השביל?', 'GDYEH poh-CHEE-nyeh STAH-zah', 'גדיה פוצ׳ינייה סטאזה'],
        ['Je li staza dobro obilježena?', 'Is the trail well marked?', 'השביל מסומן היטב?', 'YEH lee STAH-zah DOH-bro oh-bee-LYEH-zheh-nah', 'יה לי סטאזה דוברו אוביליז׳נה'],
        ['Staza je zatvorena', 'The trail is closed', 'השביל סגור', 'STAH-zah yeh zaht-VOH-reh-nah', 'סטאזה יה זטבורנה'],
        ['Koliko traje do vrha?', 'How long to the summit?', 'כמה זמן עד הפסגה?', 'KOH-lee-ko TRAH-yeh DOH VR-hah', 'קוליקו טראיה דו ורחה'],
        ['Je li opasno?', 'Is it dangerous?', 'זה מסוכן?', 'YEH lee oh-PAHS-no', 'יה לי אופאסנו'],
        ['Kakvo će biti vrijeme?', 'What will the weather be?', 'איך יהיה מזג האוויר?', 'KAHK-vo cheh BEE-tee VREE-yeh-meh', 'קאקבו צ׳ה ביטי בריימה'],
        ['Ima li snijega? / leda?', 'Is there snow? / ice?', 'יש שלג? / קרח?', 'EE-mah lee SNEE-yeh-gah / LEH-dah', 'אימה לי סניגה / לדה'],
        ['kiša · snijeg · vjetar', 'rain · snow · wind', 'גשם · שלג · רוח', 'KEE-shah · SNEE-yeg · VYEH-tar', 'קישה · סניג · ויטאר'],
        ['magla · oluja · sunčano', 'fog · storm · sunny', 'ערפל · סערה · שמשי', 'MAH-glah · OH-loo-yah · SOON-chah-no', 'מאגלה · אולויה · סונצ׳אנו'],
        ['Izlazak / Zalazak sunca', 'Sunrise / Sunset', 'זריחה / שקיעה', 'EEZ-lah-zahk / ZAH-lah-zahk SOON-tsah', 'איזלאזאק / זלאזאק סונצה'],
        ['Koliko je sati?', 'What time is it?', 'מה השעה?', 'KOH-lee-ko yeh SAH-tee', 'קוליקו יה סאטי'],
        ['vrh · prevoj · sedlo', 'summit · mountain pass · saddle', 'פסגה · מעבר הרים · אוכף', 'VR-h · PREH-voy · SEHD-lo', 'ורח · פרבוי · סדלו'],
        ['planinarski dom', 'mountain hut', 'בקתת הרים', 'PLAH-nee-nahr-skee DOHM', 'פלאנינארסקי דום'],
        ['Gdje je najbliže sklonište?', 'Where is the nearest shelter?', 'איפה המחסה הקרוב?', 'GDYEH yeh NY-blee-zheh SKLOH-nee-shteh', 'גדיה יה נייבליז׳ה סקלוניש-טה'],
        ['Izgubio / Izgubila sam se', 'I’m lost (m / f)', 'הלכתי לאיבוד', 'eez-GOO-bee-oh / -bee-lah sahm SEH', 'איזגוביו / איזגובילה סאם סה'],
        ['Povrijeđen / Povrijeđena sam', 'I’m injured (m / f)', 'נפצעתי', 'poh-VREE-yeh-jen / -jeh-nah sahm', 'פוברייג׳ן / פוברייג׳נה סאם'],
        ['Treba nam pomoć u planini', 'We need help in the mountains', 'אנחנו צריכים עזרה בהרים', 'TREH-bah NAHM POH-moch oo plah-NEE-nee', 'טרבה נאם פומוץ׳ או פלאניני']
      ]
    },
    {
      id: 'stay',
      title: ['Hotels & guesthouses', 'מלונות וצימרים'],
      tip: ['Hosts at small guesthouses often want to know your arrival time in advance, so message or call ahead (numbers in section 05). Mountain nights in October are cold, so ask about heating.',
        'מארחים בבתי הארחה קטנים רוצים לרוב לדעת מראש מתי תגיעו, כדאי לשלוח הודעה או להתקשר (מספרים בחלק 05). לילות ההר באוקטובר קרים, אז כדאי לשאול על חימום.'],
      items: [
        ['Imam rezervaciju', 'I have a reservation', 'יש לי הזמנה', 'EE-mahm reh-zer-VAH-tsee-yoo', 'אימאם רזרבציו'],
        ['Na ime…', 'Under the name…', 'על שם…', 'NAH EE-meh', 'נה אימה'],
        ['Stižemo oko … sati', 'We’ll arrive around … o’clock', 'נגיע בסביבות השעה …', 'STEE-zheh-mo OH-ko … SAH-tee', 'סטיז׳מו אוקו … סאטי'],
        ['Kada je prijava?', 'When is check-in?', 'מתי הצ׳ק-אין?', 'KAH-dah yeh PREE-yah-vah', 'קאדה יה פריאבה'],
        ['Kada je odjava?', 'When is check-out?', 'מתי הצ׳ק-אאוט?', 'KAH-dah yeh OHD-yah-vah', 'קאדה יה אודיאבה'],
        ['U koliko sati je doručak?', 'What time is breakfast?', 'באיזו שעה ארוחת הבוקר?', 'oo KOH-lee-ko SAH-tee yeh DOH-roo-chahk', 'או קוליקו סאטי יה דורוצ׳אק'],
        ['Možemo li ostaviti prtljag?', 'Can we leave our luggage?', 'אפשר להשאיר מזוודות?', 'MOH-zheh-mo lee OH-stah-vee-tee PRT-lyahg', 'מוז׳מו לי אוסטביטי פרטליאג'],
        ['Imate li parking?', 'Do you have parking?', 'יש לכם חניה?', 'EE-mah-teh lee PAR-king', 'אימאטה לי פארקינג'],
        ['Koja je šifra za Wi-Fi?', 'What’s the Wi-Fi password?', 'מה הסיסמה לוויי-פיי?', 'KOH-yah yeh SHEE-frah zah WEE-fee', 'קויה יה שיפרה זה ווי-פיי'],
        ['Hladno je', 'It’s cold', 'קר', 'HLAHD-no yeh', 'חלאדנו יה'],
        ['Možete li pojačati grijanje?', 'Could you turn up the heating?', 'אפשר להגביר את החימום?', 'MOH-zheh-teh lee poh-YAH-chah-tee GREE-yah-nyeh', 'מוז׳טה לי פויאצ׳אטי גריאניה']
      ]
    },
    {
      id: 'eat',
      title: ['Restaurants & cafés', 'מסעדות ובתי קפה'],
      tip: ['The bill is rarely brought unasked, so ask for it (Račun, molim). Some small places take cash only, so check before you order. A tip of about 10% is normal for good service.',
        'את החשבון לא תמיד מביאים מעצמם, אז מבקשים (Račun, molim). חלק מהמקומות הקטנים מקבלים רק מזומן, כדאי לבדוק לפני ההזמנה. טיפ של כ-10% נהוג על שירות טוב.'],
      items: [
        ['Sto za dvoje, molim', 'A table for two, please', 'שולחן לשניים, בבקשה', 'STOH zah DVOH-yeh MOH-leem', 'סטו זה דבויה מולים'],
        ['Jelovnik, molim', 'The menu, please', 'תפריט, בבקשה', 'YEH-lov-neek MOH-leem', 'ילובניק מולים'],
        ['Šta preporučujete?', 'What do you recommend?', 'מה אתם ממליצים?', 'SHTAH preh-poh-ROO-choo-yeh-teh', 'שטה פרפורוצ׳ויטה'],
        ['Želim…', 'I would like…', 'הייתי רוצה…', 'ZHEH-leem', 'ז׳לים'],
        ['Voda (sa gasom / bez gasa)', 'Water (sparkling / still)', 'מים (מוגזים / רגילים)', 'VOH-dah (sah GAH-som / behz GAH-sah)', 'בודה (סה גאסום / בז גאסה)'],
        ['Jedna kafa, molim', 'One coffee, please', 'קפה אחד, בבקשה', 'YEHD-nah KAH-fah MOH-leem', 'ידנה קאפה מולים'],
        ['Domaća kafa', 'Turkish-style coffee', 'קפה טורקי', 'DOH-mah-chah KAH-fah', 'דומאצ׳ה קאפה'],
        ['Pivo / Vino', 'Beer / Wine', 'בירה / יין', 'PEE-vo / VEE-no', 'פיבו / בינו'],
        ['Živjeli!', 'Cheers!', 'לחיים!', 'ZHEEV-yeh-lee', 'ז׳יביאלי'],
        ['Prijatno!', 'Enjoy your meal', 'בתיאבון', 'PREE-yaht-no', 'פריאטנו'],
        ['Ukusno je', 'It’s delicious', 'טעים מאוד', 'oo-KOOS-no yeh', 'אוקוסנו יה'],
        ['Ja sam vegetarijanac / vegetarijanka', 'I’m vegetarian (m / f)', 'אני צמחוני / צמחונית', 'yah sahm veh-geh-tah-ree-YAH-nahts / -kah', 'יה סאם בגטריאנץ / בגטריאנקה'],
        ['Bez mesa, molim', 'No meat, please', 'בלי בשר, בבקשה', 'BEHZ MEH-sah MOH-leem', 'בז מסה מולים'],
        ['Alergičan / Alergična sam na…', 'I’m allergic to… (m / f)', 'יש לי אלרגיה ל…', 'ah-LEHR-gee-chahn / -chnah sahm NAH', 'אלרגיצ׳אן / אלרגיצ׳נה סאם נה'],
        ['Račun, molim', 'The bill, please', 'חשבון, בבקשה', 'RAH-choon MOH-leem', 'ראצ׳ון מולים'],
        ['Mogu li platiti karticom?', 'Can I pay by card?', 'אפשר לשלם בכרטיס?', 'MOH-goo lee PLAH-tee-tee KAR-tee-tsom', 'מוגו לי פלאטיטי קרטיצום'],
        ['Samo gotovina?', 'Cash only?', 'רק מזומן?', 'SAH-mo goh-TOH-vee-nah', 'סאמו גוטובינה'],
        ['Zadržite kusur', 'Keep the change', 'תשאירו את העודף', 'zah-DR-zhee-teh KOO-soor', 'זדרז׳יטה קוסור']
      ]
    },
    {
      id: 'menu',
      title: ['Menu decoder', 'מפענח תפריט'],
      tip: ['Domaće means homemade. Look for pršut and sir (smoked ham and cheese), fresh fish on the coast, and Vranac (red) or Krstač (white), the local wine grapes.',
        'Domaće פירושו תוצרת בית. כדאי לחפש pršut ו-sir (בשר מעושן וגבינה), דגים טריים בחוף, ו-Vranac (אדום) או Krstač (לבן), זני הענבים המקומיים.'],
      compact: true,
      items: [
        ['riba', 'fish', 'דג', 'REE-bah', 'ריבה'],
        ['meso', 'meat', 'בשר', 'MEH-so', 'מסו'],
        ['piletina', 'chicken', 'עוף', 'PEE-leh-tee-nah', 'פילטינה'],
        ['sir', 'cheese', 'גבינה', 'SEER', 'סיר'],
        ['pršut', 'smoked ham', 'בשר חזיר מעושן', 'PR-shoot', 'פרשוט'],
        ['čorba', 'soup', 'מרק', 'CHOR-bah', 'צ׳ורבה'],
        ['ćevapi', 'grilled meat rolls', 'נקניקיות בגריל', 'cheh-VAH-pee', 'צ׳בפי'],
        ['burek', 'filled pastry', 'בורקס', 'BOO-rek', 'בורק'],
        ['kajmak', 'clotted cream spread', 'שמנת סמיכה', 'KY-mahk', 'קיימאק'],
        ['salata', 'salad', 'סלט', 'sah-LAH-tah', 'סלאטה'],
        ['hljeb', 'bread', 'לחם', 'HLYEHB', 'חליב'],
        ['sok', 'juice', 'מיץ', 'SOHK', 'סוק'],
        ['mlijeko', 'milk', 'חלב', 'MLEE-yeh-ko', 'מליקו'],
        ['rakija', 'fruit brandy', 'ברנדי פירות', 'RAH-kee-yah', 'ראקיה'],
        ['Vranac', 'red wine grape', 'ענב יין אדום', 'VRAH-nahts', 'בראנאץ'],
        ['Krstač', 'white wine grape', 'ענב יין לבן', 'KR-stahch', 'קרסטאץ׳'],
        ['domaće', 'homemade', 'תוצרת בית', 'DOH-mah-cheh', 'דומאצ׳ה'],
        ['prodavnica', 'shop / grocery', 'חנות / מכולת', 'proh-DAHV-nee-tsah', 'פרודבניצה']
      ]
    },
    {
      id: 'sights',
      title: ['Attractions & tickets', 'אטרקציות וכרטיסים'],
      tip: ['Prices, hours and gates are in the day cards. Ask for the opening hours (Radno vrijeme) before you drive far: in October some sites may close earlier or stay shut.',
        'מחירים, שעות ושערים מופיעים בכרטיסי הימים. כדאי לשאול על שעות הפתיחה (Radno vrijeme) לפני נסיעה ארוכה: באוקטובר חלק מהאתרים עשויים להיסגר מוקדם או להישאר סגורים.'],
      items: [
        ['Dvije karte, molim', 'Two tickets, please', 'שני כרטיסים, בבקשה', 'DVEE-yeh KAR-teh MOH-leem', 'דבייה קרטה מולים'],
        ['Koliko košta ulaznica?', 'How much is a ticket?', 'כמה עולה כרטיס כניסה?', 'KOH-lee-ko KOSH-tah oo-LAHZ-nee-tsah', 'קוליקו קושטה אולזניצה'],
        ['Ima li popust?', 'Is there a discount?', 'יש הנחה?', 'EE-mah lee POH-poost', 'אימה לי פופוסט'],
        ['Radno vrijeme', 'Opening hours', 'שעות פתיחה', 'RAHD-no VREE-yeh-meh', 'ראדנו בריימה'],
        ['Do kada radite?', 'Until when are you open?', 'עד מתי אתם פתוחים?', 'DOH KAH-dah RAH-dee-teh', 'דו קאדה ראדיטה'],
        ['Koliko traje obilazak?', 'How long does the visit take?', 'כמה זמן נמשך הביקור?', 'KOH-lee-ko TRAH-yeh oh-BEE-lah-zahk', 'קוליקו טראיה אובילאזאק'],
        ['Je li staza otvorena?', 'Is the trail open?', 'השביל פתוח?', 'YEH lee STAH-zah oht-VOH-reh-nah', 'יה לי סטאזה אוטבורנה'],
        ['Gdje je vidikovac?', 'Where is the viewpoint?', 'איפה נקודת התצפית?', 'GDYEH yeh VEE-dee-ko-vahts', 'גדיה יה בידיקובאץ'],
        ['Smijem li slikati?', 'May I take photos?', 'מותר לצלם?', 'SMEE-yem lee SLEE-kah-tee', 'סמיים לי סליקאטי'],
        ['Možete li nas slikati?', 'Could you photograph us?', 'אפשר שתצלמו אותנו?', 'MOH-zheh-teh lee NAHS SLEE-kah-tee', 'מוז׳טה לי נאס סליקאטי'],
        ['Nacionalni park', 'National park', 'פארק לאומי', 'NAH-tsee-oh-nahl-nee PAHRK', 'נציונלני פארק'],
        ['Čamac do ostrva, molim', 'A boat to the island, please', 'סירה לאי, בבקשה', 'CHAH-mahts DOH OH-strvah MOH-leem', 'צ׳אמאץ דו אוסטרבה מולים'],
        ['Gospa od Škrpjela', 'Our Lady of the Rocks (island off Perast)', 'גבירתנו של הסלעים (האי ליד פראסט)', 'GOH-spah OHD SHKRP-yeh-lah', 'גוספה אוד שקרפיילה']
      ]
    },
    {
      id: 'sos',
      title: ['Help & health', 'עזרה ובריאות'],
      tip: ['Emergency numbers and your insurer’s 24/7 lines are in section 01. Say Hitno (urgent), then what you need.',
        'מספרי החירום וקווי חברת הביטוח 24/7 נמצאים בחלק 01. אומרים Hitno (דחוף) ואז מה שצריך.'],
      items: [
        ['Pomoć!', 'Help!', 'הצילו!', 'POH-moch', 'פומוץ׳'],
        ['Hitno je', 'It’s urgent', 'זה דחוף', 'KHEET-no yeh', 'חיטנו יה'],
        ['Treba mi doktor', 'I need a doctor', 'אני צריך רופא', 'TREH-bah mee DOHK-tor', 'טרבה מי דוקטור'],
        ['Pozovite hitnu pomoć', 'Call an ambulance', 'תזמינו אמבולנס', 'poh-ZOH-vee-teh KHEET-noo POH-moch', 'פוזוביטה חיטנו פומוץ׳'],
        ['Pozovite policiju', 'Call the police', 'תזמינו משטרה', 'poh-ZOH-vee-teh poh-LEE-tsee-yoo', 'פוזוביטה פוליציו'],
        ['Boli me…', 'It hurts… / My … hurts', 'כואב לי…', 'BOH-lee meh', 'בולי מה'],
        ['Imam osiguranje', 'I have insurance', 'יש לי ביטוח', 'EE-mahm oh-see-goo-RAH-nyeh', 'אימאם אוסיגוראניה'],
        ['Apoteka', 'Pharmacy', 'בית מרקחת', 'ah-poh-TEH-kah', 'אפוטקה'],
        ['Bolnica', 'Hospital', 'בית חולים', 'BOHL-nee-tsah', 'בולניצה'],
        ['Izgubio / Izgubila sam pasoš', 'I lost my passport (m / f)', 'איבדתי את הדרכון', 'eez-GOO-bee-oh / -bee-lah sahm PAH-sosh', 'איזגוביו / איזגובילה סאם פאסוש'],
        ['Ukrali su mi torbu', 'My bag was stolen', 'גנבו לי את התיק', 'oo-KRAH-lee soo mee TOR-boo', 'אוקראלי סו מי טורבו']
      ]
    },
    {
      id: 'num',
      title: ['Shops, numbers & time', 'קניות, מספרים וזמן'],
      tip: ['Prices are in euros. Ask Koliko košta? and you will usually be answered in English or on a calculator.',
        'המחירים ביורו. שואלים Koliko košta? ובדרך כלל עונים באנגלית או במחשבון.'],
      compact: true,
      items: [
        ['Koliko košta?', 'How much is it?', 'כמה זה עולה?', 'KOH-lee-ko KOSH-tah', 'קוליקו קושטה'],
        ['Preskupo je', 'It’s too expensive', 'יקר מדי', 'PREH-skoo-po yeh', 'פרסקופו יה'],
        ['Imate li…?', 'Do you have…?', 'יש לכם…?', 'EE-mah-teh lee', 'אימאטה לי'],
        ['Samo gledam, hvala', 'Just looking, thanks', 'רק מסתכל, תודה', 'SAH-mo GLEH-dahm HVAH-lah', 'סאמו גלדאם חבאלה'],
        ['jedan', '1', '1', 'YEH-dahn', 'ידאן'],
        ['dva', '2', '2', 'DVAH', 'דבה'],
        ['tri', '3', '3', 'TREE', 'טרי'],
        ['četiri', '4', '4', 'CHEH-tee-ree', 'צ׳טירי'],
        ['pet', '5', '5', 'PEHT', 'פט'],
        ['šest', '6', '6', 'SHEHST', 'שסט'],
        ['sedam', '7', '7', 'SEH-dahm', 'סדאם'],
        ['osam', '8', '8', 'OH-sahm', 'אוסאם'],
        ['devet', '9', '9', 'DEH-veht', 'דבט'],
        ['deset', '10', '10', 'DEH-seht', 'דסט'],
        ['dvadeset', '20', '20', 'DVAH-deh-seht', 'דבדסט'],
        ['pedeset', '50', '50', 'PEH-deh-seht', 'פדסט'],
        ['sto', '100', '100', 'STOH', 'סטו'],
        ['danas', 'today', 'היום', 'DAH-nahs', 'דאנאס'],
        ['sutra', 'tomorrow', 'מחר', 'SOO-trah', 'סוטרה'],
        ['sada', 'now', 'עכשיו', 'SAH-dah', 'סאדה'],
        ['U koliko sati?', 'At what time?', 'באיזו שעה?', 'oo KOH-lee-ko SAH-tee', 'או קוליקו סאטי']
      ]
    },
    {
      id: 'map',
      title: ['On the map', 'על המפה'],
      tip: ['Crna Gora is Montenegro’s own name for itself, “Black Mountain”. Signs are mostly in Latin letters, with Cyrillic on some.',
        'Crna Gora הוא השם שבו מונטנגרו קוראת לעצמה, “הר שחור”. רוב השלטים בכתב לטיני, ובחלקם גם קירילי.'],
      compact: true,
      items: [
        ['Crna Gora', 'Montenegro (“Black Mountain”)', 'מונטנגרו (“הר שחור”)', 'TSR-nah GOH-rah', 'צרנה גורה'],
        ['planina', 'mountain', 'הר', 'plah-NEE-nah', 'פלאנינה'],
        ['jezero', 'lake', 'אגם', 'YEH-zeh-ro', 'יזרו'],
        ['Crno jezero', 'Black Lake', 'האגם השחור', 'TSR-no YEH-zeh-ro', 'צרנו יזרו'],
        ['more', 'sea', 'ים', 'MOH-reh', 'מורה'],
        ['Boka Kotorska', 'Bay of Kotor', 'מפרץ קוטור', 'BOH-kah KOH-tor-skah', 'בוקה קוטורסקה'],
        ['plaža', 'beach', 'חוף', 'PLAH-zhah', 'פלאז׳ה'],
        ['luka', 'harbour', 'נמל', 'LOO-kah', 'לוקה'],
        ['ostrvo', 'island', 'אי', 'OH-strvo', 'אוסטרבו'],
        ['vidikovac', 'viewpoint', 'נקודת תצפית', 'VEE-dee-ko-vahts', 'בידיקובאץ'],
        ['staza', 'trail', 'שביל', 'STAH-zah', 'סטאזה'],
        ['most', 'bridge', 'גשר', 'MOHST', 'מוסט'],
        ['kanjon', 'canyon', 'קניון', 'KAH-nyon', 'קאניון'],
        ['stari grad', 'old town', 'העיר העתיקה', 'STAH-ree GRAHD', 'סטארי גראד'],
        ['tvrđava', 'fortress', 'מצודה', 'TVR-jah-vah', 'טברג׳אבה'],
        ['crkva', 'church', 'כנסייה', 'TSRK-vah', 'צרקבה']
      ]
    }
  ]
};
if (typeof module !== 'undefined') module.exports = PHRASEBOOK;
