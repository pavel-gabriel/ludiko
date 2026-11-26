import { RIGHTS_CONTACT } from '@/utils/constants'
import { LEGAL_UPDATED, LEGAL_VERSION, type LegalTexts } from './types'

/**
 * Terms of use: short, DRAFT pending lawyer review. Licence summary follows the LICENSE file;
 * content status follows docs/PLAN.md (all content is AI-drafted and marked beta).
 */
export const TERMS: LegalTexts = {
  ro: {
    title: 'Termeni de utilizare',
    summary: 'Ludiko este gratuit. Aceste reguli scurte spun ce poți face cu aplicația și ce nu promitem.',
    sections: [
      {
        id: 'acceptance',
        title: 'Cine oferă Ludiko',
        blocks: [
          {
            kind: 'p',
            text: 'Ludiko este oferit de autorul aplicației (vezi „Politica de confidențialitate” pentru operator și contact). Folosind aplicația, accepți acești termeni. Dacă nu ești de acord, te rugăm să nu o folosești.',
          },
        ],
      },
      {
        id: 'use',
        title: 'Utilizare gratuită',
        blocks: [
          {
            kind: 'ul',
            items: [
              'poți folosi aplicația gratuit, pentru învățare personală, în familie sau la clasă;',
              'diagnosticul nivelului și recomandările de exersare sunt gratuite;',
              'putem schimba, întrerupe sau opri funcții, în special cele experimentale.',
            ],
          },
        ],
      },
      {
        id: 'accounts',
        title: 'Conturi și coduri',
        blocks: [
          {
            kind: 'ul',
            items: [
              'contul de părinte, contul de profesor și codurile de clasă sunt opționale și personale;',
              'păstrează parola și codurile în siguranță; răspunzi de ce se face cu ele;',
              'poți șterge contul de părinte din aplicație sau ne poți scrie. Ștergerea se face conform politicii de confidențialitate.',
            ],
          },
        ],
      },
      {
        id: 'children',
        title: 'Copii și părinți',
        blocks: [
          {
            kind: 'ul',
            items: [
              'aplicația este pentru copii folosită cu știrea unui părinte sau profesor;',
              'funcțiile cu cont, mementouri sau legătură cu clasa se activează de către părinte sau tutore;',
              'profesorii care introduc date despre elevi (de exemplu etichete de locuri) răspund pentru acele date și ar trebui să folosească inițiale sau numere, nu nume reale.',
            ],
          },
        ],
      },
      {
        id: 'content',
        title: 'Conținutul educațional este beta',
        blocks: [
          {
            kind: 'p',
            text: 'Exercițiile, explicațiile și textele sunt în mare parte redactate cu ajutorul inteligenței artificiale și sunt marcate „beta”, adică nu au fost încă verificate de un cadru didactic. Pot conține greșeli: dacă găsești una, folosește „Raportează o greșeală”. Ludiko nu înlocuiește școala sau profesorul și nu este afiliat Ministerului Educației.',
          },
        ],
      },
      {
        id: 'licence',
        title: 'Drepturi de autor și licență (rezumat)',
        blocks: [
          {
            kind: 'ul',
            items: [
              'codul, designul, motorul de învățare, întrebările, explicațiile, textele, ilustrațiile și numele „Ludiko” aparțin Ludiko; toate drepturile sunt rezervate;',
              'ai voie să folosești aplicația publicată de Ludiko pentru învățare personală, în familie sau la clasă. Copierea, modificarea, publicarea, vânzarea sau redistribuirea fără acordul scris nu sunt permise;',
              'materialele terților rămân sub licențele lor și sunt listate pe pagina „Credite”;',
              `textul complet este în fișierul LICENSE al depozitului. Cereri de permisiune: ${RIGHTS_CONTACT}.`,
            ],
          },
        ],
      },
      {
        id: 'warranty',
        title: 'Fără garanții',
        blocks: [
          {
            kind: 'p',
            text: 'Aplicația este oferită „așa cum este”, fără garanții de niciun fel. Nu garantăm că funcționează fără întreruperi sau erori, nici că rezultatele diagnosticului sunt corecte. În limita permisă de lege, nu răspundem pentru pagubele rezultate din folosirea aplicației. Drepturile pe care legea ți le dă ca utilizator rămân neatinse.',
          },
        ],
      },
      {
        id: 'conduct',
        title: 'Folosire corectă',
        blocks: [
          {
            kind: 'ul',
            items: [
              'nu scrie nume reale sau date personale în porecle, în camerele de joc sau în rapoarte;',
              'nu încerca să strici serviciul, să citești datele altora sau să ocolești protecțiile aplicației;',
              'nu folosi conținutul Ludiko în alte produse fără acord.',
            ],
          },
        ],
      },
      {
        id: 'changes',
        title: 'Modificări',
        blocks: [
          {
            kind: 'p',
            text: 'Putem schimba acești termeni. Versiunea și data de mai jos arată ultima schimbare. Dacă continui să folosești aplicația după o schimbare, o accepți. Acest text este o ciornă, în curs de verificare juridică.',
          },
        ],
      },
      {
        id: 'law',
        title: 'Legea aplicabilă',
        blocks: [
          {
            kind: 'p',
            text: 'Se aplică legea română. Drepturile tale de consumator și de persoană vizată rămân cele prevăzute de lege. [TODO jurist: verificarea acestei secțiuni.]',
          },
        ],
      },
      {
        id: 'version',
        title: 'Versiune și dată',
        blocks: [
          {
            kind: 'p',
            text: `Versiunea ${LEGAL_VERSION}, ultima actualizare ${LEGAL_UPDATED}. Stare: ciornă. Contact: ${RIGHTS_CONTACT}.`,
          },
        ],
      },
    ],
  },
  en: {
    title: 'Terms of use',
    summary: 'Ludiko is free. These short rules say what you may do with the app and what we do not promise.',
    sections: [
      {
        id: 'acceptance',
        title: 'Who provides Ludiko',
        blocks: [
          {
            kind: 'p',
            text: 'Ludiko is provided by the app’s author (see the “Privacy policy” for the controller and contact). By using the app you accept these terms. If you do not agree, please do not use it.',
          },
        ],
      },
      {
        id: 'use',
        title: 'Free use',
        blocks: [
          {
            kind: 'ul',
            items: [
              'you may use the app for free, for personal learning, in the family or in class;',
              'the level check and the practice recommendations are free;',
              'we may change, pause or stop features, especially experimental ones.',
            ],
          },
        ],
      },
      {
        id: 'accounts',
        title: 'Accounts and codes',
        blocks: [
          {
            kind: 'ul',
            items: [
              'the parent account, the teacher account and class codes are optional and personal;',
              'keep your password and codes safe; you are responsible for what is done with them;',
              'you can delete the parent account in the app or write to us. Deletion follows the privacy policy.',
            ],
          },
        ],
      },
      {
        id: 'children',
        title: 'Children and parents',
        blocks: [
          {
            kind: 'ul',
            items: [
              'the app is for children used with the knowledge of a parent or teacher;',
              'features with an account, reminders or a class link are turned on by a parent or guardian;',
              'teachers who enter data about pupils (for example seat labels) are responsible for that data and should use initials or numbers, not real names.',
            ],
          },
        ],
      },
      {
        id: 'content',
        title: 'Educational content is beta',
        blocks: [
          {
            kind: 'p',
            text: 'The exercises, explanations and texts are largely written with the help of artificial intelligence and are marked “beta”, meaning a teacher has not yet reviewed them. They may contain mistakes: if you find one, use “Report a mistake”. Ludiko does not replace school or a teacher and is not affiliated with the Romanian Ministry of Education.',
          },
        ],
      },
      {
        id: 'licence',
        title: 'Copyright and licence (summary)',
        blocks: [
          {
            kind: 'ul',
            items: [
              'the code, design, learning engine, questions, explanations, texts, illustrations and the name “Ludiko” belong to Ludiko; all rights are reserved;',
              'you may use the app as published by Ludiko for personal learning, in the family or in class. Copying, modifying, publishing, selling or redistributing without written permission is not allowed;',
              'third-party material stays under its own licences and is listed on the “Credits” page;',
              `the full text is in the repository’s LICENSE file. Permission requests: ${RIGHTS_CONTACT}.`,
            ],
          },
        ],
      },
      {
        id: 'warranty',
        title: 'No warranty',
        blocks: [
          {
            kind: 'p',
            text: 'The app is provided “as is”, without warranty of any kind. We do not guarantee it works without interruption or errors, or that the level check results are correct. To the extent permitted by law, we are not liable for damages arising from using the app. The rights the law gives you as a user remain unaffected.',
          },
        ],
      },
      {
        id: 'conduct',
        title: 'Fair use',
        blocks: [
          {
            kind: 'ul',
            items: [
              'do not write real names or personal data in nicknames, game rooms or reports;',
              'do not try to break the service, read other people’s data or bypass the app’s protections;',
              'do not use Ludiko content in other products without permission.',
            ],
          },
        ],
      },
      {
        id: 'changes',
        title: 'Changes',
        blocks: [
          {
            kind: 'p',
            text: 'We may change these terms. The version and date below show the last change. If you keep using the app after a change, you accept it. This text is a draft under legal review.',
          },
        ],
      },
      {
        id: 'law',
        title: 'Governing law',
        blocks: [
          {
            kind: 'p',
            text: 'Romanian law applies. Your consumer and data subject rights remain as the law provides. [TODO lawyer: review this section.]',
          },
        ],
      },
      {
        id: 'version',
        title: 'Version and date',
        blocks: [
          {
            kind: 'p',
            text: `Version ${LEGAL_VERSION}, last updated ${LEGAL_UPDATED}. Status: draft. Contact: ${RIGHTS_CONTACT}.`,
          },
        ],
      },
    ],
  },
}
