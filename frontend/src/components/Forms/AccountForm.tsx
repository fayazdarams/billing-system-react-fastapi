import { useState } from "react";
import type { FormEvent } from "react";
import Field from "../shared/Field";
import { handleEnterAsTab } from "../../lib/enterAsTab";
import "./AccountForm.css";

type Props = { onSave: (v: any) => void; onCancel: () => void };

export default function AccountForm({ onSave, onCancel }: Props) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [mobile, setMobile] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [aadhar, setAadhar] = useState("");
  const [gstin, setGstin] = useState("");
  const [pan, setPan] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [openingBalanceType, setOpeningBalanceType] = useState("Dr");
  const [submitted, setSubmitted] = useState(false);
  const nameError = !name.trim() ? "Please enter Name" : "";
  const shown = (msg: string) => (submitted ? msg : "");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    if (nameError) {
      document.getElementById("acc-name")?.focus();
      return;
    }
    onSave({
      name: name.trim(),
      address,
      mobile,
      whatsapp,
      email,
      aadhar,
      gstin,
      pan,
      opening_balance: openingBalance,
      opening_balance_type: openingBalanceType,
    });
  }

  return (
    <div className="account-page">
      <form onSubmit={handleSubmit} onKeyDown={handleEnterAsTab} noValidate>
        <div className="account-grid">
          {/* Col 1 — General */}
          <fieldset className="account-column">
            <legend className="account-legend">General Details</legend>
            <Field
              id="acc-name"
              label="Name"
              value={name}
              onChange={setName}
              error={shown(nameError)}
              required
              autoFocus
              hint="Hello"
            />
            <Field
              id="acc-address"
              label="Name"
              as="textarea"
              rows={4}
              value={address}
              onChange={setAddress}
              hint="Shift+Enter : Next line"
            />
            <Field id="acc-gstin" label="GSTIN/UIN Number" value={gstin} onChange={setGstin} maxLength={15} />

            <Field id="acc-pan" label="PAN Number" value={pan} onChange={setPan} maxLength={10} />
            <div className="account-opening-row">
              <Field
                id="acc-opening"
                label="Opening Balance"
                value={openingBalance}
                onChange={setOpeningBalance}
                inputMode="numeric"
              />
              <Field
                id="acc-type"
                label="Type"
                as="select"
                options={["Dr", "Cr"]}
                value={openingBalanceType}
                onChange={setOpeningBalanceType}
              />
            </div>
          </fieldset>

          {/* Col 2 — Contact */}
          <fieldset className="account-column">
            <legend className="account-legend">Contact Details</legend>
            <Field
              id="acc-mobile"
              label="Mobile"
              value={mobile}
              onChange={setMobile}
              autoComplete="tel"
              inputMode="numeric"
              maxLength={10}
            />
            <Field
              id="acc-whatsapp"
              label="WhatsApp"
              value={whatsapp}
              onChange={setWhatsapp}
              autoComplete="tel"
              inputMode="numeric"
              maxLength={10}
            />
            <Field id="acc-email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
            <Field
              id="acc-aadhar"
              label="Aadhar No."
              value={aadhar}
              onChange={setAadhar}
              inputMode="numeric"
              maxLength={12}
            />
          </fieldset>
        </div>

        <div className="actions">
          <button type="submit" className="primary-button">
            Save
          </button>
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
