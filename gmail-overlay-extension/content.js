const CONFIG = {
  selectors: {
    emailRow: 'tr.zA',
    messageIdAttribute: 'data-legacy-message-id',
  },
  classes: {
    highlightClass: 'gm-phishing-risk-high',
    warningButtonClass: 'gm-phishing-warning-btn',
    tooltipClass: 'gm-phishing-tooltip',
    chatContainerClass: 'gm-phishing-chat-container',
  }
};

let whitelist = JSON.parse(localStorage.getItem('phishing_whitelist') || '{}');
const analysisCache = {}; // 🧠 Store per-message analysis

chrome.runtime.onMessage?.addListener((request, sender, sendResponse) => {
  if (request.action === 'refreshDetection') {
    console.log('🔄 Manual refresh triggered');
    clearPreviousHighlights();
    processVisibleEmails();
    sendResponse({ status: 'ok' });
  }
});

function init() {
  console.log('📥 Gmail Phishing Detector initialized');
  processVisibleEmails();
  setupMutationObserver();

  setInterval(() => {
    if (document.hasFocus()) {
      processVisibleEmails();
    }
  }, 3000);

  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      console.log("🌐 Gmail view changed, re-processing...");
      clearPreviousHighlights();
      processVisibleEmails();
    }
  }, 2000);

  window.addEventListener('focus', () => {
    console.log('👀 Tab refocused — refreshing scan');
    clearPreviousHighlights();
    processVisibleEmails();
  });
}

function setupMutationObserver() {
  const inboxContainer = document.querySelector('.aeF');
  if (!inboxContainer) return console.warn('⚠️ .aeF (inbox scroll container) not found');

  const observer = new MutationObserver((mutations) => {
    const hasNewEmailRow = mutations.some(m =>
      [...m.addedNodes].some(n => n.nodeType === 1 && n.matches('tr.zA'))
    );
    if (hasNewEmailRow) {
      console.log('📩 New email row detected via .aeF observer');
      processVisibleEmails();
    }
  });

  observer.observe(inboxContainer, {
    childList: true,
    subtree: true
  });

  console.log('📡 Watching .aeF for live inbox updates');
}

function clearPreviousHighlights() {
  document.querySelectorAll(CONFIG.selectors.emailRow).forEach(row => {
    row.removeAttribute('data-phishing-processed');
    row.classList.remove(CONFIG.classes.highlightClass);
    row.querySelector(`.${CONFIG.classes.warningButtonClass}`)?.remove();
  });
}

async function processVisibleEmails() {
  const emailRows = document.querySelectorAll(CONFIG.selectors.emailRow);
  for (const emailRow of emailRows) {
    if (emailRow.getAttribute('data-phishing-processed') === 'true') continue;

    let messageId = null;
    const timeCell = emailRow.querySelector('td.xW span[title]');
    if (timeCell) {
      messageId = timeCell.getAttribute('title');
    }
    if (!messageId) {
      messageId = `${Date.now()}-${Math.random()}`;
    }

    if (whitelist[messageId]) continue;

    try {
      const response = await fetch(`http://localhost:8000/check?msg_id=${encodeURIComponent(messageId)}`);
      const data = await response.json();
      analysisCache[messageId] = data;

      if (data.is_phishing) {
        applyHighRiskStyling(emailRow, messageId);
      }
    } catch (err) {
      console.warn("⚠️ Error contacting local analysis server", err);
    }

    emailRow.setAttribute('data-phishing-processed', 'true');
  }
}

function applyHighRiskStyling(emailRow, messageId) {
  // ✅ Prevent adding the button again if it already exists
  if (emailRow.querySelector(`.${CONFIG.classes.warningButtonClass}`)) return;

  emailRow.classList.add(CONFIG.classes.highlightClass);

  const warningButton = document.createElement('button');
  warningButton.className = CONFIG.classes.warningButtonClass;
  warningButton.textContent = '⚠ Why?';

  warningButton.onclick = (e) => {
    e.stopPropagation();
    showTooltip(warningButton, messageId);
  };

  const subject = emailRow.querySelector('.y6');
  subject?.appendChild(warningButton);
}

function showTooltip(button, messageId) {
  removeExistingTooltips();
  const analysis = analysisCache[messageId];
  const tooltip = document.createElement('div');
  tooltip.className = CONFIG.classes.tooltipClass;
  tooltip.innerHTML = `
    <div class="tooltip-header">
      <span class="tooltip-title">⚠️ Phishing Risk</span>
      <button class="tooltip-close">×</button>
    </div>
    <div class="tooltip-body">
      <p><strong>Risk:</strong> ${analysis?.is_phishing ? 'High' : 'Low'}</p>
      <p><strong>Reason:</strong> ${analysis?.reason || 'Unavailable'}</p>
      <button class="more-info-btn">More Info</button>
      <button class="unflag-btn" style="margin-top: 6px; background:#666">Unflag</button>
    </div>`;

  const rect = button.getBoundingClientRect();
  tooltip.style.position = 'absolute';
  tooltip.style.top = `${rect.bottom + 5 + window.scrollY}px`;
  tooltip.style.left = `${rect.left + window.scrollX}px`;
  tooltip.style.zIndex = 9999;
  document.body.appendChild(tooltip);

  tooltip.querySelector('.tooltip-close').onclick = () => tooltip.remove();
  tooltip.querySelector('.more-info-btn').onclick = () => showChatInterface(messageId);
  tooltip.querySelector('.unflag-btn').onclick = () => {
    whitelist[messageId] = true;
    localStorage.setItem('phishing_whitelist', JSON.stringify(whitelist));
    tooltip.remove();
    clearPreviousHighlights();
    processVisibleEmails();
  };

  document.addEventListener('click', function handler(e) {
    if (!tooltip.contains(e.target) && e.target !== button) {
      tooltip.remove();
      document.removeEventListener('click', handler);
    }
  });
}

