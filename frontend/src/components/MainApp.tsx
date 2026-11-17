import { useState } from "react";
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
  const [query, setQuery] = useState("");

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
        <aside className={`${menuOpen ? "menu open" : "menu"}${collapsed ? " collapsed" : ""}`}>
          <nav>
            <ul className="menu-list">{renderItems(visible)}</ul>
          </nav>
          <button
            className="collapse-btn"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Expand menu" : "Collapse menu"}>
            <FontAwesomeIcon icon={collapsed ? faChevronRight : faChevronLeft} />{" "}
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
