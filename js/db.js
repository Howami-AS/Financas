const DB_NAME = 'FinancasPWA_DB';
const DB_VERSION = 2;
let db = null;

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('transactions')) {
        const txStore = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
        txStore.createIndex('date', 'date', { unique: false });
        txStore.createIndex('type', 'type', { unique: false });
      }
      if (!db.objectStoreNames.contains('bills')) {
        const billStore = db.createObjectStore('bills', { keyPath: 'id', autoIncrement: true });
        billStore.createIndex('date', 'date', { unique: false });
        billStore.createIndex('paid', 'paid', { unique: false });
      }
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };

    request.onerror = (e) => reject('Erro ao abrir IndexedDB: ' + e.target.errorCode);
  });
}

function addTransaction(data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['transactions'], 'readwrite');
    const store = tx.objectStore('transactions');
    const req = store.add(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllTransactions() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['transactions'], 'readonly');
    const store = tx.objectStore('transactions');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function deleteTransaction(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['transactions'], 'readwrite');
    const store = tx.objectStore('transactions');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function clearAllTransactions() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['transactions'], 'readwrite');
    const store = tx.objectStore('transactions');
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function addBill(data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['bills'], 'readwrite');
    const req = tx.objectStore('bills').add(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllBills() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['bills'], 'readonly');
    const req = tx.objectStore('bills').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function updateBill(bill) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['bills'], 'readwrite');
    const req = tx.objectStore('bills').put(bill);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function deleteBill(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['bills'], 'readwrite');
    const req = tx.objectStore('bills').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function clearAllBills() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['bills'], 'readwrite');
    const req = tx.objectStore('bills').clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}