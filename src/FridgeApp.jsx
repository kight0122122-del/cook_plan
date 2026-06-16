import { useState, useEffect, useRef, Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("Tab render error:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontWeight: 700, color: "#333", marginBottom: 8 }}>表示エラーが発生しました</div>
          <div style={{ fontSize: 13, color: "#999", marginBottom: 20 }}>{String(this.state.error)}</div>
          <button onClick={() => this.setState({ error: null })} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "#2E7D5A", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
            再試行
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const STORAGE_KEY = "fridge-ingredients";
const SUGGEST_COUNT_KEY = "fridge-suggest-count";
const HISTORY_KEY = "fridge-history";
const SEASONING_KEY = "fridge-seasonings";
const FREE_LIMIT = Infinity;

const PRESET_SEASONINGS = [
  { group: "基本", items: ["塩", "砂糖", "醤油", "みりん", "酒", "酢", "味噌"] },
  { group: "油", items: ["サラダ油", "ごま油", "オリーブオイル", "バター"] },
  { group: "だし・スープ", items: ["だしの素", "コンソメ", "鶏がらスープの素", "白だし"] },
  { group: "ソース・タレ", items: ["ウスターソース", "ケチャップ", "マヨネーズ", "ポン酢", "めんつゆ", "オイスターソース"] },
  { group: "スパイス", items: ["胡椒", "七味唐辛子", "にんにく（チューブ）", "生姜（チューブ）", "ごま"] },
];

const categoryEmoji = {
  野菜: "🥬", 肉: "🥩", 魚: "🐟", 乳製品: "🧀", 卵: "🥚",
  穀物: "🍚", 麺類: "🍜", 果物: "🍎", 飲み物: "🥤", その他: "🧴",
};

const CATEGORIES = Object.keys(categoryEmoji);
const UNITS = ["個", "本", "枚", "袋", "パック", "g", "kg", "ml", "L", "束", "缶", "箱"];

const DEFAULT_SHELF_DAYS = {
  肉: 3, 魚: 2, 野菜: 7, 乳製品: 7, 卵: 21,
  果物: 5, 穀物: 180, 麺類: 365, 飲み物: 30, その他: 7,
};

const FROZEN_SHELF_DAYS = {
  肉: 30, 魚: 30, 野菜: 30, 乳製品: 30, 卵: 60,
  果物: 30, 穀物: 365, 麺類: 365, 飲み物: 60, その他: 30,
};

function calcExpiryDate(category, frozen = false) {
  const table = frozen ? FROZEN_SHELF_DAYS : DEFAULT_SHELF_DAYS;
  const days = table[category] ?? 7;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function getCategoryEmoji(category) {
  return categoryEmoji[category] || "🍱";
}

async function callClaude(messages, systemPrompt) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, systemPrompt }),
  });
  const data = await response.json();
  return data.content.map(b => b.text || "").join("");
}

const SERVING_OPTIONS = [
  { value: 1, label: "1人分", emoji: "🧑" },
  { value: 2, label: "2人分", emoji: "👫" },
  { value: 4, label: "4人分", emoji: "👨‍👩‍👧‍👦" },
];

const EFFORT_OPTIONS = [
  { value: "quick", label: "ササっと", emoji: "⚡", desc: "15分以内" },
  { value: "normal", label: "ふつう", emoji: "🙂", desc: "30〜45分" },
  { value: "weekend", label: "じっくり", emoji: "👨‍🍳", desc: "1時間以上" },
];

const MEAL_OPTIONS = [
  { value: "なんでも", label: "なんでも", emoji: "🍱" },
  { value: "和食", label: "和食", emoji: "🍜" },
  { value: "洋食", label: "洋食", emoji: "🍝" },
  { value: "中華", label: "中華", emoji: "🥡" },
  { value: "丼もの", label: "丼もの", emoji: "🍚" },
  { value: "スープ", label: "スープ", emoji: "🍲" },
];

function ChoiceChip({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: "8px 14px", borderRadius: 24, border: "1.5px solid",
            borderColor: value === opt.value ? "#2E7D5A" : "#E8E8E8",
            background: value === opt.value ? "#E8F5EE" : "#fff",
            color: value === opt.value ? "#2E7D5A" : "#666",
            fontWeight: value === opt.value ? 700 : 500,
            fontSize: 13, cursor: "pointer", transition: "all 0.15s",
            display: "flex", alignItems: "center", gap: 5,
          }}
        >
          <span>{opt.emoji}</span>
          <span>{opt.label}</span>
          {opt.desc && <span style={{ fontSize: 11, opacity: 0.7 }}>({opt.desc})</span>}
        </button>
      ))}
    </div>
  );
}

function AdPlaceholder() {
  return null;
}

function LoginModal({ onClose }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "flex-end", zIndex: 2000,
    }}>
      <div style={{
        background: "#fff", borderRadius: "24px 24px 0 0", width: "100%",
        padding: "32px 24px 40px", maxWidth: 480, margin: "0 auto",
      }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#1A1A1A", marginBottom: 8 }}>
            無料枠を使い切りました
          </div>
          <div style={{ fontSize: 14, color: "#666", lineHeight: 1.7 }}>
            引き続き料理提案を使うには<br />
            アカウント登録（無料）が必要です
          </div>
        </div>

        <button style={{ ...primaryBtn, marginBottom: 12 }}>
          Googleでログイン
        </button>
        <button style={{ ...primaryBtn, background: "#1A1A1A", marginBottom: 12 }}>
          メールアドレスで登録
        </button>
        <button
          onClick={onClose}
          style={{ width: "100%", padding: 14, border: "none", background: "none", color: "#AAA", fontSize: 14, cursor: "pointer" }}
        >
          あとで
        </button>

        <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: "#BBB" }}>
          ※ 登録後は無制限で利用できます。広告は表示されます。
        </div>
      </div>
    </div>
  );
}

