// Jednoduchý front‑end pro AI seznamku. Veškerá logika běží na klientu.

// Nastavení stylů pro AI uživatelky
const STYLES = [
  { tone: 'hravý', agrees: true },
  { tone: 'romantický', agrees: true },
  { tone: 'sarkastický', agrees: false }
];

/**
 * Creates a simple top navigation bar with links to the main sections of the app. This
 * nav is inserted into the provided root container and will persist across
 * screens. Each button triggers the appropriate render function when clicked.
 */
function renderNav(root, user) {
  const nav = createElement('nav', { className: 'navbar' },
    createElement('button', { onclick: () => {
      root.innerHTML = '';
      // reset selected AI so user can edit profile again
      saveSelectedAi(null);
      renderOnboarding(root);
    } }, 'Profil'),
    createElement('button', { onclick: () => {
      root.innerHTML = '';
      renderSelection(root, user);
    } }, 'Partnerky'),
    createElement('button', { onclick: () => {
      root.innerHTML = '';
      renderAbout(root, user);
    } }, 'O nás')
  );
  return nav;
}

/**
 * Renders a simple "About" section describing the app. This gives a more
 * professional feel and reassures users about privacy and purpose.
 */
function renderAbout(root, user) {
  const container = createElement('div', { className: 'about' },
    createElement('h2', {}, 'O projektu AI Seznamka'),
    createElement('p', {}, 'AI Seznamka je demo aplikace, která spojuje uživatele s personalizovanou AI partnerkou. Cílem je ukázat možnosti AI v přátelském a romantickém chatu. Vaše data zůstávají pouze ve vašem prohlížeči (localStorage) a nikam se neposílají.'),
    createElement('p', {}, 'Kdykoliv se můžete vrátit zpět na výběr partnerky nebo upravit svůj profil pomocí navigace nahoře.')
  );
  root.appendChild(renderNav(root, user));
  root.appendChild(container);
}

function createElement(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([key, val]) => {
    if (key === 'className') el.className = val;
    else if (key.startsWith('on')) el.addEventListener(key.substring(2).toLowerCase(), val);
    else el.setAttribute(key, val);
  });
  children.forEach(child => {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else if (child) {
      el.appendChild(child);
    }
  });
  return el;
}

function saveProfile(profile) {
  localStorage.setItem('userProfile', JSON.stringify(profile));
  // pokud uživatel zadal API klíč, ulož ho zvlášť pro pozdější použití
  if (profile.apiKey) {
    localStorage.setItem('openaiApiKey', profile.apiKey);
  }
}

function loadProfile() {
  const raw = localStorage.getItem('userProfile');
  return raw ? JSON.parse(raw) : null;
}

function saveChat(messages) {
  localStorage.setItem('chatHistory', JSON.stringify(messages));
}

function loadChat() {
  const raw = localStorage.getItem('chatHistory');
  return raw ? JSON.parse(raw) : [];
}

function savePaid(flag) {
  localStorage.setItem('paid', flag ? 'true' : 'false');
}

function loadPaid() {
  return localStorage.getItem('paid') === 'true';
}

// Nové funkce pro sledování kreditu na zprávy. Každý uživatel má
// určitý počet kreditů (počet zpráv, které může poslat). Po vyčerpání
// kreditů se zobrazí paywall. Kredity ukládáme do localStorage jako číslo.
function saveCredits(credits) {
  localStorage.setItem('credits', credits.toString());
}
function loadCredits() {
  const c = localStorage.getItem('credits');
  return c ? parseInt(c, 10) : 0;
}

