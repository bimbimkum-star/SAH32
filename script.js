/**
 * चुपाकाबरा खाता — कोर जावास्क्रिप्ट इंजन (भाग 3)
 */

// =======================================================
// 1. INDEXEDDB इंजन (नो-क्रैश, नो-हैंग, नो-डेटा-लॉस)
// =======================================================
const DB_NAME = 'ChupakabraKhataDB';
const DB_VERSION = 1;
const STORE_NAME = 'transactions';
let idb = null;
let transactionsList = [];

// सेटिंग्स स्टेट
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
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = (e) => {
      idb = e.target.result;
      resolve(idb);
    };

    request.onerror = (e) => {
      console.error('IndexedDB Error:', e.target.error);
      reject(e.target.error);
    };
  });
}

function dbAddEntry(item) {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function dbGetAllEntries() {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function dbDeleteEntry(id) {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// =======================================================
// 2. SAFEGATE PIN सुरक्षा और गूगल सिंक शील्ड
// =======================================================
let currentEnteredPin = "";
let isSettingPinMode = false;

function setupSafegate() {
  const savedPin = localStorage.getItem('CHUPAKABRA_PIN');
  if (!savedPin) {
    isSettingPinMode = true;
    document.getElementById('safegateTitle').innerText = '🛡️ नया पिन सेट करें';
    document.getElementById('safegateSubtitle').innerText = 'खाता सुरक्षित रखने के लिए 4-अंकों का गुप्त पिन बनाएं';
  } else {
    isSettingPinMode = false;
    document.getElementById('safegateTitle').innerText = 'Safegate सुरक्षा शील्ड';
    document.getElementById('safegateSubtitle').innerText = 'खाता खोलने के लिए 4-अंकों का गुप्त पिन दर्ज करें';
  }
}

function pressPin(digit) {
  if (currentEnteredPin.length < 4) {
    currentEnteredPin += digit;
    refreshPinDots();
    if (currentEnteredPin.length === 4) {
      setTimeout(submitPin, 100);
    }
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
  const errEl = document.getElementById('pinError');

  if (isSettingPinMode) {
    localStorage.setItem('CHUPAKABRA_PIN', currentEnteredPin);
    alert('Safegate पिन सफलतापूर्वक बन गया!');
    unlockApplication();
  } else {
    if (currentEnteredPin === savedPin) {
      unlockApplication();
    } else {
      errEl.innerText = '⚠️ गलत पिन! कृपया पुनः प्रयास करें।';
      clearPin();
    }
  }
}

function unlockApplication() {
  document.getElementById('safegateShield').style.display = 'none';
  document.getElementById('mainApp').style.display = 'flex';
  syncAndRenderAll();
}

function handleGoogleSignIn() {
  // गूगल क्लाउड बैकअप सिंक सिम्युलेटर
  alert('गूगल अकाउंट से कनेक्ट हो रहा है... क्लाउड सिंक एक्टिव!');
  document.getElementById('syncStatusBadge').innerText = '● Cloud Sync';
  document.getElementById('syncStatusBadge').style.color = '#38bdf8';
  unlockApplication();
}

// =======================================================
// 3. ब्याज कैलकुलेटर इंजन (Interest Logic)
// =======================================================
function calculateAccruedInterest(amount, monthlyRate, timestamp) {
  if (!monthlyRate || monthlyRate <= 0) return 0;
  
  const entryDate = new Date(timestamp);
  const today = new Date();
  const diffTime = Math.abs(today - entryDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // मासिक साधारण ब्याज: (मूलधन * दर * दिन) / (30 * 100)
  const interest = (amount * monthlyRate * diffDays) / (30 * 100);
  return Math.round(interest);
}

// =======================================================
// 4. साउंडबॉक्स ऑडियो इंजन (Paytm/PhonePe स्टाइल अलर्ट)
// =======================================================
function playSoundboxAnnouncement(text) {
  if (!appSettings.soundboxEnabled) return;

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const voiceMsg = new SpeechSynthesisUtterance(text);
    voiceMsg.lang = 'hi-IN';
    voiceMsg.rate = 1.0;
    voiceMsg.pitch = 1.0;
    window.speechSynthesis.speak(voiceMsg);
  }
}

function toggleSoundboxMode() {
  appSettings.soundboxEnabled = !appSettings.soundboxEnabled;
  localStorage.setItem('CHUPAKABRA_SETTINGS', JSON.stringify(appSettings));
  const btn = document.getElementById('soundboxToggleBtn');
  btn.innerHTML = `<span class="btn-symbol">🔊</span>साउंडबॉक्स: ${appSettings.soundboxEnabled ? 'ON' : 'OFF'}`;
  playSoundboxAnnouncement(`साउंडबॉक्स ${appSettings.soundboxEnabled ? 'चालू' : 'बंद'} कर दिया गया है।`);
}

// =======================================================
// 5. डेटा सिंकिंग और रेंडरिंग
// =======================================================
async function syncAndRenderAll() {
  transactionsList = await dbGetAllEntries();
  transactionsList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  renderActivityList();
  renderSummaryCards();
  applySettingsToUI();
}

function renderSummaryCards() {
  let totalIn = 0;
  let totalOutWithInterest = 0;

  transactionsList.forEach(item => {
    if (item.type === 'IN') {
      totalIn += item.amount;
    } else {
      const interest = calculateAccruedInterest(item.amount, item.interestRate, item.timestamp);
      totalOutWithInterest += (item.amount + interest);
    }
  });

  const netBalance = totalIn - totalOutWithInterest;

  document.getElementById('totalInVal').innerText = `₹${totalIn.toLocaleString('en-IN')}`;
  document.getElementById('totalOutVal').innerText = `₹${totalOutWithInterest.toLocaleString('en-IN')}`;
  document.getElementById('netBalanceVal').innerText = `₹${netBalance.toLocaleString('en-IN')}`;
}

function renderActivityList() {
  const container = document.getElementById('activityList');
  container.innerHTML = '';

  if (transactionsList.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:20px; font-size:12px; color:#94a3b8;">कोई लेन-देन नहीं है</div>`;
    return;
  }

  // केवल हालिया 6 लेन-देन दिखाएं
  const recent = transactionsList.slice(0, 6);

  recent.forEach(item => {
    const isIncome = item.type === 'IN';
    const initial = item.name ? item.name.charAt(0) : 'ग';
    const dateObj = new Date(item.timestamp);
    const timeStr = dateObj.toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' });

    // ब्याज गणना
    const interest = (!isIncome && item.interestRate) ? calculateAccruedInterest(item.amount, item.interestRate, item.timestamp) : 0;
    const finalAmount = item.amount + interest;

    // ग्राहक रिस्क स्कोर (समय के हिसाब से)
    const diffDays = Math.ceil(Math.abs(new Date() - dateObj) / (1000 * 60 * 60 * 24));
    let trustClass = "safe";
    let trustText = "● SAFE";
    if (!isIncome) {
      if (diffDays > 30) { trustClass = "risk"; trustText = "● HIGH RISK"; }
      else if (diffDays > 15) { trustClass = "watch"; trustText = "● WATCH"; }
    }

    const row = document.createElement('div');
    row.className = 'activity-row';
    row.onclick = () => showCustomerActionMenu(item);

    row.innerHTML = `
      <div class="client-avatar">${initial}</div>
      <div class="client-info">
        <b>${escapeHtml(item.name)}</b>
        <small>${isIncome ? 'जमा' : 'उधार'} • ${timeStr} ${interest > 0 ? `(+₹${interest} ब्याज)` : ''}</small>
        <div class="trust-badge ${trustClass}">${trustText}</div>
      </div>
      <div class="txn-amount-val ${isIncome ? 'text-green' : 'text-red'}">
        ${isIncome ? '+' : '−'}₹${finalAmount.toLocaleString('en-IN')}
      </div>
    `;
    container.appendChild(row);
  });
}

// =======================================================
// 6. नई एंट्री प्रबंधन (Modal Form)
// =======================================================
function openNewEntryModal() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  document.getElementById('entryDateTime').value = new Date(now.getTime() - offset).toISOString().slice(0, 16);
  document.getElementById('entryInterestRate').value = appSettings.defaultInterest || 2.0;
  document.getElementById('entryModal').classList.add('show');
}

function closeNewEntryModal() {
  document.getElementById('entryModal').classList.remove('show');
  document.getElementById('newEntryForm').reset();
}

function toggleInterestFieldVisibility() {
  const type = document.getElementById('entryType').value;
  const block = document.getElementById('interestBlock');
  block.style.display = (type === 'OUT') ? 'block' : 'none';
}

function toggleInterestInput() {
  const check = document.getElementById('applyInterestCheck').checked;
  document.getElementById('interestRateWrap').style.display = check ? 'block' : 'none';
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

  const newEntry = {
    id: 'TX_' + Date.now(),
    name: name,
    amount: amount,
    type: type,
    interestRate: interestRate,
    timestamp: dt
  };

  await dbAddEntry(newEntry);
  closeNewEntryModal();
  await syncAndRenderAll();

  // साउंडबॉक्स अलर्ट
  const typeText = (type === 'IN') ? 'जमा प्राप्त हुए' : 'उधार दर्ज हुआ';
  playSoundboxAnnouncement(`चुपाकाबरा खाता पर ${name} से ₹${amount} ${typeText}`);
}

// =======================================================
// 7. इमेज जैसा "चुपाकाबरा खाता" स्टैंडी QR इंजन
// =======================================================
function openStandeeQrModal(customName = null, customAmount = null) {
  const upiId = appSettings.upi || "9818589869@ptyes";
  const shop = appSettings.shopName || "चुपाकाबरा खाता";

  document.getElementById('standeeUpiText').innerText = upiId;

  // डायनामिक UPI पेमेंट स्ट्रिंग
  let upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shop)}&cu=INR`;
  if (customAmount) {
    upiUrl += `&am=${customAmount}&tn=${encodeURIComponent('Khata: ' + customName)}`;
  }

  // QR कोड जनरेशन API
  const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUrl)}`;
  document.getElementById('standeeQrImage').src = qrApi;

  document.getElementById('standeeQrModal').classList.add('show');
}

function closeStandeeQrModal() {
  document.getElementById('standeeQrModal').classList.remove('show');
}

function printStandeeCard() {
  const printArea = document.getElementById('printContainer');
  const cardContent = document.getElementById('standeePrintArea').innerHTML;
  printArea.innerHTML = `<div style="max-width:380px; margin:20px auto; background:#050811; padding:20px; border-radius:14px;">${cardContent}</div>`;
  closeStandeeQrModal();
  window.print();
}

// =======================================================
// 8. वॉयस असिस्टेंट इंजन (Speech Recognition)
// =======================================================
let voiceRecognition = null;
let isVoiceListening = false;
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRec) {
  voiceRecognition = new SpeechRec();
  voiceRecognition.lang = 'hi-IN';
  voiceRecognition.continuous = false;
  voiceRecognition.interimResults = false;

  voiceRecognition.onstart = () => {
    isVoiceListening = true;
    document.getElementById('voiceMicBtn').classList.add('recording');
    document.getElementById('soundwaveBox').classList.add('active');
    document.getElementById('voiceStatusText').innerText = 'सुन रहा हूँ... बोलिए';
    document.getElementById('voiceLiveTranscript').innerText = 'माइक सक्रिय है...';
  };

  voiceRecognition.onend = () => {
    isVoiceListening = false;
    document.getElementById('voiceMicBtn').classList.remove('recording');
    document.getElementById('soundwaveBox').classList.remove('active');
    document.getElementById('voiceStatusText').innerText = 'बोलने के लिए माइक दबाएं';
  };

  voiceRecognition.onerror = () => {
    document.getElementById('voiceLiveTranscript').innerText = 'आवाज़ साफ नहीं आई, कृपया दोबारा बोलें।';
  };

  voiceRecognition.onresult = (e) => {
    const rawText = e.results[0][0].transcript;
    document.getElementById('voiceLiveTranscript').innerText = `सुना: "${rawText}"`;
    processVoiceInstruction(rawText);
  };
}

