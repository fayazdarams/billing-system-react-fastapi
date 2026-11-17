import { useState } from "react";
import Dashboard from "./Dashboard";
import "./MainApp.css";

type MenuItem = { id: string; label: string; children?: MenuItem[] };

const MENUS: MenuItem[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "account", label: "Account" },
  { id: "item", label: "Item" },
  { id: "sales", label: "Sales" },
  { id: "purchase", label: "Purchase" },
  { id: "receipt", label: "Receipt" },
  { id: "payment", label: "Payment" },
  {
    id: "reports",
    label: "Reports",
    children: [
      {
        id: "transactions",
        label: "Transactions",
        children: [
          { id: "accountWise", label: "Account Wise" },
          { id: "itemWise", label: "Item Wise" },
          { id: "accountItem", label: "Account-Item" },
          { id: "general", label: "General" },
        ],
      },
      {
        id: "repAccount",
        label: "Account",
        children: [
          { id: "accountLedger", label: "Account Ledger" },
          { id: "topAccounts", label: "Top Accounts" },
        ],
      },
      {
        id: "repItem",
        label: "Item",
        children: [
          { id: "itemLedger", label: "Item Ledger" },
          { id: "topItems", label: "Top Items" },
          { id: "itemImei", label: "IMEIS" },
        ],
      },
      {
        id: "footFall",
        label: "FootFall",
        children: [
          { id: "footFallDaily", label: "Daily" },
          { id: "footFallMonthly", label: "Monthly" },
        ],
      },
    ],
  },
  {
    id: "promos",
    label: "Promos",
    children: [
      { id: "promotionItem", label: "Item Promo" },
      {
        id: "groupPromotion",
        label: "Group Promo",
        children: [
          { id: "promotionGroupItems", label: "Group" },
          { id: "promotionGroup", label: "Promo" },
        ],
      },
      { id: "promotionReceipt", label: "Rcpt Promo" },
    ],
  },
  { id: "settings", label: "Settings" },
];

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

  function select(id: string, hasChildren: boolean) {
    if (hasChildren) {
      setOpen((p) => ({ ...p, [id]: !p[id] }));
      return;
    }
    setActive(id);
    setMenuOpen(false);
    setOpen({}); // close flyouts after selection
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
            <span>{m.label}</span>
            {hasChildren && <span className="arrow">{isOpen ? "▾" : "▸"}</span>}
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
          ☰
        </button>
        <strong className="store">{storeName}</strong>
        <span className="user">{username}</span>
        <button className="logout-btn" onClick={onLogout}>
          Log out
        </button>
      </header>
      <div className="app-body">
        <aside className={menuOpen ? "menu open" : "menu"}>
          <nav>
            <ul className="menu-list">{renderItems(MENUS)}</ul>
          </nav>
        </aside>
        {menuOpen && <div className="backdrop" onClick={() => setMenuOpen(false)} />}
        <main className="content">
          {active === "dashboard" ? (
            <Dashboard onOpen={(id) => setActive(id)} />
          ) : (
            <div className="placeholder">
              <h1>{MENUS.flatMap((m) => [m, ...(m.children ?? [])]).find((x) => x.id === active)?.label ?? active}</h1>
              <p>Form / list / report will open here.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