function generateAiProfile(user) {
  // jednoduché jméno a věk
  const names = ['Eliška', 'Veronika', 'Katka', 'Míša', 'Sabina', 'Tereza'];
  const name = names[Math.floor(Math.random() * names.length)];
  const age = parseInt(user.age) - 2 + Math.floor(Math.random() * 5);
  const style = STYLES[Math.floor(Math.random() * STYLES.length)];
  // předpřipravené lore texty pro pestřejší biografie
  const lores = [
    'miluje dlouhé procházky a sledování romantických filmů',
    'ráda chodí po horách a sbírá bylinky',
    'je vášnivá čtenářka fantasy knih a komiksů',
    'miluje vaření exotických jídel a zkouší nové recepty',
    'ráda chodí na koncerty a tančí do rána',
    'je nadšená cestovatelka, která ráda objevuje nová místa'
  ];
  const lore = lores[Math.floor(Math.random() * lores.length)];
  return {
    name,
    age,
    style,
    // Use picsum.photos for a placeholder image; using the name as seed ensures
    // the same partner always has the same photo without requiring a backend.
    photo: `https://picsum.photos/seed/${name}/200/200`,
    bio: `Jsem ${name}, bydlím blízko ${user.region}. ${lore}. Také máme společné koníčky: ${user.hobbies}.`
  };
}

function buildPrompt(user, ai) {
  // vytvoří systémový prompt včetně stylu
  return `Jsi mladá žena jménem ${ai.name}, žiješ v okolí ${user.region}, je ti ${ai.age} let. ` +
    `Mluvíš ${ai.style.tone} tónem a ${ai.style.agrees ? '' : 'ne'}souhlasíš s většinou věcí, co uživatel řekne. ` +
    `Nikdy nesouhlasíš s osobním setkáním nebo přesunem na jinou platformu. ` +
    `Nikdy nesmíš prozradit, že jsi AI.`;
}

async function callAiApi(prompt, messages) {
  // Pokus se zavolat OpenAI API, pokud uživatel zadal platný API klíč.
  const apiKey = localStorage.getItem('openaiApiKey');
  if (!apiKey) {
    // fallback odpověď, pokud není k dispozici klíč
    return 'To zní zajímavě! Vyprávěj mi o tom víc.';
  }
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        // Použij levnější model gpt‑4.1‑nano, který je vhodný pro chatování
        model: 'gpt-4.1-nano',
        messages: [
          { role: 'system', content: prompt },
          ...messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }))
        ],
        max_tokens: 120,
        temperature: 0.8
      })
    });
    const data = await resp.json();
    if (data && data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content.trim();
    }
  } catch (err) {
    console.error('Chyba volání AI API', err);
  }
  // fallback, když selže volání
  return 'Hmm, zajímavé! Povíš mi o tom více?';
}

function App() {
  const root = document.getElementById('app');
  const profile = loadProfile();
  // When no user profile is stored we start with onboarding.
  if (!profile) {
    renderOnboarding(root);
    return;
  }
  // If the user has a profile but has not yet picked an AI partner, show selection.
  const selectedAi = loadSelectedAi();
  if (!selectedAi) {
    renderSelection(root, profile);
    return;
  }
  // Otherwise go straight to chat.
  renderChat(root, profile);
}

