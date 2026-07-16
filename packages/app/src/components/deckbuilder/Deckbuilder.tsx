import { useEffect, useMemo, useState } from 'react';
import type { CardData, CardDB } from '@mood-swings/engine';
import { standardDeckNotice, validateCustomDeck } from '@mood-swings/engine';
import type { DeckCounts } from '../../game/deckModel.js';
import { addCopy, subCopy, setCount, flatten } from '../../game/deckModel.js';
import type { Filters, SortKey } from '../../game/browse.js';
import { emptyFilters, searchAndFilter, sortCards, groupBySort, paginate } from '../../game/browse.js';
import { serializeDeck, parseDeck } from '../../game/deckText.js';
import type { SavedDeck } from '../../game/deckStorage.js';
import {
  listDecks,
  saveDeck,
  deleteDeck,
  renameDeck,
  duplicateDeck,
  loadDeckCounts,
  getViewPref,
  setViewPref,
} from '../../game/deckStorage.js';
import type { ViewMode } from './types.js';
import { SimpleNamedList } from './views/SimpleNamedList.js';
import { DetailedList } from './views/DetailedList.js';
import { VisualList } from './views/VisualList.js';
import { VisualDetailList } from './views/VisualDetailList.js';
import { DeckListPanel } from './DeckListPanel.js';
import { CardDetailModal } from './CardDetailModal.js';
import { PromptModal, ConfirmModal } from '../Modal.js';

interface DeckbuilderProps {
  counts: DeckCounts;
  db: CardDB;
  onChange(next: DeckCounts): void;
  /** Called after a load/save so the parent can reset its unsaved-changes baseline. */
  onClean?(counts: DeckCounts, name: string): void;
}

const COLORS = ['white', 'blue', 'black', 'red', 'green'] as const;
const RARITIES = ['common', 'uncommon', 'rare', 'mythic'] as const;
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'number', label: 'Number' },
  { key: 'name', label: 'Name' },
  { key: 'color', label: 'Color' },
  { key: 'value', label: 'Value' },
  { key: 'rarity', label: 'Rarity' },
];
const PAGE_SIZE: Record<ViewMode, number> = { simple: 90, detailed: 60, visual: 24, 'visual-detail': 12 };

function isViewMode(v: string | null): v is ViewMode {
  return v === 'simple' || v === 'detailed' || v === 'visual' || v === 'visual-detail';
}

