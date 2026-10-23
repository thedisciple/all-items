"use client";

const collectionIcons = ["🙂", "⭐", "🎁", "🛠️", "🏠", "🌿", "📷", "📚", "🎨", "📦"] as const;

export function CollectionEmojiField({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <div className="collection-emoji-field"><label className="field"><span>{label}</span><input name="icon" value={value} onChange={(event) => onChange(event.target.value)} maxLength={32} required={required} placeholder="🙂" autoComplete="off"/></label>
    <div className="collection-emoji-palette" role="group" aria-label={label}>{collectionIcons.map((emoji) => <button key={emoji} type="button" className="collection-emoji-choice" aria-label={emoji} aria-pressed={value === emoji} onClick={() => onChange(emoji)}>{emoji}</button>)}</div>
  </div>;
}