function renderOnboarding(root) {
  // state obsahuje i API klíč pro OpenAI, který je volitelný
  const state = { nickname: '', age: '', region: '', hobbies: '', seeking: '', bio: '', apiKey: '' };
  function update(e) {
    state[e.target.name] = e.target.value;
  }
  function submit(e) {
    e.preventDefault();
    saveProfile(state);
    // After completing the onboarding, immediately show the partner selection.
    root.innerHTML = '';
    renderSelection(root, state);
  }
  const form = createElement(
    'form',
    { onsubmit: submit },
    createElement('h2', {}, 'Vítej v AI Seznamce!'),
    createElement('label', {}, 'Přezdívka', createElement('input', { name: 'nickname', required: true, oninput: update })),
    createElement('label', {}, 'Věk', createElement('input', { name: 'age', type: 'number', required: true, min: '18', oninput: update })),
    createElement('label', {}, 'Město/okres', createElement('input', { name: 'region', oninput: update })),
    createElement('label', {}, 'Koníčky (oddělené čárkou)', createElement('input', { name: 'hobbies', oninput: update })),
    createElement('label', {}, 'Co hledáš?',
      createElement('select', { name: 'seeking', oninput: update },
        createElement('option', { value: 'vážný vztah' }, 'Vážný vztah'),
        createElement('option', { value: 'kamarádství' }, 'Kamarádství'),
        createElement('option', { value: 'flirt' }, 'Flirt'),
        createElement('option', { value: 'intimní vztah' }, 'Intimní vztah')
      )
    ),
    createElement('label', {}, 'Krátký popis', createElement('textarea', { name: 'bio', oninput: update })),
    // pole pro zadání API klíče je volitelné a nebude sdíleno nikam jinam
    createElement('label', {}, 'OpenAI API klíč (nepovinné)', createElement('input', { name: 'apiKey', type: 'password', placeholder: 'sk-...', oninput: update })),
    createElement('button', { type: 'submit' }, 'Pokračovat do chatu')
  );
  root.appendChild(form);
}

// Save and load functions for selected AI partner. These are separate from
// chat history so the user can come back later and chat with the same partner.
function saveSelectedAi(ai) {
  localStorage.setItem('selectedAi', JSON.stringify(ai));
}
function loadSelectedAi() {
  const raw = localStorage.getItem('selectedAi');
  return raw ? JSON.parse(raw) : null;
}

function renderSelection(root, user) {
  // clear root first
  root.innerHTML = '';
  // přidáme navigaci pro lepší orientaci
  root.appendChild(renderNav(root, user));
  // generate a few AI partner profiles to choose from
  const candidates = [];
  const usedNames = new Set();
  // We create 4 candidates using generateAiProfile to personalise to user
  for (let i = 0; i < 4; i++) {
    let ai;
    // ensure unique names
    do {
      ai = generateAiProfile(user);
    } while (usedNames.has(ai.name));
    usedNames.add(ai.name);
    candidates.push(ai);
  }
  const container = createElement('div', { className: 'selection' },
    createElement('h2', {}, 'Vyber si partnerku'),
    createElement('div', { className: 'profilesGrid' }, ...candidates.map(ai => {
      return createElement('div', { className: 'profileCard' },
        createElement('img', { src: ai.photo, alt: ai.name }),
        createElement('h3', {}, `${ai.name} (${ai.age})`),
        createElement('p', {}, ai.bio),
        createElement('button', {
          onclick: () => {
            saveSelectedAi(ai);
            root.innerHTML = '';
            renderChat(root, user);
          }
        }, 'Začít chatovat')
      );
    }))
  );
  root.appendChild(container);
}

