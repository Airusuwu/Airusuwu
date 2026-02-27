const EPS = 'ε';
const EMPTY = '∅';

const $ = (id) => document.getElementById(id);
const processLines = [];

function log(line = '') {
  processLines.push(line);
  $('processLog').textContent = processLines.join('\n');
}

const state = {
  nextStateId: 0,
  initial: null,
};

const cy = cytoscape({
  container: $('cy'),
  elements: [],
  style: [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        'background-color': '#e2e8f0',
        'border-width': 2,
        'border-color': '#475569',
        width: 50,
        height: 50,
        'font-size': 12,
      },
    },
    {
      selector: 'node.initial',
      style: {
        'border-color': '#2563eb',
        'border-width': 4,
      },
    },
    {
      selector: 'node.final',
      style: {
        'background-color': '#bbf7d0',
        'border-color': '#15803d',
      },
    },
    {
      selector: 'edge',
      style: {
        label: 'data(label)',
        'curve-style': 'bezier',
        'target-arrow-shape': 'triangle',
        'line-color': '#64748b',
        'target-arrow-color': '#64748b',
        'font-size': 12,
        'text-background-color': '#fff',
        'text-background-opacity': 1,
        'text-background-padding': 2,
      },
    },
    {
      selector: ':selected',
      style: {
        'overlay-color': '#93c5fd',
        'overlay-opacity': 0.25,
      },
    },
  ],
  layout: { name: 'grid' },
  userZoomingEnabled: true,
  userPanningEnabled: true,
});

function normalizeSymbols(label) {
  return label
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const low = s.toLowerCase();
      if (['ε', 'e', 'eps', 'epsilon', 'lambda', 'λ'].includes(low)) return EPS;
      return s;
    });
}

function parseAlphabet() {
  return $('alphabetInput').value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s !== EPS);
}

function refreshNodeLabels() {
  cy.nodes().forEach((n) => {
    const base = n.id();
    const prefix = n.hasClass('initial') ? '→' : '';
    const suffix = n.hasClass('final') ? '*' : '';
    n.data('label', `${prefix}${base}${suffix}`);
  });
}

function addState(position) {
  const id = `q${state.nextStateId++}`;
  cy.add({ group: 'nodes', data: { id, label: id }, position: position || { x: 140 + Math.random() * 380, y: 80 + Math.random() * 300 } });
}

function setInitialNode(node) {
  cy.nodes().removeClass('initial');
  if (node) {
    node.addClass('initial');
    state.initial = node.id();
  } else {
    state.initial = null;
  }
  refreshNodeLabels();
}

function toggleFinalNode(node) {
  node.toggleClass('final');
  refreshNodeLabels();
}

