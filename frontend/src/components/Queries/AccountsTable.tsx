import { useState, useEffect } from "react";
import AccountForm from "../Forms/AccountForm";

type Row = { id: number; name: string; address: string; mobile: string; balance: number };

const DEMO: Row[] = [
  { id: 1, name: "customer11", address: "11", mobile: "8899620787", balance: -8920.0 },
  { id: 2, name: "customer12234", address: "cust", mobile: "7766554433", balance: -120413.45 },
];

// CHANGE 1: MainApp passes setContentTitle here.
// AccountTable owns List vs New vs Edit — so it pushes the title up.
type Props = { onTitle?: (t: string) => void };

export default function AccountTable({ onTitle }: Props) {
  const [view, setView] = useState<"list" | "new" | "edit">("list");
  const [fName, setFName] = useState("");
  const [fAddr, setFAddr] = useState("");
  const [fCell, setFCell] = useState("");

  // List shows → header = "Accounts"
  // Runs once on mount, and again when we come back to list.
  useEffect(() => {
    if (view === "list") onTitle?.("Accounts");
  }, [view, onTitle]);

  function handleNew() {
    onTitle?.("New Account");
    setView("new");
  }

  function handleEdit() {
    onTitle?.("Update Account");
    setView("edit");
  }

  function handleBack() {
    onTitle?.("Accounts");
    setView("list");
  }

  if (view === "new" || view === "edit") {
    return (
      <AccountForm
        onCancel={handleBack}
        onSave={(v) => {
          console.log("save", v);
          handleBack();
        }}
      />
    );
  }

  const rows = DEMO.filter(
    (r) =>
      r.name.toLowerCase().includes(fName.toLowerCase()) &&
      r.address.toLowerCase().includes(fAddr.toLowerCase()) &&
      r.mobile.includes(fCell),
  );

  return (
    <div className="container-fluid px-3 pb-3 h-100">
      {/* CHANGE 2: Deleted <div>ACCOUNTS</div> — title is in app-header now */}

      <button className="btn btn-primary btn-sm mb-2" onClick={handleNew}>
        New Account
      </button>

      <div className="table-responsive">
        <table className="table table-bordered table-sm align-middle mb-0">
          <thead className="table-primary">
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Name</th>
              <th>Address</th>
              <th style={{ width: 140 }}>Cell</th>
              <th style={{ width: 160 }} className="text-end">
                Account Balance
              </th>
              <th style={{ width: 40 }}></th>
            </tr>
            <tr>
              <th></th>
              <th>
                <input
                  className="form-control form-control-sm"
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  placeholder="Filter"
                />
              </th>
              <th>
                <input
                  className="form-control form-control-sm"
                  value={fAddr}
                  onChange={(e) => setFAddr(e.target.value)}
                  placeholder="Filter"
                />
              </th>
              <th>
                <input
                  className="form-control form-control-sm"
                  value={fCell}
                  onChange={(e) => setFCell(e.target.value)}
                  placeholder="Filter"
                />
              </th>
              <th colSpan={2}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} onClick={handleEdit} style={{ cursor: "pointer" }}>
                <td className="text-end">{i + 1}</td>
                <td>{r.name}</td>
                <td>{r.address}</td>
                <td>{r.mobile}</td>
                <td className="text-end">{r.balance.toFixed(2)}</td>
                <td className="text-center">🖨</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