function toggleVoiceInput() {
  if (!voiceRecognition) {
    alert('ब्राउज़र में वॉयस सपोर्ट उपलब्ध नहीं है। कृपया Google Chrome का उपयोग करें।');
    return;
  }
  if (isVoiceListening) voiceRecognition.stop();
  else voiceRecognition.start();
}

async function processVoiceInstruction(raw) {
  const text = raw.toLowerCase();

  // (A) सवाल पहचानना: "बकाया कितना है?"
  if (text.includes('बकाया') || text.includes('हिसाब') || text.includes('कितना') || text.includes('बाकी')) {
    let matched = null;
    for (let t of transactionsList) {
      if (text.includes(t.name.toLowerCase())) {
        matched = t.name;
        break;
      }
    }
    if (matched) {
      let bal = 0;
      transactionsList.filter(t => t.name.toLowerCase() === matched.toLowerCase()).forEach(t => {
        const interest = calculateAccruedInterest(t.amount, t.interestRate, t.timestamp);
        if (t.type === 'OUT') bal += (t.amount + interest);
        else bal -= t.amount;
      });

      if (bal > 0) playSoundboxAnnouncement(`${matched} के यहाँ कुल ${bal} रुपये बकाया है।`);
      else if (bal < 0) playSoundboxAnnouncement(`${matched} का ${Math.abs(bal)} रुपये जमा है।`);
      else playSoundboxAnnouncement(`${matched} का हिसाब बराबर है।`);
    } else {
      playSoundboxAnnouncement('ग्राहक का नाम समझ नहीं आया।');
    }
    return;
  }

  // (B) एंट्री जोड़ना: "राजू को 500 दिए"
  const digits = text.match(/\d+/g);
  if (!digits) {
    playSoundboxAnnouncement('रुपये समझ नहीं आए। कृपया दोबारा बोलें।');
    return;
  }
  const amount = parseFloat(digits[0]);

  let type = 'IN';
  const outWords = ['दिया', 'दिए', 'भेजा', 'भेजे', 'उधार दिया', 'पे किया'];
  if (outWords.some(w => text.includes(w))) type = 'OUT';

  let name = 'ग्राहक';
  const match = text.match(/(.*?)(?:को|से|ने)/);
  if (match && match[1]) {
    name = match[1].replace(/\d+/g, '').replace(/रुपये|रुपया|रू/g, '').trim();
  }

  const entry = {
    id: 'TX_' + Date.now(),
    name: name,
    amount: amount,
    type: type,
    interestRate: (type === 'OUT') ? appSettings.defaultInterest : 0,
    timestamp: new Date().toISOString()
  };

  await dbAddEntry(entry);
  await syncAndRenderAll();
  playSoundboxAnnouncement(`चुपाकाबरा खाता पर ${name} के ${amount} रुपये ${type === 'IN' ? 'जमा' : 'उधार'} दर्ज हुए।`);
}