function addOrMergeEdge(sourceId, targetId, rawLabel) {
  const symbols = normalizeSymbols(rawLabel);
  if (!symbols.length) return;
  const existing = cy.edges().filter((e) => e.source().id() === sourceId && e.target().id() === targetId)[0];
  if (existing) {
    const merged = Array.from(new Set([...normalizeSymbols(existing.data('label')), ...symbols]));
    existing.data('label', merged.join(','));
  } else {
    cy.add({ group: 'edges', data: { id: `e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, source: sourceId, target: targetId, label: symbols.join(',') } });
  }
}

function buildAutomaton() {
  const states = cy.nodes().map((n) => n.id());
  const finals = new Set(cy.nodes('.final').map((n) => n.id()));
  const initial = cy.nodes('.initial')[0]?.id() || null;

  const transitions = [];
  const alphabetSet = new Set(parseAlphabet());

  cy.edges().forEach((e) => {
    const from = e.source().id();
    const to = e.target().id();
    normalizeSymbols(e.data('label')).forEach((sym) => {
      transitions.push({ from, to, symbol: sym });
      if (sym !== EPS) alphabetSet.add(sym);
    });
  });

  return {
    states,
    alphabet: Array.from(alphabetSet),
    initial,
    finals,
    transitions,
  };
}

function emptyMatrix(n, value = EMPTY) {
  return Array.from({ length: n }, () => Array.from({ length: n }, () => value));
}

function needParensForConcat(r) {
  return r.includes('+');
}

function dedupUnionParts(parts) {
  return Array.from(new Set(parts.filter((p) => p && p !== EMPTY))).sort();
}

function splitTopUnion(regex) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of regex) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === '+' && depth === 0) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function reUnion(a, b) {
  if (a === EMPTY) return b;
  if (b === EMPTY) return a;
  if (a === b) return a;
  const parts = dedupUnionParts([...splitTopUnion(a), ...splitTopUnion(b)]);
  return parts.length ? parts.join('+') : EMPTY;
}

function reConcat(a, b) {
  if (a === EMPTY || b === EMPTY) return EMPTY;
  if (a === EPS) return b;
  if (b === EPS) return a;
  const aa = needParensForConcat(a) ? `(${a})` : a;
  const bb = needParensForConcat(b) ? `(${b})` : b;
  return `${aa}${bb}`;
}

function reStar(a) {
  if (a === EMPTY || a === EPS) return EPS;
  if (a.endsWith('*')) return a;
  const body = needParensForConcat(a) || a.length > 1 ? `(${a})` : a;
  return `${body}*`;
}

function stateEquation(i, stateId, R, F, states) {
  const terms = [];
  for (let j = 0; j < states.length; j += 1) {
    if (R[i][j] !== EMPTY) terms.push(`${R[i][j]}X_${states[j]}`);
  }
  if (F[i] !== EMPTY) terms.push(F[i]);
  return `X_${stateId} = ${terms.length ? terms.join(' + ') : EMPTY}`;
}

function epsilonClosureNFA(automaton) {
  const { states, transitions, alphabet, finals } = automaton;
  const byFrom = new Map(states.map((s) => [s, []]));
  transitions.forEach((t) => byFrom.get(t.from)?.push(t));

  const closures = new Map();
  for (const s of states) {
    const visited = new Set([s]);
    const stack = [s];
    while (stack.length) {
      const cur = stack.pop();
      for (const t of byFrom.get(cur) || []) {
        if (t.symbol === EPS && !visited.has(t.to)) {
          visited.add(t.to);
          stack.push(t.to);
        }
      }
    }
    closures.set(s, visited);
  }

  const noEpsTransitions = [];
  for (const p of states) {
    for (const a of alphabet) {
      const reach = new Set();
      for (const q of closures.get(p)) {
        for (const t of byFrom.get(q) || []) {
          if (t.symbol === a) {
            for (const r of closures.get(t.to)) reach.add(r);
          }
        }
      }
      for (const r of reach) {
        noEpsTransitions.push({ from: p, to: r, symbol: a });
      }
    }
  }

  const newFinals = new Set();
  for (const s of states) {
    const cls = closures.get(s);
    if (Array.from(cls).some((x) => finals.has(x))) newFinals.add(s);
  }

  return { closures, transitions: noEpsTransitions, finals: newFinals };
}

function runArden() {
  processLines.length = 0;
  $('regexResult').textContent = '—';

  const automaton = buildAutomaton();
  if (!automaton.initial) {
    log('Error: Debes marcar exactamente un estado inicial.');
    return;
  }
  if (automaton.finals.size === 0) {
    log('Error: Debes marcar al menos un estado final.');
    return;
  }

  log('=== 1) AFN-ε de entrada ===');
  log(`Estados: {${automaton.states.join(', ')}}`);
  log(`Alfabeto: {${automaton.alphabet.join(', ') || '∅'}}`);
  log(`Inicial: ${automaton.initial}`);
  log(`Finales: {${Array.from(automaton.finals).join(', ')}}`);
  log('Transiciones unitarias:');
  automaton.transitions.forEach((t) => log(`  ${t.from} --${t.symbol}--> ${t.to}`));

  const noEps = epsilonClosureNFA(automaton);
  log('\n=== 2) Eliminación de ε con ε-closure ===');
  for (const s of automaton.states) {
    log(`ε-closure(${s}) = {${Array.from(noEps.closures.get(s)).join(', ')}}`);
  }
  log('Transiciones AFN sin ε:');
  noEps.transitions.forEach((t) => log(`  ${t.from} --${t.symbol}--> ${t.to}`));
  log(`Nuevos finales (closure intersecta finales originales): {${Array.from(noEps.finals).join(', ')}}`);

  const states = automaton.states;
  const n = states.length;
  const idx = new Map(states.map((s, i) => [s, i]));
  const R = emptyMatrix(n, EMPTY);
  const F = Array.from({ length: n }, (_, i) => (noEps.finals.has(states[i]) ? EPS : EMPTY));

  for (const t of noEps.transitions) {
    const i = idx.get(t.from);
    const j = idx.get(t.to);
    R[i][j] = reUnion(R[i][j], t.symbol);
  }

  log('\n=== 3) Sistema de ecuaciones (una variable por estado) ===');
  for (let i = 0; i < n; i += 1) {
    log(stateEquation(i, states[i], R, F, states));
  }

  log('\n=== 4) Resolución por Lema de Arden (eliminación iterativa) ===');
  for (let k = 0; k < n; k += 1) {
    const A = R[k][k];
    const Astar = reStar(A);
    if (A !== EMPTY) {
      log(`\n[Arden en X_${states[k]}] X = ${A}X + B  ⇒  X = ${Astar}B`);
    }

    for (let j = 0; j < n; j += 1) {
      if (j === k) continue;
      R[k][j] = reConcat(Astar, R[k][j]);
    }
    F[k] = reConcat(Astar, F[k]);
    R[k][k] = EMPTY;

    log(`Ecuación normalizada de X_${states[k]}: ${stateEquation(k, states[k], R, F, states)}`);

    for (let i = 0; i < n; i += 1) {
      if (i === k) continue;
      const Rik = R[i][k];
      if (Rik === EMPTY) continue;

      log(`  Sustituir X_${states[k]} en ecuación de X_${states[i]} con coeficiente ${Rik}`);
      for (let j = 0; j < n; j += 1) {
        if (j === k) continue;
        const contribution = reConcat(Rik, R[k][j]);
        R[i][j] = reUnion(R[i][j], contribution);
      }
      F[i] = reUnion(F[i], reConcat(Rik, F[k]));
      R[i][k] = EMPTY;
      log(`  => ${stateEquation(i, states[i], R, F, states)}`);
    }
  }

  const initialIdx = idx.get(automaton.initial);
  const finalRegex = F[initialIdx] || EMPTY;

  log('\n=== 5) Resultado ===');
  log(`Regex(state inicial ${automaton.initial}) = ${finalRegex}`);
  $('regexResult').textContent = finalRegex;
}

function exportJSON() {
  const nodes = cy.nodes().map((n) => ({
    id: n.id(),
    initial: n.hasClass('initial'),
    final: n.hasClass('final'),
    position: n.position(),
  }));
  const edges = cy.edges().map((e) => ({
    source: e.source().id(),
    target: e.target().id(),
    label: e.data('label'),
  }));
  const payload = {
    alphabet: $('alphabetInput').value,
    nextStateId: state.nextStateId,
    nodes,
    edges,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'afne.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const obj = JSON.parse(e.target.result);
      cy.elements().remove();
      state.nextStateId = obj.nextStateId ?? 0;
      $('alphabetInput').value = obj.alphabet ?? '';

      (obj.nodes || []).forEach((n) => {
        cy.add({ group: 'nodes', data: { id: n.id, label: n.id }, position: n.position || { x: 100, y: 100 } });
        const node = cy.getElementById(n.id);
        if (n.initial) node.addClass('initial');
        if (n.final) node.addClass('final');
      });
      (obj.edges || []).forEach((ed) => addOrMergeEdge(ed.source, ed.target, ed.label || ''));
      refreshNodeLabels();
      state.initial = cy.nodes('.initial')[0]?.id() || null;
      log('JSON importado correctamente.');
    } catch (err) {
      log(`Error al importar JSON: ${err.message}`);
    }
  };
  reader.readAsText(file);
}

$('addStateBtn').addEventListener('click', () => addState());
$('deleteSelectedBtn').addEventListener('click', () => {
  const selected = cy.$(':selected');
  selected.remove();
  if (!cy.getElementById(state.initial).length) state.initial = null;
  refreshNodeLabels();
});
$('setInitialBtn').addEventListener('click', () => {
  const selected = cy.nodes(':selected');
  if (selected.length !== 1) {
    alert('Selecciona exactamente 1 estado.');
    return;
  }
  setInitialNode(selected[0]);
});
$('toggleFinalBtn').addEventListener('click', () => {
  const selected = cy.nodes(':selected');
  if (!selected.length) {
    alert('Selecciona al menos 1 estado.');
    return;
  }
  selected.forEach(toggleFinalNode);
});
$('addEdgeBtn').addEventListener('click', () => {
  const selected = cy.nodes(':selected');
  if (selected.length !== 2) {
    alert('Selecciona exactamente 2 estados (origen y destino).');
    return;
  }
  const label = prompt('Etiqueta(s) separadas por coma (ej: a,b,ε):', 'a');
  if (!label) return;
  addOrMergeEdge(selected[0].id(), selected[1].id(), label);
});
$('editEdgeBtn').addEventListener('click', () => {
  const selected = cy.edges(':selected');
  if (selected.length !== 1) {
    alert('Selecciona exactamente 1 arista para editar.');
    return;
  }
  const edge = selected[0];
  const label = prompt('Nueva etiqueta:', edge.data('label'));
  if (label === null) return;
  const symbols = normalizeSymbols(label);
  if (!symbols.length) {
    edge.remove();
  } else {
    edge.data('label', symbols.join(','));
  }
});

cy.on('dbltap', 'edge', (evt) => {
  const edge = evt.target;
  const label = prompt('Editar etiqueta de transición:', edge.data('label'));
  if (label === null) return;
  const symbols = normalizeSymbols(label);
  if (!symbols.length) edge.remove();
  else edge.data('label', symbols.join(','));
});

$('executeArdenBtn').addEventListener('click', runArden);
$('copyRegexBtn').addEventListener('click', async () => {
  const text = $('regexResult').textContent;
  if (!text || text === '—') return;
  await navigator.clipboard.writeText(text);
});
$('exportBtn').addEventListener('click', exportJSON);
$('importInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) importJSON(file);
  e.target.value = '';
});

addState({ x: 140, y: 160 });
setInitialNode(cy.nodes()[0]);
toggleFinalNode(cy.nodes()[0]);
addOrMergeEdge('q0', 'q0', 'a');
$('alphabetInput').value = 'a,b';
refreshNodeLabels();
log('Proyecto listo. Diseña tu AFN-ε y pulsa "Ejecutar Arden".');
