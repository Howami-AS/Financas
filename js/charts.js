let categoryChartInstance = null;
let balanceChartInstance = null;

function updateCharts(transactions, bills = [], selectedMonth = '') {
  const catCtx = document.getElementById('chart-categories')?.getContext('2d');
  const balCtx = document.getElementById('chart-balance')?.getContext('2d');
  if (!catCtx || !balCtx) return;

  const inPeriod = item => !selectedMonth || item.date.startsWith(selectedMonth);
  const payments = bills.flatMap(bill => {
    const history = Array.isArray(bill.payments) ? bill.payments.slice() : [];
    if (bill.paid && bill.paidAt && !history.some(payment => payment.paidAt === bill.paidAt)) {
      history.push({ paidAt: bill.paidAt, amount: Number(bill.amount) });
    }
    return history
      .filter(payment => !selectedMonth || (payment.paidAt || bill.date).startsWith(selectedMonth))
      .map(payment => ({ ...payment, category: bill.category || 'Outros' }));
  });

  // Agrupar saídas por categoria no período selecionado
  const catTotals = {};
  transactions.filter(t => t.type === 'OUT' && inPeriod(t)).forEach(t => {
    const category = t.category || 'Outros';
    catTotals[category] = (catTotals[category] || 0) + Number(t.amount);
  });
  payments.forEach(payment => {
    catTotals[payment.category] = (catTotals[payment.category] || 0) + Number(payment.amount);
  });

  if (categoryChartInstance) categoryChartInstance.destroy();
  categoryChartInstance = new Chart(catCtx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(catTotals),
      datasets: [{
        data: Object.values(catTotals),
        backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899']
      }]
    },
    options: { responsive: true, plugins: { title: { display: true, text: 'Gastos por Categoria' } } }
  });

  // Entradas x Saídas Totais
  const inTotal = transactions.filter(t => t.type === 'IN' && inPeriod(t)).reduce((a, b) => a + Number(b.amount), 0);
  const outTotal = transactions.filter(t => t.type === 'OUT' && inPeriod(t)).reduce((a, b) => a + Number(b.amount), 0) +
    payments.reduce((total, payment) => total + Number(payment.amount), 0);

  if (balanceChartInstance) balanceChartInstance.destroy();
  balanceChartInstance = new Chart(balCtx, {
    type: 'bar',
    data: {
      labels: ['Entradas', 'Saídas'],
      datasets: [{
        label: 'Total (R$)',
        data: [inTotal, outTotal],
        backgroundColor: ['#16a34a', '#dc2626']
      }]
    },
    options: { responsive: true, plugins: { title: { display: true, text: 'Comparativo Geral' } } }
  });
}