import { useState, useRef, useCallback, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHome,
  faUsers,
  faTable,
  faBox,
  faShoppingCart,
  faFileAlt,
  faRupeeSign,
  faFile,
  faExchangeAlt,
  faUser,
  faWalking,
  faReceipt,
  faCog,
  faSearch,
  faBars,
  faSignOutAlt,
  faTag,
  faFileInvoice,
  faPercent,
  faGift,
  faChartBar,
  faLink,
  faBookOpen,
  faTrophy,
  faMobileAlt,
  faCalendarDay,
  faCalendarAlt,
  faStar,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import Dashboard from "./Dashboard";
import "./MainApp.css";

type MenuItem = { id: string; label: string; icon: IconDefinition; children?: MenuItem[] };

const MENU_MIN_WIDTH = 56;
const LABEL_HIDE_WIDTH = 56; // labels hide only below this, not at 100
const MENU_FALLBACK_MAX_WIDTH = 180; // used only before measuring, or if measuring fails
const MENUS: MenuItem[] = [
  { id: "dashboard", label: "Dashboard", icon: faHome },
  { id: "account", label: "Account", icon: faUsers },
  { id: "item", label: "Item", icon: faTable },
  { id: "sales", label: "Sales", icon: faBox },
  { id: "purchase", label: "Purchase", icon: faShoppingCart },
  { id: "receipt", label: "Receipt", icon: faFileAlt },
  { id: "payment", label: "Payment", icon: faRupeeSign },
  {
    id: "reports",
    label: "Reports",
    icon: faFile,
    children: [
      {
        id: "transactions",
        label: "Transactions",
        icon: faExchangeAlt,
        children: [
          { id: "accountWise", label: "Account Wise", icon: faUsers },
          { id: "itemWise", label: "Item Wise", icon: faBox },
          { id: "accountItem", label: "Account-Item", icon: faLink },
          { id: "general", label: "General", icon: faChartBar },
        ],
      },
      {
        id: "repAccount",
        label: "Account",
        icon: faUser,
        children: [
          { id: "accountLedger", label: "Account Ledger", icon: faBookOpen },
          { id: "topAccounts", label: "Top Accounts", icon: faTrophy },
        ],
      },
      {
        id: "repItem",
        label: "Item",
        icon: faBox,
        children: [
          { id: "itemLedger", label: "Item Ledger", icon: faBookOpen },
          { id: "topItems", label: "Top Items", icon: faStar },
          { id: "itemImei", label: "IMEIS", icon: faMobileAlt },
        ],
      },
      {
        id: "footFall",
        label: "FootFall",
        icon: faWalking,
        children: [
          { id: "footFallDaily", label: "Daily", icon: faCalendarDay },
          { id: "footFallMonthly", label: "Monthly", icon: faCalendarAlt },
        ],
      },
    ],
  },
  {
    id: "promos",
    label: "Promos",
    icon: faReceipt,
    children: [
      { id: "promotionItem", label: "Item Promo", icon: faTag },
      {
        id: "groupPromotion",
        label: "Group Promo",
        icon: faGift,
        children: [
          { id: "promotionGroupItems", label: "Group", icon: faUsers },
          { id: "promotionGroup", label: "Promo", icon: faPercent },
        ],
      },
      { id: "promotionReceipt", label: "Rcpt Promo", icon: faFileInvoice },
    ],
  },
  { id: "settings", label: "Settings", icon: faCog },
];

function findPath(items: MenuItem[], id: string, trail: MenuItem[] = []): MenuItem[] | null {
  for (const m of items) {
    const next = [...trail, m];
    if (m.id === id) return next;
    if (m.children) {
      const r = findPath(m.children, id, next);
      if (r) return r;
    }
  }
  return null;
}
function filterMenus(items: MenuItem[], q: string): MenuItem[] {
  if (!q) return items;
  const out: MenuItem[] = [];
  for (const m of items) {
    const kids = m.children ? filterMenus(m.children, q) : [];
    if (m.label.toLowerCase().includes(q) || kids.length) out.push({ ...m, children: kids.length ? kids : m.children });
  }
  return out;
}

export default function MainApp({
  storeName,
  username,
  onLogout,
}: {
  storeName: string;
  username: string;
  onLogout: () => void;
}) {
  const [active, setActive] = useState("dashboard");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [menuWidth, setMenuWidth] = useState(180);
  const [menuMaxWidth, setMenuMaxWidth] = useState(MENU_FALLBACK_MAX_WIDTH);

  // Max drag = longest menu label + icon + gap + padding + arrow + 2px
  useEffect(() => {
    const labels: string[] = [];
    const collect = (items: MenuItem[]) => {
      for (const m of items) {
        labels.push(m.label);
        if (m.children) collect(m.children);
      }
    };
    collect(MENUS);
    const probe = document.createElement("span");
    probe.style.cssText =
      "position:absolute;visibility:hidden;white-space:nowrap;font:500 14.72px Inter, system-ui, sans-serif;letter-spacing:-0.01em";
    document.body.appendChild(probe);
    let longest = 0;
    for (const l of labels) {
      probe.textContent = l;
      longest = Math.max(longest, probe.offsetWidth);
    }
    probe.remove();
    // 18 icon + 10 gap + 20 padding (10+10) + 12 arrow + 2 your extra
    const max = Math.ceil(longest + 18 + 10 + 20 + 12 + 16);
    setMenuMaxWidth(max);
    setMenuWidth(max); // load width = same as max drag width, not hardcoded 180
  }, []);
  const [dragWidth, setDragWidth] = useState(180);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const dragWidthRef = useRef(180); // live width, no stale state in onUp
  const maxWidthRef = useRef(MENU_FALLBACK_MAX_WIDTH);
  useEffect(() => {
    maxWidthRef.current = menuMaxWidth;
  }, [menuMaxWidth]);

  const onResizeDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const start = menuWidth; // menuWidth already holds exact width (70 stays 70), never force 56
      dragRef.current = { startX: e.clientX, startWidth: start };
      dragWidthRef.current = start;
      setDragWidth(start);
      setDragging(true);
    },
    [menuWidth],
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const w = dragRef.current.startWidth + (e.clientX - dragRef.current.startX);
      const clamped = Math.min(maxWidthRef.current, Math.max(MENU_MIN_WIDTH, w));
      dragWidthRef.current = clamped; // keep ref in sync
      setDragWidth(clamped); // smooth, no snap mid-drag
    };
    const onUp = () => {
      const w = dragWidthRef.current; // read live ref, no updater side-effects
      dragRef.current = null;
      setDragging(false);
      setCollapsed(w <= LABEL_HIDE_WIDTH);
      setMenuWidth(w); // 70 stays 70, no jump to 56
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging]);
  const [query, setQuery] = useState("");

  const isCollapsedVisual = dragging ? dragWidth <= LABEL_HIDE_WIDTH : collapsed;
  const crumbs = findPath(MENUS, active) ?? [];
  const visible = filterMenus(MENUS, query.trim().toLowerCase());

  function select(id: string, hasChildren: boolean) {
    if (hasChildren) {
      setOpen((p) => ({ ...p, [id]: !p[id] }));
      return;
    }
    setActive(id);
    setMenuOpen(false);
    setOpen({});
    setQuery("");
  }

  function renderItems(items: MenuItem[]) {
    return items.map((m) => {
      const hasChildren = !!m.children?.length;
      const isOpen = !!open[m.id];
      return (
        <li key={m.id} className={isOpen ? "menu-li open" : "menu-li"}>
          <button
            className={active === m.id ? "menu-item active" : "menu-item"}
            onClick={() => select(m.id, hasChildren)}
            aria-expanded={hasChildren ? isOpen : undefined}>
            <span className="menu-item-left">
              <FontAwesomeIcon icon={m.icon} className="menu-icon" fixedWidth />{" "}
              <span className="menu-label">{m.label}</span>
              <span className="tooltip">{m.label}</span>
            </span>
            {hasChildren && <span className="arrow menu-label">{isOpen ? "▾" : "▸"}</span>}
          </button>
          {hasChildren && <ul className="submenu">{renderItems(m.children!)}</ul>}
        </li>
      );
    });
  }

  return (
    <div className="app">
      <header className="app-header">
        <button className="icon-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="Toggle menu">
          <FontAwesomeIcon icon={faBars} />
        </button>
        <strong className="store">{storeName}</strong>
        <span className="user">{username}</span>
        <button className="logout-btn" onClick={onLogout}>
          <FontAwesomeIcon icon={faSignOutAlt} /> Log out
        </button>
      </header>
      <div className="app-body">
        <aside
          className={`${menuOpen ? "menu open" : "menu"}${isCollapsedVisual ? " collapsed" : ""}${dragging ? " dragging" : ""}`}
          style={{ width: dragging ? dragWidth : menuWidth }}>
          <nav>
            <ul className="menu-list">{renderItems(visible)}</ul>
          </nav>
          <div className="resize-handle" onPointerDown={onResizeDown} title="Drag to resize menu" />
          <button
            className="collapse-btn"
            onClick={() => {
              if (collapsed) {
                setCollapsed(false);
                setMenuWidth(maxWidthRef.current);
              } else {
                setCollapsed(true);
                setMenuWidth(56);
              }
            }}
            title={collapsed ? "Expand menu" : "Collapse menu"}>
            <FontAwesomeIcon icon={collapsed ? faChevronRight : faChevronLeft} />{" "}
            <span className="menu-label">Collapse</span>
          </button>
        </aside>
        {menuOpen && <div className="backdrop" onClick={() => setMenuOpen(false)} />}
        <main className="content">
          <div className="content-top">
            <nav className="crumbs" aria-label="Breadcrumb">
              {crumbs.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && <span className="crumb-sep"> / </span>}
                  <button
                    className={i === crumbs.length - 1 ? "crumb current" : "crumb"}
                    onClick={() => !c.children && select(c.id, false)}>
                    {c.label}
                  </button>
                </span>
              ))}
            </nav>
            <div className="search-box">
              <FontAwesomeIcon icon={faSearch} className="search-icon" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search menu, accounts, items..."
                aria-label="Search"
              />
            </div>
          </div>
          {active === "dashboard" ? (
            <Dashboard onOpen={(id) => setActive(id)} />
          ) : (
            <div className="placeholder">
              <h1>{crumbs[crumbs.length - 1]?.label ?? active}</h1>
              <p>Form / list / report will open here.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
