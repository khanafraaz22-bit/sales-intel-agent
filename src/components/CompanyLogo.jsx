import { useState } from "react";
import { motion } from "framer-motion";

// Clearbit's free logo API was shut down Dec 2025, so we use working sources:
//  1. logo.dev   — closest Clearbit successor (needs a public token; free tier)
//  2. Google favicon service — no key, always available, real brand mark
//  3. DuckDuckGo icon service — no key, decent coverage
//  4. monogram fallback — if all fail
// Sources are tried in order via onError chaining.

function guessDomain(name) {
  if (!name) return null;
  const cleaned = name
    .toLowerCase()
    .replace(/\b(inc|corp|corporation|ltd|llc|plc|co|group|technologies|technology|holdings|the|company|limited)\b/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
  return cleaned ? `${cleaned}.com` : null;
}

// Optional: if you sign up at logo.dev (free), put your PUBLIC token here to get
// higher-quality logos. Leave empty to skip logo.dev and use the keyless sources.
const LOGO_DEV_TOKEN = "";

function logoCandidates(name) {
  const domain = guessDomain(name);
  if (!domain) return [];
  const urls = [];
  if (LOGO_DEV_TOKEN) {
    urls.push(`https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}&size=128&format=png`);
  }
  // Keyless, always-on sources:
  urls.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`);
  urls.push(`https://icons.duckduckgo.com/ip3/${domain}.ico`);
  return urls;
}

function initials(name) {
  if (!name) return "?";
  const words = name.replace(/[^a-zA-Z0-9 ]/g, " ").trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export default function CompanyLogo({ name, size = 64 }) {
  const candidates = logoCandidates(name);
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);

  const showLogo = !failed && candidates.length > 0 && idx < candidates.length;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border"
      style={{ width: size, height: size, background: "var(--surface)", borderColor: "var(--border)" }}
    >
      {showLogo ? (
        <img
          key={candidates[idx]}
          src={candidates[idx]}
          alt={`${name} logo`}
          width={size - 20}
          height={size - 20}
          className="object-contain"
          onError={() => {
            if (idx + 1 < candidates.length) setIdx(idx + 1);
            else setFailed(true);
          }}
        />
      ) : (
        <span className="font-display font-bold" style={{ fontSize: size * 0.32, color: "var(--teal)" }}>
          {initials(name)}
        </span>
      )}
    </motion.div>
  );
}
