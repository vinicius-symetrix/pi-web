// Cartões de início — sugestões quando a sessão está vazia.
// ponytail: lista estática; clique só preenche o composer.
export const START_CARDS = [
  { label: '📊 Status do hub', text: 'Qual o status do hub agora?' },
  { label: '🔍 Buscar sessão', text: 'Busque nas conversas: ' },
  { label: '📈 PnL de hoje', text: 'Mostre o PnL de hoje das estratégias.' },
  { label: '🧠 Resumir o dia', text: 'Resuma o que aconteceu hoje.' },
];

export function renderStartCards({ escapeHtml = String } = {}) {
  let html = '<div class="start-cards">';
  START_CARDS.forEach((c) => {
    html +=
      `<button type="button" class="start-card" data-start-text="${escapeHtml(c.text)}">` +
      `${escapeHtml(c.label)}</button>`;
  });
  return html + '</div>';
}
