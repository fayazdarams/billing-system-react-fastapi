import "./Dashboard.css";

type Row = { label: string; count?: string; amount?: string };
type Card = { id: string; title: string; count?: string; amount?: string; rows?: Row[] };

const CARDS: Card[] = [
  { id: "account", title: "Accounts", count: "(0)" },
  { id: "item", title: "Products", count: "(0)" },
  { id: "sales", title: "Sales", count: "(0)", amount: "--" },
  { id: "purchase", title: "Purchase", count: "(0)", amount: "--" },
  {
    id: "receipt",
    title: "Receipts",
    count: "(0)",
    amount: "--",
    rows: [
      { label: "Cash", count: "(0)", amount: "--" },
      { label: "Bank", count: "(0)", amount: "--" },
      { label: "Cheque", count: "(0)", amount: "--" },
      { label: "Waived Off", count: "(0)", amount: "--" },
    ],
  },
  {
    id: "payment",
    title: "Payments",
    count: "(0)",
    amount: "--",
    rows: [
      { label: "Cash", count: "(0)", amount: "--" },
      { label: "Bank", count: "(0)", amount: "--" },
      { label: "Cheque", count: "(0)", amount: "--" },
      { label: "Waived Off", count: "(0)", amount: "--" },
    ],
  },
];

// Columns like old Dashboard.php: [Accounts, Products] | [Sales, Purchase] | [Receipts, Payments]
const COLS: Card[][] = [
  [CARDS[0], CARDS[1]],
  [CARDS[2], CARDS[3]],
  [CARDS[4], CARDS[5]],
];

export default function Dashboard({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <div className="dash">
      <h1 className="dash-title">DASHBOARD</h1>
      <div className="dash-grid">
        {COLS.map((col, i) => (
          <div key={i} className="dash-col">
            {col.map((c) => (
              <button key={c.id} className="dash-card" onClick={() => onOpen(c.id)}>
                <div className="dash-card-head">
                  <strong>{c.title}</strong>
                  <span>{c.count}</span>
                  {c.amount && <span>{c.amount}</span>}
                </div>
                {c.rows && (
                  <table className="dash-table">
                    <tbody>
                      {c.rows.map((r) => (
                        <tr key={r.label}>
                          <td>{r.label}:</td>
                          <td className="num">{r.count}</td>
                          <td className="num">{r.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
