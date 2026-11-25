import { useState, useRef } from "react";
import ConfirmDialog from "../shared/ConfirmDialog";
import type { FormEvent } from "react";
import Field from "../shared/Field";
import { handleEnterAsTab } from "../../lib/enterAsTab";
import {
  getAccountAadharError,
  getAccountAddressError,
  getAccountGstError,
  getAccountNameError,
  getAccountOpeningBalanceError,
  getAccountPanError,
  getAccountTypeError,
  getEmailError,
  getMobileError,
} from "../../lib/validation";
import { postJson, getApiErrorStatus, getApiErrorMessage } from "../../lib/api";
import "./AccountForm.css";
import type { ToastVariant } from "../../types";

type Props = {
  onSave: (v: any) => void;
  onCancel: () => void;
  onToast: (message: string, variant: ToastVariant) => void;
  storenumber: number;
  onSessionExpired: () => void;
};

interface AccountErrors {
  name: string;
  address: string;
  mobile: string;
  whatsapp: string;
  email: string;
  aadhar: string;
  gstin: string;
  pan: string;
  openingBalance: string;
  openingBalanceType: string;
}

const emptyErrors: AccountErrors = {
  name: "",
  address: "",
  mobile: "",
  whatsapp: "",
  email: "",
  aadhar: "",
  gstin: "",
  pan: "",
  openingBalance: "",
  openingBalanceType: "",
};