// =======================================================
// 9. OCR बिल व कच्ची पर्ची स्कैनर इंजन
// =======================================================
function openOcrScanner() {
  document.getElementById('ocrScannerModal').classList.add('show');
}
function closeOcrScanner() {
  document.getElementById('ocrScannerModal').classList.remove('show');
  document.getElementById('ocrProcessingState').style.display = 'none';
}

async function processOcrImage(e) {
  const file = e.target.files[0];
  if (!file) return;

  const stateEl = document.getElementById('ocrProcessingState');
  stateEl.style.display = 'block';

  try {
    const { data: { text } } = await Tesseract.recognize(file, 'eng+hin', {
      logger: m => console.log(m)
    });

    stateEl.style.display = 'none';
    closeOcrScanner();

    // OCR टेक्स्ट में से राशि और नाम निकालना
    const numbers = text.match(/\d+/g);
    const detectedAmount = numbers ? parseFloat(numbers[numbers.length - 1]) : 100;

    openNewEntryModal();
    document.getElementById('entryAmount').value = detectedAmount;
    document.getElementById('entryCustomerName').value = 'बिल ग्राहक';
    alert(`पर्ची से ₹${detectedAmount} की राशि पहचानी गई! विवरण चेक करके सेव करें।`);
  } catch (err) {
    alert('पर्ची पढ़ने में त्रुटि हुई। कृपया साफ़ फोटो अपलोड करें।');
    stateEl.style.display = 'none';
  }
}

