let selectedType = 'OUT';

document.addEventListener('DOMContentLoaded', async () => {
  await initDB();
  document.getElementById('report-month').value = new Date().toISOString().slice(0, 7);
  setupEvents();
  refreshApp();
});

function formatBRL(val) {
  return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const BILL_RENEWAL_DAYS = 20;
const BILL_RENEWAL_MS = BILL_RENEWAL_DAYS * 24 * 60 * 60 * 1000;

async function renewExpiredPinnedBills(bills) {
  const now = Date.now();
  const expiredBills = bills.filter(bill => bill.pinned && bill.paid && bill.paidAt &&
    now - new Date(bill.paidAt).getTime() >= BILL_RENEWAL_MS);

  await Promise.all(expiredBills.map(bill => {
    bill.paid = false;
    bill.paidAt = null;
    return updateBill(bill);
  }));
}

function getFilteredTransactions(transactions) {
  const searchInput = document.getElementById('search-input');
  const filterType = document.getElementById('filter-type');

  const searchTerm = (searchInput ? searchInput.value.trim().toLowerCase() : '');
  const typeFilter = (filterType ? filterType.value : 'ALL');

  return transactions.filter(t => {
    const matchesType = typeFilter === 'ALL' || t.type === typeFilter;
    const matchesSearch = !searchTerm ||
      (t.description && t.description.toLowerCase().includes(searchTerm)) ||
      (t.category && t.category.toLowerCase().includes(searchTerm));

    return matchesType && matchesSearch;
  });
}

async function refreshApp() {
  const transactions = await getAllTransactions();
  const bills = await getAllBills();
  await renewExpiredPinnedBills(bills);
  
  let totalIn = 0, totalOut = 0;
  transactions.forEach(t => {
    if (t.type === 'IN') totalIn += Number(t.amount);
    if (t.type === 'OUT') totalOut += Number(t.amount);
  });
  totalOut += bills
    .filter(bill => bill.paid)
    .reduce((total, bill) => total + Number(bill.amount), 0);

  document.getElementById('dash-saldo').innerText = formatBRL(totalIn - totalOut);
  document.getElementById('dash-entradas').innerText = formatBRL(totalIn);
  document.getElementById('dash-saidas').innerText = formatBRL(totalOut);

  renderList('recent-list', transactions.slice(-5).reverse());
  renderList('full-list', getFilteredTransactions(transactions).slice().reverse());
  renderPaidBills(bills, document.getElementById('report-month').value);
  renderBills(bills);
  updateCharts(transactions, bills);
}

function renderPaidBills(bills, selectedMonth) {
  const container = document.getElementById('paid-bills-list');
  const paidBills = bills
    .filter(bill => bill.paid && (!selectedMonth || bill.date.startsWith(selectedMonth)))
    .sort((first, second) => second.date.localeCompare(first.date));

  container.innerHTML = '';
  if (paidBills.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#888;">Nenhuma conta paga neste mês.</p>';
    return;
  }

  paidBills.forEach(bill => {
    const div = document.createElement('div');
    div.className = 'tx-item shadow';
    div.innerHTML = `
      <div>
        <strong>${bill.description}</strong>
        <br><small>${bill.category || 'Outros'} • ${bill.date} • Conta paga</small>
      </div>
      <strong class="text-red">- ${formatBRL(bill.amount)}</strong>
    `;
    container.appendChild(div);
  });
}

function renderBills(bills) {
  const container = document.getElementById('bills-list');
  const pendingBills = bills.filter(bill => !bill.paid);
  const pendingTotal = pendingBills.reduce((total, bill) => total + Number(bill.amount), 0);
  document.getElementById('bills-total').innerText = formatBRL(pendingTotal);
  container.innerHTML = '';

  if (bills.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#888;">Nenhuma conta cadastrada.</p>';
    return;
  }

  bills.slice().sort((first, second) => first.date.localeCompare(second.date)).forEach(bill => {
    const div = document.createElement('div');
    div.className = `bill-item shadow ${bill.paid ? 'is-paid' : ''}`;
    div.innerHTML = `
      <label class="bill-check">
        <input type="checkbox" data-bill-id="${bill.id}" ${bill.paid ? 'checked disabled' : ''} title="${bill.paid ? 'Conta já marcada como paga' : 'Marcar como paga'}">
        <span></span>
      </label>
      <div class="bill-info">
        <strong>${bill.description}</strong>
        <small>${bill.category || 'Outros'} • Vencimento: ${bill.date}</small>
      </div>
      <div class="bill-value">
        <strong>${formatBRL(bill.amount)}</strong>
        <button type="button" class="bill-pin ${bill.pinned ? 'is-pinned' : ''}" data-pin-bill="${bill.id}" aria-label="${bill.pinned ? 'Desafixar' : 'Fixar'} conta" title="${bill.pinned ? 'Desafixar conta' : 'Fixar conta'}">${bill.pinned ? '📌' : '○'}</button>
        <button type="button" class="delete-button" data-delete-bill="${bill.id}">Excluir</button>
      </div>
    `;
    container.appendChild(div);
  });
}

function renderList(elementId, items) {
  const container = document.getElementById(elementId);
  container.innerHTML = '';
  
  if (items.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#888;">Nenhum registro encontrado.</p>';
    return;
  }

  items.forEach(t => {
    const div = document.createElement('div');
    div.className = 'tx-item shadow';
    div.innerHTML = `
      <div>
        <strong>${t.description}</strong>
        <br><small>${t.category} • ${t.date}</small>
      </div>
      <div style="text-align:right">
        <span class="${t.type === 'IN' ? 'text-green' : 'text-red'}" style="font-weight:bold;">
          ${t.type === 'IN' ? '+' : '-'} ${formatBRL(t.amount)}
        </span>
        <br><button onclick="handleDelete(${t.id})" style="border:none;background:none;color:gray;cursor:pointer;"><small>Excluir</small></button>
      </div>
    `;
    container.appendChild(div);
  });
}

async function handleDelete(id) {
  if (confirm('Deseja remover este lançamento?')) {
    await deleteTransaction(id);
    refreshApp();
  }
}

function setupEvents() {
  // Navegação por abas
  document.querySelectorAll('[data-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      if (btn.classList.contains('nav-item')) btn.classList.add('active');
      document.getElementById(btn.dataset.target).classList.add('active');
    });
  });

  // Controle do Modal
  const modal = document.getElementById('modal-transaction');
  document.getElementById('open-modal-btn').onclick = () => modal.style.display = 'flex';
  document.querySelector('.close-modal').onclick = () => modal.style.display = 'none';

  // Chaveador Entrada / Saída
  document.querySelectorAll('.btn-type').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.btn-type').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      selectedType = e.target.dataset.type;
    });
  });

  const searchInput = document.getElementById('search-input');
  const filterType = document.getElementById('filter-type');

  if (searchInput) {
    searchInput.addEventListener('input', refreshApp);
  }

  if (filterType) {
    filterType.addEventListener('change', refreshApp);
  }

  document.getElementById('report-month').addEventListener('change', async (e) => {
    const bills = await getAllBills();
    renderPaidBills(bills, e.target.value);
  });

  document.getElementById('bill-form').onsubmit = async (e) => {
    e.preventDefault();
    await addBill({
      description: document.getElementById('bill-desc').value.trim(),
      category: document.getElementById('bill-category').value,
      amount: parseFloat(document.getElementById('bill-amount').value),
      date: document.getElementById('bill-date').value,
      paid: false,
      pinned: false,
      paidAt: null
    });
    e.target.reset();
    refreshApp();
  };

  document.getElementById('bills-list').addEventListener('change', async (e) => {
    if (!e.target.matches('[data-bill-id]')) return;
    const bills = await getAllBills();
    const bill = bills.find(item => item.id === Number(e.target.dataset.billId));
    if (bill) {
      if (bill.paid && !e.target.checked) return;
      bill.paid = e.target.checked;
      bill.paidAt = bill.paid ? new Date().toISOString() : null;
      await updateBill(bill);
      refreshApp();
    }
  });

  document.getElementById('bills-list').addEventListener('click', async (e) => {
    const pinButton = e.target.closest('[data-pin-bill]');
    if (pinButton) {
      const bills = await getAllBills();
      const bill = bills.find(item => item.id === Number(pinButton.dataset.pinBill));
      if (bill) {
        bill.pinned = !bill.pinned;
        if (bill.pinned && bill.paid && !bill.paidAt) bill.paidAt = new Date().toISOString();
        await updateBill(bill);
        refreshApp();
      }
      return;
    }

    const button = e.target.closest('[data-delete-bill]');
    if (!button || !confirm('Deseja remover esta conta?')) return;
    await deleteBill(Number(button.dataset.deleteBill));
    refreshApp();
  });

  document.getElementById('btn-clear-bills').onclick = async () => {
    const bills = await getAllBills();
    if (bills.length === 0) return;
    if (confirm('Deseja apagar todas as contas a pagar?')) {
      await clearAllBills();
      refreshApp();
    }
  };

  // Salvar formulário
  document.getElementById('tx-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = {
      description: document.getElementById('tx-desc').value,
      amount: parseFloat(document.getElementById('tx-amount').value),
      date: document.getElementById('tx-date').value,
      category: document.getElementById('tx-category').value,
      type: selectedType
    };
    await addTransaction(data);
    e.target.reset();
    modal.style.display = 'none';
    refreshApp();
  };

  // Alternador de Tema
  document.getElementById('theme-toggle').onclick = () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
  };

  // Exportar Backup JSON
  document.getElementById('btn-export-json').onclick = async () => {
    const data = await getAllTransactions();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `financas_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };

  // Exportar relatório mensal em PDF
  document.getElementById('btn-export-pdf').onclick = async () => {
    const selectedMonth = document.getElementById('report-month').value;
    if (!selectedMonth) {
      alert('Selecione o mês do relatório.');
      return;
    }

    const [transactions, bills] = await Promise.all([getAllTransactions(), getAllBills()]);
    const monthTransactions = transactions.filter(item => item.date.startsWith(selectedMonth));
    const monthBills = bills.filter(item => item.date.startsWith(selectedMonth));
    const income = monthTransactions.filter(item => item.type === 'IN');
    const expenses = monthTransactions.filter(item => item.type === 'OUT');
    const expenseItems = [
      ...expenses.map(item => ({ ...item, source: 'Lançamento' })),
      ...monthBills
        .filter(item => item.paid)
        .map(item => ({ ...item, category: item.category || 'Outros', source: 'Conta paga' }))
    ];
    const totalIncome = income.reduce((sum, item) => sum + Number(item.amount), 0);
    const totalExpenses = expenseItems.reduce((sum, item) => sum + Number(item.amount), 0);
    const pdf = new window.jspdf.jsPDF();
    const monthLabel = new Date(`${selectedMonth}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    pdf.setFontSize(18);
    pdf.text('Relatório Financeiro', 14, 18);
    pdf.setFontSize(11);
    pdf.text(`Período: ${monthLabel}`, 14, 27);
    pdf.text(`Entradas: ${formatBRL(totalIncome)}`, 14, 38);
    pdf.text(`Saídas: ${formatBRL(totalExpenses)}`, 14, 46);
    pdf.text(`Saldo do mês: ${formatBRL(totalIncome - totalExpenses)}`, 14, 54);

    let y = 66;
    pdf.setFontSize(10);
    pdf.text('Data', 14, y);
    pdf.text('Descrição', 38, y);
    pdf.text('Categoria / origem', 105, y);
    pdf.text('Valor', 174, y);
    y += 7;
    [...income.map(item => ({ ...item, category: item.category, source: 'Entrada' })), ...expenseItems]
      .sort((first, second) => first.date.localeCompare(second.date))
      .forEach(item => {
        if (y > 280) {
          pdf.addPage();
          y = 18;
        }
        pdf.text(item.date.split('-').reverse().join('/'), 14, y);
        pdf.text(String(item.description).slice(0, 34), 38, y);
        pdf.text(`${item.category} (${item.source})`.slice(0, 34), 105, y);
        pdf.text(formatBRL(item.amount), 174, y);
        y += 7;
      });

    pdf.save(`relatorio_financeiro_${selectedMonth}.pdf`);
  };

  // Limpar tudo
  document.getElementById('btn-clear-data').onclick = async () => {
    if (confirm('Atenção: Todos os dados serão apagados permanentemente!')) {
      await clearAllTransactions();
      await clearAllBills();
      refreshApp();
    }
  };
}