export function Deckbuilder({ counts, db, onChange, onClean }: DeckbuilderProps) {
  const pool = useMemo(
    () => db.all().filter((c) => c.rarity !== 'headliner' && c.rarity !== 'helper').sort((a, b) => a.number - b.number),
    [db],
  );

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(() => emptyFilters());
  const [sort, setSort] = useState<SortKey>('number');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [view, setView] = useState<ViewMode>(() => (isViewMode(getViewPref()) ? (getViewPref() as ViewMode) : 'detailed'));
  const [page, setPage] = useState(1);
  const [modalCard, setModalCard] = useState<CardData | null>(null);

  const [decks, setDecks] = useState<SavedDeck[]>(() => listDecks());
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [deckName, setDeckName] = useState('Untitled deck');
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [flash, setFlash] = useState<string | null>(null);
  // Which name/confirm dialog is open (replaces window.prompt / window.confirm).
  const [dialog, setDialog] = useState<'saveAs' | 'rename' | 'delete' | null>(null);

  // Reset to page 1 whenever the result set or layout changes.
  useEffect(() => setPage(1), [query, filters, sort, dir, view]);
  useEffect(() => setViewPref(view), [view]);

  const flat = useMemo(() => flatten(counts), [counts]);
  const validation = useMemo(() => validateCustomDeck(flat, 2), [flat]);
  const notice = useMemo(() => standardDeckNotice(flat, db), [flat, db]);

  const filtered = useMemo(() => searchAndFilter(pool, query, filters), [pool, query, filters]);
  const sorted = useMemo(() => sortCards(filtered, sort, dir), [filtered, sort, dir]);
  const pageInfo = useMemo(() => paginate(sorted, page, PAGE_SIZE[view]), [sorted, page, view]);
  const groups = useMemo(() => groupBySort(pageInfo.slice, sort), [pageInfo.slice, sort]);

  const showFlash = (m: string) => {
    setFlash(m);
    window.setTimeout(() => setFlash((cur) => (cur === m ? null : cur)), 3500);
  };

  // --- deck edits ---
  const onAdd = (n: number) => onChange(addCopy(counts, n));
  const onSub = (n: number) => onChange(subCopy(counts, n));
  const onSet = (n: number, c: number) => onChange(setCount(counts, n, c));
  const onClear = () => onChange(new Map());

  // --- filter chip toggles ---
  const toggleSet = (key: 'colors' | 'rarities' | 'dieColors', v: string) =>
    setFilters((f) => {
      const next = new Set(f[key] as Set<string>);
      next.has(v) ? next.delete(v) : next.add(v);
      return { ...f, [key]: next };
    });
  const clearFilters = () => {
    setQuery('');
    setFilters(emptyFilters());
  };

  // --- deck manager ---
  const refresh = () => setDecks(listDecks());
  const performSaveAs = (name: string) => {
    const sd = saveDeck(name, counts);
    setCurrentId(sd.id);
    setDeckName(sd.name);
    refresh();
    onClean?.(counts, sd.name);
    showFlash(`Saved “${sd.name}”.`);
  };
  const doSave = () => {
    if (!currentId) return setDialog('saveAs');
    const sd = saveDeck(deckName, counts, currentId);
    refresh();
    onClean?.(counts, sd.name);
    showFlash(`Saved “${sd.name}”.`);
  };
  const doLoad = (id: string) => {
    const sd = decks.find((d) => d.id === id);
    if (!sd) return;
    const { counts: loaded, dropped } = loadDeckCounts(sd);
    onChange(loaded);
    setCurrentId(sd.id);
    setDeckName(sd.name);
    onClean?.(loaded, sd.name);
    showFlash(dropped.length ? `Loaded “${sd.name}” (${dropped.length} unknown card(s) dropped).` : `Loaded “${sd.name}”.`);
  };
  const performRename = (name: string) => {
    if (!currentId) return;
    renameDeck(currentId, name);
    setDeckName(name);
    refresh();
    onClean?.(counts, name);
  };
  const doDuplicate = () => {
    if (!currentId) return;
    const sd = duplicateDeck(currentId);
    if (sd) {
      setCurrentId(sd.id);
      setDeckName(sd.name);
      refresh();
      showFlash(`Duplicated as “${sd.name}”.`);
    }
  };
  const performDelete = () => {
    if (!currentId) return;
    deleteDeck(currentId);
    setCurrentId(null);
    refresh();
    showFlash('Deck deleted.');
  };

  // --- import / export ---
  const doImport = () => {
    const { counts: parsed, unmatched } = parseDeck(importText, db);
    onChange(parsed);
    setImportOpen(false);
    setImportText('');
    setCurrentId(null);
    onClean?.(parsed, deckName);
    showFlash(unmatched.length ? `Imported. ${unmatched.length} line(s) unmatched: ${unmatched.slice(0, 3).join(', ')}${unmatched.length > 3 ? '…' : ''}` : 'Imported deck.');
  };
  const doExportClipboard = async () => {
    const text = serializeDeck(counts, db, deckName);
    try {
      await navigator.clipboard.writeText(text);
      showFlash('Copied deck to clipboard.');
    } catch {
      showFlash('Clipboard unavailable — use Download.');
    }
  };
  const doExportDownload = () => {
    const text = serializeDeck(counts, db, deckName);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${deckName.replace(/[^\w-]+/g, '_') || 'deck'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ViewComp =
    view === 'simple' ? SimpleNamedList : view === 'visual' ? VisualList : view === 'visual-detail' ? VisualDetailList : DetailedList;

  return (
    <div className="dbx">
      {notice && <div className="dbx-notice" role="note">{notice}</div>}

      <div className="dbx-toolbar">
        <input
          className="dbx-search"
          type="search"
          placeholder="Search name or rules text…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search cards"
        />

        <div className="dbx-chips">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`dbx-chip dbx-color--${c}${filters.colors.has(c) ? ' is-on' : ''}`}
              onClick={() => toggleSet('colors', c)}
            >
              {c}
            </button>
          ))}
          {RARITIES.map((r) => (
            <button
              key={r}
              type="button"
              className={`dbx-chip${filters.rarities.has(r) ? ' is-on' : ''}`}
              onClick={() => toggleSet('rarities', r)}
            >
              {r}
            </button>
          ))}
          <button type="button" className={`dbx-chip${filters.dieColors.has('white') ? ' is-on' : ''}`} onClick={() => toggleSet('dieColors', 'white')}>
            fixed
          </button>
          <button type="button" className={`dbx-chip${filters.dieColors.has('black') ? ' is-on' : ''}`} onClick={() => toggleSet('dieColors', 'black')}>
            variable
          </button>
          <label className="dbx-range">
            val
            <input type="number" min={0} max={12} value={filters.valueMin} onChange={(e) => setFilters((f) => ({ ...f, valueMin: Number(e.target.value) }))} />
            –
            <input type="number" min={0} max={12} value={filters.valueMax} onChange={(e) => setFilters((f) => ({ ...f, valueMax: Number(e.target.value) }))} />
          </label>
          <button type="button" className={`dbx-chip${filters.hasSecondary ? ' is-on' : ''}`} onClick={() => setFilters((f) => ({ ...f, hasSecondary: f.hasSecondary ? null : true }))}>
            2nd value
          </button>
          <button type="button" className={`dbx-chip${filters.hasRules ? ' is-on' : ''}`} onClick={() => setFilters((f) => ({ ...f, hasRules: f.hasRules ? null : true }))}>
            has text
          </button>
          <button type="button" className="dbx-chip dbx-chip--clear" onClick={clearFilters}>
            clear
          </button>
        </div>

        <div className="dbx-toolbar__row">
          <label className="dbx-sort">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <button type="button" className="dbx-dir" onClick={() => setDir((d) => (d === 'asc' ? 'desc' : 'asc'))} aria-label="Toggle sort direction">
              {dir === 'asc' ? '↑' : '↓'}
            </button>
          </label>

          <div className="dbx-views" role="tablist" aria-label="View mode">
            {(['simple', 'detailed', 'visual', 'visual-detail'] as ViewMode[]).map((v) => (
              <button key={v} type="button" className={`dbx-viewbtn${view === v ? ' is-active' : ''}`} onClick={() => setView(v)}>
                {v === 'visual-detail' ? 'Visual+Detail' : v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          <div className="dbx-manager">
            <select value={currentId ?? ''} onChange={(e) => (e.target.value ? doLoad(e.target.value) : undefined)} aria-label="Load saved deck">
              <option value="">{decks.length ? 'Load deck…' : 'No saved decks'}</option>
              {decks.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <button type="button" className="btn" onClick={doSave}>Save</button>
            <button type="button" className="btn" onClick={() => setDialog('saveAs')}>Save as</button>
            <button type="button" className="btn" onClick={() => setDialog('rename')} disabled={!currentId}>Rename</button>
            <button type="button" className="btn" onClick={doDuplicate} disabled={!currentId}>Duplicate</button>
            <button type="button" className="btn" onClick={() => setDialog('delete')} disabled={!currentId}>Delete</button>
            <button type="button" className="btn" onClick={() => setImportOpen(true)}>Import</button>
            <button type="button" className="btn" onClick={doExportClipboard}>Export</button>
            <button type="button" className="btn" onClick={doExportDownload}>↓ .txt</button>
          </div>
        </div>

        <div className="dbx-resultbar">
          <span className="muted">{filtered.length} of {pool.length}</span>
          {pageInfo.pages > 1 && (
            <span className="dbx-pager">
              <button type="button" className="btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pageInfo.page <= 1}>‹</button>
              <span className="muted">{pageInfo.page} / {pageInfo.pages}</span>
              <button type="button" className="btn" onClick={() => setPage((p) => p + 1)} disabled={pageInfo.page >= pageInfo.pages}>›</button>
            </span>
          )}
          {flash && <span className="dbx-flash">{flash}</span>}
        </div>
      </div>

      <div className="dbx-body">
        <div className="dbx-browser">
          {groups.length === 0 ? (
            <p className="muted dbx-empty">No cards match. <button type="button" className="linklike" onClick={clearFilters}>Clear filters</button></p>
          ) : (
            <ViewComp groups={groups} counts={counts} onAdd={onAdd} onSet={onSet} onSub={onSub} onOpen={setModalCard} />
          )}
        </div>

        <DeckListPanel
          counts={counts}
          db={db}
          onAdd={onAdd}
          onSet={onSet}
          onSub={onSub}
          onClear={onClear}
          onOpen={setModalCard}
          validation={validation}
        />
      </div>

      {importOpen && (
        <div className="dbx-modal__backdrop" onClick={() => setImportOpen(false)} role="presentation">
          <div className="dbx-modal dbx-import" role="dialog" aria-modal="true" aria-label="Import deck" onClick={(e) => e.stopPropagation()}>
            <header className="dbx-modal__head">
              <h3 className="dbx-modal__title">Import deck</h3>
              <button type="button" className="dbx-modal__close" onClick={() => setImportOpen(false)} aria-label="Close">×</button>
            </header>
            <p className="muted">Paste a decklist — one card per line, optional leading count (e.g. <code>3 Sadness</code>). Lines starting with <code>#</code> are ignored.</p>
            <textarea className="dbx-import__text" value={importText} onChange={(e) => setImportText(e.target.value)} rows={12} placeholder={'3 Sadness\n2 Rage\nEnvy'} />
            <div className="dbx-import__actions">
              <button type="button" className="btn btn--primary" onClick={doImport} disabled={!importText.trim()}>Import</button>
              <button type="button" className="btn" onClick={() => setImportOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {modalCard && (
        <CardDetailModal
          card={modalCard}
          count={counts.get(modalCard.number) ?? 0}
          onAdd={() => onAdd(modalCard.number)}
          onSet={(n) => onSet(modalCard.number, n)}
          onSub={() => onSub(modalCard.number)}
          onClose={() => setModalCard(null)}
        />
      )}

      {dialog === 'saveAs' && (
        <PromptModal
          title="Save deck"
          label="Deck name"
          initialValue={deckName}
          confirmLabel="Save"
          onConfirm={(name) => {
            performSaveAs(name);
            setDialog(null);
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === 'rename' && (
        <PromptModal
          title="Rename deck"
          label="New name"
          initialValue={deckName}
          confirmLabel="Rename"
          onConfirm={(name) => {
            performRename(name);
            setDialog(null);
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === 'delete' && (
        <ConfirmModal
          title="Delete deck"
          message={<>Delete “{deckName}”? This can’t be undone.</>}
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            performDelete();
            setDialog(null);
          }}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  );
}