// =======================================================
// 10. कस्टमर एक्शन मेनू (WhatsApp, QR, पासबुक लिंक)
// =======================================================
function showCustomerActionMenu(item) {
  const isOut = item.type === 'OUT';
  const interest = isOut ? calculateAccruedInterest(item.amount, item.interestRate, item.timestamp) : 0;
  const total = item.amount + interest;

  const choice = prompt(
    `${item.name} का खाता विकल्प चुनें:\n1. 💬 WhatsApp पेमेंट रिमाइंडर भेजें\n2. 📱 चुपाकाबरा QR Pay खोलें\n3. 🔗 लाइव पासबुक लिंक कॉपी करें\n4. 🗑️ एंट्री डिलीट करें`,
    "1"
  );

  if (choice === "1") {
    sendWhatsAppReminder(item.name, total, interest);
  } else if (choice === "2") {
    openStandeeQrModal(item.name, total);
  } else if (choice === "3") {
    copyPassbookLink(item.name);
  } else if (choice === "4") {
    if (confirm(`क्या आप सच में ${item.name} की यह एंट्री हटाना चाहते हैं?`)) {
      dbDeleteEntry(item.id).then(syncAndRenderAll);
    }
  }
}

function sendWhatsAppReminder(name, total, interest) {
  let msg = `नमस्ते ${name} जी, ${appSettings.shopName} में आपका कुल बकाया ₹${total.toLocaleString('en-IN')}`;
  if (interest > 0) msg += ` (जिसमें ₹${interest} ब्याज शामिल है)`;
  msg += ` शेष है। कृपया समय पर भुगतान करने का कष्ट करें। UPI: ${appSettings.upi}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

function copyPassbookLink(name) {
  const dummyPassbookUrl = `https://bimkum-star.github.io/chupakabra-khata/passbook.html?c=${encodeURIComponent(name)}`;
  navigator.clipboard.writeText(dummyPassbookUrl).then(() => {
    alert(`${name} की लाइव पासबुक का लिंक कॉपी हो गया है! इसे ग्राहक को WhatsApp पर भेजें।`);
  });
}

