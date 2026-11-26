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
import { postJson, putJson, getApiErrorStatus, getApiErrorMessage } from "../../lib/api";
import "./AccountForm.css";
import type { ToastVariant } from "../../types";

type Props = {
  initialAccount?: {
    id: number;
    name: string;
    address: string;
    mobile: string;
    whatsapp: string;
    email: string | null;
    aadhar: string | null;
    gstin: string | null;
    pan: string | null;
    openingBalance: string;
    openingBalanceType: string;
  };
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

export default function AccountForm({ initialAccount, onCancel, onToast, storenumber, onSessionExpired }: Props) {
  const isEditing = Boolean(initialAccount?.id);

  // FIX 1: state starts from initialAccount, not "". Edit opens pre-filled.
  const [name, setName] = useState(initialAccount?.name ?? "");
  const [address, setAddress] = useState(initialAccount?.address ?? "");
  const [mobile, setMobile] = useState(initialAccount?.mobile ?? "");
  const [whatsapp, setWhatsapp] = useState(initialAccount?.whatsapp ?? "");
  const [email, setEmail] = useState(initialAccount?.email ?? "");
  const [aadhar, setAadhar] = useState(initialAccount?.aadhar ?? "");
  const [gstin, setGstin] = useState(initialAccount?.gstin ?? "");
  const [pan, setPan] = useState(initialAccount?.pan ?? "");
  const [openingBalance, setOpeningBalance] = useState(initialAccount?.openingBalance ?? "0");
  const [openingBalanceType, setOpeningBalanceType] = useState(initialAccount?.openingBalanceType ?? "Dr");
  const [errors, setErrors] = useState<AccountErrors>(emptyErrors);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const shown = (msg: string) => (submitted ? msg : "");
  const [showConfirm, setShowConfirm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [base, setBase] = useState({
    name: initialAccount?.name ?? "",
    address: initialAccount?.address ?? "",
    mobile: initialAccount?.mobile ?? "",
    whatsapp: initialAccount?.whatsapp ?? "",
    email: initialAccount?.email ?? "",
    aadhar: initialAccount?.aadhar ?? "",
    gstin: initialAccount?.gstin ?? "",
    pan: initialAccount?.pan ?? "",
    openingBalance: initialAccount?.openingBalance ?? "0",
    openingBalanceType: initialAccount?.openingBalanceType ?? "Dr",
  });

  const isDirty =
    name !== base.name ||
    address !== base.address ||
    mobile !== base.mobile ||
    whatsapp !== base.whatsapp ||
    email !== base.email ||
    aadhar !== base.aadhar ||
    gstin !== base.gstin ||
    pan !== base.pan ||
    openingBalance !== base.openingBalance ||
    openingBalanceType !== base.openingBalanceType;

  function handleCancelClick() {
    if (!isDirty) {
      onCancel();
      return;
    }
    setShowConfirm(true);
  }

  function handleConfirmYes() {
    setShowConfirm(false);
    formRef.current?.requestSubmit();
  }

  function handleConfirmNo() {
    setShowConfirm(false);
    resetForm();
    onCancel();
  }

  // FIX 3: reset goes back to base (initial values in Edit, empty in New),
  // not always to empty. Otherwise Discard in Edit would blank the form.
  function resetForm() {
    setName(base.name);
    setAddress(base.address);
    setMobile(base.mobile);
    setWhatsapp(base.whatsapp);
    setEmail(base.email);
    setAadhar(base.aadhar);
    setGstin(base.gstin);
    setPan(base.pan);
    setOpeningBalance(base.openingBalance);
    setOpeningBalanceType(base.openingBalanceType);
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
    if (field === "mobile" || field === "whatsapp") value = value.replace(/[^0-9]/g, "");
    if (field === "aadhar") value = value.replace(/[^0-9]/g, "");
    if (field === "openingBalance") {
      value = value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
      if (value.includes(".")) {
        const [intPart, decPart] = value.split(".");
        value = intPart + "." + decPart.slice(0, 2); // still cap decimals at 2
      }

      if (value !== "" && value !== "." && Number(value) > 9999999999.99) {
        return; // ignore this keystroke / paste, keep previous value
      }
    }
    if (field === "pan") value = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (field === "gstin") value = value.toUpperCase().replace(/[^A-Z0-9]/g, "");

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
    if (saving) return;
    if (!isDirty) {
      onToast("No changes to update", "info");
      return;
    }
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
      isEditing ? await putJson(`/accounts/${initialAccount!.id}`, payload) : await postJson("/accounts", payload);
      onToast(isEditing ? "Account updated successfully" : "Account saved successfully", "success");
      if (isEditing) {
        setBase({
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
      } else resetForm();

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
          <button type="submit" className={`primary-button ${saving ? "is-saving" : ""}`} disabled={saving || !isDirty}>
            {isEditing ? "Update" : "Save"}
          </button>
          <button
            type="button"
            className={`secondary-button ${saving ? "is-saving" : ""}`}
            onClick={handleCancelClick}
            disabled={saving}>
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
