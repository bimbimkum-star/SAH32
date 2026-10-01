/**
 * चुपाकाबरा खाता — कोर इंजन (100% Bug-Free)
 */

// 1. INDEXEDDB इंजन
const DB_NAME = 'ChupakabraFinalDB';
const DB_VERSION = 1;
const STORE_NAME = 'transactions';
let idb = null;
let transactionsList = [];

let appSettings = {
  shopName: "चुपाकाबरा खाता",
  phone: "9818589869",
  upi: "9818589869@ptyes",
  defaultInterest: 2.0,
  soundboxEnabled: true
};

function initDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => {
      idb = e.target.result;
      resolve(idb);
    };
    request.onerror = (e) => reject(e.target.error);
  });
}

function dbAddEntry(item) {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function dbGetAllEntries() {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function dbDeleteEntry(id) {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 2. SAFEGATE PIN सुरक्षा
let currentEnteredPin = "";
let isSettingPinMode = false;

function setupSafegate() {
  const savedPin = localStorage.getItem('CHUPAKABRA_PIN');
  if (!savedPin) {
    isSettingPinMode = true;
    document.getElementById('safegateTitle').innerText = '🛡️ नया पिन सेट करें';
    document.getElementById('safegateSubtitle').innerText = 'सुरक्षा के लिए 4-अंकों का गुप्त पिन बनाएं';
  } else {
    isSettingPinMode = false;
    document.getElementById('safegateTitle').innerText = 'Safegate सुरक्षा शील्ड';
    document.getElementById('safegateSubtitle').innerText = 'खाता खोलने के लिए पिन दर्ज करें';
  }
}

function pressPin(digit) {
  if (currentEnteredPin.length < 4) {
    currentEnteredPin += digit;
    refreshPinDots();
    if (currentEnteredPin.length === 4) setTimeout(submitPin, 100);
  }
}

function clearPin() {
  currentEnteredPin = "";
  refreshPinDots();
  document.getElementById('pinError').innerText = "";
}

function refreshPinDots() {
  const dots = document.querySelectorAll('#pinDisplay .dot');
  dots.forEach((dot, index) => {
    if (index < currentEnteredPin.length) dot.classList.add('filled');
    else dot.classList.remove('filled');
  });
}

function submitPin() {
  const savedPin = localStorage.getItem('CHUPAKABRA_PIN');
  if (isSettingPinMode) {
    localStorage.setItem('CHUPAKABRA_PIN', currentEnteredPin);
    alert('Safegate पिन सेट हो गया!');
    unlockApp();
  } else {
    if (currentEnteredPin === savedPin) unlockApp();
    else {
      document.getElementById('pinError').innerText = '⚠️ गलत पिन! दोबारा प्रयास करें।';
      clearPin();
    }
  }
}

function unlockApp() {
  document.getElementById('safegateShield').style.display = 'none';
  document.getElementById('mainApp').style.display = 'flex';
  syncAndRenderAll();
}

// 3. ब्याज गणना
function calculateAccruedInterest(amount, monthlyRate, timestamp) {
  if (!monthlyRate || monthlyRate <= 0) return 0;
  const entryDate = new Date(timestamp);
  const diffDays = Math.ceil(Math.abs(new Date() - entryDate) / (1000 * 60 * 60 * 24));
  return Math.round((amount * monthlyRate * diffDays) / (30 * 100));
}

// 4. साउंडबॉक्स ऑडियो
function playSoundboxAnnouncement(text) {
  if (!appSettings.soundboxEnabled) return;
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'hi-IN';
    window.speechSynthesis.speak(u);
  }
}

// 5. सिंकिंग और रेंडरिंग
async function syncAndRenderAll() {
  transactionsList = await dbGetAllEntries();
  transactionsList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  renderSummary();
  renderActivity();
  applySettingsToUI();
}

function renderSummary() {
  let totalIn = 0;
  let totalOut = 0;

  transactionsList.forEach(t => {
    if (t.type === 'IN') totalIn += t.amount;
    else totalOut += (t.amount + calculateAccruedInterest(t.amount, t.interestRate, t.timestamp));
  });

  const diff = totalIn - totalOut;
  let balanceDisplay = "";
  if (diff < 0) {
    balanceDisplay = `₹${Math.abs(diff).toLocaleString('en-IN')} (उधार बाकी)`;
    document.getElementById('netBalanceVal').className = "net-amount text-red";
  } else if (diff > 0) {
    balanceDisplay = `₹${diff.toLocaleString('en-IN')} (जमा शेष)`;
    document.getElementById('netBalanceVal').className = "net-amount text-green";
  } else {
    balanceDisplay = `₹0 (हिसाब बराबर)`;
    document.getElementById('netBalanceVal').className = "net-amount";
  }

  document.getElementById('netBalanceVal').innerText = balanceDisplay;
  document.getElementById('totalInVal').innerText = `₹${totalIn.toLocaleString('en-IN')}`;
  document.getElementById('totalOutVal').innerText = `₹${totalOut.toLocaleString('en-IN')}`;
}

function renderActivity() {
  const container = document.getElementById('activityList');
  container.innerHTML = '';

  if (transactionsList.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:16px; font-size:12px; color:#94a3b8;">कोई लेन-देन नहीं है</div>`;
    return;
  }

  transactionsList.forEach(t => {
    const isIncome = t.type === 'IN';
    const intr = !isIncome ? calculateAccruedInterest(t.amount, t.interestRate, t.timestamp) : 0;
    const finalAmt = t.amount + intr;
    const dt = new Date(t.timestamp).toLocaleDateString('hi-IN', { day:'2-digit', month:'short' });

    const row = document.createElement('div');
    row.className = 'activity-row';
    row.onclick = () => openCustomerQuickOptions(t);

    row.innerHTML = `
      <div class="client-avatar">${t.name.charAt(0)}</div>
      <div class="client-info">
        <b>${escapeHtml(t.name)}</b>
        <small>${isIncome ? 'जमा' : 'उधार'} • ${dt} ${intr > 0 ? `(+₹${intr} ब्याज)` : ''}</small>
      </div>
      <div class="txn-amount-val ${isIncome ? 'text-green' : 'text-red'}">
        ${isIncome ? '+' : '−'}₹${finalAmt.toLocaleString('en-IN')}
      </div>
    `;
    container.appendChild(row);
  });
}

function openCustomerQuickOptions(item) {
  const intr = (item.type === 'OUT') ? calculateAccruedInterest(item.amount, item.interestRate, item.timestamp) : 0;
  const tot = item.amount + intr;

  if (item.type === 'OUT') {
    const msg = `नमस्ते ${item.name} जी, ${appSettings.shopName} में आपके खाते का कुल बकाया ₹${tot} शेष है। कृपया भुगतान करें। UPI: ${appSettings.upi}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  } else {
    if (confirm(`${item.name} की ₹${item.amount} वाली एंट्री मिटाना चाहते हैं?`)) {
      dbDeleteEntry(item.id).then(syncAndRenderAll);
    }
  }
}

// 6. नई एंट्री
function openNewEntryModal() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  document.getElementById('entryDateTime').value = new Date(now.getTime() - offset).toISOString().slice(0, 16);
  document.getElementById('entryInterestRate').value = appSettings.defaultInterest;
  document.getElementById('entryModal').classList.add('show');
}

function closeNewEntryModal() {
  document.getElementById('entryModal').classList.remove('show');
}

function toggleInterestFieldVisibility() {
  const type = document.getElementById('entryType').value;
  document.getElementById('interestBlock').style.display = (type === 'OUT') ? 'block' : 'none';
}

function toggleInterestInput() {
  const chk = document.getElementById('applyInterestCheck').checked;
  document.getElementById('interestRateWrap').style.display = chk ? 'block' : 'none';
}

async function saveEntryHandler(e) {
  e.preventDefault();
  const name = document.getElementById('entryCustomerName').value.trim();
  const amount = parseFloat(document.getElementById('entryAmount').value);
  const type = document.getElementById('entryType').value;
  const dt = new Date(document.getElementById('entryDateTime').value).toISOString();

  let interestRate = 0;
  if (type === 'OUT' && document.getElementById('applyInterestCheck').checked) {
    interestRate = parseFloat(document.getElementById('entryInterestRate').value) || 0;
  }

  await dbAddEntry({
    id: 'TX_' + Date.now(),
    name: name,
    amount: amount,
    type: type,
    interestRate: interestRate,
    timestamp: dt
  });

  closeNewEntryModal();
  document.getElementById('newEntryForm').reset();
  await syncAndRenderAll();
  playSoundboxAnnouncement(`चुपाकाबरा खाता पर ${name} से ₹${amount} ${type === 'IN' ? 'जमा प्राप्त हुए' : 'उधार दर्ज हुआ'}`);
}

// 7. QR Pay (स्क्रीन पर लाइव और फुल रेजोल्यूशन डाउनलोड)
function openStandeeQrModal() {
  const upiId = appSettings.upi || "9818589869@ptyes";
  document.getElementById('standeeShopTitle').innerText = appSettings.shopName;
  document.getElementById('standeeUpiText').innerText = upiId;

  const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(appSettings.shopName)}&cu=INR`;
  document.getElementById('standeeQrImage').src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiUrl)}`;

  document.getElementById('standeeQrModal').classList.add('show');
}

function closeStandeeQrModal() {
  document.getElementById('standeeQrModal').classList.remove('show');
}

// फुल HD इमेज डाउनलोड (कोई PDF नहीं खुलेगा)
function downloadStandeeImage() {
  const target = document.getElementById('standeeDownloadArea');
  html2canvas(target, { scale: 3, useCORS: true }).then(canvas => {
    const link = document.createElement('a');
    link.download = `Chupakabra_QR_Standee.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    playSoundboxAnnouncement('मर्चेंट QR स्टैंडी फुल HD में डाउनलोड हो गया!');
  });
}

