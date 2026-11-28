// frontend/src/components/Tables/AccountsTable.tsx (replace existing file)
// No Bootstrap. AG Grid client-side filtering on cache. No Tailwind.
// npm i ag-grid-react ag-grid-community  (if not already installed)
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeAlpine, themeQuartz } from "ag-grid-community";
import type { ColDef, GridApi, RowDoubleClickedEvent } from "ag-grid-community";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPrint } from "@fortawesome/free-solid-svg-icons";

// AG Grid v32+ / v36: modules are NOT auto-registered. Without this you get error #200
// for RowSelection, TextFilter, NumberFilter, SetFilter, ColumnFilter, CellStyle.
ModuleRegistry.registerModules([AllCommunityModule]);
import AccountForm from "../Forms/AccountForm";
import type { ToastVariant } from "../../types";
import { getApiErrorStatus, getApiErrorMessage } from "../../lib/api";
import { getAccountCache, syncAccounts, type AccountRow } from "../../lib/accountsCache";
import "./AccountsTable.css";

type Props = {
  onTitle?: (t: string) => void;
  onToast: (message: string, variant: ToastVariant) => void;
  storenumber: number;
  onSessionExpired: () => void;
};

// UI state that survives unmount - same idea as data cache.
// Form itself unmounts (cost 0), scroll + filter are restored on return.
let savedFilterModel: Record<string, unknown> | null = null;
let savedColumnState: any | null = null; // full state: order + width + sort
let savedSelectedId: number | null = null; // selected row IS the scroll position now
let savedEditingId: number | null = null;

const DEFAULT_COL_DEF = { sortable: true, resizable: false, filterParams: { debounceMs: 0 } }; // AG Grid default is 500ms - that is the felt lag

const mytheme = themeQuartz.withParams({
  backgroundColor: "#ffffff",
  foregroundColor: "#1a1a1a",
  fontFamily: "serif",
  headerFontFamily: "Brush Script MT",
  cellFontFamily: "monospace",
  spacing: 4,
  fontSize: 15,
  wrapperBorder: { width: 1, style: "solid", color: "#d0d0d0" },
  rowBorder: { width: 1, style: "solid", color: "#d0d0d0" },
  columnBorder: { width: 1, style: "solid", color: "#d0d0d0" },
  headerBackgroundColor: "#faf8f5",
  headerFontSize: 15,
  headerRowBorder: { width: 2, style: "solid", color: "red" },
  headerColumnBorder: { width: 1, style: "solid", color: "#d0d0d0" },
  headerColumnBorderHeight: "100%",
  headerColumnResizeHandleColor: "transparent", //Hide it
  headerColumnResizeHandleHeight: "25%",
  headerColumnResizeHandleWidth: "5px",
  selectedRowBackgroundColor: "rgba(0, 255, 0, 0.1)",
  oddRowBackgroundColor: "#8881",
  popupShadow: { radius: 10, spread: 1, color: "red" },
  scrollbarWidth: "thin",
});

function handlePrint(row: AccountRow) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`
    <html><head><title>Account - ${row.name}</title></head><body>
      <h2>${row.name}</h2>
      <p>${row.address}</p>
      <p>Mobile: ${row.mobile} | WhatsApp: ${row.whatsapp}</p>
      <p>Email: ${row.email ?? ""} | GSTIN: ${row.gstin ?? ""} | PAN: ${row.pan ?? ""}</p>
      <p>Opening: ${row.openingBalance} ${row.openingBalanceType}</p>
    </body></html>
  `);
  w.document.close();
  w.focus();
  w.print();
}