function removeExistingTooltips() {
  document.querySelectorAll(`.${CONFIG.classes.tooltipClass}`).forEach(el => el.remove());
  document.getElementById('waterflai-chatbox')?.remove();
}

function showChatInterface(messageId) {
  const analysis = analysisCache[messageId];
  const existing = document.getElementById('waterflai-chatbox');
  if (existing) existing.remove();

  const box = document.createElement('div');
  box.id = 'waterflai-chatbox';
  box.style.position = 'fixed';
  box.style.bottom = '20px';
  box.style.right = '20px';
  box.style.width = '420px';
  box.style.height = '420px';
  box.style.background = '#f9f9f9';
  box.style.border = '1px solid #ddd';
  box.style.zIndex = 999999;
  box.style.borderRadius = '18px';
  box.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.15)';
  box.style.overflow = 'hidden';
  box.style.fontFamily = 'Segoe UI, sans-serif';
  box.innerHTML = `
    <div style="background:#32DCC8;color:#fff;padding:10px 14px;font-size:16px;font-weight:600;border-top-left-radius:18px;border-top-right-radius:18px;display:flex;justify-content:space-between;align-items:center">
      🛡️ Security Assistant (Mistral)
      <button id="chat-close" style="background:transparent;border:none;color:#fff;font-size:20px;cursor:pointer">×</button>
    </div>
    <div style="padding:10px">
      <div id="chat-thread" style="margin-bottom:10px;max-height:200px;overflow-y:auto;padding-right:4px"></div>
      <textarea id="chat-input" placeholder="Ask about this email..." style="width:100%;height:70px;padding:8px;border-radius:6px;border:1px solid #ccc;resize:none;font-size:14px"></textarea>
      <button id="chat-send" style="margin-top:10px;width:100%;padding:10px;background:#32DCC8;color:#fff;border:none;border-radius:6px;font-weight:bold;font-size:15px;cursor:pointer">Send</button>
    </div>
  `;

  document.body.appendChild(box);
  document.getElementById('chat-close').onclick = () => box.remove();

  const final_text = analysis?.summary || 'Summary unavailable';
  const full_mail = analysis?.full_mail || 'Email content unavailable';

  const messages = [
    {
      role: "system",
      content: "You are a cybersecurity assistant specialized in detecting phishing attempts. Always provide clear, educational, and safe advice."
    },
    {
      role: "user",
      content: `This is the suspicious email:\n\n${full_mail}\n\nSecurity summary:\n${final_text}`
    }
  ];

  function appendChatBubble(role, text) {
    const thread = document.getElementById('chat-thread');
    const bubble = document.createElement('div');
    bubble.style.marginBottom = '10px';
    bubble.style.display = 'flex';
    bubble.style.justifyContent = role === 'user' ? 'flex-end' : 'flex-start';

    const msg = document.createElement('div');
    msg.textContent = text;
    msg.style.maxWidth = '75%';
    msg.style.padding = '10px';
    msg.style.borderRadius = '10px';
    msg.style.fontSize = '14px';
    msg.style.lineHeight = '1.4';
    msg.style.whiteSpace = 'pre-wrap';
    msg.style.background = role === 'user' ? '#32DCC8' : '#eee';
    msg.style.color = role === 'user' ? '#fff' : '#333';

    bubble.appendChild(msg);
    thread.appendChild(bubble);
    thread.scrollTop = thread.scrollHeight;
  }

  box.querySelector('#chat-send').onclick = async () => {
    const input = box.querySelector('#chat-input').value;
    if (!input.trim()) return;

    appendChatBubble('user', input);
    appendChatBubble('assistant', '🔎 Analyzing...');

    messages.push({ role: 'user', content: input });

    try {
      const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer OZSyUAoFi2DmsjJz5Cuqg8vWeFzG9grq',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'mistral-tiny',
          messages,
          temperature: 0.7
        })
      });

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || '⚠️ No response from Mistral.';

      messages.push({ role: 'assistant', content: reply });

      document.getElementById('chat-thread').lastChild.remove();
      appendChatBubble('assistant', reply);
    } catch (err) {
      console.error(err);
      document.getElementById('chat-thread').lastChild.remove();
      appendChatBubble('assistant', '❌ Error fetching response from Mistral.');
    }
  };
}

document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
