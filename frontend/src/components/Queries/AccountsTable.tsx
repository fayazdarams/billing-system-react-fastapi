// frontend/src/components/Tables/AccountsTable.tsx (replace existing file)
// No Bootstrap. AG Grid client-side filtering on cache. No Tailwind.
// npm i ag-grid-react ag-grid-community  (if not already installed)
import { useCallback, useEffect, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeAlpine } from "ag-grid-community";
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
let savedFirstRow = 0;
let savedSelectedId: number | null = null; // ✅ FIX - selected row
let savedEditingId: number | null = null;

const DEFAULT_COL_DEF = { sortable: true, resizable: true, filterParams: { debounceMs: 0 } }; // AG Grid default is 500ms - that is the felt lag

export default function AccountsTable({ onTitle, onToast, storenumber, onSessionExpired }: Props) {
  const [view, setView] = useState<"list" | "new" | "edit">("list");
  const [rows, setRows] = useState<AccountRow[]>(() => getAccountCache());
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [loading, setLoading] = useState(false);
  const gridApi = useRef<GridApi | null>(null);
  const restored = useRef(false);
  const opened = useRef(false);

  const refreshFromCache = useCallback(() => setRows([...getAccountCache()]), []);

  // Print — from cache, no fetch, no sync. Single click selects row + prints.
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

  // COLS inside component — Print column needs handlePrint.
  const COLS: ColDef<AccountRow>[] = [
    // 1. Serial — display position only, never sorts, recalculates on sort/filter
    {
      headerName: "#",
      colId: "serial",
      width: 40,
      pinned: "left",
      sortable: false,
      filter: false,
      resizable: false,
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
      minWidth: 250,
      pinned: "left",
      filter: "agTextColumnFilter",
    },

    // 3. Address
    {
      field: "address",
      headerName: "Address",
      flex: 1,
      minWidth: 180,
      filter: "agTextColumnFilter",
    },

    // 4. Cell
    {
      field: "mobile",
      headerName: "Cell",
      width: 100,
      filter: "agTextColumnFilter",
    },

    // 5. Opening Balance — balance + Dr/Cr in one column
    {
      field: "openingBalance",
      headerName: "Opening Balance",
      width: 150,
      cellStyle: { textAlign: "right" },
      filter: "agNumberColumnFilter",
      valueFormatter: (p) => `${Number(p.value ?? 0).toFixed(2)} ${p.data?.openingBalanceType ?? ""}`.trim(),
    },

    // 6. Print — last column
    {
      headerName: "Action",
      colId: "print",
      width: 50,
      pinned: "right",
      sortable: false,
      filter: false,
      resizable: false,
      cellRenderer: (p: any) => (
        <button type="button" className="row-print-btn" title="Print account" onClick={() => handlePrint(p.data)}>
          <FontAwesomeIcon icon={faPrint} />
        </button>
      ),
    },
  ];

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

  function saveUiState() {
    if (!gridApi.current) return;
    savedFilterModel = gridApi.current.getFilterModel();
    savedColumnState = gridApi.current.getColumnState(); // order + width + sort
    savedFirstRow = gridApi.current.getFirstDisplayedRowIndex();
    // ✅ Selection is saved in onSelectionChanged, not here — saveUiState runs on
    // double-click too, when selection is already the double-clicked row.
  }

  function restoreUiState(api: GridApi) {
    if (restored.current) return;
    if (savedFilterModel) api.setFilterModel(savedFilterModel);
    if (savedColumnState) {
      api.applyColumnState({ state: savedColumnState, applyOrder: true }); // restores order + width + sort
    }
    // Guard: on first open rows arrive AFTER onGridReady (async sync).
    // Grid has 0 rows then, so scroll restore is invalid -> warning #88.
    // Do NOT mark restored yet - retry on onFirstDataRendered when rows exist.
    const count = api.getDisplayedRowCount();
    if (count === 0) return;
    restored.current = true;

    // ✅ Vertical scroll — ensureIndexVisible with retry, not pixel.
    // Pixel scrollTop gets overwritten by AG Grid on next render.
    const idx = Math.min(Math.max(0, savedFirstRow), count - 1);
    setTimeout(() => api.ensureIndexVisible(idx, "top"), 50);
    setTimeout(() => api.ensureIndexVisible(idx, "top"), 200);

    // ✅ Selected row — restore selection
    if (savedSelectedId != null) {
      const node = api.getRowNode(String(savedSelectedId));
      if (node) {
        node.setSelected(true);
        // Selection also brings row into view if scroll restore missed
        setTimeout(() => api.ensureIndexVisible(node.rowIndex, "middle"), 200);
      }
    }
  }

  function handleResetColumns() {
    savedFilterModel = null;
    savedColumnState = null;
    savedFirstRow = 0;
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

  // Edit = syncCache() FIRST, then open from cache. Covers update + delete by other user.
  // Double-click only — single click just selects the row.
  async function handleRowDoubleClick(e: RowDoubleClickedEvent<AccountRow>) {
    const id = e.data?.id;
    if (!id) return;
    saveUiState();
    savedEditingId = id;
    savedSelectedId = id; // ✅ double-clicked row is also the selected row
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
          {loading ? "Loading..." : "Refresh"}
        </button>
        <button type="button" className="secondary-button" onClick={handleResetColumns}>
          Reset Columns
        </button>
        <span className="accounts-query-count">{rows.length} accounts</span>
      </div>
      <div className="accounts-grid">
        <AgGridReact<AccountRow>
          rowData={rows}
          columnDefs={COLS}
          defaultColDef={DEFAULT_COL_DEF}
          rowHeight={30}
          headerHeight={35}
          getRowId={(p) => String(p.data.id)}
          suppressDragLeaveHidesColumns={true} // ✅ drag header outside does NOT hide column
          onGridReady={(e) => {
            gridApi.current = e.api;
            restoreUiState(e.api);
          }}
          onFirstDataRendered={(e) => restoreUiState(e.api)}
          animateRows={false} // no slide-up animation on filter - rows snap like old system
          onRowDoubleClicked={handleRowDoubleClick}
          onFilterChanged={() => {
            savedFilterModel = gridApi.current?.getFilterModel() ?? null;
            // ✅ Recalculate serials after filter
            gridApi.current?.refreshCells({ columns: ["serial"], force: true });
          }}
          onSortChanged={(e) => {
            saveUiState(); // saves full column state, not just sort
            // ✅ Recalculate serials after sort
            e.api.refreshCells({ columns: ["serial"], force: true });
          }}
          onColumnMoved={() => saveUiState()} // column position
          onColumnResized={() => saveUiState()} // field size / width
          onSelectionChanged={(e) => {
            // ✅ Selected row — save on every single click
            const selected = e.api.getSelectedRows();
            savedSelectedId = selected[0]?.id ?? null;
          }}
          rowSelection={{ mode: "singleRow" }}
        />
      </div>
    </div>
  );
}