function AddIngredientModal({ onAdd, onClose, initial = null }) {
  const [name, setName] = useState(initial?.name || "");
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : "1");
  const [unit, setUnit] = useState(initial?.unit || "個");
  const [category, setCategory] = useState(initial?.category || "その他");
  const [frozen, setFrozen] = useState(initial?.frozen || false);
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate || calcExpiryDate(initial?.category || "その他", initial?.frozen || false));
  const isEdit = !!initial;

  function handleCategoryChange(cat) {
    setCategory(cat);
    setExpiryDate(calcExpiryDate(cat, frozen));
  }

  function handleFrozenChange(val) {
    setFrozen(val);
    setExpiryDate(calcExpiryDate(category, val));
  }

  function getInputStep(u) {
    if (["g", "ml"].includes(u)) return 100;
    if (["kg", "L"].includes(u)) return 0.1;
    return 0.1;
  }

  function getInputDefaultQty(u) {
    if (["g", "ml"].includes(u)) return "100";
    if (["kg", "L"].includes(u)) return "0.1";
    return "1";
  }

  function handleUnitChange(u) {
    setUnit(u);
    setQuantity(getInputDefaultQty(u));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const qty = parseFloat(quantity);
    if (!name.trim() || isNaN(qty) || qty <= 0) return;
    const item = {
      name: name.trim(), quantity: qty, unit, category, frozen,
      addedAt: initial?.addedAt || new Date().toISOString().split("T")[0],
      expiryDate: expiryDate || null,
      urgent: initial?.urgent || false,
    };
    onAdd(item, initial?.name);
  }

  const inputStyle = {
    width: "100%", padding: "10px 12px", border: "1.5px solid #E8E8E8",
    borderRadius: 10, fontSize: 14, boxSizing: "border-box",
    outline: "none", color: "#1A1A1A",
  };

  const selectStyle = { ...inputStyle, background: "#fff", cursor: "pointer" };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "flex-end", zIndex: 2000,
    }}>
      <div style={{
        background: "#fff", borderRadius: "24px 24px 0 0", width: "100%",
        padding: "28px 24px 40px", maxWidth: 480, margin: "0 auto",
      }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: "#1A1A1A", marginBottom: 20 }}>
          {isEdit ? "✏️ 食材を編集" : "✏️ 食材を手動追加"}
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>食材名</label>
            <input
              style={inputStyle}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例：鶏もも肉"
              autoFocus
            />
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>数量</label>
              <input
                style={inputStyle}
                type="number"
                min="0"
                step={getInputStep(unit)}
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>単位</label>
              <select style={selectStyle} value={unit} onChange={e => handleUnitChange(e.target.value)}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>カテゴリ</label>
            <select style={selectStyle} value={category} onChange={e => handleCategoryChange(e.target.value)}>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{getCategoryEmoji(c)} {c}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 14 }}>
            <button
              type="button"
              onClick={() => handleFrozenChange(!frozen)}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                border: `1.5px solid ${frozen ? "#6BAED6" : "#E8E8E8"}`,
                background: frozen ? "#EEF6FC" : "#F9F9F9",
                color: frozen ? "#2171B5" : "#AAA",
                fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8,
              }}
            >
              <span>❄️</span>
              <span>{frozen ? "冷凍保存中" : "冷凍保存（タップで切り替え）"}</span>
            </button>
          </div>
          <div style={{ marginBottom: 22 }}>
            <label style={labelStyle}>賞味期限 <span style={{ fontWeight: 400, color: "#BBB" }}>（カテゴリ・冷凍設定から自動計算・変更可）</span></label>
            <input
              style={inputStyle}
              type="date"
              value={expiryDate}
              onChange={e => setExpiryDate(e.target.value)}
            />
          </div>
          <button type="submit" style={primaryBtn} disabled={!name.trim()}>
            {isEdit ? "保存する" : "追加する"}
          </button>
        </form>
        <button onClick={onClose} style={{ width: "100%", padding: 14, border: "none", background: "none", color: "#AAA", fontSize: 14, cursor: "pointer", marginTop: 8 }}>
          キャンセル
        </button>
      </div>
    </div>
  );
}

function ExpiryBadge({ item }) {
  const today = new Date();
  if (item.urgent) return <div style={{ fontSize: 11, color: "#FF4444", fontWeight: 700, marginTop: 2 }}>🚨 早く使いたい</div>;
  if (item.frozen) return <div style={{ fontSize: 11, color: "#2171B5", fontWeight: 600, marginTop: 2 }}>❄️ 冷凍保存中</div>;
  if (item.expiryDate) {
    const days = Math.ceil((new Date(item.expiryDate) - today) / 86400000);
    if (days <= 0) return <div style={{ fontSize: 11, color: "#FF4444", fontWeight: 700, marginTop: 2 }}>⚠️ 期限切れ</div>;
    if (days <= 1) return <div style={{ fontSize: 11, color: "#FF4444", fontWeight: 700, marginTop: 2 }}>⚠️ 今日まで</div>;
    if (days <= 3) return <div style={{ fontSize: 11, color: "#FF8C00", fontWeight: 600, marginTop: 2 }}>⚠️ あと{days}日</div>;
    return <div style={{ fontSize: 11, color: "#AAA", marginTop: 2 }}>期限 {item.expiryDate}</div>;
  }
  if (item.addedAt) {
    const days = Math.ceil((today - new Date(item.addedAt)) / 86400000);
    if (days >= 7) return <div style={{ fontSize: 11, color: "#FF8C00", fontWeight: 600, marginTop: 2 }}>📅 登録から{days}日</div>;
    if (days > 0) return <div style={{ fontSize: 11, color: "#BBB", marginTop: 2 }}>📅 {days}日前に登録</div>;
  }
  return null;
}