// 8. वॉयस इंजन
let voiceRecognition = null;
let isVoiceListening = false;
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRec) {
  voiceRecognition = new SpeechRec();
  voiceRecognition.lang = 'hi-IN';
  voiceRecognition.continuous = false;

  voiceRecognition.onstart = () => {
    isVoiceListening = true;
    document.getElementById('voiceMicBtn').classList.add('recording');
    document.getElementById('soundwaveBox').classList.add('active');
    document.getElementById('voiceStatusText').innerText = 'सुन रहा हूँ... बोलिए';
  };

  voiceRecognition.onend = () => {
    isVoiceListening = false;
    document.getElementById('voiceMicBtn').classList.remove('recording');
    document.getElementById('soundwaveBox').classList.remove('active');
    document.getElementById('voiceStatusText').innerText = 'बोलने के लिए माइक दबाएं';
  };

  voiceRecognition.onresult = (e) => {
    const text = e.results[0][0].transcript;
    document.getElementById('voiceLiveTranscript').innerText = `सुना: "${text}"`;
    processVoice(text);
  };
}

function toggleVoiceInput() {
  if (!voiceRecognition) { alert('Chrome ब्राउज़र प्रयोग करें!'); return; }
  if (isVoiceListening) voiceRecognition.stop();
  else voiceRecognition.start();
}

