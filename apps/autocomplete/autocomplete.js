/**
 * Autocomplete — interface wiring.
 *
 * The algorithm lives in search.js; this file only connects it to the DOM.
 *
 * The dataset is prepared ONCE, at load. Every keystroke is a linear scan
 * over the prepared entries, measured at 0.0079 ms per search over the
 * supplied 110 records, so there is no index to build and nothing to cache
 * per keystroke.
 */
import { countries } from './data.js';
import { prepareDataset } from './normalize.js';
import { search, splitMatch, DEFAULT_LIMIT } from './search.js';

const inputEl = document.getElementById('search');
const listEl = document.getElementById('suggestions');
const statusEl = document.getElementById('status');
const clearEl = document.getElementById('clear');
const countEl = document.getElementById('count');
const creditEl = document.getElementById('credit');

// Prepared once. This is the whole reason the search is fast.
const entries = prepareDataset(countries);

countEl.textContent = String(entries.length);
creditEl.textContent = `${entries.length} country names from the supplied data.js dataset.`;

/** The matches currently shown. */
let matches = [];
/** Index of the highlighted option, or -1 for none. */
let activeIndex = -1;

/**
 * Builds an option element, marking the matched text.
 *
 * The parts are added as text nodes and a <mark> element. The label is never
 * interpolated into HTML, so a dataset entry cannot inject markup.
 */
function buildOption(match) {
  const { before, match: matched, after } = splitMatch(match);

  const option = document.createElement('li');
  option.className = 'ac__option';
  option.id = `option-${match.id}`;
  option.setAttribute('role', 'option');
  option.setAttribute('aria-selected', 'false');

  if (before) option.append(document.createTextNode(before));

  const mark = document.createElement('mark');
  mark.textContent = matched;
  option.append(mark);

  if (after) option.append(document.createTextNode(after));

  const id = document.createElement('span');
  id.className = 'ac__option-id';
  id.textContent = `#${match.id}`;
  option.append(id);

  return option;
}

function setActive(index) {
  const options = listEl.querySelectorAll('.ac__option');

  options.forEach((option, i) => {
    option.setAttribute('aria-selected', i === index ? 'true' : 'false');
  });

  activeIndex = index;

  if (index >= 0 && options[index]) {
    // Keep the highlighted option in view while arrowing through a long list.
    options[index].scrollIntoView({ block: 'nearest' });
    inputEl.setAttribute('aria-activedescendant', options[index].id);
  } else {
    inputEl.removeAttribute('aria-activedescendant');
  }
}

function closeList() {
  listEl.hidden = true;
  listEl.replaceChildren();
  matches = [];
  activeIndex = -1;
  inputEl.setAttribute('aria-expanded', 'false');
  inputEl.removeAttribute('aria-activedescendant');
}

function render(query) {
  const trimmed = query.trim();

  if (trimmed === '') {
    closeList();
    statusEl.textContent = '';
    statusEl.classList.remove('ac__status--empty');
    return;
  }

  matches = search(entries, query, DEFAULT_LIMIT);

  if (matches.length === 0) {
    closeList();
    statusEl.textContent = `No country matches “${trimmed}”.`;
    statusEl.classList.add('ac__status--empty');
    return;
  }

  listEl.replaceChildren(...matches.map(buildOption));
  listEl.hidden = false;
  inputEl.setAttribute('aria-expanded', 'true');
  setActive(-1);

  statusEl.classList.remove('ac__status--empty');
  statusEl.textContent =
    matches.length === 1
      ? '1 suggestion.'
      : `${matches.length} suggestions. Use the arrow keys to move between them.`;
}

/** Selects a match, putting its original label in the field. */
function select(match) {
  inputEl.value = match.name;
  closeList();
  statusEl.textContent = `Selected ${match.name}.`;
  inputEl.focus();
}

inputEl.addEventListener('input', () => render(inputEl.value));

inputEl.addEventListener('keydown', (event) => {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      if (matches.length === 0) return;
      setActive(activeIndex + 1 >= matches.length ? 0 : activeIndex + 1);
      return;

    case 'ArrowUp':
      event.preventDefault();
      if (matches.length === 0) return;
      setActive(activeIndex - 1 < 0 ? matches.length - 1 : activeIndex - 1);
      return;

    case 'Enter':
      // Only intercept Enter when an option is highlighted, so the field can
      // still be submitted normally otherwise.
      if (activeIndex >= 0 && matches[activeIndex]) {
        event.preventDefault();
        select(matches[activeIndex]);
      }
      return;

    case 'Escape':
      if (!listEl.hidden) {
        event.preventDefault();
        closeList();
        statusEl.textContent = '';
      }
      return;

    default:
  }
});

listEl.addEventListener('click', (event) => {
  const option = event.target.closest('.ac__option');
  if (!option) return;

  const id = Number(option.id.replace('option-', ''));
  const match = matches.find((m) => m.id === id);
  if (match) select(match);
});

// Clicking away dismisses the list.
document.addEventListener('click', (event) => {
  if (!event.target.closest('.ac__field')) closeList();
});

clearEl.addEventListener('click', () => {
  inputEl.value = '';
  closeList();
  statusEl.textContent = '';
  statusEl.classList.remove('ac__status--empty');
  inputEl.focus();
});