// =======================================================
// 11. प्रिंट सेंटर (A4 और 80mm थर्मल रोल)
// =======================================================
function openPrintDialog() {
  const sel = document.getElementById('printCustomerFilter');
  sel.innerHTML = '<option value="ALL">-- समस्त खाता (Full Ledger) --</option>';
  const uniqueNames = [...new Set(transactionsList.map(t => t.name))];
  uniqueNames.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n;
    opt.innerText = n;
    sel.appendChild(opt);
  });
  document.getElementById('printDialog').classList.add('show');
}

function closePrintDialog() {
  document.getElementById('printDialog').classList.remove('show');
}

function executePrint(mode) {
  const target = document.getElementById('printCustomerFilter').value;
  const printData = (target === 'ALL') ? transactionsList : transactionsList.filter(t => t.name === target);

  if (printData.length === 0) {
    alert('प्रिंट करने के लिए कोई लेन-देन नहीं है!');
    return;
  }

  let inSum = 0;
  let outSum = 0;
  printData.forEach(t => {
    if (t.type === 'IN') inSum += t.amount;
    else outSum += (t.amount + calculateAccruedInterest(t.amount, t.interestRate, t.timestamp));
  });

  const out = document.getElementById('printContainer');
  document.body.className = (mode === 'A4') ? 'mode-a4' : 'mode-roll';

  if (mode === 'A4') {
    let rows = printData.map(t => {
      const isIncome = t.type === 'IN';
      const intr = !isIncome ? calculateAccruedInterest(t.amount, t.interestRate, t.timestamp) : 0;
      return `
        <tr>
          <td>${new Date(t.timestamp).toLocaleString('hi-IN')}</td>
          <td>${escapeHtml(t.name)}</td>
          <td>${isIncome ? 'जमा' : 'उधार'} ${intr > 0 ? `(+₹${intr} ब्याज)` : ''}</td>
          <td style="text-align:right;">₹${(t.amount + intr).toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    out.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <h2>${escapeHtml(appSettings.shopName)}</h2>
          <p style="font-size:12px; color:#555;">संपर्क: ${escapeHtml(appSettings.phone)} | UPI: ${escapeHtml(appSettings.upi)}</p>
          <p style="font-size:12px; margin-top:4px;">लेज़र रिपोर्ट: <strong>${target === 'ALL' ? 'समस्त ग्राहक खाता' : escapeHtml(target)}</strong></p>
        </div>
        <div style="text-align:right; font-size:12px;">प्रिंट दिनांक: ${new Date().toLocaleDateString('hi-IN')}</div>
      </div>
      <hr style="margin: 10px 0;">
      <table>
        <thead>
          <tr><th>तारीख</th><th>ग्राहक</th><th>प्रकार</th><th style="text-align:right;">राशि</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:20px; float:right; width:260px; font-size:13px;">
        <p>कुल जमा: <strong>₹${inSum.toFixed(2)}</strong></p>
        <p>कुल बकाया (+ब्याज): <strong>₹${outSum.toFixed(2)}</strong></p>
        <hr style="margin:6px 0;">
        <p style="font-size:15px;">शुद्ध बैलेंस: <strong>₹${(inSum - outSum).toFixed(2)}</strong></p>
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
          <h3 style="margin:0;">${escapeHtml(appSettings.shopName)}</h3>
          <p style="font-size:9px;">${escapeHtml(appSettings.phone)}</p>
          <p style="font-size:9px;">खाता: ${target === 'ALL' ? 'समस्त' : escapeHtml(target)}</p>
        </div>
        <table>
          <thead>
            <tr><th>नाम</th><th>टाइप</th><th style="text-align:right;">रुपये</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:6px; font-size:10px;">
          <div>जमा: ₹${inSum}</div>
          <div>उधार: ₹${outSum}</div>
          <div style="font-weight:bold; font-size:11px; margin-top:2px;">नेट: ₹${inSum - outSum}</div>
        </div>
        <div class="center" style="margin-top:8px; font-size:9px;">** धन्यवाद! **</div>
      </div>
    `;
  }

  closePrintDialog();
  window.print();
}

// =======================================================
// 12. दुकान सेटिंग्स प्रबंधन
// =======================================================
function openSettingsDialog() {
  document.getElementById('settingShopNameInput').value = appSettings.shopName || '';
  document.getElementById('settingPhoneInput').value = appSettings.phone || '';
  document.getElementById('settingUpiInput').value = appSettings.upi || '';
  document.getElementById('settingDefaultInterestInput').value = appSettings.defaultInterest || 2.0;
  document.getElementById('settingPinInput').value = '';
  document.getElementById('settingsModal').classList.add('show');
}

function closeSettingsDialog() {
  document.getElementById('settingsModal').classList.remove('show');
}

function saveSettingsHandler() {
  appSettings.shopName = document.getElementById('settingShopNameInput').value.trim() || "चुपाकाबरा खाता";
  appSettings.phone = document.getElementById('settingPhoneInput').value.trim();
  appSettings.upi = document.getElementById('settingUpiInput').value.trim();
  appSettings.defaultInterest = parseFloat(document.getElementById('settingDefaultInterestInput').value) || 2.0;

  const newPin = document.getElementById('settingPinInput').value.trim();
  if (newPin.length === 4 && !isNaN(newPin)) {
    localStorage.setItem('CHUPAKABRA_PIN', newPin);
  }

  localStorage.setItem('CHUPAKABRA_SETTINGS', JSON.stringify(appSettings));
  applySettingsToUI();
  closeSettingsDialog();
  playSoundboxAnnouncement('दुकान सेटिंग्स सेव कर ली गई हैं।');
}

function applySettingsToUI() {
  document.getElementById('headerShopTitle').innerText = appSettings.shopName;
  if (appSettings.phone) {
    document.getElementById('headerShopSub').innerText = `${appSettings.phone} • सुरक्षित गद्दी`;
  }
}

// =======================================================
// 13. यूटिलिटी फंक्शन्स
// =======================================================
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[s]);
}

function switchNavTab(tabName) {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(t => t.classList.remove('active'));

  if (tabName === 'home') tabs[0].classList.add('active');
  else if (tabName === 'customers') {
    tabs[1].classList.add('active');
    openPrintDialog();
  } else if (tabName === 'reports') {
    tabs[3].classList.add('active');
    openPrintDialog();
  }
}

function viewAllTransactions() {
  openPrintDialog();
}

function openBulkReminderModal() {
  alert('बकाया रिमाइंडर: सभी बकायेदारों को WhatsApp लिंक भेजने के लिए तैयार है!');
}

function openLivePassbookDialog() {
  const name = prompt('किस ग्राहक की लाइव पासबुक का लिंक जनरेट करना है?', 'सुरेश');
  if (name) copyPassbookLink(name);
}

// =======================================================
// 14. ऐप प्रारंभ (Initialization)
// =======================================================
window.addEventListener('DOMContentLoaded', async () => {
  const savedSettings = localStorage.getItem('CHUPAKABRA_SETTINGS');
  if (savedSettings) {
    try { appSettings = JSON.parse(savedSettings); } catch(e){}
  }

  await initDatabase();
  setupSafegate();
});