export default function AccountsTable({ onTitle, onToast, storenumber, onSessionExpired }: Props) {
  const [view, setView] = useState<"list" | "new" | "edit">("list");
  const [rows, setRows] = useState<AccountRow[]>(() => getAccountCache());
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [loading, setLoading] = useState(false);
  const gridApi = useRef<GridApi | null>(null);
  const restored = useRef(false);
  const opened = useRef(false);
  const gridWrapRef = useRef<HTMLDivElement | null>(null);

  const refreshFromCache = useCallback(() => setRows([...getAccountCache()]), []);

  // COLS inside component — Print column needs handlePrint.
  const COLS = useMemo<ColDef<AccountRow>[]>(
    () => [
      // 1. Serial — display position only, never sorts, recalculates on sort/filter
      {
        headerName: "#",
        colId: "serial",
        width: 40,
        pinned: "left",
        suppressMovable: true,

        sortable: false,
        filter: false,

        cellStyle: { textAlign: "right" },
        valueGetter: (p) => {
          if (!p.node || !p.api) return "";
          let idx = -1;
          // Walks only displayed rows, after sort + filter, in displayed order
          p.api.forEachNodeAfterFilterAndSort((node, i) => {
            if (node === p.node) idx = i;
          });
          return idx + 1;
        },
      },

      // 2. Name
      {
        field: "name",
        headerName: "Name",
        flex: 1,
        minWidth: 300,
        pinned: "left",
        suppressMovable: true,

        filter: "agTextColumnFilter",
        resizable: true,
      },

      // 3. Address
      {
        field: "address",
        headerName: "Address",
        flex: 1,
        minWidth: 438,
        filter: "agTextColumnFilter",
        resizable: true,
        lockPinned: true,
      },

      // 4. Cell
      {
        field: "mobile",
        headerName: "Cell",
        width: 120,
        filter: "agTextColumnFilter",
        lockPinned: true,
      },

      // 5. Opening Balance — balance + Dr/Cr in one column
      {
        field: "openingBalance",
        headerName: "Opening Balance",
        width: 200,
        cellStyle: { textAlign: "right" },
        filter: "agNumberColumnFilter",
        lockPinned: true,
        valueFormatter: (p) => `${Number(p.value ?? 0).toFixed(2)} ${p.data?.openingBalanceType ?? ""}`.trim(),
      },

      // 6. Print — last column
      {
        headerName: "Action",
        colId: "print",
        width: 45,
        pinned: "right",
        suppressMovable: true,
        sortable: false,
        filter: false,
        cellRenderer: (p: any) => (
          <button type="button" className="row-print-btn" title="Print account" onClick={() => handlePrint(p.data)}>
            <FontAwesomeIcon icon={faPrint} />
          </button>
        ),
      },
    ],
    [],
  );

  // Open list = syncCache() - seed once, delta afterwards. No GET /accounts every time.
  const openList = useCallback(async () => {
    setLoading(true);
    try {
      await syncAccounts(storenumber);
      refreshFromCache();
    } catch (e) {
      onToast(getApiErrorMessage(e), "error");
      if (getApiErrorStatus(e) === 401) onSessionExpired();
    } finally {
      setLoading(false);
    }
  }, [storenumber, onToast, onSessionExpired, refreshFromCache]);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    openList();
  }, [openList]);
  useEffect(() => {
    if (view === "list") onTitle?.("Accounts");
  }, [view, onTitle]);

  //  Came back to this tab — restore saved selection, refocus grid
  useEffect(() => {
    if (view !== "list") return;
    function onWindowFocus() {
      if (savedSelectedId == null) return;
      const node = gridApi.current?.getRowNode(String(savedSelectedId));
      if (node) {
        node.setSelected(true);
        const idx = node.rowIndex;
        if (idx != null) gridApi.current?.ensureIndexVisible(idx, "middle");
        gridWrapRef.current?.focus();
      }
    }
    window.addEventListener("focus", onWindowFocus);
    return () => window.removeEventListener("focus", onWindowFocus);
  }, [view]);

  function saveUiState() {
    if (!gridApi.current) return;
    savedFilterModel = gridApi.current.getFilterModel();
    savedColumnState = gridApi.current.getColumnState(); // order + width + sort
    const selected = gridApi.current.getSelectedRows();
    if (selected.length > 0) savedSelectedId = selected[0].id;
  }

  function restoreUiState(api: GridApi) {
    if (restored.current) return;
    if (savedFilterModel) api.setFilterModel(savedFilterModel);
    if (savedColumnState) {
      api.applyColumnState({ state: savedColumnState, applyOrder: true }); // restores order + width + sort
    }
    // Guard: on first open rows arrive AFTER onGridReady (async sync).
    // Grid has 0 rows then, so restore is invalid -> warning #88.
    // Do NOT mark restored yet - retry on onFirstDataRendered when rows exist.
    const count = api.getDisplayedRowCount();
    if (count === 0) return;
    restored.current = true;

    //  If no row selected, select first row. If a row is selected, keep it.
    // Either way, focus the grid so arrows work immediately.
    let node = savedSelectedId != null ? api.getRowNode(String(savedSelectedId)) : null;

    if (!node) {
      node = api.getDisplayedRowAtIndex(0); // first row
      if (node?.data) savedSelectedId = node.data.id;
    }

    const idx = node?.rowIndex;
    if (node && idx != null) {
      node.setSelected(true);
      setTimeout(() => api.ensureIndexVisible(idx, "middle"), 50);
      setTimeout(() => api.ensureIndexVisible(idx, "middle"), 200);
    }
    setTimeout(() => gridWrapRef.current?.focus(), 200);
  }

  function handleResetColumns() {
    savedFilterModel = null;
    savedColumnState = null;
    savedSelectedId = null;
    gridApi.current?.resetColumnState();
    gridApi.current?.setFilterModel(null);
    gridApi.current?.deselectAll();
    refreshFromCache();
  }

  function handleNew() {
    saveUiState();
    setEditing(null);
    onTitle?.("New Account");
    setView("new");
  }

  // Single open function — used by double-click AND Enter key.
  // Edit = syncCache() FIRST, then open from cache. Covers update + delete by other user.
  async function openEdit(id: number) {
    saveUiState();
    savedEditingId = id;
    savedSelectedId = id;
    setLoading(true);
    try {
      await syncAccounts(storenumber);
      refreshFromCache();
      const fresh = getAccountCache().find((a) => a.id === id);
      if (!fresh) {
        onToast("This account was deleted by another user", "error");
        return;
      }
      setEditing(fresh);
      onTitle?.("Update Account");
      setView("edit");
    } catch (err) {
      onToast(getApiErrorMessage(err), "error");
      if (getApiErrorStatus(err) === 401) onSessionExpired();
    } finally {
      setLoading(false);
    }
  }

  async function handleRowDoubleClick(e: RowDoubleClickedEvent<AccountRow>) {
    const id = e.data?.id;
    if (!id) return;
    await openEdit(id);
  }

  //  Row-only keyboard navigation. No cell focus at all.
  // Up / Down moves the whole-row highlight. Left / Right do nothing.
  // Up on first row = nothing. Down on last row = nothing. Stop, no wrap.
  function moveSelection(delta: -1 | 1) {
    const api = gridApi.current;
    if (!api) return;
    const count = api.getDisplayedRowCount();
    if (count === 0) return;
    const selected = api.getSelectedNodes();
    let currentIdx = selected[0]?.rowIndex ?? -1;
    if (currentIdx == null || currentIdx < 0) {
      currentIdx = delta === 1 ? -1 : count; // no selection yet: Down -> first, Up -> last
    }
    const nextIdx = Math.min(Math.max(0, currentIdx + delta), count - 1);
    if (nextIdx === currentIdx) return; // already at first / last row
    const node = api.getDisplayedRowAtIndex(nextIdx);
    if (!node) return;
    node.setSelected(true);
    api.ensureIndexVisible(nextIdx, "middle");
  }

  function handleGridKeyDown(e: React.KeyboardEvent) {
    const target = e.target as HTMLElement | null;

    //  Inside any filter / menu / popup — let it handle the key, not the grid
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.closest(".ag-filter, .ag-menu, .ag-popup, .ag-select, .ag-picker-field, .ag-list"))
    ) {
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveSelection(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveSelection(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = gridApi.current?.getSelectedRows();
      if (selected?.[0]?.id) openEdit(selected[0].id);
    }
  }

  // ONLY exit back to list - Cancel. Save stays in the form.
  // Sync once here, so Cancel also picks up other users' changes made while form was open.
  // On sync failure, toast - no upsert fallback: one saved row cannot represent many accounts.
  async function handleBack() {
    try {
      await syncAccounts(storenumber);
    } catch (e) {
      onToast(getApiErrorMessage(e), "error");
      if (getApiErrorStatus(e) === 401) onSessionExpired();
    }
    setEditing(null);
    onTitle?.("Accounts");
    setView("list");
    restored.current = false; // allow restore on next mount of grid
    refreshFromCache();
  }

  if (view === "new" || view === "edit") {
    return (
      <AccountForm
        key={view === "edit" ? `edit-${editing?.id}` : "new"}
        initialAccount={view === "edit" ? (editing ?? undefined) : undefined}
        onCancel={handleBack}
        onToast={onToast}
        storenumber={storenumber}
        onSessionExpired={onSessionExpired}
      />
    );
  }

  return (
    <div className="accounts-query">
      <div className="accounts-query-bar">
        <button type="button" className="primary-button" onClick={handleNew}>
          New Account
        </button>
        <button type="button" className="secondary-button" onClick={openList} disabled={loading}>
          {"Refresh"}
        </button>
        <button type="button" className="secondary-button" onClick={handleResetColumns}>
          Reset Columns
        </button>
        <span className="accounts-query-count">{rows.length} accounts</span>
      </div>
      <div
        className="accounts-grid"
        ref={gridWrapRef}
        tabIndex={0}
        onKeyDown={handleGridKeyDown}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            //  Save BEFORE wipe — memory survives, highlight does not
            const selected = gridApi.current?.getSelectedRows();
            if (selected && selected.length > 0) {
              savedSelectedId = selected[0].id;
            }
            gridApi.current?.deselectAll();
            //  Do NOT set savedSelectedId = null here — that was the bug
          }
        }}>
        <AgGridReact<AccountRow>
          theme={mytheme}
          rowData={rows}
          columnDefs={COLS}
          defaultColDef={DEFAULT_COL_DEF}
          rowHeight={30}
          headerHeight={35}
          getRowId={(p) => String(p.data.id)}
          suppressCellFocus={true} //  No cell border, no cell-to-cell movement, no header highlight
          suppressDragLeaveHidesColumns={true} // drag header outside does NOT hide column
          suppressRowHoverHighlight={true}
          onGridReady={(e) => {
            gridApi.current = e.api;
            restoreUiState(e.api);
          }}
          onFirstDataRendered={(e) => restoreUiState(e.api)}
          onRowDataUpdated={(e) => restoreUiState(e.api)} // second chance after Cancel refresh
          animateRows={false} // no slide-up animation on filter - rows snap like old system
          onRowDoubleClicked={handleRowDoubleClick}
          onFilterChanged={() => {
            savedFilterModel = gridApi.current?.getFilterModel() ?? null;
            //  Recalculate serials after filter
            gridApi.current?.refreshCells({ columns: ["serial"], force: true });
          }}
          onSortChanged={(e) => {
            saveUiState(); // saves full column state, not just sort
            //  Recalculate serials after sort
            e.api.refreshCells({ columns: ["serial"], force: true });
            //  Scroll follows the selected row after sort
            const selected = e.api.getSelectedNodes();
            const idx = selected[0]?.rowIndex;
            if (idx != null) e.api.ensureIndexVisible(idx, "middle");
          }}
          onColumnMoved={() => saveUiState()} // column position
          onColumnResized={() => saveUiState()} // field size / width
          onSelectionChanged={(e) => {
            //  Save on every click / arrow move. Never clear on unmount deselect.
            const selected = e.api.getSelectedRows();
            if (selected.length > 0) savedSelectedId = selected[0].id;
          }}
          rowSelection={{
            mode: "singleRow",
            checkboxes: false, // no checkbox in rows
            enableClickSelection: true, // click row = select
          }}
        />
      </div>
    </div>
  );
}