const labelStyle = { fontSize: 12, fontWeight: 700, color: "#999", display: "block", marginBottom: 6 };

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return isMobile;
}

export default function FridgeApp() {
  const isMobile = useIsMobile();
  const [fridge, setFridge] = useState([]);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState("fridge");
  const [scanning, setScanning] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [toast, setToast] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [suggestCount, setSuggestCount] = useState(0);

  const [servings, setServings] = useState(2);
  const [effort, setEffort] = useState("normal");
  const [mealType, setMealType] = useState("なんでも");
  const [showPrefs, setShowPrefs] = useState(true);
  const [seasonings, setSeasonings] = useState({});
  const [customSeasoningInput, setCustomSeasoningInput] = useState("");

  const fileRef = useRef();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setFridge(JSON.parse(stored));
      const count = parseInt(localStorage.getItem(SUGGEST_COUNT_KEY) || "0", 10);
      setSuggestCount(count);
      const hist = localStorage.getItem(HISTORY_KEY);
      if (hist) setHistory(JSON.parse(hist));
      const seas = localStorage.getItem(SEASONING_KEY);
      if (seas) setSeasonings(JSON.parse(seas));
    } catch {}
  }, []);

  function saveFridge(items) {
    setFridge(items);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
  }

  function incrementSuggestCount() {
    const next = suggestCount + 1;
    setSuggestCount(next);
    try { localStorage.setItem(SUGGEST_COUNT_KEY, String(next)); } catch {}
    return next;
  }

  function saveSeasonings(next) {
    setSeasonings(next);
    try { localStorage.setItem(SEASONING_KEY, JSON.stringify(next)); } catch {}
  }

  function toggleSeasoning(name) {
    saveSeasonings({ ...seasonings, [name]: !seasonings[name] });
  }

  function addCustomSeasoning() {
    const name = customSeasoningInput.trim();
    if (!name) return;
    saveSeasonings({ ...seasonings, [name]: true });
    setCustomSeasoningInput("");
  }

  function removeCustomSeasoning(name) {
    const next = { ...seasonings };
    delete next[name];
    saveSeasonings(next);
  }

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function removeIngredient(name) {
    saveFridge(fridge.filter(i => i.name !== name));
  }

  function toggleUrgent(name) {
    saveFridge(fridge.map(i => i.name === name ? { ...i, urgent: !i.urgent } : i));
  }

  function getStep(unit) {
    if (["g", "ml"].includes(unit)) return 50;
    if (["kg", "L"].includes(unit)) return 0.1;
    return 1;
  }

  function adjustQty(name, direction) {
    const updated = fridge.map(i => {
      if (i.name !== name) return i;
      const step = getStep(i.unit);
      const newQty = Math.max(0, Math.round((i.quantity + direction * step) * 10) / 10);
      return { ...i, quantity: newQty };
    });
    saveFridge(updated);
  }

  function handleAddIngredient(item, originalName = null) {
    let updated = [...fridge];
    if (originalName) {
      updated = updated.map(i => i.name === originalName ? { ...item } : i);
      saveFridge(updated);
      setEditingItem(null);
      showToast(`${item.name}を更新しました！`);
    } else {
      const existing = updated.find(i => i.name === item.name);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        updated.push(item);
      }
      saveFridge(updated);
      setShowAddModal(false);
      showToast(`${item.name}を追加しました！`);
    }
  }

  async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImagePreview(URL.createObjectURL(file));
    setScanResult(null);
    setScanning(true);

    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });

      const mediaType = file.type || "image/jpeg";
      const text = await callClaude(
        [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: "このレシートまたは食品の画像から食材・食品を抽出してください。JSONのみ返してください。例: [{\"name\":\"鶏もも肉\",\"quantity\":2,\"unit\":\"枚\",\"category\":\"肉\"},{\"name\":\"牛乳\",\"quantity\":1,\"unit\":\"本\",\"category\":\"乳製品\"}]" }
          ]
        }],
        "あなたは食材認識AIです。レシートや食品画像から食材リストをJSONで返します。カテゴリは「野菜」「肉」「魚」「乳製品」「卵」「調味料」「穀物」「果物」「飲み物」「その他」のいずれかにしてください。JSONのみ返し、説明文やMarkdownは一切不要です。"
      );

      const clean = text.replace(/```json|```/g, "").trim();
      const today = new Date().toISOString().split("T")[0];
      const items = JSON.parse(clean).map(i => ({ ...i, addedAt: today, expiryDate: calcExpiryDate(i.category), urgent: false }));
      setScanResult(items);
    } catch {
      showToast("読み取りに失敗しました。別の画像を試してください。", "error");
    } finally {
      setScanning(false);
    }
  }

  async function addScannedItems() {
    if (!scanResult) return;
    setScanning(true);

    let normalizedItems = scanResult;

    if (fridge.length > 0) {
      try {
        const fridgeNames = fridge.map(i => i.name).join("、");
        const scanNames = scanResult.map(i => i.name).join("、");
        const text = await callClaude(
          [{ role: "user", content: `冷蔵庫にある食材: ${fridgeNames}\nスキャンした食材: ${scanNames}\n\n表記ゆれを考慮して、スキャンした各食材が冷蔵庫のどの食材と同じか判定してください。JSONのみ返してください。` }],
          `あなたは食材名の正規化AIです。「茨城のおいしいたまねぎ」→「たまねぎ」のように、スキャンした食材名を冷蔵庫の既存食材名に合わせて正規化します。
一致するものがない場合はスキャン時の名前をそのまま使います。
必ずJSONのみ返してください。形式: [{"scanned": "スキャン時の名前", "normalized": "正規化後の名前"}]`
        );
        const clean = text.replace(/```json|```/g, "").trim();
        const mapping = JSON.parse(clean);
        normalizedItems = scanResult.map(item => {
          const match = mapping.find(m => m.scanned === item.name);
          return match ? { ...item, name: match.normalized } : item;
        });
      } catch {
        // 失敗時はそのまま追加
      }
    }

    const updated = [...fridge];
    for (const item of normalizedItems) {
      const existing = updated.find(i => i.name === item.name);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        updated.push(item);
      }
    }
    saveFridge(updated);
    setScanResult(null);
    setImagePreview(null);
    setScanning(false);
    setTab("fridge");
    showToast(`${scanResult.length}品を冷蔵庫に追加しました！`);
  }

  async function getSuggestion() {
    if (fridge.length === 0) {
      showToast("先に食材を登録してください", "error");
      return;
    }

    const nextCount = incrementSuggestCount();
    if (nextCount > FREE_LIMIT) {
      setShowLoginModal(true);
      setSuggestCount(prev => prev); // no re-increment
      return;
    }

    setSuggesting(true);
    setSuggestion(null);
    setShowPrefs(false);

    const today = new Date();
    const fridgeText = fridge.filter(i => i.quantity > 0).map(i => {
      let info = `${i.name} ${i.quantity}${i.unit}`;
      if (i.urgent) info += `【優先：早く使いたい】`;
      if (i.frozen) info += `【冷凍保存中】`;
      if (i.expiryDate) {
        const days = Math.ceil((new Date(i.expiryDate) - today) / 86400000);
        if (days <= 0) info += `【期限切れ】`;
        else if (days <= 3) info += `【期限まで${days}日】`;
      } else if (i.addedAt) {
        const days = Math.ceil((today - new Date(i.addedAt)) / 86400000);
        if (days >= 5) info += `【登録から${days}日経過】`;
      }
      return info;
    }).join("、");
    const effortLabel = EFFORT_OPTIONS.find(e => e.value === effort)?.label;
    const effortDesc = EFFORT_OPTIONS.find(e => e.value === effort)?.desc;
    const availableSeasonings = Object.entries(seasonings).filter(([, v]) => v).map(([k]) => k);
    const seasoningText = availableSeasonings.length > 0 ? availableSeasonings.join("、") : "不明";

    try {
      const text = await callClaude(
        [{
          role: "user",
          content: `冷蔵庫の中身: ${fridgeText}

利用可能な調味料: ${seasoningText}

条件:
- 人数: ${servings}人分
- 手間: ${effortLabel}（${effortDesc}）
- ジャンル: ${mealType}

上記の条件に合った料理を1品提案してください。JSONのみ返してください。`
        }],
        `あなたは料理提案AIです。冷蔵庫の食材と指定された調味料・条件から料理を提案します。
必ずJSONのみ返してください。形式:
{
  "name": "料理名",
  "description": "一言説明",
  "cookTime": "調理時間",
  "servings": ${servings},
  "steps": ["手順1（${servings}人分の量で）", "手順2", "手順3"],
  "usedIngredients": [{"name": "食材名", "quantity": 数量, "unit": "単位"}],
  "comment": "シェフからひとこと（手間や人数に触れてもOK）"
}
・手順の量はすべて${servings}人分で記述してください
・手間レベル「${effortLabel}」に合った料理にしてください
・利用可能な調味料の範囲内でレシピを提案してください
・【優先：早く使いたい】【期限切れ】【期限まで○日】【登録から○日経過】の食材は最優先で使ってください
JSONのみ返し、説明文やMarkdownは不要です。`
      );

      const clean = text.replace(/```json|```/g, "").trim();
      setSuggestion(JSON.parse(clean));
    } catch {
      showToast("提案の取得に失敗しました", "error");
      setShowPrefs(true);
    } finally {
      setSuggesting(false);
    }
  }

  function consumeIngredients() {
    if (!suggestion) return;
    let updated = [...fridge];
    for (const used of suggestion.usedIngredients) {
      updated = updated.map(i => {
        const match = i.name === used.name
          || i.name.includes(used.name)
          || used.name.includes(i.name);
        if (!match) return i;
        return { ...i, quantity: Math.max(0, i.quantity - used.quantity) };
      });
    }
    saveFridge(updated);

    const record = {
      id: Date.now(),
      date: new Date().toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" }),
      name: suggestion.name,
      description: suggestion.description,
      cookTime: suggestion.cookTime,
      servings,
      steps: suggestion.steps,
      comment: suggestion.comment,
      usedIngredients: suggestion.usedIngredients,
    };
    const newHistory = [record, ...history].slice(0, 50);
    setHistory(newHistory);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory)); } catch {}

    setSuggestion(null);
    setShowPrefs(true);
    setTab("fridge");
    showToast("使った食材を冷蔵庫から消費しました🍳");
  }

  function resetSuggest() {
    setSuggestion(null);
    setShowPrefs(true);
  }

  const grouped = fridge.reduce((acc, item) => {
    const cat = item.category || "その他";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const remainingFree = Math.max(0, FREE_LIMIT - suggestCount);

  const tabs = [["fridge", "🗄️", "冷蔵庫"], ["scan", "📷", "スキャン"], ["suggest", "✨", "提案"], ["condiments", "🧂", "調味料"], ["history", "📖", "履歴"]];

  function switchTab(key) {
    setTab(key);
    if (key === "suggest") { setSuggestion(null); setShowPrefs(true); }
  }

  /* ---- 共通コンテンツブロック ---- */
  const fridgeContent = (
    <>
      {fridge.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#BBB" }}>
          <div style={{ fontSize: 60, marginBottom: 12 }}>🗄️</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#CCC" }}>冷蔵庫が空です</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>レシートをスキャンして食材を登録しよう</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#999", letterSpacing: 1, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <span>{getCategoryEmoji(cat)}</span> {cat.toUpperCase()}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map(item => (
                  <div key={item.name} style={{
                    background: item.quantity === 0 ? "#F9F9F9" : "#fff", borderRadius: 14, padding: "12px 16px",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                    opacity: item.quantity === 0 ? 0.7 : 1,
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: item.quantity === 0 ? "#BBB" : "#1A1A1A" }}>{item.name}</div>
                      {item.quantity === 0
                        ? <div style={{ fontSize: 12, color: "#FF6B6B", fontWeight: 700, marginTop: 2 }}>在庫切れ</div>
                        : <div style={{ fontSize: 12, color: "#AAA", marginTop: 2 }}>{item.quantity}{item.unit}</div>
                      }
                      {item.quantity > 0 && <ExpiryBadge item={item} />}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button onClick={() => adjustQty(item.name, -1)} style={btnStyle("#F5F5F5", "#666")}>−</button>
                      <div style={{ textAlign: "center", minWidth: 36 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#333" }}>{item.quantity}</div>
                        {getStep(item.unit) !== 1 && <div style={{ fontSize: 10, color: "#BBB" }}>±{getStep(item.unit)}</div>}
                      </div>
                      <button onClick={() => adjustQty(item.name, 1)} style={btnStyle("#E8F5EE", "#2E7D5A")}>＋</button>
                      <button onClick={() => toggleUrgent(item.name)} style={btnStyle(item.urgent ? "#FFF0F0" : "#F5F5F5", item.urgent ? "#FF4444" : "#CCC")} title="早く使いたい">🚨</button>
                      <button onClick={() => setEditingItem(item)} style={btnStyle("#F0F4FF", "#4A6FD4")}>✎</button>
                      <button onClick={() => removeIngredient(item.name)} style={btnStyle("#FFF0F0", "#FF6B6B")}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <button onClick={() => setShowAddModal(true)} style={{
        width: "100%", padding: "14px", border: "1.5px dashed #D4EBE0", borderRadius: 14,
        background: "#F7FBF9", color: "#2E7D5A", fontWeight: 700, fontSize: 14,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        marginTop: 16, marginBottom: 16,
      }}>
        ＋ 食材を手動で追加
      </button>
      <AdPlaceholder label="広告" />
    </>
  );

  const scanContent = (
    <div style={{ maxWidth: isMobile ? "100%" : 640, margin: "0 auto" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1A1A1A", marginBottom: 4 }}>レシートをスキャン</div>
        <div style={{ fontSize: 13, color: "#999", marginBottom: 16 }}>レシートや食材の写真を撮ると、自動で冷蔵庫に追加します</div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleImageUpload} style={{ display: "none" }} />
        <button onClick={() => fileRef.current?.click()} style={{
          width: "100%", padding: "16px", border: "2px dashed #D4EBE0", borderRadius: 12,
          background: "#F7FBF9", color: "#2E7D5A", fontWeight: 700, fontSize: 15,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8
        }}>
          <span style={{ fontSize: 24 }}>📷</span> 写真を選択 / 撮影
        </button>
      </div>
      <button onClick={() => setShowAddModal(true)} style={{
        width: "100%", padding: "14px", border: "1.5px dashed #D4EBE0", borderRadius: 14,
        background: "#F7FBF9", color: "#2E7D5A", fontWeight: 700, fontSize: 14,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        marginBottom: 16,
      }}>
        ✏️ 手動で食材を入力する
      </button>
      {imagePreview && (
        <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
          <img src={imagePreview} alt="preview" style={{ width: "100%", maxHeight: 220, objectFit: "cover" }} />
          {scanning && (
            <div style={{ padding: 20, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
              <div style={{ color: "#2E7D5A", fontWeight: 600 }}>食材を読み取り中...</div>
            </div>
          )}
        </div>
      )}
      {scanResult && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: "#1A1A1A" }}>
            🎉 {scanResult.length}品を検出しました
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {scanResult.map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#F7FBF9", borderRadius: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{getCategoryEmoji(item.category)} {item.name}</span>
                <span style={{ color: "#2E7D5A", fontWeight: 700, fontSize: 14 }}>{item.quantity}{item.unit}</span>
              </div>
            ))}
          </div>
          <button onClick={addScannedItems} style={primaryBtn}>冷蔵庫に追加する</button>
        </div>
      )}
    </div>
  );

  const suggestContent = (
    <div style={{ maxWidth: isMobile ? "100%" : 640, margin: "0 auto" }}>
      {remainingFree > 0 && remainingFree !== Infinity && !suggestion && !suggesting && (
        <div style={{
          background: "#FFF9F0", border: "1px solid #FFE0A0", borderRadius: 12,
          padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#886600",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span>⚡</span>
          <span>無料で使えるあと <strong>{remainingFree}回</strong> ／ 以降はログインが必要です</span>
        </div>
      )}
      {showPrefs && !suggesting && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#999", marginBottom: 10 }}>👥 何人分？</div>
            <ChoiceChip options={SERVING_OPTIONS} value={servings} onChange={setServings} />
          </div>
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#999", marginBottom: 10 }}>⏱ 手間は？</div>
            <ChoiceChip options={EFFORT_OPTIONS} value={effort} onChange={setEffort} />
          </div>
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", gridColumn: isMobile ? "1" : "1 / -1" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#999", marginBottom: 10 }}>🍱 食べたいジャンル</div>
            <ChoiceChip options={MEAL_OPTIONS} value={mealType} onChange={setMealType} />
          </div>
        </div>
      )}
      {showPrefs && !suggesting && (
        <button onClick={getSuggestion} style={primaryBtn}>この条件で提案してもらう ✨</button>
      )}
      {showPrefs && !suggesting && history.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#999", marginBottom: 10, letterSpacing: 0.5 }}>📖 以前作った料理をまた作る</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.slice(0, 3).map(rec => (
              <button
                key={rec.id}
                onClick={() => { setSuggestion({ ...rec }); setShowPrefs(false); }}
                style={{
                  width: "100%", padding: "12px 16px", border: "1.5px solid #E8E8E8", borderRadius: 12,
                  background: "#fff", textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1A1A1A" }}>{rec.name}</div>
                  <div style={{ fontSize: 12, color: "#AAA", marginTop: 2 }}>⏱ {rec.cookTime}・👥 {rec.servings}人分</div>
                </div>
                <div style={{ fontSize: 12, color: "#BBB" }}>{rec.date}</div>
              </button>
            ))}
          </div>
        </div>
      )}
      {suggesting && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🍳</div>
          <div style={{ color: "#2E7D5A", fontWeight: 700, fontSize: 15 }}>メニューを考えています...</div>
          <div style={{ color: "#AAA", fontSize: 13, marginTop: 8 }}>
            {servings}人分・{EFFORT_OPTIONS.find(e => e.value === effort)?.label}・{mealType}
          </div>
        </div>
      )}
      {suggestion && (
        <div>
          <div style={{ background: "linear-gradient(135deg, #2E7D5A, #45A876)", borderRadius: 20, padding: 24, color: "#fff", marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.8, marginBottom: 6, letterSpacing: 1 }}>TODAY'S MENU</div>
            <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 4 }}>{suggestion.name}</div>
            <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 14 }}>{suggestion.description}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{ background: "rgba(255,255,255,0.2)", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>⏱ {suggestion.cookTime}</span>
              <span style={{ background: "rgba(255,255,255,0.2)", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>👥 {servings}人分</span>
              <span style={{ background: "rgba(255,255,255,0.2)", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                {EFFORT_OPTIONS.find(e => e.value === effort)?.emoji} {EFFORT_OPTIONS.find(e => e.value === effort)?.label}
              </span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#999", marginBottom: 12 }}>使う食材</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {suggestion.usedIngredients?.map((ing, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                    <span style={{ color: "#333" }}>• {ing.name}</span>
                    <span style={{ color: "#FF6B6B", fontWeight: 600 }}>−{ing.quantity}{ing.unit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#999", marginBottom: 12 }}>作り方</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {suggestion.steps?.map((step, i) => (
                  <div key={i} style={{ display: "flex", gap: 10 }}>
                    <span style={{ background: "#E8F5EE", color: "#2E7D5A", fontWeight: 700, fontSize: 12, width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                    <span style={{ fontSize: 14, color: "#333", lineHeight: 1.6 }}>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {suggestion.comment && (
            <div style={{ background: "#FFF9F0", borderRadius: 16, padding: 16, marginBottom: 16, borderLeft: "3px solid #FFB347" }}>
              <div style={{ fontSize: 12, color: "#CC8800", fontWeight: 700, marginBottom: 4 }}>👨‍🍳 シェフより</div>
              <div style={{ fontSize: 13, color: "#886600", lineHeight: 1.6 }}>{suggestion.comment}</div>
            </div>
          )}
          <AdPlaceholder label="広告" />
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <button onClick={resetSuggest} style={{ ...secondaryBtn, flex: 1 }}>条件を変える</button>
            <button onClick={() => { setSuggestion(null); getSuggestion(); }} style={{ ...secondaryBtn, flex: 1 }}>別の料理</button>
          </div>
          <button onClick={consumeIngredients} style={primaryBtn}>これを作る！🍳</button>
        </div>
      )}
    </div>
  );

  const historyContent = (
    <div style={{ maxWidth: isMobile ? "100%" : 640, margin: "0 auto" }}>
      {history.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#BBB" }}>
          <div style={{ fontSize: 60, marginBottom: 12 }}>📖</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#CCC" }}>まだ履歴がありません</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>「これを作る！」を押すと記録されます</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {history.map(rec => {
            const isExpanded = expandedHistory === rec.id;
            return (
              <div key={rec.id} style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ fontWeight: 800, fontSize: 17, color: "#1A1A1A" }}>{rec.name}</div>
                  <div style={{ fontSize: 12, color: "#BBB", whiteSpace: "nowrap", marginLeft: 12 }}>{rec.date}</div>
                </div>
                <div style={{ fontSize: 13, color: "#888", marginBottom: 10 }}>{rec.description}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  <span style={{ background: "#F0F0F0", padding: "3px 10px", borderRadius: 20, fontSize: 12, color: "#666" }}>⏱ {rec.cookTime}</span>
                  <span style={{ background: "#F0F0F0", padding: "3px 10px", borderRadius: 20, fontSize: 12, color: "#666" }}>👥 {rec.servings}人分</span>
                  {rec.usedIngredients?.map((ing, i) => (
                    <span key={i} style={{ background: "#E8F5EE", padding: "3px 10px", borderRadius: 20, fontSize: 12, color: "#2E7D5A" }}>{ing.name}</span>
                  ))}
                </div>

                {isExpanded && rec.steps && (
                  <div style={{ borderTop: "1px solid #F0F0F0", paddingTop: 14, marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#999", marginBottom: 10 }}>作り方</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {rec.steps.map((step, i) => (
                        <div key={i} style={{ display: "flex", gap: 10 }}>
                          <span style={{ background: "#E8F5EE", color: "#2E7D5A", fontWeight: 700, fontSize: 12, width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                          <span style={{ fontSize: 13, color: "#333", lineHeight: 1.6 }}>{step}</span>
                        </div>
                      ))}
                    </div>
                    {rec.comment && (
                      <div style={{ background: "#FFF9F0", borderRadius: 12, padding: 12, marginTop: 12, borderLeft: "3px solid #FFB347" }}>
                        <div style={{ fontSize: 11, color: "#CC8800", fontWeight: 700, marginBottom: 2 }}>👨‍🍳 シェフより</div>
                        <div style={{ fontSize: 12, color: "#886600", lineHeight: 1.6 }}>{rec.comment}</div>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setExpandedHistory(isExpanded ? null : rec.id)}
                    style={{ ...secondaryBtn, flex: 1, padding: "10px" , fontSize: 13 }}
                  >
                    {isExpanded ? "閉じる" : "レシピを見る"}
                  </button>
                  <button
                    onClick={() => { setSuggestion({ ...rec, usedIngredients: rec.usedIngredients }); setShowPrefs(false); switchTab("suggest"); }}
                    style={{ ...secondaryBtn, flex: 1, padding: "10px", fontSize: 13, color: "#2E7D5A", borderColor: "#2E7D5A" }}
                  >
                    🍳 また作る
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const contentMap = {
    fridge: fridgeContent,
    scan: scanContent,
    suggest: suggestContent,
    condiments: (
      <CondimentsTab
        seasonings={seasonings}
        toggleSeasoning={toggleSeasoning}
        removeCustomSeasoning={removeCustomSeasoning}
        customSeasoningInput={customSeasoningInput}
        setCustomSeasoningInput={setCustomSeasoningInput}
        addCustomSeasoning={addCustomSeasoning}
        isMobile={isMobile}
      />
    ),
    history: historyContent,
  };

  /* ---- スマホレイアウト ---- */
  if (isMobile) {
    return (
      <div style={{ fontFamily: "'Hiragino Sans', 'Yu Gothic UI', sans-serif", background: "#FAFAF7", minHeight: "100vh", maxWidth: 480, margin: "0 auto", position: "relative" }}>
        {toast && <Toast toast={toast} />}
        {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
        {showAddModal && <AddIngredientModal onAdd={handleAddIngredient} onClose={() => setShowAddModal(false)} />}
        <div style={{ background: "#fff", borderBottom: "1px solid #F0EDE8", padding: "20px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 28 }}>🗄️</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1A1A" }}>うちの冷蔵庫</div>
              <div style={{ fontSize: 11, color: "#999", marginTop: 1 }}>{fridge.length}品 在庫中</div>
            </div>
          </div>
          <div style={{ display: "flex", overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
            {tabs.map(([key, emoji, label]) => (
              <button key={key} onClick={() => switchTab(key)} style={{
                flexShrink: 0, padding: "10px 14px", border: "none", background: "none",
                fontSize: 12, fontWeight: tab === key ? 700 : 500,
                color: tab === key ? "#2E7D5A" : "#999",
                borderBottom: tab === key ? "2.5px solid #2E7D5A" : "2.5px solid transparent",
                cursor: "pointer", whiteSpace: "nowrap",
              }}>{emoji} {label}</button>
            ))}
          </div>
        </div>
        <div style={{ padding: 16, paddingBottom: 100 }}>
          <ErrorBoundary key={tab}>{contentMap[tab]}</ErrorBoundary>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  /* ---- PCレイアウト ---- */
  return (
    <div style={{ fontFamily: "'Hiragino Sans', 'Yu Gothic UI', sans-serif", background: "#FAFAF7", minHeight: "100vh", display: "flex" }}>
      {toast && <Toast toast={toast} />}
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
      {showAddModal && <AddIngredientModal onAdd={handleAddIngredient} onClose={() => setShowAddModal(false)} />}
      {editingItem && <AddIngredientModal onAdd={handleAddIngredient} onClose={() => setEditingItem(null)} initial={editingItem} />}

      {/* サイドバー */}
      <div style={{
        width: 240, background: "#fff", borderRight: "1px solid #F0EDE8",
        padding: "32px 20px", display: "flex", flexDirection: "column", gap: 8,
        position: "sticky", top: 0, height: "100vh",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <span style={{ fontSize: 32 }}>🗄️</span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#1A1A1A" }}>うちの冷蔵庫</div>
            <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{fridge.length}品 在庫中</div>
          </div>
        </div>
        {tabs.map(([key, emoji, label]) => (
          <button key={key} onClick={() => switchTab(key)} style={{
            width: "100%", padding: "12px 16px", border: "none", borderRadius: 12, textAlign: "left",
            background: tab === key ? "#E8F5EE" : "none",
            color: tab === key ? "#2E7D5A" : "#666",
            fontWeight: tab === key ? 700 : 500, fontSize: 15,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 10, transition: "all 0.15s",
          }}>
            <span style={{ fontSize: 20 }}>{emoji}</span> {label}
          </button>
        ))}
      </div>

      {/* メインコンテンツ */}
      <div style={{ flex: 1, padding: "40px 48px", overflowY: "auto" }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#1A1A1A", marginBottom: 24 }}>
          {tabs.find(([key]) => key === tab)?.[1]} {tabs.find(([key]) => key === tab)?.[2]}
        </div>
        {contentMap[tab]}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Toast({ toast }) {
  return (
    <div style={{
      position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
      background: toast.type === "error" ? "#FF6B6B" : "#4CAF82",
      color: "#fff", padding: "10px 20px", borderRadius: 24, fontSize: 14,
      zIndex: 1000, fontWeight: 600, boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
      whiteSpace: "nowrap"
    }}>
      {toast.msg}
    </div>
  );
}

const btnStyle = (bg, color) => ({
  width: 32, height: 32, border: "none", borderRadius: 8,
  background: bg, color: color, fontWeight: 700, fontSize: 16,
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
});

const primaryBtn = {
  width: "100%", padding: "15px", border: "none", borderRadius: 14,
  background: "linear-gradient(135deg, #2E7D5A, #45A876)", color: "#fff",
  fontWeight: 800, fontSize: 15, cursor: "pointer", letterSpacing: "-0.3px"
};

const secondaryBtn = {
  padding: "15px", border: "1.5px solid #D4EBE0", borderRadius: 14,
  background: "#fff", color: "#2E7D5A",
  fontWeight: 700, fontSize: 15, cursor: "pointer"
};

function CondimentsTab({ seasonings, toggleSeasoning, removeCustomSeasoning, customSeasoningInput, setCustomSeasoningInput, addCustomSeasoning, isMobile }) {
  const safe = seasonings && typeof seasonings === "object" && !Array.isArray(seasonings) ? seasonings : {};
  const allPresetNames = PRESET_SEASONINGS.flatMap(g => g.items);
  const customSeasonings = Object.keys(safe).filter(k => !allPresetNames.includes(k));
  const checkedCount = Object.values(safe).filter(Boolean).length;

  return (
    <div style={{ maxWidth: isMobile ? "100%" : 640, margin: "0 auto" }}>
      <div style={{ fontSize: 13, color: "#999", marginBottom: 16 }}>
        持っている調味料にチェックを入れてください。料理提案でAIが活用します。
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#2E7D5A", marginBottom: 16 }}>
        ✅ {checkedCount}種類の調味料が登録済み
      </div>
      {PRESET_SEASONINGS.map(group => (
        <div key={group.group} style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#999", letterSpacing: 1, marginBottom: 12 }}>{group.group}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {group.items.map(name => {
              const checked = !!safe[name];
              return (
                <button
                  key={name}
                  onClick={() => toggleSeasoning(name)}
                  style={{
                    padding: "7px 14px", borderRadius: 20, border: `1.5px solid ${checked ? "#2E7D5A" : "#E8E8E8"}`,
                    background: checked ? "#E8F5EE" : "#F9F9F9",
                    color: checked ? "#2E7D5A" : "#888",
                    fontWeight: checked ? 700 : 500, fontSize: 13, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 5,
                  }}
                >
                  <span>{checked ? "✓" : "+"}</span>
                  <span>{name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {customSeasonings.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#999", letterSpacing: 1, marginBottom: 12 }}>カスタム</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {customSeasonings.map(name => {
              const checked = !!safe[name];
              return (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button
                    onClick={() => toggleSeasoning(name)}
                    style={{
                      padding: "7px 14px", borderRadius: 20, border: `1.5px solid ${checked ? "#2E7D5A" : "#E8E8E8"}`,
                      background: checked ? "#E8F5EE" : "#F9F9F9", color: checked ? "#2E7D5A" : "#888",
                      fontWeight: checked ? 700 : 500, fontSize: 13, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 5,
                    }}
                  >
                    <span>{checked ? "✓" : "+"}</span><span>{name}</span>
                  </button>
                  <button
                    onClick={() => removeCustomSeasoning(name)}
                    style={{ width: 22, height: 22, border: "none", borderRadius: "50%", background: "#FFE8E8", color: "#FF6B6B", fontSize: 12, cursor: "pointer", fontWeight: 700, padding: 0 }}
                  >✕</button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#999", letterSpacing: 1, marginBottom: 12 }}>リストにない調味料を追加</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ flex: 1, padding: "10px 12px", border: "1.5px solid #E8E8E8", borderRadius: 10, fontSize: 14, outline: "none" }}
            value={customSeasoningInput}
            onChange={e => setCustomSeasoningInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomSeasoning(); } }}
            placeholder="例：ナンプラー、粒マスタード"
          />
          <button
            onClick={addCustomSeasoning}
            disabled={!customSeasoningInput.trim()}
            style={{
              padding: "10px 18px", border: "none", borderRadius: 10,
              background: customSeasoningInput.trim() ? "#2E7D5A" : "#E8E8E8",
              color: customSeasoningInput.trim() ? "#fff" : "#BBB",
              fontWeight: 700, fontSize: 14, cursor: customSeasoningInput.trim() ? "pointer" : "default",
            }}
          >追加</button>
        </div>
      </div>
    </div>
  );
}
