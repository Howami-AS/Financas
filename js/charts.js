let categoryChartInstance = null;
let balanceChartInstance = null;

function updateCharts(transactions) {
  const catCtx = document.getElementById('chart-categories')?.getContext('2d');
  const balCtx = document.getElementById('chart-balance')?.getContext('2d');
  if (!catCtx || !balCtx) return;

  // Agrupar por Categoria (Apenas Saídas)
  const catTotals = {};
  transactions.filter(t => t.type === 'OUT').forEach(t => {
    catTotals[t.category] = (catTotals[t.category] || 0) + Number(t.amount);
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
  const inTotal = transactions.filter(t => t.type === 'IN').reduce((a, b) => a + Number(b.amount), 0);
  const outTotal = transactions.filter(t => t.type === 'OUT').reduce((a, b) => a + Number(b.amount), 0);

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