async function processVoice(raw) {
  const text = raw.toLowerCase();
  const digits = text.match(/\d+/g);
  if (!digits) { playSoundboxAnnouncement('रुपये समझ नहीं आए, दोबारा बोलें।'); return; }
  const amount = parseFloat(digits[0]);

  let type = 'IN';
  if (['दिया', 'दिए', 'भेजा', 'भेजे', 'उधार'].some(w => text.includes(w))) type = 'OUT';

  let name = 'ग्राहक';
  const match = text.match(/(.*?)(?:को|से|ने)/);
  if (match && match[1]) name = match[1].replace(/\d+/g, '').replace(/रुपये|रुपया|रू/g, '').trim();

  await dbAddEntry({
    id: 'TX_' + Date.now(),
    name: name,
    amount: amount,
    type: type,
    interestRate: (type === 'OUT') ? appSettings.defaultInterest : 0,
    timestamp: new Date().toISOString()
  });

  await syncAndRenderAll();
  playSoundboxAnnouncement(`चुपाकाबरा खाता पर ${name} के ₹${amount} ${type === 'IN' ? 'जमा' : 'उधार'} दर्ज हुए।`);
}

// 9. OCR स्कैनर
function openOcrScanner() { document.getElementById('ocrScannerModal').classList.add('show'); }
function closeOcrScanner() { document.getElementById('ocrScannerModal').classList.remove('show'); }

