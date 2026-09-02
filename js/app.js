let selectedType = 'OUT';

document.addEventListener('DOMContentLoaded', async () => {
  await initDB();
  setupEvents();
  refreshApp();
});

function formatBRL(val) {
  return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
  
  // Atualizar Saldos no Dashboard
  let totalIn = 0, totalOut = 0;
  transactions.forEach(t => {
    if (t.type === 'IN') totalIn += Number(t.amount);
    if (t.type === 'OUT') totalOut += Number(t.amount);
  });

  document.getElementById('dash-saldo').innerText = formatBRL(totalIn - totalOut);
  document.getElementById('dash-entradas').innerText = formatBRL(totalIn);
  document.getElementById('dash-saidas').innerText = formatBRL(totalOut);

  renderList('recent-list', transactions.slice(-5).reverse());
  renderList('full-list', getFilteredTransactions(transactions).slice().reverse());
  updateCharts(transactions);
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
  document.querySelectorAll('.nav-item[data-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
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

  // Exportar CSV
  document.getElementById('btn-export-csv').onclick = async () => {
    const transactions = await getAllTransactions();
    const headers = ['Descrição', 'Valor', 'Data', 'Categoria', 'Tipo'];
    const rows = transactions.map(t => [
      `"${String(t.description ?? '').replace(/"/g, '""')}"`,
      `"${Number(t.amount ?? 0).toFixed(2).replace('.', ',')}"`,
      `"${String(t.date ?? '').replace(/"/g, '""')}"`,
      `"${String(t.category ?? '').replace(/"/g, '""')}"`,
      `"${t.type === 'IN' ? 'Entrada' : 'Saída'}"`
    ]);

    const csv = ['sep=;', headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const blob = new Blob([bom, csv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `financas_export_${new Date().toISOString().slice(0,10)}.xls`;
    a.click();
  };

  // Limpar tudo
  document.getElementById('btn-clear-data').onclick = async () => {
    if (confirm('Atenção: Todos os dados serão apagados permanentemente!')) {
      await clearAllTransactions();
      refreshApp();
    }
  };
}