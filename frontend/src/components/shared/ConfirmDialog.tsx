// src/components/shared/ConfirmDialog.tsx
import "./ConfirmDialog.css";

type Props = {
  title: string; // header, e.g. "Save Changes"
  message: string; // body, e.g. "Do you want to save changes?"
  yesLabel?: string; // default "YES"
  noLabel?: string; // default "NO"
  onYes: () => void;
  onNo: () => void;
};

export default function ConfirmDialog({ title, message, yesLabel = "YES", noLabel = "NO", onYes, onNo }: Props) {
  return (
    <div className="confirm-overlay" role="presentation">
      <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className="confirm-header">
          <h3 id="confirm-title">{title}</h3>
        </div>
        <div className="confirm-body">
          <p>{message}</p>
        </div>
        <div className="confirm-footer">
          <button type="button" id="confirm-yes" className="primary-button" onClick={onYes} autoFocus>
            {yesLabel}
          </button>
          <button type="button" className="secondary-button" onClick={onNo}>
            {noLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