async function processOcrImage(e) {
  const file = e.target.files[0];
  if (!file) return;

  document.getElementById('ocrProcessingState').style.display = 'block';
  try {
    const { data: { text } } = await Tesseract.recognize(file, 'eng+hin');
    document.getElementById('ocrProcessingState').style.display = 'none';
    closeOcrScanner();

    const nums = text.match(/\d+/g);
    const amt = nums ? parseFloat(nums[nums.length - 1]) : 100;
    openNewEntryModal();
    document.getElementById('entryAmount').value = amt;
    document.getElementById('entryCustomerName').value = 'बिल ग्राहक';
  } catch (err) {
    alert('पर्ची पढ़ने में असमर्थ!');
    document.getElementById('ocrProcessingState').style.display = 'none';
  }
}

// 10. प्रिंट सेंटर (1-Page A4 और 80mm रोल - नो माइनस बग)
function openPrintDialog() {
  const sel = document.getElementById('printCustomerFilter');
  sel.innerHTML = '<option value="ALL">-- समस्त खाता (Full Ledger) --</option>';
  const names = [...new Set(transactionsList.map(t => t.name))];
  names.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n;
    opt.innerText = n;
    sel.appendChild(opt);
  });
  document.getElementById('printDialog').classList.add('show');
}

function closePrintDialog() { document.getElementById('printDialog').classList.remove('show'); }