export default function AccountForm({ onSave, onCancel, onToast, storenumber, onSessionExpired }: Props) {
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
  const [errors, setErrors] = useState<AccountErrors>(emptyErrors);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const shown = (msg: string) => (submitted ? msg : "");
  const [showConfirm, setShowConfirm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const isDirty =
    name.trim() !== "" ||
    address.trim() !== "" ||
    mobile.trim() !== "" ||
    whatsapp.trim() !== "" ||
    email.trim() !== "" ||
    aadhar.trim() !== "" ||
    gstin.trim() !== "" ||
    pan.trim() !== "" ||
    openingBalance.trim() !== "0" ||
    openingBalanceType !== "Dr";

  function handleCancelClick() {
    if (!isDirty) {
      onCancel(); // empty form → close immediately, no dialog
      return;
    }
    setShowConfirm(true); // dirty form → blocking dialog
  }

  function handleConfirmYes() {
    setShowConfirm(false);
    // YES = "save it" → submit the form. Validation errors (if any)
    // will show in the form, form stays open.
    formRef.current?.requestSubmit();
  }

  function handleConfirmNo() {
    setShowConfirm(false);
    resetForm();
    onCancel(); // NO = "discard it" → close without saving
  }

  function resetForm() {
    setName("");
    setAddress("");
    setMobile("");
    setWhatsapp("");
    setEmail("");
    setAadhar("");
    setGstin("");
    setPan("");
    setOpeningBalance("0");
    setOpeningBalanceType("Dr");
    setErrors(emptyErrors);
    setSubmitted(false);
  }

  function validateAll(next: {
    name: string;
    address: string;
    mobile: string;
    whatsapp: string;
    email: string;
    aadhar: string;
    gstin: string;
    pan: string;
    openingBalance: string;
    openingBalanceType: string;
  }): AccountErrors {
    return {
      name: getAccountNameError(next.name),
      address: getAccountAddressError(next.address),
      mobile: getMobileError(next.mobile, "Mobile"),
      whatsapp: getMobileError(next.whatsapp, "WhatsApp"),
      email: getEmailError(next.email),
      aadhar: getAccountAadharError(next.aadhar),
      gstin: getAccountGstError(next.gstin),
      pan: getAccountPanError(next.pan),
      openingBalance: getAccountOpeningBalanceError(next.openingBalance),
      openingBalanceType: getAccountTypeError(next.openingBalanceType),
    };
  }

  function handleChange(field: string, value: string) {
    // Sanitize while typing — same rules as validation.ts expects.
    if (field === "mobile" || field === "whatsapp") value = value.replace(/[^0-9]/g, "");
    if (field === "aadhar") value = value.replace(/[^0-9]/g, "");
    if (field === "openingBalance") value = value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
    if (field === "pan") value = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (field === "gstin") value = value.toUpperCase().replace(/[^A-Z0-9]/g, "");

    // WhatsApp mirrors Mobile until user edits WhatsApp by hand.

    if (field === "name") setName(value);
    if (field === "address") setAddress(value);
    if (field === "gstin") setGstin(value);
    if (field === "pan") setPan(value);
    if (field === "mobile") {
      setMobile(value);
      setWhatsapp(value);
    }
    if (field === "whatsapp") setWhatsapp(value);
    if (field === "email") setEmail(value);
    if (field === "aadhar") setAadhar(value);
    if (field === "openingBalance") setOpeningBalance(value);
    if (field === "openingBalanceType") setOpeningBalanceType(value);

    // After submit, re-validate all fields from new value. Single setErrors.
    if (submitted) {
      const next = {
        name: field === "name" ? value : name,
        address: field === "address" ? value : address,
        mobile: field === "mobile" ? value : mobile,
        whatsapp: field === "whatsapp" ? value : field === "mobile" ? value : whatsapp,
        email: field === "email" ? value : email,
        aadhar: field === "aadhar" ? value : aadhar,
        gstin: field === "gstin" ? value : gstin,
        pan: field === "pan" ? value : pan,
        openingBalance: field === "openingBalance" ? value : openingBalance,
        openingBalanceType: field === "openingBalanceType" ? value : openingBalanceType,
      };
      setErrors(validateAll(next));
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return; // double-submit guard, same as register
    const form = e.currentTarget;
    const nextErrors = validateAll({
      name,
      address,
      mobile,
      whatsapp,
      email,
      aadhar,
      gstin,
      pan,
      openingBalance,
      openingBalanceType,
    });
    setErrors(nextErrors);
    setSubmitted(true);
    if (Object.values(nextErrors).some(Boolean)) {
      setTimeout(() => {
        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      }, 0);
      return;
    }
    const payload = {
      name: name.trim(),
      address: address.trim(),
      mobile: mobile.trim(),
      whatsapp: whatsapp.trim(),
      email: email.trim() || null,
      aadhar: aadhar.trim() || null,
      gstin: gstin.trim().toUpperCase() || null,
      pan: pan.trim().toUpperCase() || null,
      openingBalance: openingBalance.trim() === "" ? "0" : openingBalance.trim(),
      openingBalanceType: openingBalanceType.trim(),
      storenumber: storenumber,
    };

    setSaving(true);

    try {
      const data = await postJson("/accounts", payload);
      onToast("Account saved successfully", "success");
      onSave(data);
      resetForm();
      setTimeout(() => {
        form.querySelector<HTMLElement>("#acc-name")?.focus();
      }, 0);
    } catch (err) {
      onToast(getApiErrorMessage(err), "error");
      if (getApiErrorStatus(err) === 401) onSessionExpired();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="account-page">
      <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleEnterAsTab} noValidate>
        <div className="account-grid">
          {/* Col 1 — General */}
          <fieldset className="account-column">
            <legend className="account-legend">General Details</legend>
            <Field
              id="acc-name"
              label="Name"
              value={name}
              onChange={(value) => handleChange("name", value)}
              error={shown(errors.name)}
              required
              autoFocus
              submitted={submitted}
            />
            <Field
              id="acc-address"
              label="Address"
              as="textarea"
              rows={4}
              value={address}
              onChange={(value) => handleChange("address", value)}
              error={shown(errors.address)}
              required
              hint="Shift+Enter : Next line"
              submitted={submitted}
            />
            <Field
              id="acc-gstin"
              label="GSTIN/UIN Number"
              value={gstin}
              onChange={(value) => handleChange("gstin", value)}
              error={shown(errors.gstin)}
              maxLength={15}
              submitted={submitted}
            />

            <Field
              id="acc-pan"
              label="PAN Number"
              value={pan}
              onChange={(value) => handleChange("pan", value)}
              error={shown(errors.pan)}
              maxLength={10}
              submitted={submitted}
            />
          </fieldset>

          {/* Col 2 — Contact */}
          <fieldset className="account-column">
            <legend className="account-legend">Contact Details</legend>
            <Field
              id="acc-mobile"
              label="Mobile"
              value={mobile}
              onChange={(value) => handleChange("mobile", value)}
              error={shown(errors.mobile)}
              required
              autoComplete="tel"
              inputMode="numeric"
              maxLength={10}
              submitted={submitted}
            />
            <Field
              id="acc-whatsapp"
              label="WhatsApp"
              value={whatsapp}
              onChange={(value) => handleChange("whatsapp", value)}
              error={shown(errors.whatsapp)}
              required
              autoComplete="tel"
              inputMode="numeric"
              maxLength={10}
              submitted={submitted}
            />
            <Field
              id="acc-email"
              label="Email"
              type="email"
              value={email}
              onChange={(value) => handleChange("email", value)}
              error={shown(errors.email)}
              autoComplete="email"
              submitted={submitted}
            />
            <Field
              id="acc-aadhar"
              label="Aadhar No."
              value={aadhar}
              onChange={(value) => handleChange("aadhar", value)}
              error={shown(errors.aadhar)}
              inputMode="numeric"
              maxLength={12}
              submitted={submitted}
            />
            <div className="account-opening-row">
              <Field
                id="acc-opening"
                label="Opening Balance"
                value={openingBalance}
                onChange={(value) => handleChange("openingBalance", value)}
                error={shown(errors.openingBalance)}
                required
                inputMode="numeric"
                selectOnFocus
                submitted={submitted}
              />
              <Field
                id="acc-type"
                label="Type"
                as="select"
                options={["Dr", "Cr"]}
                value={openingBalanceType}
                onChange={(value) => handleChange("openingBalanceType", value)}
                error={shown(errors.openingBalanceType)}
                required
                submitted={submitted}
              />
            </div>
          </fieldset>
        </div>

        <div className="actions">
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
          <button type="button" className="secondary-button" onClick={handleCancelClick} disabled={saving}>
            Cancel
          </button>
        </div>
      </form>
      {showConfirm && (
        <ConfirmDialog
          title="Save Changes"
          message="Do you want to save changes?"
          yesLabel="YES"
          noLabel="NO"
          onYes={handleConfirmYes}
          onNo={handleConfirmNo}
        />
      )}
    </div>
  );
}
