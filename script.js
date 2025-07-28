// Jednoduchý front‑end pro AI seznamku. Veškerá logika běží na klientu.

// Nastavení stylů pro AI uživatelky
const STYLES = [
  { tone: 'hravý', agrees: true },
  { tone: 'romantický', agrees: true },
  { tone: 'sarkastický', agrees: false }
];

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

function generateAiProfile(user) {
  // jednoduché jméno a věk
  const names = ['Eliška', 'Veronika', 'Katka', 'Míša', 'Sabina', 'Tereza'];
  const name = names[Math.floor(Math.random() * names.length)];
  const age = parseInt(user.age) - 2 + Math.floor(Math.random() * 5);
  const style = STYLES[Math.floor(Math.random() * STYLES.length)];
  return {
    name,
    age,
    style,
    photo: 'https://thispersondoesnotexist.com/image',
    bio: `Jsem ${name}, bydlím blízko ${user.region}. Mám ráda podobné koníčky jako ty: ${user.hobbies}.`
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
        model: 'gpt-3.5-turbo',
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
  if (!profile) {
    renderOnboarding(root);
  } else {
    renderChat(root, profile);
  }
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
    root.innerHTML = '';
    renderChat(root, state);
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

function renderChat(root, user) {
  const ai = generateAiProfile(user);
  let messages = loadChat();
  let paid = loadPaid();
  // pokud má uživatel jiný profil, resetuj historii
  if (!localStorage.getItem('aiName') || localStorage.getItem('aiName') !== ai.name) {
    messages = [];
    saveChat(messages);
    savePaid(false);
    paid = false;
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

  const paywall = createElement(
    'div',
    { className: 'paywall' },
    createElement('h4', {}, 'Je mi to líto…'),
    createElement('p', {}, 'Tvůj kredit na zprávy právě vypršel. Toto je oznámení od našeho webu. Pokud chceš pokračovat v našem poznávání, stačí si zakoupit další kredit.'),
    createElement('button', { onclick: redirectToCheckout }, 'Zaplatit a pokračovat')
  );

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
    messages.push({ sender: 'user', text });
    saveChat(messages);
    inputEl.value = '';
    renderMessages();
    // Kontrola limitu
    const userCount = messages.filter(m => m.sender === 'user').length;
    if (!paid && userCount >= 5) {
      // zobrazit výzvu a zastavit
      messagesEl.parentNode.replaceChild(paywall, inputArea);
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
  function redirectToCheckout() {
    // Simulace zaplacení: nastav paid na true
    savePaid(true);
    paid = true;
    // obnovit input
    paywall.parentNode.replaceChild(inputArea, paywall);
  }
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
  if (!paid && messages.filter(m => m.sender === 'user').length >= 5) {
    container.appendChild(paywall);
  } else {
    container.appendChild(inputArea);
  }
  root.appendChild(container);
}

document.addEventListener('DOMContentLoaded', App);