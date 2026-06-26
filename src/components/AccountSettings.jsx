import { useState } from "react";
import { motion } from "framer-motion";

export default function AccountSettings({ auth, groq, onClose }) {
  const [username, setUsername] = useState(auth.username || "");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // {type, text}

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  // Groq key management (browser-side, per device).
  const [keyInput, setKeyInput] = useState("");
  const hasKey = Boolean(groq?.hasKey);

  const flash = (type, text) => setMsg({ type, text });

  const saveGroqKey = () => {
    const v = keyInput.trim();
    if (v.length < 20) { flash("error", "That doesn't look like a valid Groq key (should start with gsk_)."); return; }
    groq.setGroqKey(v);
    setKeyInput("");
    flash("success", "Groq key saved on this device.");
  };

  const removeGroqKey = () => {
    groq.clearGroqKey();
    setKeyInput("");
    flash("success", "Groq key removed from this device.");
  };

  const saveUsername = async () => {
    if (!username.trim() || username.trim().length < 2) { flash("error", "Username must be at least 2 characters."); return; }
    setBusy(true);
    const { error } = await auth.updateUsername(username.trim());
    setBusy(false);
    flash(error ? "error" : "success", error ? error.message : "Username updated.");
  };

  const savePassword = async () => {
    if (newPassword.length < 8) { flash("error", "New password must be at least 8 characters."); return; }
    setBusy(true);
    const { error } = await auth.updatePassword(newPassword);
    setBusy(false);
    if (error) flash("error", error.message);
    else { flash("success", "Password changed."); setNewPassword(""); }
  };

  const doDelete = async () => {
    if (!deletePassword) { flash("error", "Enter your password to confirm deletion."); return; }
    setBusy(true);
    const { error } = await auth.deleteAccount(deletePassword);
    setBusy(false);
    if (error) flash("error", error.message);
    // On success, the auth state change signs them out and the modal unmounts.
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "color-mix(in srgb, var(--bg) 75%, transparent)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 160, damping: 22 }}
        className="card relative w-full max-w-md p-8"
        style={{ background: "color-mix(in srgb, var(--surface) 92%, transparent)", backdropFilter: "blur(14px)" }}>
        <button onClick={onClose} className="absolute right-4 top-4 text-lg ink-faint transition hover:text-teal" aria-label="Close">✕</button>

        <div className="eyebrow" style={{ color: "var(--teal)" }}>Account Settings</div>
        <h1 className="font-display mt-2 text-2xl font-bold ink">{auth.fullName || auth.username}</h1>
        <p className="text-body mt-1 text-sm ink-faint">{auth.user?.email}</p>

        {msg && (
          <div className="mt-4 rounded-lg p-3 text-sm"
            style={{ background: msg.type === "error" ? "var(--red-soft)" : "var(--green-soft)", color: msg.type === "error" ? "var(--red)" : "var(--green)" }}>
            {msg.text}
          </div>
        )}

        {/* Username */}
        <div className="mt-6">
          <label className="eyebrow">Username</label>
          <div className="mt-1 flex gap-2">
            <input value={username} onChange={(e) => setUsername(e.target.value)}
              className="flex-1 rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none ink"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)" }} />
            <button onClick={saveUsername} disabled={busy}
              className="font-mono rounded-lg px-4 text-xs font-semibold uppercase tracking-wide disabled:opacity-50"
              style={{ background: "var(--teal)", color: "var(--bg)" }}>Save</button>
          </div>
        </div>

        {/* Password */}
        <div className="mt-4">
          <label className="eyebrow">New Password</label>
          <div className="mt-1 flex gap-2">
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="flex-1 rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none ink"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)" }} />
            <button onClick={savePassword} disabled={busy || !newPassword}
              className="font-mono rounded-lg px-4 text-xs font-semibold uppercase tracking-wide disabled:opacity-50"
              style={{ background: "var(--teal)", color: "var(--bg)" }}>Change</button>
          </div>
        </div>

        {/* Groq API key (browser-side, per device) */}
        <div className="mt-4">
          <label className="eyebrow">Groq API Key</label>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: hasKey ? "var(--green)" : "var(--red)" }} />
              <span className="ink-soft">{hasKey ? "Key saved on this device" : "No key on this device"}</span>
            </div>
            {hasKey && (
              <button onClick={removeGroqKey} disabled={busy}
                className="font-mono rounded-lg border px-4 py-2.5 text-xs uppercase tracking-wide transition disabled:opacity-50"
                style={{ borderColor: "var(--red)", color: "var(--red)" }}>Remove</button>
            )}
          </div>
          <div className="mt-2 flex gap-2">
            <input type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveGroqKey()}
              placeholder={hasKey ? "Paste a new key to replace it" : "gsk_..."}
              className="flex-1 rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none ink"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)" }} />
            <button onClick={saveGroqKey} disabled={busy || !keyInput}
              className="font-mono rounded-lg px-4 text-xs font-semibold uppercase tracking-wide disabled:opacity-50"
              style={{ background: "var(--teal)", color: "var(--bg)" }}>{hasKey ? "Update" : "Save"}</button>
          </div>
          <p className="mt-1.5 text-xs ink-faint">
            Stored only in this browser, never on our servers. Get a free key at{" "}
            <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="underline" style={{ color: "var(--teal)" }}>console.groq.com/keys</a>.
          </p>
        </div>

        {/* Danger zone */}
        <div className="mt-6 rounded-xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--red) 40%, transparent)" }}>
          <div className="eyebrow" style={{ color: "var(--red)" }}>Danger Zone</div>
          {!confirmingDelete ? (
            <>
              <p className="text-body mt-2 text-sm ink-soft">Permanently delete your account and all saved reports. This cannot be undone.</p>
              <button onClick={() => { setConfirmingDelete(true); setMsg(null); }}
                className="font-mono mt-3 rounded-lg border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition"
                style={{ borderColor: "var(--red)", color: "var(--red)" }}>Delete account</button>
            </>
          ) : (
            <>
              <p className="text-body mt-2 text-sm ink-soft">Enter your password to confirm. This is permanent.</p>
              <input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Your password"
                className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none ink"
                style={{ borderColor: "var(--red)", background: "var(--surface-2)" }} />
              <div className="mt-3 flex gap-2">
                <button onClick={doDelete} disabled={busy}
                  className="font-mono rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wide disabled:opacity-50"
                  style={{ background: "var(--red)", color: "#fff" }}>{busy ? "Deleting…" : "Permanently delete"}</button>
                <button onClick={() => { setConfirmingDelete(false); setDeletePassword(""); }}
                  className="font-mono rounded-lg border px-4 py-2 text-xs uppercase tracking-wide ink-soft"
                  style={{ borderColor: "var(--border)" }}>Cancel</button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}