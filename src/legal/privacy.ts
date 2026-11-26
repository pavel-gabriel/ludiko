import { RIGHTS_CONTACT } from '@/utils/constants'
import { LEGAL_UPDATED, LEGAL_VERSION, type LegalTexts } from './types'

/**
 * Privacy policy: DRAFT pending lawyer review. Source of facts: docs/PRIVACY_DATA_MAP.md.
 * Plain language for parents. Keep every Firestore collection from firestore.rules named in the
 * "technical" section (tests/legalPages.test.ts enforces it).
 * Items marked "[TODO ...]" need the owner before publication.
 */
export const PRIVACY: LegalTexts = {
  ro: {
    title: 'Politica de confidențialitate',
    summary:
      'Ludiko este făcut pentru copii, iar datele lor contează. Pe scurt: aplicația funcționează în primul rând pe dispozitivul tău, nu cerem numele real al copilului, nu avem reclame și nu avem urmăritori.',
    sections: [
      {
        id: 'who',
        title: 'Cine suntem',
        blocks: [
          {
            kind: 'p',
            text: 'Ludiko este o aplicație educațională gratuită (matematică, limba română, științe și altele) pentru copii, în special din clasele 0–VIII.',
          },
          {
            kind: 'p',
            text: 'Operatorul datelor este „Ludiko”, așa cum apare în licența aplicației. Ludiko nu este încă o persoană juridică înregistrată: drepturile de autor aparțin autorului aplicației, care răspunde pentru datele descrise aici. [TODO proprietar: nume complet, adresă și, dacă va fi cazul, CUI, înainte de publicare.]',
          },
          {
            kind: 'p',
            text: `Pentru orice întrebare despre date, scrie-ne la ${RIGHTS_CONTACT}. Nu avem (încă) un responsabil cu protecția datelor.`,
          },
        ],
      },
      {
        id: 'data',
        title: 'Ce date folosim',
        blocks: [
          {
            kind: 'p',
            text: 'Nu cerem numele real, data nașterii, adresa, fotografii sau locația copilului. Nu salvăm răspunsurile la fiecare exercițiu, ci doar rezultatul învățării (de exemplu „are lacună la scăderea cu împrumut”).',
          },
          { kind: 'h', text: 'Rămâne pe dispozitiv (nu ajunge la noi)' },
          {
            kind: 'ul',
            items: [
              'profilul copilului: poreclă, avatar, clasă, limbă și un cod de recuperare;',
              'progresul: abilități, stele, autocolante, zilele jucate, misiuni, rezultatele verificărilor;',
              'setări (limbă, font pentru dislexie, sunet) și memoria offline a aplicației.',
            ],
          },
          { kind: 'h', text: 'Dacă joci cu prietenii (multiplayer)' },
          {
            kind: 'ul',
            items: [
              'un nume de animal ales din listă (de exemplu „Vulpea Veselă”), nu numele copilului, plus avatarul și scorul. Ele stau în baza de date în timp real doar cât timp camera există; o cameră nu poate fi listată, iar intrarea se face doar cu codul exact;',
              'rezultatele jocului se văd doar în cameră, pe podium. Nu mai păstrăm niciun istoric și nu mai există un clasament public.',
            ],
          },
          {
            kind: 'p',
            text: 'În jocul cu prietenii copilul nu scrie niciun nume: alege un animal și un avatar.',
          },
          { kind: 'h', text: 'Contul de părinte (opțional)' },
          {
            kind: 'ul',
            items: [
              'adresa ta de e-mail și parola (parola o gestionează Google Firebase Authentication, noi nu o vedem);',
              'data și versiunea acordului tău;',
              'pentru fiecare copil sincronizat: porecla, avatarul, clasa, limba și progresul la învățat, ca să regăsești totul pe alt telefon.',
            ],
          },
          { kind: 'h', text: 'Mementouri zilnice (opțional)' },
          {
            kind: 'ul',
            items: [
              'adresa tehnică a dispozitivului pentru notificări, ora aleasă, fusul orar, limba, dacă mementoul este activ și data ultimei zile de joacă. Nu păstrăm numele, clasa sau progresul copilului.',
            ],
          },
          { kind: 'h', text: 'Clasa mea (opțional)' },
          {
            kind: 'ul',
            items: [
              'codul de locație primit de la profesor și numele clasei;',
              'un rezumat al stării abilităților copilului și numărul de zile jucate în săptămâna curentă. Fără poreclă, avatar sau răspunsuri;',
              'eticheta locului, aleasă de profesor (ar trebui să fie inițiale sau un număr).',
            ],
          },
          { kind: 'h', text: 'Conturi de profesor' },
          {
            kind: 'ul',
            items: [
              'e-mail și nume afișat (inclusiv din contul Google, dacă profesorul alege acea variantă);',
              'clasele, locurile, temele, sesiunile de joc, șabloanele și rezultatele sesiunilor create de profesor.',
            ],
          },
          { kind: 'h', text: 'Raportează o greșeală' },
          {
            kind: 'ul',
            items: [
              'identificatorul exercițiului, motivul, mesajul liber (cel mult 300 de caractere) și versiunea aplicației. Te rugăm să nu scrii date personale în mesaj.',
            ],
          },
          { kind: 'h', text: 'Date tehnice inevitabile' },
          {
            kind: 'ul',
            items: [
              'adresa IP și datele de conectare ajung, ca la orice site, la furnizorii care ne găzduiesc (GitHub Pages) și la Google (Firebase);',
              'fonturile (Nunito, OpenDyslexic) sunt găzduite chiar în aplicație; nu se încarcă nimic de la Google Fonts.',
            ],
          },
        ],
      },
      {
        id: 'why',
        title: 'De ce folosim aceste date',
        blocks: [
          {
            kind: 'ul',
            items: [
              'ca aplicația să funcționeze și să te ajute să înveți: profiluri și progres (acestea rămân pe dispozitiv);',
              'ca jocul cu prietenii și clasa să funcționeze: serviciul pe care l-ai cerut;',
              'ca să ai cont de părinte, mementouri și legătura cu clasa: acordul tău, pe care îl poți retrage oricând;',
              'pentru conturile de profesor: serviciul pe care profesorul l-a cerut;',
              'ca să corectăm greșelile din conținut: mesajul pe care l-ai trimis chiar tu;',
              'pentru securitate și prevenirea abuzurilor: interesul nostru legitim de a păstra serviciul sigur.',
            ],
          },
          {
            kind: 'p',
            text: 'Nu vindem date, nu facem publicitate, nu construim profiluri comerciale și nu luăm decizii automate cu efecte juridice asupra copilului.',
          },
        ],
      },
      {
        id: 'where',
        title: 'Unde sunt datele și cine le vede',
        blocks: [
          {
            kind: 'ul',
            items: [
              'pe dispozitivul tău: profilurile și progresul;',
              'în cloud, la Google (Firebase: autentificare, bază de date Firestore și bază de date în timp real), care acționează ca persoană împuternicită de noi. Regiunea în care se află bazele de date: [TODO proprietar: se completează după verificarea în consola Firebase, de preferat UE];',
              'site-ul este găzduit pe GitHub Pages; GitHub păstrează jurnale cu adresele IP ale vizitatorilor, pe propria răspundere;',
              'dacă pornești mementourile, serviciul de notificări al browserului (Google, Mozilla sau Apple) primește mesajul criptat;',
            ],
          },
          { kind: 'h', text: 'Cine poate vedea datele' },
          {
            kind: 'ul',
            items: [
              'tu (părintele), pentru datele din contul tău;',
              'profesorul clasei, doar rezumatul de abilități al locurilor din clasa lui;',
              'jucătorii din aceeași cameră de joc, numele de animal și avatarele celorlalți, cât timp camera există;',
              'noi, ca administratori, doar pentru suport, rapoarte de greșeli și securitate.',
            ],
          },
          {
            kind: 'p',
            text: 'Google poate prelucra date și în afara Spațiului Economic European. În acest caz se aplică mecanismele oferite de Google (de exemplu clauzele contractuale standard). [TODO jurist: confirmarea mecanismului de transfer.]',
          },
        ],
      },
      {
        id: 'retention',
        title: 'Cât timp păstrăm datele',
        blocks: [
          {
            kind: 'ul',
            items: [
              'pe dispozitiv: până ștergi profilul din „Gestionează” sau datele site-ului din browser;',
              'contul de părinte: până îl ștergi cu butonul „Șterge contul din cloud”. Un copil șters se elimină din cloud la următoarea sincronizare;',
              'mementouri: până le oprești. Dacă browserul anulează abonarea, ștergem înregistrarea;',
              'legătura cu clasa: rezumatul se înlocuiește la fiecare sincronizare și se șterge când copilul iese din clasă sau profesorul șterge locul ori clasa;',
              'camerele de joc: se șterg când gazda iese sau se deconectează; nu se mai poate intra într-o cameră mai veche de 6 ore, iar camerele rămase se șterg după 24 de ore;',
              'istoricul jocurilor cu prietenii: nu se mai păstrează (clasamentul public a fost eliminat, iar datele vechi se șterg);',
              'rapoartele de greșeli: cele rezolvate se șterg după 12 luni, oricare după 24 de luni;',
              'abonările la mementouri nefolosite: se șterg după 12 luni;',
              'conturile de profesor: până când profesorul le șterge din aplicație („Șterge contul de profesor”), împreună cu clasele, sesiunile și șabloanele lui;',
              'jurnalele tehnice ale Google și GitHub: după regulile lor.',
            ],
          },
        ],
      },
      {
        id: 'rights',
        title: 'Drepturile tale',
        blocks: [
          {
            kind: 'p',
            text: 'Conform Regulamentului (UE) 2016/679 (GDPR) ai dreptul la:',
          },
          {
            kind: 'ul',
            items: [
              'acces: să afli ce date avem despre tine sau copilul tău;',
              'rectificare: să corectezi datele greșite;',
              'ștergere („dreptul de a fi uitat”);',
              'restricționarea prelucrării;',
              'portabilitate: exportul în format JSON, disponibil în aplicație pentru contul de părinte, și copia de rezervă a profilului;',
              'opoziție față de prelucrările bazate pe interes legitim;',
              'retragerea acordului oricând, fără să afecteze ce s-a făcut până atunci.',
            ],
          },
          { kind: 'h', text: 'Cum le exerciți' },
          {
            kind: 'ul',
            items: [
              'direct din aplicație: ștergi un profil, ștergi contul de părinte din cloud, exporți datele, oprești mementourile, ieși din clasă, sau folosești „Șterge tot” din zona pentru părinți, care le face pe toate odată;',
              `sau scrie-ne la ${RIGHTS_CONTACT}. Răspundem în cel mult o lună.`,
            ],
          },
          {
            kind: 'p',
            text: 'Dacă ștergi doar contul de părinte, rezumatul trimis clasei și înregistrarea pentru mementouri rămân; „Șterge tot” le șterge și pe acestea.',
          },
          {
            kind: 'p',
            text: 'Ai dreptul să depui plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP), www.dataprotection.ro.',
          },
        ],
      },
      {
        id: 'children',
        title: 'Copiii',
        blocks: [
          {
            kind: 'ul',
            items: [
              'copiii nu au nevoie de cont: profilul lor rămâne pe dispozitiv și nu cere e-mail sau nume real;',
              'în România, vârsta de la care copilul își poate da singur acordul pentru servicii online este 16 ani (Legea nr. 190/2018). Pentru funcțiile care cer acord (cont, mementouri, legătura cu clasa), acordul îl dă părintele sau tutorele legal. Contul este doar al părintelui;',
              'nu avem reclame, nu avem urmăritori ai unor terți și nu avem chat liber între copii;',
              'te rugăm să alegi pentru copil o poreclă, nu numele real, și să fii aproape când joacă cu alți copii;',
              'dacă crezi că am primit date ale unui copil fără acordul părintelui, scrie-ne și le ștergem.',
            ],
          },
        ],
      },
      {
        id: 'storage',
        title: 'Cookie-uri și stocare locală',
        blocks: [
          {
            kind: 'p',
            text: 'Ludiko nu setează cookie-uri și nu folosește cookie-uri de urmărire sau de publicitate.',
          },
          {
            kind: 'p',
            text: 'Folosim doar stocarea locală a browserului (IndexedDB, localStorage, memoria offline a aplicației și sesiunea Firebase), strict pentru funcționare: profilurile, progresul, setările, limba, memoria offline și sesiunea de conectare. Fiind necesară funcționării serviciului pe care l-ai cerut, nu cerem o bifă separată. O poți șterge oricând din setările browserului (profilurile de pe acel dispozitiv se pierd dacă nu ai copie de rezervă sau cont).',
          },
        ],
      },
      {
        id: 'changes',
        title: 'Modificări',
        blocks: [
          {
            kind: 'p',
            text: 'Dacă schimbăm ce date folosim sau de ce, actualizăm această pagină, versiunea și data de mai jos. Pentru funcțiile care cer acord, îți cerem din nou acordul când schimbarea este importantă.',
          },
          {
            kind: 'p',
            text: 'Acest text este o ciornă, în curs de verificare juridică. Poate fi modificat înainte de lansarea publică.',
          },
        ],
      },
      {
        id: 'version',
        title: 'Versiune și dată',
        blocks: [
          {
            kind: 'p',
            text: `Versiunea ${LEGAL_VERSION}, ultima actualizare ${LEGAL_UPDATED}. Stare: ciornă.`,
          },
        ],
      },
      {
        id: 'technical',
        title: 'Detalii tehnice (pentru curioși și juriști)',
        blocks: [
          {
            kind: 'p',
            text: 'Colecțiile din baza de date Firestore, ce conțin și cine le poate citi (după regulile de securitate din aplicație):',
          },
          {
            kind: 'ul',
            items: [
              'families: consimțământul părintelui și, în subcolecția children, profilul și progresul copiilor sincronizați. Doar părintele.',
              'pushSubscriptions: abonarea la mementouri (adresa dispozitivului, ora, fusul orar, limba). Niciun client nu o poate citi; o citește doar programul care trimite mementourile.',
              'classes: clasa unui profesor, cu locurile (seats), rezumatele de progres (progress) și temele (assignments). Profesorul; temele pot fi citite de dispozitivele care cunosc codul clasei.',
              'joinCodes: legătura dintre un cod de locație și clasă. Se poate citi doar cunoscând codul exact.',
              'contentReports: rapoartele „Raportează o greșeală”. Doar administratorul.',
              'teachers: profilul profesorului (e-mail, nume afișat). Profesorul și, pentru numărare, administratorul.',
              'sessions și sessionResults: sesiunile de joc ale profesorilor și rezultatele lor (cu eticheta aleasă de profesor pentru fiecare cod). Doar profesorul care le-a creat.',
              'sessionCodes: index prin care dispozitivul unui elev verifică un cod primit de la profesor (doar codul și sesiunea, fără nume). Se poate citi doar cunoscând codul exact.',
              'templates: șabloanele salvate ale profesorilor. Doar profesorul.',
              'gameHistory: istoricul vechi al jocurilor cu prietenii. Nu mai este folosit: regulile blochează orice acces, iar datele vechi se șterg.',
              'admins: lista identificatorilor de administrator ai proprietarului aplicației.',
            ],
          },
          {
            kind: 'p',
            text: 'În baza de date în timp real se află camerele de joc (rooms): numele de animal, avatarele, scorurile și întrebările jocului, plus un index al codurilor (roomCodes). O cameră nu poate fi listată: o citește doar cine cunoaște codul ei, iar fiecare jucător își poate modifica doar propriile date.',
          },
        ],
      },
    ],
  },
  en: {
    title: 'Privacy policy',
    summary:
      'Ludiko is made for children, and their data matters. In short: the app works mainly on your own device, we do not ask for the child’s real name, and we have no ads and no trackers.',
    sections: [
      {
        id: 'who',
        title: 'Who we are',
        blocks: [
          {
            kind: 'p',
            text: 'Ludiko is a free educational app (maths, Romanian language, science and more) for children, mainly in grades 0 to 8.',
          },
          {
            kind: 'p',
            text: 'The data controller is “Ludiko”, as named in the app’s licence. Ludiko is not yet a registered legal entity: the copyright belongs to the app’s author, who is responsible for the data described here. [TODO owner: full name, address and, if applicable, company number before publication.]',
          },
          {
            kind: 'p',
            text: `For any question about data, write to ${RIGHTS_CONTACT}. We do not (yet) have a data protection officer.`,
          },
        ],
      },
      {
        id: 'data',
        title: 'What data we use',
        blocks: [
          {
            kind: 'p',
            text: 'We do not ask for a child’s real name, birth date, address, photos or location. We do not store the answer to every exercise, only the learning outcome (for example “has a gap in subtraction with borrowing”).',
          },
          { kind: 'h', text: 'Stays on the device (never reaches us)' },
          {
            kind: 'ul',
            items: [
              'the child profile: nickname, avatar, grade, language and a recovery code;',
              'progress: skills, stars, stickers, days played, missions, check results;',
              'settings (language, dyslexia font, sound) and the app’s offline memory.',
            ],
          },
          { kind: 'h', text: 'If you play with friends (multiplayer)' },
          {
            kind: 'ul',
            items: [
              'an animal name picked from a list (for example “Happy Fox”), not the child’s name, plus the avatar and the score. They sit in the realtime database only while the room exists; rooms cannot be listed and can only be joined with the exact code;',
              'game results are shown only in the room, on the podium. We no longer keep any history and there is no public leaderboard.',
            ],
          },
          {
            kind: 'p',
            text: 'When playing with friends the child does not type any name: they pick an animal and an avatar.',
          },
          { kind: 'h', text: 'Parent account (optional)' },
          {
            kind: 'ul',
            items: [
              'your email address and password (the password is handled by Google Firebase Authentication, we never see it);',
              'the date and version of your consent;',
              'for each synced child: nickname, avatar, grade, language and learning progress, so you can find everything on another phone.',
            ],
          },
          { kind: 'h', text: 'Daily reminders (optional)' },
          {
            kind: 'ul',
            items: [
              'the technical address of the device for notifications, the chosen hour, time zone, language, whether the reminder is on and the date of the last day played. We do not store the child’s name, grade or progress.',
            ],
          },
          { kind: 'h', text: 'My class (optional)' },
          {
            kind: 'ul',
            items: [
              'the seat code received from the teacher and the class name;',
              'a summary of the child’s skill states and the number of days played this week. No nickname, avatar or answers;',
              'the seat label chosen by the teacher (it should be initials or a number).',
            ],
          },
          { kind: 'h', text: 'Teacher accounts' },
          {
            kind: 'ul',
            items: [
              'email and display name (including from the Google account, if the teacher chooses that option);',
              'the classes, seats, assignments, game sessions, templates and session results the teacher creates.',
            ],
          },
          { kind: 'h', text: 'Report a mistake' },
          {
            kind: 'ul',
            items: [
              'the exercise identifier, the reason, the free-text message (at most 300 characters) and the app version. Please do not write personal data in the message.',
            ],
          },
          { kind: 'h', text: 'Unavoidable technical data' },
          {
            kind: 'ul',
            items: [
              'your IP address and connection data reach our hosting provider (GitHub Pages) and Google (Firebase), as with any website;',
              'the fonts (Nunito, OpenDyslexic) are hosted inside the app itself; nothing is loaded from Google Fonts.',
            ],
          },
        ],
      },
      {
        id: 'why',
        title: 'Why we use this data',
        blocks: [
          {
            kind: 'ul',
            items: [
              'to make the app work and help you learn: profiles and progress (these stay on the device);',
              'to make play with friends and the class work: the service you asked for;',
              'for the parent account, reminders and the class link: your consent, which you can withdraw at any time;',
              'for teacher accounts: the service the teacher asked for;',
              'to fix mistakes in the content: the message you sent yourself;',
              'for security and abuse prevention: our legitimate interest in keeping the service safe.',
            ],
          },
          {
            kind: 'p',
            text: 'We do not sell data, we do not advertise, we do not build commercial profiles and we do not make automated decisions with legal effects on the child.',
          },
        ],
      },
      {
        id: 'where',
        title: 'Where the data is and who sees it',
        blocks: [
          {
            kind: 'ul',
            items: [
              'on your device: profiles and progress;',
              'in the cloud, at Google (Firebase: authentication, Firestore database and realtime database), acting as our processor. Region of the databases: [TODO owner: fill in after checking the Firebase console, preferably the EU];',
              'the site is hosted on GitHub Pages; GitHub keeps logs with visitors’ IP addresses, on its own responsibility;',
              'if you turn on reminders, the browser’s notification service (Google, Mozilla or Apple) receives the encrypted message;',
            ],
          },
          { kind: 'h', text: 'Who can see the data' },
          {
            kind: 'ul',
            items: [
              'you (the parent), for the data in your account;',
              'the class teacher, only the skill summary of the seats in their class;',
              'players in the same game room, each other’s animal names and avatars, while the room exists;',
              'we, as administrators, only for support, mistake reports and security.',
            ],
          },
          {
            kind: 'p',
            text: 'Google may also process data outside the European Economic Area. In that case the mechanisms Google offers apply (for example standard contractual clauses). [TODO lawyer: confirm the transfer mechanism.]',
          },
        ],
      },
      {
        id: 'retention',
        title: 'How long we keep data',
        blocks: [
          {
            kind: 'ul',
            items: [
              'on the device: until you delete the profile under “Manage” or clear the site data in your browser;',
              'parent account: until you delete it with the “Delete cloud account” button. A deleted child is removed from the cloud on the next sync;',
              'reminders: until you turn them off. If the browser cancels the subscription, we delete the record;',
              'class link: the summary is replaced on every sync and deleted when the child leaves the class or the teacher deletes the seat or the class;',
              'game rooms: deleted when the host leaves or disconnects; a room older than 6 hours can no longer be joined, and leftover rooms are deleted after 24 hours;',
              'history of games with friends: no longer kept (the public leaderboard was removed and old data is being deleted);',
              'mistake reports: resolved ones are deleted after 12 months, any report after 24 months;',
              'unused reminder subscriptions: deleted after 12 months;',
              'teacher accounts: until the teacher deletes them in the app (“Delete teacher account”), together with their classes, sessions and templates;',
              'Google and GitHub technical logs: under their own rules.',
            ],
          },
        ],
      },
      {
        id: 'rights',
        title: 'Your rights',
        blocks: [
          {
            kind: 'p',
            text: 'Under Regulation (EU) 2016/679 (GDPR) you have the right to:',
          },
          {
            kind: 'ul',
            items: [
              'access: find out what data we hold about you or your child;',
              'rectification: correct wrong data;',
              'erasure (“right to be forgotten”);',
              'restriction of processing;',
              'portability: a JSON export, available in the app for the parent account, and the profile backup;',
              'object to processing based on legitimate interest;',
              'withdraw consent at any time, without affecting what was done before.',
            ],
          },
          { kind: 'h', text: 'How to use them' },
          {
            kind: 'ul',
            items: [
              'directly in the app: delete a profile, delete the parent cloud account, export data, turn off reminders, leave a class, or use “Delete everything” in the parent area, which does all of these at once;',
              `or write to ${RIGHTS_CONTACT}. We answer within one month at most.`,
            ],
          },
          {
            kind: 'p',
            text: 'Deleting only the parent account does not delete the summary sent to a class or the reminder record; “Delete everything” removes those too.',
          },
          {
            kind: 'p',
            text: 'You have the right to lodge a complaint with the National Supervisory Authority for Personal Data Processing (ANSPDCP), www.dataprotection.ro.',
          },
        ],
      },
      {
        id: 'children',
        title: 'Children',
        blocks: [
          {
            kind: 'ul',
            items: [
              'children do not need an account: their profile stays on the device and asks for no email or real name;',
              'in Romania the age from which a child can consent alone to online services is 16 (Law no. 190/2018). For features that need consent (account, reminders, class link), the parent or legal guardian gives it. The account belongs to the parent only;',
              'we have no ads, no third-party trackers and no free chat between children;',
              'please choose a nickname for the child, not their real name, and stay close when they play with other children;',
              'if you think we received a child’s data without a parent’s consent, write to us and we will delete it.',
            ],
          },
        ],
      },
      {
        id: 'storage',
        title: 'Cookies and local storage',
        blocks: [
          {
            kind: 'p',
            text: 'Ludiko does not set cookies and does not use tracking or advertising cookies.',
          },
          {
            kind: 'p',
            text: 'We only use the browser’s local storage (IndexedDB, localStorage, the app’s offline memory and the Firebase session), strictly to make the app work: profiles, progress, settings, language, offline memory and the sign-in session. Because it is necessary for the service you asked for, we do not ask for a separate tick. You can clear it at any time in your browser settings (profiles on that device are lost unless you have a backup or an account).',
          },
        ],
      },
      {
        id: 'changes',
        title: 'Changes',
        blocks: [
          {
            kind: 'p',
            text: 'If we change what data we use or why, we update this page, the version and the date below. For features that need consent, we ask for your consent again when the change is significant.',
          },
          {
            kind: 'p',
            text: 'This text is a draft under legal review. It may change before the public launch.',
          },
        ],
      },
      {
        id: 'version',
        title: 'Version and date',
        blocks: [
          {
            kind: 'p',
            text: `Version ${LEGAL_VERSION}, last updated ${LEGAL_UPDATED}. Status: draft.`,
          },
        ],
      },
      {
        id: 'technical',
        title: 'Technical details (for the curious and for lawyers)',
        blocks: [
          {
            kind: 'p',
            text: 'The Firestore database collections, what they hold and who can read them (according to the app’s security rules):',
          },
          {
            kind: 'ul',
            items: [
              'families: the parent’s consent and, in the children subcollection, the profile and progress of synced children. Only the parent.',
              'pushSubscriptions: the reminder subscription (device address, hour, time zone, language). No client can read it; only the program that sends the reminders does.',
              'classes: a teacher’s class, with its seats, progress summaries (progress) and assignments. The teacher; assignments can be read by devices that know the class code.',
              'joinCodes: the link between a seat code and the class. It can only be read by knowing the exact code.',
              'contentReports: the “Report a mistake” reports. Only the administrator.',
              'teachers: the teacher profile (email, display name). The teacher and, for counting, the administrator.',
              'sessions and sessionResults: teachers’ game sessions and their results (with the label the teacher chose for each code). Only the teacher who created them.',
              'sessionCodes: an index a student’s device uses to check a code from the teacher (only the code and the session, no names). It can only be read by knowing the exact code.',
              'templates: teachers’ saved templates. Only the teacher.',
              'gameHistory: the old history of games with friends. No longer used: the rules block all access and old data is being deleted.',
              'admins: the list of administrator identifiers of the app’s owner.',
            ],
          },
          {
            kind: 'p',
            text: 'The realtime database holds the game rooms (rooms): animal names, avatars, scores and the game’s questions, plus an index of codes (roomCodes). Rooms cannot be listed: only someone who knows a room’s code can read it, and each player can only change their own data.',
          },
        ],
      },
    ],
  },
}