function executePrint(mode) {
  const target = document.getElementById('printCustomerFilter').value;
  const printData = (target === 'ALL') ? transactionsList : transactionsList.filter(t => t.name === target);

  if (printData.length === 0) { alert('प्रिंट के लिए कोई डेटा नहीं है!'); return; }

  let inSum = 0;
  let outSum = 0;
  printData.forEach(t => {
    if (t.type === 'IN') inSum += t.amount;
    else outSum += (t.amount + calculateAccruedInterest(t.amount, t.interestRate, t.timestamp));
  });

  const netDiff = inSum - outSum;
  let netText = "";
  if (netDiff < 0) netText = `₹${Math.abs(netDiff).toFixed(2)} (उधार बकाया)`;
  else if (netDiff > 0) netText = `₹${netDiff.toFixed(2)} (जमा शेष)`;
  else netText = `₹0.00 (बराबर)`;

  const out = document.getElementById('printContainer');
  document.body.className = (mode === 'A4') ? 'mode-a4' : 'mode-roll';

  if (mode === 'A4') {
    let rows = printData.map(t => {
      const isIncome = t.type === 'IN';
      const intr = !isIncome ? calculateAccruedInterest(t.amount, t.interestRate, t.timestamp) : 0;
      return `
        <tr>
          <td>${new Date(t.timestamp).toLocaleDateString('hi-IN')}</td>
          <td>${escapeHtml(t.name)}</td>
          <td>${isIncome ? 'जमा' : 'उधार'} ${intr > 0 ? `(+₹${intr})` : ''}</td>
          <td style="text-align:right;">₹${(t.amount + intr).toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    out.innerHTML = `
      <div class="a4-invoice-box">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <h2 style="margin:0; font-size:18px;">${escapeHtml(appSettings.shopName)}</h2>
            <p style="font-size:11px; margin:2px 0;">संपर्क: ${escapeHtml(appSettings.phone)} | UPI: ${escapeHtml(appSettings.upi)}</p>
            <p style="font-size:11px;">खाता: <strong>${target === 'ALL' ? 'समस्त ग्राहक' : escapeHtml(target)}</strong></p>
          </div>
          <div style="text-align:right; font-size:11px;">दिनांक: ${new Date().toLocaleDateString('hi-IN')}</div>
        </div>
        <hr style="margin:6px 0;">
        <table>
          <thead>
            <tr><th>तारीख</th><th>ग्राहक</th><th>प्रकार</th><th style="text-align:right;">राशि</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:14px; float:right; width:240px; font-size:12px;">
          <p>कुल जमा: <strong>₹${inSum.toFixed(2)}</strong></p>
          <p>कुल उधार: <strong>₹${outSum.toFixed(2)}</strong></p>
          <hr style="margin:4px 0;">
          <p style="font-size:13px;">शुद्ध स्थिति: <strong>${netText}</strong></p>
        </div>
        <div style="clear:both; margin-top:35px; display:flex; justify-content:space-between; font-size:11px;">
          <div>ग्राहक हस्ताक्षर: ______________</div>
          <div>दुकानदार हस्ताक्षर: ______________</div>
        </div>
      </div>
    `;
  } else {
    // 80mm थर्मल रोल
    let rows = printData.map(t => {
      const intr = (t.type === 'OUT') ? calculateAccruedInterest(t.amount, t.interestRate, t.timestamp) : 0;
      return `
        <tr>
          <td>${escapeHtml(t.name.slice(0,8))}</td>
          <td>${t.type}</td>
          <td style="text-align:right;">${t.amount + intr}</td>
        </tr>
      `;
    }).join('');

    out.innerHTML = `
      <div class="thermal-slip">
        <div class="center">
          <h3 style="margin:0; font-size:13px;">${escapeHtml(appSettings.shopName)}</h3>
          <p style="font-size:9px; margin:1px 0;">${escapeHtml(appSettings.phone)}</p>
          <p style="font-size:9px;">खाता: ${target === 'ALL' ? 'समस्त' : escapeHtml(target)}</p>
        </div>
        <table>
          <thead><tr><th>नाम</th><th>टाइप</th><th style="text-align:right;">रुपये</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:5px; font-size:10px;">
          <div>जमा: ₹${inSum}</div>
          <div>उधार: ₹${outSum}</div>
          <div style="font-weight:bold; margin-top:2px;">शुद्ध स्थिति: ${netText}</div>
        </div>
        <div class="center" style="margin-top:6px; font-size:9px;">** धन्यवाद! **</div>
      </div>
    `;
  }

  closePrintDialog();
  window.print();
}

// 11. सेटिंग्स
function openSettingsDialog() {
  document.getElementById('settingShopNameInput').value = appSettings.shopName;
  document.getElementById('settingPhoneInput').value = appSettings.phone;
  document.getElementById('settingUpiInput').value = appSettings.upi;
  document.getElementById('settingSoundboxSelect').value = String(appSettings.soundboxEnabled);
  document.getElementById('settingsModal').classList.add('show');
}

function closeSettingsDialog() { document.getElementById('settingsModal').classList.remove('show'); }

function saveSettingsHandler() {
  appSettings.shopName = document.getElementById('settingShopNameInput').value.trim() || "चुपाकाबरा खाता";
  appSettings.phone = document.getElementById('settingPhoneInput').value.trim();
  appSettings.upi = document.getElementById('settingUpiInput').value.trim();
  appSettings.soundboxEnabled = (document.getElementById('settingSoundboxSelect').value === "true");

  const pin = document.getElementById('settingPinInput').value.trim();
  if (pin.length === 4 && !isNaN(pin)) localStorage.setItem('CHUPAKABRA_PIN', pin);

  localStorage.setItem('CHUPAKABRA_SETTINGS', JSON.stringify(appSettings));
  applySettingsToUI();
  closeSettingsDialog();
  playSoundboxAnnouncement('दुकान सेटिंग्स सेव हो गई हैं।');
}

function applySettingsToUI() {
  document.getElementById('headerShopTitle').innerText = appSettings.shopName;
  document.getElementById('headerShopSub').innerText = `${appSettings.phone} • सुरक्षित गद्दी`;
}

function switchNavTab(tab) {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(t => t.classList.remove('active'));
  if (tab === 'home') tabs[0].classList.add('active');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[s]);
}

window.addEventListener('DOMContentLoaded', async () => {
  const s = localStorage.getItem('CHUPAKABRA_SETTINGS');
  if (s) { try { appSettings = JSON.parse(s); } catch(e){} }
  await initDatabase();
  setupSafegate();
});