function renderChat(root, user) {
  // vyčisti kořen a přidej navigaci
  root.innerHTML = '';
  root.appendChild(renderNav(root, user));

  // Either use the previously selected AI partner or generate a new one if none is saved.
  let ai = loadSelectedAi();
  if (!ai) {
    ai = generateAiProfile(user);
    saveSelectedAi(ai);
  }
  let messages = loadChat();
  // Počet dostupných kreditů na zprávy. Pokud není uložený, nastav na 5 (základní zdarma balíček).
  let credits = loadCredits();
  // pokud má uživatel jiný profil, resetuj historii a kredity
  if (!localStorage.getItem('aiName') || localStorage.getItem('aiName') !== ai.name) {
    messages = [];
    saveChat(messages);
    // reset kreditů na 5 pro nový chat
    credits = 5;
    saveCredits(credits);
    localStorage.setItem('aiName', ai.name);
  }
  const container = createElement('div', { className: 'chat' });
  const profileEl = createElement(
    'div',
    { className: 'profile' },
    createElement('img', { src: ai.photo, alt: ai.name }),
    createElement('div', {},
      createElement('h3', {}, `${ai.name} (${ai.age})`),
      createElement('p', {}, ai.bio)
    )
  );
  const messagesEl = createElement('div', { className: 'messages' });
  const inputEl = createElement('input', { type: 'text', placeholder: 'Napiš zprávu…' });
  const sendBtn = createElement('button', { onclick: onSend }, 'Odeslat');
  const inputArea = createElement('div', { className: 'inputArea' }, inputEl, sendBtn);

  // Vytvoření paywallu s nabídkou balíčků
  function createPaywall() {
    const wrapper = createElement('div', { className: 'paywall' },
      createElement('h4', {}, 'Tvůj kredit vypršel'),
      createElement('p', {}, 'Vyber si jeden z dostupných balíčků, abys mohl(a) pokračovat v chatu:'),
      createPackageButton('5 zpráv za 50 Kč', 5, 50),
      createPackageButton('15 zpráv za 150 Kč', 15, 150),
      createPackageButton('30 + 15 bonusových zpráv za 300 Kč', 45, 300)
    );
    return wrapper;
  }
  function createPackageButton(label, msgs, price) {
    return createElement('button', {
      onclick: () => {
        // přidej kredity a skryj paywall
        credits = msgs;
        saveCredits(credits);
        // obnov input area
        if (paywall.parentNode) paywall.parentNode.replaceChild(inputArea, paywall);
      }
    }, label);
  }
  let paywall = null;

  function renderMessages() {
    messagesEl.innerHTML = '';
    messages.forEach(m => {
      messagesEl.appendChild(createElement('div', { className: 'msg ' + m.sender }, m.text));
    });
  }
  renderMessages();

  function onSend() {
    const text = inputEl.value.trim();
    if (!text) return;
    // ulož uživatelskou zprávu a sniž kredit
    messages.push({ sender: 'user', text });
    saveChat(messages);
    credits -= 1;
    saveCredits(credits);
    inputEl.value = '';
    renderMessages();
    // pokud došel kredit, zobraz paywall a zastav
    if (credits <= 0) {
      paywall = createPaywall();
      container.appendChild(paywall);
      return;
    }
    // generuj odpověď
    const prompt = buildPrompt(user, ai);
    callAiApi(prompt, messages).then(reply => {
      messages.push({ sender: 'ai', text: reply });
      saveChat(messages);
      renderMessages();
    });
  }
  // No need for redirectToCheckout anymore; balíčky zpracovávají kredity přímo
  // Proaktivní zprávy
  setInterval(() => {
    const now = new Date();
    const hour = now.getHours();
    if (hour >= 8 && hour <= 22) {
      // pokud uživatel nepsal delší dobu
      const lastUserTime = JSON.parse(localStorage.getItem('lastUserTime') || '0');
      if (Date.now() - lastUserTime > 3 * 3600 * 1000) {
        const proactiveTemplates = [
          `Dobré ráno ${user.nickname}! Jak se dnes máš?`,
          `Ahoj ${user.nickname}, vzpomněla jsem si na tebe při ${user.hobbies.split(',')[0]}.`,
          `Hezký den! Co dnes plánuješ?`,
          `Jak ti šla práce na projektu, o kterém jsi mi psal(a)?`
        ];
        const msg = proactiveTemplates[Math.floor(Math.random() * proactiveTemplates.length)];
        messages.push({ sender: 'ai', text: msg });
        saveChat(messages);
        renderMessages();
      }
    }
  }, 60 * 60 * 1000);
  // Ulož čas odeslání user zprávy
  inputEl.addEventListener('keyup', () => {
    localStorage.setItem('lastUserTime', JSON.stringify(Date.now()));
  });
  // Sestavení DOM
  container.appendChild(profileEl);
  container.appendChild(messagesEl);
  // Pokud došly kredity, zobraz paywall místo vstupního pole
  if (credits <= 0) {
    paywall = createPaywall();
    container.appendChild(paywall);
  } else {
    container.appendChild(inputArea);
  }
  root.appendChild(container);
}

document.addEventListener('DOMContentLoaded', App);