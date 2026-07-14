import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from "recharts";
import {
  Plus, Pencil, Trash2, Check, X, Wallet, Calendar, TrendingUp,
  AlertTriangle, ChevronRight, ChevronDown, Coins, ReceiptText, Lock,
  ArrowLeftRight, Landmark, Delete, PiggyBank, Sparkles
} from "lucide-react";

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');`;

const CATEGORIES = ["Housing", "Utilities", "Medical", "Vehicle", "Insurance", "Fuel", "Subscription", "Other"];

const CATEGORY_COLORS = {
  Housing: "#24594A", Utilities: "#3E7A64", Medical: "#A23B3B", Vehicle: "#1E4E6B",
  Insurance: "#6B4E9E", Fuel: "#B3541B", Subscription: "#8A6D1E", Other: "#5B6660",
};

const QUICK_ADD_SUGGESTIONS = [
  { name: "Boarding Fees", category: "Housing", frequency: "monthly" },
  { name: "Electricity Bill", category: "Utilities", frequency: "monthly" },
  { name: "Medical Centre Rent", category: "Medical", frequency: "monthly" },
  { name: "Car Leasing", category: "Vehicle", frequency: "monthly" },
  { name: "Car Insurance", category: "Insurance", frequency: "annual" },
  { name: "Fuel Budget", category: "Fuel", frequency: "monthly" },
  { name: "Subscriptions", category: "Subscription", frequency: "monthly" },
  { name: "Car Repair", category: "Vehicle", frequency: "onetime" },
];

const DEFAULT_WALLET_NAMES = ["PP Money Box", "Money Storage", "Sampath Bank", "HNB Bank", "People's Bank", "Wallet"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function monthKey(dateStr) { return dateStr.slice(0, 7); }
function fmtMoney(n) {
  const v = Number(n) || 0;
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function daysUntil(dateStr) {
  const today = new Date(todayStr() + "T00:00:00");
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function nextOccurrence(payment) {
  if (payment.frequency === "onetime") {
    return { dueDate: payment.dueDate || todayStr(), periodKey: payment.dueDate || todayStr() };
  }
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  if (payment.frequency === "monthly") {
    const dueDay = Math.min(Math.max(Number(payment.dueDay) || 1, 1), 28);
    let periodY = y, periodM = m;
    if (d > dueDay) { periodM += 1; if (periodM > 11) { periodM = 0; periodY += 1; } }
    const periodKey = `${periodY}-${String(periodM + 1).padStart(2, "0")}`;
    const dueDate = `${periodY}-${String(periodM + 1).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;
    if (payment.lastPaidPeriod === periodKey) {
      let ny = periodY, nm = periodM + 1;
      if (nm > 11) { nm = 0; ny += 1; }
      const nKey = `${ny}-${String(nm + 1).padStart(2, "0")}`;
      const nDate = `${ny}-${String(nm + 1).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;
      return { dueDate: nDate, periodKey: nKey };
    }
    return { dueDate, periodKey };
  } else {
    const dueMonth = Math.min(Math.max(Number(payment.dueMonth) || 1, 1), 12);
    const dueDay = Math.min(Math.max(Number(payment.dueDay) || 1, 1), 28);
    let periodY = y;
    const passedThisYear = (m + 1) > dueMonth || ((m + 1) === dueMonth && d > dueDay);
    if (passedThisYear) periodY += 1;
    const periodKey = `${periodY}`;
    const dueDate = `${periodY}-${String(dueMonth).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;
    if (payment.lastPaidPeriod === periodKey) {
      const nY = periodY + 1;
      return { dueDate: `${nY}-${String(dueMonth).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`, periodKey: `${nY}` };
    }
    return { dueDate, periodKey };
  }
}

function monthlyEquivalent(p) {
  if (p.frequency === "onetime") return 0;
  return p.frequency === "annual" ? Number(p.amount) / 12 : Number(p.amount);
}

function groupSumByDate(entries, amountKey) {
  const map = {};
  entries.forEach(e => { map[e.date] = (map[e.date] || 0) + Number(e[amountKey]); });
  return map;
}

async function safeGet(key) {
  try { const r = await window.storage.get(key, false); return r ? r.value : null; }
  catch (e) { return null; }
}
async function safeSet(key, value) {
  try { await window.storage.set(key, JSON.stringify(value), false); }
  catch (e) { console.error("storage set failed", key, e); }
}

export default function BudgetLedgerRoot() {
  const [loaded, setLoaded] = useState(false);
  const [passcode, setPasscode] = useState(null);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    (async () => {
      const pc = await safeGet("app-passcode");
      setPasscode(pc ? JSON.parse(pc) : "");
      setLoaded(true);
    })();
  }, []);

  if (!loaded) {
    return <div style={{ fontFamily: "Inter, sans-serif", padding: 40, textAlign: "center", color: "#5B6660" }}>Loading…</div>;
  }

  if (!unlocked) {
    return (
      <LockScreen
        hasPasscode={!!passcode}
        onSetPasscode={async (pin) => { await safeSet("app-passcode", pin); setPasscode(pin); setUnlocked(true); }}
        onUnlock={(pin) => { if (pin === passcode) setUnlocked(true); return pin === passcode; }}
        onSkipSetup={() => setUnlocked(true)}
      />
    );
  }

  return <App passcode={passcode} setPasscode={setPasscode} />;
}

function LockScreen({ hasPasscode, onSetPasscode, onUnlock, onSkipSetup }) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [stage, setStage] = useState(hasPasscode ? "enter" : "create");
  const [error, setError] = useState("");

  function press(digit) {
    setError("");
    if (stage === "confirm") {
      if (confirmPin.length < 6) setConfirmPin(prev => prev + digit);
    } else {
      if (pin.length < 6) setPin(prev => prev + digit);
    }
  }
  function backspace() {
    setError("");
    if (stage === "confirm") setConfirmPin(prev => prev.slice(0, -1));
    else setPin(prev => prev.slice(0, -1));
  }

  useEffect(() => {
    if (stage === "enter" && pin.length >= 4) {
      const ok = onUnlock(pin);
      if (!ok) { setError("Incorrect passcode"); setTimeout(() => setPin(""), 350); }
    }
  }, [pin, stage]);

  useEffect(() => {
    if (stage === "create" && pin.length >= 4) {
      setTimeout(() => setStage("confirm"), 150);
    }
  }, [pin, stage]);

  useEffect(() => {
    if (stage === "confirm" && confirmPin.length >= pin.length && confirmPin.length >= 4) {
      if (confirmPin === pin) { onSetPasscode(pin); }
      else { setError("Passcodes don't match"); setTimeout(() => { setPin(""); setConfirmPin(""); setStage("create"); }, 500); }
    }
  }, [confirmPin, stage, pin]);

  const display = stage === "confirm" ? confirmPin : pin;

  return (
    <div style={styles.lockShell}>
      <style>{FONT_IMPORT}{GLOBAL_CSS}</style>
      <Lock size={28} color="#EEF0EC" style={{ marginBottom: 10 }} />
      <div style={styles.lockTitle}>
        {stage === "create" ? "Set a passcode" : stage === "confirm" ? "Confirm passcode" : "Enter passcode"}
      </div>
      <div style={styles.lockSubtitle}>
        {stage === "enter" ? "To open your budget ledger" : "4–6 digits, keep it easy to remember"}
      </div>
      <div style={styles.dotsRow}>
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} style={{ ...styles.dot, ...(i < display.length ? styles.dotFilled : {}) }} />
        ))}
      </div>
      {error && <div style={styles.lockError}>{error}</div>}
      <div style={styles.keypad}>
        {["1","2","3","4","5","6","7","8","9"].map(n => (
          <button key={n} style={styles.key} onClick={() => press(n)}>{n}</button>
        ))}
        <button style={styles.key} onClick={() => { if (display.length >= 4) { if (stage === "enter") { const ok = onUnlock(pin); if (!ok) { setError("Incorrect passcode"); setPin(""); } } } }}>
          {stage === "enter" ? <Check size={18} /> : ""}
        </button>
        <button style={styles.key} onClick={() => press("0")}>0</button>
        <button style={styles.key} onClick={backspace}><Delete size={18} /></button>
      </div>
      {!hasPasscode && stage === "create" && (
        <button style={styles.skipLink} onClick={onSkipSetup}>Skip for now</button>
      )}
    </div>
  );
}

function App({ passcode, setPasscode }) {
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("dashboard");

  const [wallets, setWallets] = useState([]);
  const [incomeEntries, setIncomeEntries] = useState([]);
  const [fixedPayments, setFixedPayments] = useState([]);
  const [paymentLog, setPaymentLog] = useState([]);
  const [dailyConfig, setDailyConfig] = useState({ allocation: 1000, walletId: null });
  const [dailyExpenses, setDailyExpenses] = useState([]); // individual entries: {id, date, amount, note}
  const [savingsGoals, setSavingsGoals] = useState([]); // {id, name, targetAmount, createdDate}
  const [savingsContributions, setSavingsContributions] = useState([]); // {id, goalId, amount, date}

  useEffect(() => {
    (async () => {
      const [w, oldBal, inc, fp, pl, dc, oldDs, de, sg, sc] = await Promise.all([
        safeGet("wallets"), safeGet("balance"), safeGet("income-entries"), safeGet("fixed-payments"),
        safeGet("payment-log"), safeGet("daily-config"), safeGet("daily-spend"),
        safeGet("daily-expenses"), safeGet("savings-goals"), safeGet("savings-contributions"),
      ]);
      let walletList;
      if (w) {
        walletList = JSON.parse(w);
      } else if (oldBal) {
        const ob = JSON.parse(oldBal);
        walletList = DEFAULT_WALLET_NAMES.map((name, i) => ({ id: uid(), name, balance: i === DEFAULT_WALLET_NAMES.length - 1 ? Number(ob.amount) || 0 : 0 }));
      } else {
        walletList = DEFAULT_WALLET_NAMES.map(name => ({ id: uid(), name, balance: 0 }));
      }
      setWallets(walletList);
      if (inc) setIncomeEntries(JSON.parse(inc));
      if (fp) setFixedPayments(JSON.parse(fp));
      if (pl) setPaymentLog(JSON.parse(pl));
      if (dc) { const parsed = JSON.parse(dc); setDailyConfig({ walletId: walletList[walletList.length - 1]?.id, ...parsed }); }
      else setDailyConfig(prev => ({ ...prev, walletId: walletList[walletList.length - 1]?.id }));

      if (de) {
        setDailyExpenses(JSON.parse(de));
      } else if (oldDs) {
        // migrate old one-entry-per-day format into individual entries
        const old = JSON.parse(oldDs);
        setDailyExpenses(old.map(d => ({ id: uid(), date: d.date, amount: Number(d.spent) || 0, note: d.note || "" })));
      }
      if (sg) setSavingsGoals(JSON.parse(sg));
      if (sc) setSavingsContributions(JSON.parse(sc));
      setLoaded(true);
    })();
  }, []);

  useEffect(() => { if (loaded) safeSet("wallets", wallets); }, [wallets, loaded]);
  useEffect(() => { if (loaded) safeSet("income-entries", incomeEntries); }, [incomeEntries, loaded]);
  useEffect(() => { if (loaded) safeSet("fixed-payments", fixedPayments); }, [fixedPayments, loaded]);
  useEffect(() => { if (loaded) safeSet("payment-log", paymentLog); }, [paymentLog, loaded]);
  useEffect(() => { if (loaded) safeSet("daily-config", dailyConfig); }, [dailyConfig, loaded]);
  useEffect(() => { if (loaded) safeSet("daily-expenses", dailyExpenses); }, [dailyExpenses, loaded]);
  useEffect(() => { if (loaded) safeSet("savings-goals", savingsGoals); }, [savingsGoals, loaded]);
  useEffect(() => { if (loaded) safeSet("savings-contributions", savingsContributions); }, [savingsContributions, loaded]);

  const totalBalance = useMemo(() => wallets.reduce((s, w) => s + Number(w.balance), 0), [wallets]);

  const upcoming = useMemo(() => {
    return fixedPayments
      .filter(p => !(p.frequency === "onetime" && p.lastPaidPeriod)) // hide paid one-time bills
      .map(p => { const { dueDate, periodKey } = nextOccurrence(p); return { ...p, dueDate, periodKey, daysLeft: daysUntil(dueDate) }; })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [fixedPayments]);

  const monthlyBurnRate = useMemo(() => fixedPayments.reduce((s, p) => s + monthlyEquivalent(p), 0) + Number(dailyConfig.allocation || 0) * 30, [fixedPayments, dailyConfig]);

  const thisMonthKey = monthKey(todayStr());
  const thisMonthIncome = useMemo(() => incomeEntries.filter(e => monthKey(e.date) === thisMonthKey).reduce((s, e) => s + Number(e.amount), 0), [incomeEntries, thisMonthKey]);
  const upcoming30Total = useMemo(() => upcoming.filter(p => p.daysLeft <= 30 && p.daysLeft >= 0).reduce((s, p) => s + Number(p.amount), 0), [upcoming]);

  const dailyTotalsByDate = useMemo(() => groupSumByDate(dailyExpenses, "amount"), [dailyExpenses]);
  const todaySpent = dailyTotalsByDate[todayStr()] || 0;
  const todayOver = todaySpent > Number(dailyConfig.allocation);

  // ---- Forecast numbers ----
  const forecast = useMemo(() => {
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projectedMonthIncome = dayOfMonth > 0 ? (thisMonthIncome / dayOfMonth) * daysInMonth : 0;
    const balanceAfterBills = totalBalance - upcoming30Total;

    const goalForecasts = savingsGoals.map(g => {
      const contribs = savingsContributions.filter(c => c.goalId === g.id).sort((a, b) => a.date.localeCompare(b.date));
      const saved = contribs.reduce((s, c) => s + Number(c.amount), 0);
      const remaining = Math.max(0, Number(g.targetAmount) - saved);
      let daysToGo = null;
      if (contribs.length > 0) {
        const daysSince = Math.max(1, -daysUntil(contribs[0].date) + 1);
        const dailyRate = saved / daysSince;
        daysToGo = dailyRate > 0 ? Math.ceil(remaining / dailyRate) : null;
      }
      return { goal: g, saved, remaining, daysToGo };
    });

    return { projectedMonthIncome, balanceAfterBills, goalForecasts };
  }, [thisMonthIncome, totalBalance, upcoming30Total, savingsGoals, savingsContributions]);

  function addIncome(amount, note, walletId) {
    if (!amount || isNaN(amount)) return;
    const amt = Number(amount);
    setIncomeEntries(prev => [...prev, { id: uid(), date: todayStr(), amount: amt, note: note || "", walletId }]);
    setWallets(prev => prev.map(w => w.id === walletId ? { ...w, balance: Number(w.balance) + amt } : w));
  }

  function markPaid(payment, actualAmount, walletId) {
    const amt = Number(actualAmount);
    if (isNaN(amt)) return;
    const { periodKey } = nextOccurrence(payment);
    setPaymentLog(prev => [...prev, { id: uid(), paymentId: payment.id, name: payment.name, category: payment.category, amount: amt, date: todayStr(), walletId }]);
    setFixedPayments(prev => prev.map(p => p.id === payment.id ? { ...p, lastPaidPeriod: periodKey } : p));
    setWallets(prev => prev.map(w => w.id === walletId ? { ...w, balance: Number(w.balance) - amt } : w));
  }

  function upsertPayment(payment) {
    setFixedPayments(prev => prev.some(p => p.id === payment.id) ? prev.map(p => p.id === payment.id ? payment : p) : [...prev, payment]);
  }
  function deletePayment(id) { setFixedPayments(prev => prev.filter(p => p.id !== id)); }

  function addDailyExpense(amount, note) {
    const amt = Number(amount);
    if (!amt || isNaN(amt)) return;
    setDailyExpenses(prev => [...prev, { id: uid(), date: todayStr(), amount: amt, note: note || "" }]);
    if (dailyConfig.walletId) {
      setWallets(prev => prev.map(w => w.id === dailyConfig.walletId ? { ...w, balance: Number(w.balance) - amt } : w));
    }
  }
  function deleteDailyExpense(entry) {
    setDailyExpenses(prev => prev.filter(e => e.id !== entry.id));
    if (dailyConfig.walletId) {
      setWallets(prev => prev.map(w => w.id === dailyConfig.walletId ? { ...w, balance: Number(w.balance) + Number(entry.amount) } : w));
    }
  }

  function upsertWallet(wallet) {
    setWallets(prev => prev.some(w => w.id === wallet.id) ? prev.map(w => w.id === wallet.id ? wallet : w) : [...prev, wallet]);
  }
  function deleteWallet(id) { setWallets(prev => prev.filter(w => w.id !== id)); }
  function transferBetween(fromId, toId, amount) {
    const amt = Number(amount);
    if (!amt || isNaN(amt) || fromId === toId) return;
    setWallets(prev => prev.map(w => {
      if (w.id === fromId) return { ...w, balance: Number(w.balance) - amt };
      if (w.id === toId) return { ...w, balance: Number(w.balance) + amt };
      return w;
    }));
  }

  function upsertGoal(goal) {
    setSavingsGoals(prev => prev.some(g => g.id === goal.id) ? prev.map(g => g.id === goal.id ? goal : g) : [...prev, goal]);
  }
  function deleteGoal(id) {
    setSavingsGoals(prev => prev.filter(g => g.id !== id));
    setSavingsContributions(prev => prev.filter(c => c.goalId !== id));
  }
  function contributeToGoal(goalId, amount) {
    const amt = Number(amount);
    if (!amt || isNaN(amt)) return;
    setSavingsContributions(prev => [...prev, { id: uid(), goalId, amount: amt, date: todayStr() }]);
  }

  if (!loaded) {
    return <div style={{ fontFamily: "Inter, sans-serif", padding: 40, textAlign: "center", color: "#5B6660" }}>Loading your ledger…</div>;
  }

  return (
    <div style={styles.appShell}>
      <style>{FONT_IMPORT}{GLOBAL_CSS}</style>
      <LedgerTape
        wallets={wallets} totalBalance={totalBalance} thisMonthIncome={thisMonthIncome}
        upcoming30Total={upcoming30Total} onAddIncome={addIncome} onGoToWallets={() => setTab("wallets")}
      />
      <TabBar tab={tab} setTab={setTab} />
      <div style={styles.content}>
        {tab === "dashboard" && (
          <Dashboard upcoming={upcoming} wallets={wallets} onMarkPaid={markPaid} dailyConfig={dailyConfig}
            todaySpent={todaySpent} todayOver={todayOver} monthlyBurnRate={monthlyBurnRate} forecast={forecast} />
        )}
        {tab === "wallets" && (
          <Wallets wallets={wallets} onSave={upsertWallet} onDelete={deleteWallet} onTransfer={transferBetween} />
        )}
        {tab === "payments" && (
          <FixedPayments fixedPayments={fixedPayments} onSave={upsertPayment} onDelete={deletePayment} monthlyBurnRate={monthlyBurnRate} />
        )}
        {tab === "daily" && (
          <DailyExpenses dailyConfig={dailyConfig} setDailyConfig={setDailyConfig} dailyExpenses={dailyExpenses}
            dailyTotalsByDate={dailyTotalsByDate} onAdd={addDailyExpense} onDelete={deleteDailyExpense} wallets={wallets} />
        )}
        {tab === "goals" && (
          <Goals goals={savingsGoals} contributions={savingsContributions} forecast={forecast}
            onSave={upsertGoal} onDelete={deleteGoal} onContribute={contributeToGoal} />
        )}
        {tab === "charts" && <Charts paymentLog={paymentLog} dailyExpenses={dailyExpenses} />}
        {tab === "settings" && <Settings passcode={passcode} setPasscode={setPasscode} />}
      </div>
    </div>
  );
}

function LedgerTape({ wallets, totalBalance, thisMonthIncome, upcoming30Total, onAddIncome, onGoToWallets }) {
  const [expanded, setExpanded] = useState(false);
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [incomeAmt, setIncomeAmt] = useState("");
  const [incomeNote, setIncomeNote] = useState("");
  const [incomeWallet, setIncomeWallet] = useState(wallets[0]?.id || "");

  useEffect(() => { if (!incomeWallet && wallets[0]) setIncomeWallet(wallets[0].id); }, [wallets]);

  return (
    <div style={styles.tapeWrap}>
      <div style={styles.tape}>
        <div style={styles.tapeHeader}>
          <ReceiptText size={16} color="#EEF0EC" />
          <span style={styles.tapeHeaderText}>MASS MONEY FLOW</span>
        </div>
        <div style={styles.tapeRow}>
          <span style={styles.tapeLabel}>Total Balance</span>
          <span style={styles.tapeValue} onClick={() => setExpanded(e => !e)}>
            {fmtMoney(totalBalance)} <ChevronDown size={14} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
          </span>
        </div>
        {expanded && (
          <div style={styles.walletBreakdown}>
            {wallets.map(w => (
              <div key={w.id} style={styles.walletBreakdownRow}>
                <span style={styles.walletBreakdownName}>{w.name}</span>
                <span style={styles.walletBreakdownVal}>{fmtMoney(w.balance)}</span>
              </div>
            ))}
            <button style={styles.manageWalletsLink} onClick={onGoToWallets}>Manage wallets <ChevronRight size={12} /></button>
          </div>
        )}
        <div style={styles.tapeDivider} />
        <div style={styles.tapeRow}>
          <span style={styles.tapeLabel}>Income this month</span>
          <span style={styles.tapeValueSmall}>{fmtMoney(thisMonthIncome)}</span>
        </div>
        <div style={styles.tapeRow}>
          <span style={styles.tapeLabel}>Due in next 30 days</span>
          <span style={styles.tapeValueSmall}>{fmtMoney(upcoming30Total)}</span>
        </div>
        <div style={styles.tapeDivider} />
        {!showIncomeForm ? (
          <button style={styles.tapeAddIncomeBtn} onClick={() => setShowIncomeForm(true)}>
            <Plus size={14} /> Add today's income
          </button>
        ) : (
          <div style={styles.incomeFormStack}>
            <select style={styles.incomeSelect} value={incomeWallet} onChange={e => setIncomeWallet(e.target.value)}>
              {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <input type="number" placeholder="Amount" value={incomeAmt} onChange={e => setIncomeAmt(e.target.value)} style={styles.incomeInput} autoFocus />
            <input type="text" placeholder="Note (optional)" value={incomeNote} onChange={e => setIncomeNote(e.target.value)} style={styles.incomeInput} />
            <div style={styles.incomeBtnRow}>
              <button style={styles.incomeConfirmBtn} onClick={() => { onAddIncome(incomeAmt, incomeNote, incomeWallet); setIncomeAmt(""); setIncomeNote(""); setShowIncomeForm(false); }}>
                <Check size={14} /> Add
              </button>
              <button style={styles.incomeCancelBtn} onClick={() => setShowIncomeForm(false)}>
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      <div style={styles.tapePerforation}>
        {Array.from({ length: 24 }).map((_, i) => <span key={i} style={styles.perfDot} />)}
      </div>
    </div>
  );
}

function TabBar({ tab, setTab }) {
  const tabs = [
    { id: "dashboard", label: "Overview", icon: Wallet },
    { id: "wallets", label: "Wallets", icon: Landmark },
    { id: "payments", label: "Bills", icon: Calendar },
    { id: "daily", label: "Daily", icon: Coins },
    { id: "goals", label: "Goals", icon: PiggyBank },
    { id: "charts", label: "Charts", icon: TrendingUp },
  ];
  return (
    <div style={styles.tabBar}>
      {tabs.map(t => {
        const Icon = t.icon;
        const active = tab === t.id;
        return (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ ...styles.tabBtn, ...(active ? styles.tabBtnActive : {}) }}>
            <Icon size={15} color={active ? "#EEF0EC" : "#5B6660"} />
            <span style={{ ...styles.tabLabel, color: active ? "#EEF0EC" : "#5B6660" }}>{t.label}</span>
          </button>
        );
      })}
      <button onClick={() => setTab("settings")} style={{ ...styles.tabBtn, ...(tab === "settings" ? styles.tabBtnActive : {}) }}>
        <Lock size={15} color={tab === "settings" ? "#EEF0EC" : "#5B6660"} />
        <span style={{ ...styles.tabLabel, color: tab === "settings" ? "#EEF0EC" : "#5B6660" }}>Lock</span>
      </button>
    </div>
  );
}

function ForecastCard({ forecast }) {
  const { projectedMonthIncome, balanceAfterBills, goalForecasts } = forecast;
  return (
    <div style={styles.forecastCard}>
      <div style={styles.forecastHeader}>
        <Sparkles size={15} color="#7FB89F" />
        <span style={styles.forecastHeaderText}>Financial Forecast</span>
      </div>
      <div style={styles.forecastRow}>
        <span style={styles.tapeLabel}>Projected income this month</span>
        <span style={styles.forecastValue}>{fmtMoney(projectedMonthIncome)}</span>
      </div>
      <div style={styles.forecastRow}>
        <span style={styles.tapeLabel}>Balance after next 30 days of bills</span>
        <span style={{ ...styles.forecastValue, color: balanceAfterBills < 0 ? "#E39A9A" : "#EEF0EC" }}>
          {fmtMoney(balanceAfterBills)}
        </span>
      </div>
      {goalForecasts.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {goalForecasts.map(gf => (
            <div key={gf.goal.id} style={styles.forecastGoalRow}>
              <span style={styles.forecastGoalName}>{gf.goal.name}</span>
              <span style={styles.forecastGoalNote}>
                {gf.daysToGo == null
                  ? "log a contribution to see pace"
                  : gf.daysToGo === 0
                    ? "goal reached 🎉"
                    : `~${gf.daysToGo}d at current pace`}
              </span>
            </div>
          ))}
        </div>
      )}
      <p style={styles.forecastHint}>Estimated from your own averages, not real financial advice.</p>
    </div>
  );
}

function Dashboard({ upcoming, wallets, onMarkPaid, dailyConfig, todaySpent, todayOver, monthlyBurnRate, forecast }) {
  const [payingId, setPayingId] = useState(null);
  const [payAmt, setPayAmt] = useState("");
  const [payWallet, setPayWallet] = useState(wallets[0]?.id || "");

  return (
    <div>
      <SectionTitle title="Upcoming Payments" subtitle="Sorted by what's due soonest" />

      <ForecastCard forecast={forecast} />

      <div style={styles.burnRateCard}>
        <span style={styles.tapeLabel}>Estimated monthly burn rate</span>
        <span style={styles.burnRateValue}>{fmtMoney(monthlyBurnRate)}</span>
        <span style={styles.burnRateHint}>Recurring bills (annual ÷ 12) + 30 days of your daily allowance</span>
      </div>

      {todayOver && (
        <div style={styles.warningBanner}>
          <AlertTriangle size={16} color="#A23B3B" />
          <span>You've gone {fmtMoney(todaySpent - dailyConfig.allocation)} over today's daily allowance.</span>
        </div>
      )}
      {upcoming.length === 0 && <EmptyState text="No fixed payments yet. Add some in the Bills tab." />}
      <div style={styles.list}>
        {upcoming.map(p => (
          <div key={p.id} style={styles.upcomingCard}>
            <div style={{ width: 4, alignSelf: "stretch", borderRadius: 4, background: CATEGORY_COLORS[p.category] || "#5B6660" }} />
            <div style={{ flex: 1, padding: "10px 14px" }}>
              <div style={styles.upcomingTop}>
                <span style={styles.upcomingName}>{p.name}</span>
                <span style={styles.upcomingAmount}>{fmtMoney(p.amount)}</span>
              </div>
              <div style={styles.upcomingBottom}>
                <span style={{ ...styles.dueTag, ...(p.daysLeft <= 3 ? styles.dueTagSoon : {}) }}>
                  {p.daysLeft < 0 ? `${Math.abs(p.daysLeft)}d overdue` : p.daysLeft === 0 ? "Due today" : `in ${p.daysLeft}d`}
                </span>
                <span style={styles.categoryTag}>{p.category}</span>
                {p.frequency === "onetime" && <span style={styles.categoryTag}>One-time</span>}
              </div>
              {payingId === p.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  <select style={styles.incomeSelect} value={payWallet} onChange={e => setPayWallet(e.target.value)}>
                    {wallets.map(w => <option key={w.id} value={w.id}>{w.name} ({fmtMoney(w.balance)})</option>)}
                  </select>
                  <input type="number" value={payAmt} onChange={e => setPayAmt(e.target.value)} style={styles.formInput} autoFocus />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={styles.smallBtnSolidFlex} onClick={() => { onMarkPaid(p, payAmt, payWallet); setPayingId(null); }}>
                      <Check size={13} /> Confirm
                    </button>
                    <button style={styles.smallBtn} onClick={() => setPayingId(null)}><X size={13} /></button>
                  </div>
                </div>
              ) : (
                <button style={styles.payBtn} onClick={() => { setPayingId(p.id); setPayAmt(p.amount); setPayWallet(wallets[0]?.id || ""); }}>
                  Mark as paid <ChevronRight size={13} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Wallets({ wallets, onSave, onDelete, onTransfer }) {
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [tFrom, setTFrom] = useState(wallets[0]?.id || "");
  const [tTo, setTTo] = useState(wallets[1]?.id || "");
  const [tAmt, setTAmt] = useState("");

  function startNew() { setEditing({ id: uid(), name: "", balance: 0 }); setShowForm(true); }
  function startEdit(w) { setEditing({ ...w }); setShowForm(true); }

  return (
    <div>
      <SectionTitle title="Wallets" subtitle="Every place your money actually sits" />

      {!showForm && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <button style={{ ...styles.primaryBtn, width: "auto", flex: 1 }} onClick={startNew}><Plus size={15} /> Add wallet</button>
          <button style={styles.secondaryBtnSolidGhost} onClick={() => setShowTransfer(s => !s)}><ArrowLeftRight size={15} /> Transfer</button>
        </div>
      )}

      {showTransfer && !showForm && (
        <div style={styles.formCard}>
          <label style={styles.formLabel}>From</label>
          <select style={styles.formInput} value={tFrom} onChange={e => setTFrom(e.target.value)}>
            {wallets.map(w => <option key={w.id} value={w.id}>{w.name} ({fmtMoney(w.balance)})</option>)}
          </select>
          <label style={styles.formLabel}>To</label>
          <select style={styles.formInput} value={tTo} onChange={e => setTTo(e.target.value)}>
            {wallets.map(w => <option key={w.id} value={w.id}>{w.name} ({fmtMoney(w.balance)})</option>)}
          </select>
          <label style={styles.formLabel}>Amount</label>
          <input style={styles.formInput} type="number" value={tAmt} onChange={e => setTAmt(e.target.value)} placeholder="0.00" />
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button style={styles.primaryBtn} onClick={() => { onTransfer(tFrom, tTo, tAmt); setTAmt(""); setShowTransfer(false); }}><Check size={15} /> Transfer</button>
            <button style={styles.secondaryBtn} onClick={() => setShowTransfer(false)}>Cancel</button>
          </div>
        </div>
      )}

      {showForm && (
        <div style={styles.formCard}>
          <label style={styles.formLabel}>Wallet name</label>
          <input style={styles.formInput} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Sampath Bank" />
          <label style={styles.formLabel}>Current balance</label>
          <input style={styles.formInput} type="number" value={editing.balance} onChange={e => setEditing({ ...editing, balance: e.target.value })} placeholder="0.00" />
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button style={styles.primaryBtn} onClick={() => { if (!editing.name) return; onSave({ ...editing, balance: Number(editing.balance) || 0 }); setShowForm(false); }}><Check size={15} /> Save</button>
            <button style={styles.secondaryBtn} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={styles.list}>
        {wallets.map(w => (
          <div key={w.id} style={styles.paymentRow}>
            <div style={{ width: 4, alignSelf: "stretch", borderRadius: 4, background: "#24594A" }} />
            <div style={{ flex: 1, padding: "10px 14px" }}>
              <div style={styles.upcomingTop}>
                <span style={styles.upcomingName}>{w.name}</span>
                <span style={styles.upcomingAmount}>{fmtMoney(w.balance)}</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 10 }}>
              <button style={styles.iconBtnGhost} onClick={() => startEdit(w)}><Pencil size={14} /></button>
              <button style={styles.iconBtnGhostDanger} onClick={() => onDelete(w.id)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FixedPayments({ fixedPayments, onSave, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filterCat, setFilterCat] = useState("All");

  function startNew(prefill) {
    setEditing({
      id: uid(), name: prefill?.name || "", amount: "", category: prefill?.category || "Other",
      frequency: prefill?.frequency || "monthly", dueDay: "1", dueMonth: 1, dueDate: todayStr(), lastPaidPeriod: null,
    });
    setShowForm(true);
  }
  function startEdit(p) { setEditing({ ...p, dueDay: String(p.dueDay ?? "1") }); setShowForm(true); }

  const filtered = filterCat === "All" ? fixedPayments : fixedPayments.filter(p => p.category === filterCat);

  return (
    <div>
      <SectionTitle title="Fixed Payments" subtitle="Recurring bills plus one-time big expenses" />

      {!showForm && (
        <>
          <div style={styles.quickAddWrap}>
            {QUICK_ADD_SUGGESTIONS.map(s => (
              <button key={s.name} style={styles.quickAddChip} onClick={() => startNew(s)}><Plus size={12} /> {s.name}</button>
            ))}
          </div>
          <button style={styles.primaryBtn} onClick={() => startNew(null)}><Plus size={15} /> Add custom payment</button>
        </>
      )}

      {showForm && (
        <PaymentForm payment={editing} onCancel={() => { setShowForm(false); setEditing(null); }}
          onSave={(p) => { onSave(p); setShowForm(false); setEditing(null); }} />
      )}

      {!showForm && fixedPayments.length > 0 && (
        <div style={styles.filterRow}>
          <button style={{ ...styles.filterChip, ...(filterCat === "All" ? styles.filterChipActive : {}) }} onClick={() => setFilterCat("All")}>All</button>
          {[...new Set(fixedPayments.map(p => p.category))].map(c => (
            <button key={c} style={{ ...styles.filterChip, ...(filterCat === c ? styles.filterChipActive : {}) }} onClick={() => setFilterCat(c)}>{c}</button>
          ))}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        {fixedPayments.length === 0 && !showForm && <EmptyState text="Nothing added yet — tap a suggestion above or add a custom payment." />}
        <div style={styles.list}>
          {filtered.map(p => (
            <div key={p.id} style={styles.paymentRow}>
              <div style={{ width: 4, alignSelf: "stretch", borderRadius: 4, background: CATEGORY_COLORS[p.category] || "#5B6660" }} />
              <div style={{ flex: 1, padding: "10px 14px" }}>
                <div style={styles.upcomingTop}>
                  <span style={styles.upcomingName}>{p.name}</span>
                  <span style={styles.upcomingAmount}>{fmtMoney(p.amount)}</span>
                </div>
                <div style={styles.upcomingBottom}>
                  <span style={styles.categoryTag}>{p.category}</span>
                  <span style={styles.categoryTag}>
                    {p.frequency === "monthly" ? `Monthly · day ${p.dueDay}`
                      : p.frequency === "annual" ? `Annually · ${MONTH_NAMES[(p.dueMonth || 1) - 1]} ${p.dueDay}`
                      : `One-time · ${p.dueDate}${p.lastPaidPeriod ? " · paid" : ""}`}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 10 }}>
                <button style={styles.iconBtnGhost} onClick={() => startEdit(p)}><Pencil size={14} /></button>
                <button style={styles.iconBtnGhostDanger} onClick={() => onDelete(p.id)}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PaymentForm({ payment, onCancel, onSave }) {
  const [form, setForm] = useState(payment);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  function handleSave() {
    if (!form.name || !form.amount) return;
    onSave({
      ...form,
      amount: Number(form.amount),
      dueDay: Number(form.dueDay) || 1,
      dueMonth: Number(form.dueMonth) || 1,
    });
  }

  return (
    <div style={styles.formCard}>
      <label style={styles.formLabel}>Name</label>
      <input style={styles.formInput} value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Electricity Bill" />
      <label style={styles.formLabel}>Amount</label>
      <input style={styles.formInput} type="number" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0.00" />
      <label style={styles.formLabel}>Category</label>
      <select style={styles.formInput} value={form.category} onChange={e => set("category", e.target.value)}>
        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <label style={styles.formLabel}>Frequency</label>
      <div style={{ display: "flex", gap: 6 }}>
        <button style={{ ...styles.freqBtn, ...(form.frequency === "monthly" ? styles.freqBtnActive : {}) }} onClick={() => set("frequency", "monthly")}>Monthly</button>
        <button style={{ ...styles.freqBtn, ...(form.frequency === "annual" ? styles.freqBtnActive : {}) }} onClick={() => set("frequency", "annual")}>Annually</button>
        <button style={{ ...styles.freqBtn, ...(form.frequency === "onetime" ? styles.freqBtnActive : {}) }} onClick={() => set("frequency", "onetime")}>One-time</button>
      </div>

      {form.frequency === "monthly" && (
        <>
          <label style={styles.formLabel}>Due day of month (1–28)</label>
          <input style={styles.formInput} type="text" inputMode="numeric" value={form.dueDay} onChange={e => set("dueDay", e.target.value.replace(/\D/g, ""))} />
        </>
      )}
      {form.frequency === "annual" && (
        <>
          <label style={styles.formLabel}>Due month</label>
          <select style={styles.formInput} value={form.dueMonth} onChange={e => set("dueMonth", Number(e.target.value))}>
            {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <label style={styles.formLabel}>Due day (1–28)</label>
          <input style={styles.formInput} type="text" inputMode="numeric" value={form.dueDay} onChange={e => set("dueDay", e.target.value.replace(/\D/g, ""))} />
        </>
      )}
      {form.frequency === "onetime" && (
        <>
          <label style={styles.formLabel}>Due date</label>
          <input style={styles.formInput} type="date" value={form.dueDate || todayStr()} onChange={e => set("dueDate", e.target.value)} />
        </>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button style={styles.primaryBtn} onClick={handleSave}><Check size={15} /> Save</button>
        <button style={styles.secondaryBtn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function DailyExpenses({ dailyConfig, setDailyConfig, dailyExpenses, dailyTotalsByDate, onAdd, onDelete, wallets }) {
  const [editingAlloc, setEditingAlloc] = useState(false);
  const [allocDraft, setAllocDraft] = useState(dailyConfig.allocation);
  const [amountDraft, setAmountDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");

  const today = todayStr();
  const todayEntries = dailyExpenses.filter(e => e.date === today).sort((a, b) => (b.id > a.id ? 1 : -1));
  const todayTotal = dailyTotalsByDate[today] || 0;

  const last7Dates = Object.keys(dailyTotalsByDate).filter(d => daysUntil(d) >= -7 && daysUntil(d) <= 0);
  const totalOver7 = last7Dates.reduce((s, d) => s + Math.max(0, dailyTotalsByDate[d] - Number(dailyConfig.allocation)), 0);

  const recentDates = Object.keys(dailyTotalsByDate).sort((a, b) => b.localeCompare(a)).slice(0, 10);
  const sourceWallet = wallets.find(w => w.id === dailyConfig.walletId);

  function submit() {
    if (amountDraft === "") return;
    onAdd(amountDraft, noteDraft);
    setAmountDraft("");
    setNoteDraft("");
  }

  return (
    <div>
      <SectionTitle title="Daily Expenses" subtitle="Log every little spend — tea, uber, coffee, all of it" />

      <div style={styles.dailyConfigCard}>
        <div>
          <span style={styles.tapeLabel}>Daily allocation</span>
          {editingAlloc ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
              <input type="number" value={allocDraft} onChange={e => setAllocDraft(e.target.value)} style={styles.tapeInputDark} autoFocus />
              <button style={styles.smallBtnSolid} onClick={() => { setDailyConfig(prev => ({ ...prev, allocation: Number(allocDraft) || 0 })); setEditingAlloc(false); }}><Check size={13} /></button>
              <button style={styles.smallBtn} onClick={() => setEditingAlloc(false)}><X size={13} /></button>
            </div>
          ) : (
            <div style={styles.dailyAllocValue} onClick={() => { setAllocDraft(dailyConfig.allocation); setEditingAlloc(true); }}>
              {fmtMoney(dailyConfig.allocation)} <Pencil size={12} style={{ opacity: 0.6 }} />
            </div>
          )}
        </div>
        <select style={styles.walletMiniSelect} value={dailyConfig.walletId || ""} onChange={e => setDailyConfig(prev => ({ ...prev, walletId: e.target.value }))}>
          {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      {totalOver7 > 0 && (
        <div style={styles.warningBanner}><AlertTriangle size={16} color="#A23B3B" /><span>You've spent {fmtMoney(totalOver7)} over allowance in the last 7 days.</span></div>
      )}

      <div style={styles.formCard}>
        <label style={styles.formLabel}>Add an expense — from {sourceWallet?.name || "wallet"}</label>
        <input style={styles.formInput} type="number" placeholder="Amount (e.g. 100)" value={amountDraft} onChange={e => setAmountDraft(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()} />
        <input style={styles.formInput} type="text" placeholder="What was it? (e.g. Tea, Uber)" value={noteDraft} onChange={e => setNoteDraft(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()} />
        <button style={styles.primaryBtn} onClick={submit}><Plus size={15} /> Add expense</button>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={styles.todayTotalRow}>
          <span style={styles.miniHeading}>Today's total</span>
          <span style={{ ...styles.todayTotalValue, color: todayTotal > Number(dailyConfig.allocation) ? "#A23B3B" : "#24594A" }}>
            {fmtMoney(todayTotal)} <span style={styles.dailyAllocSmall}>/ {fmtMoney(dailyConfig.allocation)}</span>
          </span>
        </div>
        <div style={styles.list}>
          {todayEntries.length === 0 && <EmptyState text="Nothing logged today yet." />}
          {todayEntries.map(e => (
            <div key={e.id} style={styles.expenseEntryRow}>
              <span style={styles.expenseEntryNote}>{e.note || "Expense"}</span>
              <span style={styles.expenseEntryAmount}>{fmtMoney(e.amount)}</span>
              <button style={styles.expenseDeleteBtn} onClick={() => onDelete(e)}><X size={13} /></button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <span style={styles.miniHeading}>Recent days</span>
        <div style={styles.list}>
          {recentDates.length === 0 && <EmptyState text="No days logged yet." />}
          {recentDates.map(d => {
            const total = dailyTotalsByDate[d];
            const over = total > Number(dailyConfig.allocation);
            return (
              <div key={d} style={styles.dailyRow}>
                <span style={styles.dailyDate}>{d}</span>
                <span style={{ ...styles.dailySpentVal, color: over ? "#A23B3B" : "#24594A" }}>{fmtMoney(total)}</span>
                <span style={styles.dailyAllocSmall}>of {fmtMoney(dailyConfig.allocation)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Goals({ goals, contributions, forecast, onSave, onDelete, onContribute }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [contributingId, setContributingId] = useState(null);
  const [contribAmt, setContribAmt] = useState("");

  function startNew() { setEditing({ id: uid(), name: "", targetAmount: "", createdDate: todayStr() }); setShowForm(true); }
  function startEdit(g) { setEditing({ ...g }); setShowForm(true); }

  return (
    <div>
      <SectionTitle title="Savings Goals" subtitle="Set a target, log what you save toward it" />

      {!showForm && (
        <button style={styles.primaryBtn} onClick={startNew}><Plus size={15} /> Add a goal</button>
      )}

      {showForm && (
        <div style={styles.formCard}>
          <label style={styles.formLabel}>Goal name</label>
          <input style={styles.formInput} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Emergency Fund" />
          <label style={styles.formLabel}>Target amount</label>
          <input style={styles.formInput} type="number" value={editing.targetAmount} onChange={e => setEditing({ ...editing, targetAmount: e.target.value })} placeholder="0.00" />
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button style={styles.primaryBtn} onClick={() => { if (!editing.name || !editing.targetAmount) return; onSave({ ...editing, targetAmount: Number(editing.targetAmount) }); setShowForm(false); }}><Check size={15} /> Save</button>
            <button style={styles.secondaryBtn} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        {goals.length === 0 && !showForm && <EmptyState text="No goals yet — add one to start tracking progress." />}
        <div style={styles.list}>
          {goals.map(g => {
            const gf = forecast.goalForecasts.find(f => f.goal.id === g.id);
            const saved = gf ? gf.saved : 0;
            const pct = Math.min(100, Math.round((saved / (Number(g.targetAmount) || 1)) * 100));
            return (
              <div key={g.id} style={styles.goalCard}>
                <div style={styles.upcomingTop}>
                  <span style={styles.upcomingName}>{g.name}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={styles.iconBtnGhost} onClick={() => startEdit(g)}><Pencil size={14} /></button>
                    <button style={styles.iconBtnGhostDanger} onClick={() => onDelete(g.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div style={styles.goalProgressBarBg}>
                  <div style={{ ...styles.goalProgressBarFill, width: `${pct}%` }} />
                </div>
                <div style={styles.goalStatsRow}>
                  <span>{fmtMoney(saved)} / {fmtMoney(g.targetAmount)}</span>
                  <span>{pct}%</span>
                </div>
                {gf && gf.daysToGo != null && (
                  <span style={styles.forecastGoalNote}>
                    {gf.daysToGo === 0 ? "Goal reached 🎉" : `~${gf.daysToGo} days left at current pace`}
                  </span>
                )}
                {contributingId === g.id ? (
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <input style={styles.payInput} type="number" value={contribAmt} onChange={e => setContribAmt(e.target.value)} autoFocus placeholder="Amount" />
                    <button style={styles.smallBtnSolid} onClick={() => { onContribute(g.id, contribAmt); setContribAmt(""); setContributingId(null); }}><Check size={13} /></button>
                    <button style={styles.smallBtn} onClick={() => setContributingId(null)}><X size={13} /></button>
                  </div>
                ) : (
                  <button style={styles.payBtn} onClick={() => setContributingId(g.id)}>
                    <Plus size={13} /> Log savings
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Charts({ paymentLog, dailyExpenses }) {
  const [view, setView] = useState("monthly");
  const [categoryFilter, setCategoryFilter] = useState(CATEGORIES[0]);

  const monthlyData = useMemo(() => {
    const map = {};
    paymentLog.forEach(e => { const k = monthKey(e.date); map[k] = (map[k] || 0) + Number(e.amount); });
    dailyExpenses.forEach(e => { const k = monthKey(e.date); map[k] = (map[k] || 0) + Number(e.amount); });
    const keys = Object.keys(map).sort();
    return keys.slice(-12).map(k => ({ month: k, total: Math.round(map[k] * 100) / 100 }));
  }, [paymentLog, dailyExpenses]);

  const categoryTrend = useMemo(() => {
    const map = {};
    paymentLog.filter(e => e.category === categoryFilter).forEach(e => { const k = monthKey(e.date); map[k] = (map[k] || 0) + Number(e.amount); });
    const keys = Object.keys(map).sort();
    return keys.slice(-12).map(k => ({ month: k, amount: Math.round(map[k] * 100) / 100 }));
  }, [paymentLog, categoryFilter]);

  const hasData = paymentLog.length > 0 || dailyExpenses.length > 0;

  return (
    <div>
      <SectionTitle title="Charts" subtitle="See where the month's money actually went" />
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button style={{ ...styles.freqBtn, ...(view === "monthly" ? styles.freqBtnActive : {}) }} onClick={() => setView("monthly")}>Monthly Total</button>
        <button style={{ ...styles.freqBtn, ...(view === "category" ? styles.freqBtnActive : {}) }} onClick={() => setView("category")}>By Category</button>
      </div>
      {!hasData && <EmptyState text="Mark a few payments as paid or log daily spends to see charts here." />}
      {hasData && view === "monthly" && (
        <div style={styles.chartCard}>
          <span style={styles.miniHeading}>Total spend per month</span>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D7DAD2" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} stroke="#5B6660" />
              <YAxis tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} stroke="#5B6660" />
              <Tooltip contentStyle={{ fontFamily: "IBM Plex Mono", fontSize: 12 }} />
              <Bar dataKey="total" fill="#24594A" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {hasData && view === "category" && (
        <div style={styles.chartCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={styles.miniHeading}>Trend for a category</span>
            <select style={styles.categorySelect} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {categoryTrend.length === 0 ? <EmptyState text={`No paid ${categoryFilter} entries yet.`} /> : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={categoryTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D7DAD2" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} stroke="#5B6660" />
                <YAxis tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} stroke="#5B6660" />
                <Tooltip contentStyle={{ fontFamily: "IBM Plex Mono", fontSize: 12 }} />
                <Line type="monotone" dataKey="amount" stroke={CATEGORY_COLORS[categoryFilter]} strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}

function Settings({ passcode, setPasscode }) {
  const [changing, setChanging] = useState(false);
  const [newPin, setNewPin] = useState("");
  return (
    <div>
      <SectionTitle title="Lock Settings" subtitle="This passcode is a privacy screen, not encryption" />
      <div style={styles.formCard}>
        <p style={{ fontSize: 12.5, color: "#5B6660", margin: "0 0 10px" }}>
          It stops someone casually opening the app on your phone, but the data itself isn't encrypted —
          please don't rely on it to protect highly sensitive information.
        </p>
        {!changing ? (
          <>
            <button style={styles.primaryBtn} onClick={() => setChanging(true)}>
              <Pencil size={14} /> {passcode ? "Change passcode" : "Set a passcode"}
            </button>
            {passcode && <button style={{ ...styles.secondaryBtn, marginTop: 8, width: "100%" }} onClick={async () => { await safeSet("app-passcode", ""); setPasscode(""); }}>Remove passcode</button>}
          </>
        ) : (
          <>
            <label style={styles.formLabel}>New passcode (4–6 digits)</label>
            <input style={styles.formInput} type="password" inputMode="numeric" maxLength={6} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ""))} />
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button style={styles.primaryBtn} onClick={async () => { if (newPin.length < 4) return; await safeSet("app-passcode", newPin); setPasscode(newPin); setChanging(false); setNewPin(""); }}><Check size={15} /> Save</button>
              <button style={styles.secondaryBtn} onClick={() => setChanging(false)}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ title, subtitle }) {
  return (<div style={{ marginBottom: 16 }}><h2 style={styles.sectionTitle}>{title}</h2>{subtitle && <p style={styles.sectionSubtitle}>{subtitle}</p>}</div>);
}
function EmptyState({ text }) { return <div style={styles.emptyState}>{text}</div>; }

const GLOBAL_CSS = `
  * { box-sizing: border-box; }
  input:focus, select:focus, button:focus-visible { outline: 2px solid #24594A; outline-offset: 1px; }
  button { cursor: pointer; font-family: 'Inter', sans-serif; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-thumb { background: #C9CCC4; border-radius: 3px; }
  body { padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); }
`;

const styles = {
  appShell: { fontFamily: "'Inter', sans-serif", background: "#EEF0EC", minHeight: "100vh", maxWidth: 480, margin: "0 auto", paddingBottom: 40, color: "#1E2A26" },
  tapeWrap: { padding: "16px 14px 0" },
  tape: { background: "#1E2A26", borderRadius: "10px 10px 2px 2px", padding: "16px 18px 14px", color: "#EEF0EC" },
  tapeHeader: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 },
  tapeHeaderText: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.12em", color: "#B9C2BC" },
  tapeRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0" },
  tapeLabel: { fontSize: 13, color: "#B9C2BC", fontFamily: "'Inter', sans-serif" },
  tapeValue: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: "#EEF0EC", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 },
  tapeValueSmall: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, fontWeight: 500, color: "#EEF0EC" },
  tapeDivider: { borderTop: "1px dashed #45524C", margin: "6px 0" },
  tapeInputDark: { width: 100, background: "#F5F6F3", border: "1px solid #C9CCC4", borderRadius: 6, color: "#1E2A26", padding: "4px 8px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 15 },
  tapeIconBtn: { background: "transparent", border: "1px solid #45524C", borderRadius: 6, color: "#EEF0EC", padding: 5, display: "flex" },
  tapeAddIncomeBtn: { width: "100%", background: "#24594A", border: "none", borderRadius: 7, color: "#EEF0EC", padding: "9px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13.5, fontWeight: 500 },
  incomeFormStack: { display: "flex", flexDirection: "column", gap: 8 },
  incomeInput: { background: "#2A362F", border: "1px solid #45524C", borderRadius: 6, color: "#EEF0EC", padding: "9px 10px", fontSize: 14, width: "100%" },
  incomeSelect: { background: "#2A362F", border: "1px solid #45524C", borderRadius: 6, color: "#EEF0EC", padding: "9px 10px", fontSize: 13.5, width: "100%" },
  incomeBtnRow: { display: "flex", gap: 8, marginTop: 2 },
  incomeConfirmBtn: { flex: 1, background: "#24594A", border: "none", borderRadius: 7, color: "#EEF0EC", padding: "10px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 13.5, fontWeight: 600 },
  incomeCancelBtn: { flex: 1, background: "transparent", border: "1px solid #45524C", borderRadius: 7, color: "#EEF0EC", padding: "10px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 13.5 },
  tapePerforation: { display: "flex", justifyContent: "space-between", padding: "0 6px", background: "#1E2A26", borderRadius: "0 0 2px 2px" },
  perfDot: { width: 6, height: 6, borderRadius: "50%", background: "#EEF0EC", transform: "translateY(-3px)" },
  walletBreakdown: { background: "#2A362F", borderRadius: 8, padding: "8px 10px", margin: "6px 0", display: "flex", flexDirection: "column", gap: 4 },
  walletBreakdownRow: { display: "flex", justifyContent: "space-between", fontSize: 12.5 },
  walletBreakdownName: { color: "#C9CFC9" },
  walletBreakdownVal: { fontFamily: "'IBM Plex Mono', monospace", color: "#EEF0EC" },
  manageWalletsLink: { background: "transparent", border: "none", color: "#7FB89F", fontSize: 12, display: "flex", alignItems: "center", gap: 2, padding: "4px 0 0", alignSelf: "flex-start" },

  tabBar: { display: "flex", padding: "14px 10px 6px", gap: 3, overflowX: "auto" },
  tabBtn: { flex: "1 0 auto", minWidth: 50, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "transparent", border: "none", padding: "8px 2px", borderRadius: 8 },
  tabBtnActive: { background: "#1E2A26" },
  tabLabel: { fontSize: 9.5, fontWeight: 500 },

  content: { padding: "10px 14px" },
  sectionTitle: { fontFamily: "'Fraunces', serif", fontSize: 21, fontWeight: 600, margin: "0 0 2px" },
  sectionSubtitle: { fontSize: 12.5, color: "#5B6660", margin: 0 },

  list: { display: "flex", flexDirection: "column", gap: 10 },
  upcomingCard: { display: "flex", background: "#FFFFFF", borderRadius: 10, border: "1px solid #D7DAD2", overflow: "hidden" },
  paymentRow: { display: "flex", background: "#FFFFFF", borderRadius: 10, border: "1px solid #D7DAD2", overflow: "hidden" },
  upcomingTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  upcomingName: { fontSize: 14.5, fontWeight: 600 },
  upcomingAmount: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 14.5, fontWeight: 600 },
  upcomingBottom: { display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" },
  dueTag: { fontSize: 11, background: "#EEF0EC", color: "#5B6660", padding: "2px 8px", borderRadius: 20, fontFamily: "'IBM Plex Mono', monospace" },
  dueTagSoon: { background: "#F6E2DA", color: "#B3541B" },
  categoryTag: { fontSize: 11, background: "#EEF0EC", color: "#5B6660", padding: "2px 8px", borderRadius: 20 },

  payBtn: { marginTop: 8, background: "transparent", border: "1px solid #D7DAD2", borderRadius: 6, padding: "5px 10px", fontSize: 12.5, color: "#24594A", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 },
  payInput: { flex: 1, border: "1px solid #D7DAD2", borderRadius: 6, padding: "5px 7px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 },
  smallBtn: { background: "transparent", border: "1px solid #D7DAD2", borderRadius: 6, padding: "5px 7px", display: "flex" },
  smallBtnSolid: { background: "#24594A", border: "none", borderRadius: 6, padding: "5px 9px", color: "#EEF0EC", display: "flex", alignItems: "center", gap: 4, fontSize: 12.5 },
  smallBtnSolidFlex: { flex: 1, background: "#24594A", border: "none", borderRadius: 6, padding: "8px 0", color: "#EEF0EC", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 12.5, fontWeight: 600 },

  warningBanner: { display: "flex", alignItems: "center", gap: 8, background: "#F6E2DA", border: "1px solid #E3B9A5", color: "#8A3C15", padding: "10px 12px", borderRadius: 8, fontSize: 12.5, marginBottom: 14 },

  quickAddWrap: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  quickAddChip: { display: "flex", alignItems: "center", gap: 4, background: "#FFFFFF", border: "1px solid #D7DAD2", borderRadius: 20, padding: "6px 12px", fontSize: 12.5, color: "#1E2A26" },
  primaryBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#24594A", color: "#EEF0EC", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, width: "100%" },
  secondaryBtn: { background: "transparent", border: "1px solid #D7DAD2", borderRadius: 8, padding: "10px 16px", fontSize: 13.5, color: "#5B6660" },
  secondaryBtnSolidGhost: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#FFFFFF", border: "1px solid #D7DAD2", borderRadius: 8, padding: "10px 16px", fontSize: 13.5, color: "#1E2A26", flex: 1 },

  filterRow: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 },
  filterChip: { fontSize: 11.5, background: "#FFFFFF", border: "1px solid #D7DAD2", borderRadius: 20, padding: "4px 10px", color: "#5B6660" },
  filterChipActive: { background: "#1E2A26", color: "#EEF0EC", border: "1px solid #1E2A26" },

  formCard: { background: "#FFFFFF", border: "1px solid #D7DAD2", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 },
  formLabel: { fontSize: 11.5, color: "#5B6660", marginTop: 8, marginBottom: 2, fontWeight: 500 },
  formInput: { border: "1px solid #D7DAD2", borderRadius: 7, padding: "9px 10px", fontSize: 14, fontFamily: "'Inter', sans-serif", background: "#F9FAF8" },
  freqBtn: { flex: 1, border: "1px solid #D7DAD2", background: "#FFFFFF", borderRadius: 7, padding: "8px 2px", fontSize: 12.5 },
  freqBtnActive: { background: "#1E2A26", color: "#EEF0EC", border: "1px solid #1E2A26" },

  iconBtnGhost: { background: "transparent", border: "1px solid #D7DAD2", borderRadius: 6, padding: 6, display: "flex" },
  iconBtnGhostDanger: { background: "transparent", border: "1px solid #E3B9A5", color: "#A23B3B", borderRadius: 6, padding: 6, display: "flex" },

  dailyConfigCard: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "#1E2A26", borderRadius: 10, padding: "12px 16px", marginBottom: 14, gap: 10 },
  dailyAllocValue: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 600, color: "#EEF0EC", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, marginTop: 4 },
  walletMiniSelect: { background: "#2A362F", border: "1px solid #45524C", borderRadius: 6, color: "#EEF0EC", padding: "5px 8px", fontSize: 11.5, maxWidth: 120 },

  miniHeading: { fontSize: 12.5, fontWeight: 600, color: "#5B6660", display: "block", marginBottom: 8 },
  todayTotalRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  todayTotalValue: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, fontWeight: 700 },
  expenseEntryRow: { display: "flex", alignItems: "center", gap: 10, background: "#FFFFFF", border: "1px solid #D7DAD2", borderRadius: 8, padding: "8px 12px", fontSize: 13.5 },
  expenseEntryNote: { flex: 1 },
  expenseEntryAmount: { fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 },
  expenseDeleteBtn: { background: "transparent", border: "none", color: "#A23B3B", display: "flex", padding: 2 },
  dailyRow: { display: "flex", alignItems: "center", gap: 10, background: "#FFFFFF", border: "1px solid #D7DAD2", borderRadius: 8, padding: "8px 12px", fontSize: 13 },
  dailyDate: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#5B6660", width: 82 },
  dailySpentVal: { fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 },
  dailyAllocSmall: { fontSize: 11.5, color: "#5B6660" },

  chartCard: { background: "#FFFFFF", border: "1px solid #D7DAD2", borderRadius: 10, padding: 14, marginBottom: 14 },
  categorySelect: { border: "1px solid #D7DAD2", borderRadius: 6, padding: "5px 8px", fontSize: 12.5 },

  emptyState: { textAlign: "center", color: "#5B6660", fontSize: 13, padding: "24px 10px", background: "#FFFFFF", border: "1px dashed #D7DAD2", borderRadius: 10 },

  burnRateCard: { display: "flex", flexDirection: "column", background: "#FFFFFF", border: "1px solid #D7DAD2", borderRadius: 10, padding: "12px 14px", marginBottom: 14 },
  burnRateValue: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 700, color: "#1E2A26", margin: "2px 0" },
  burnRateHint: { fontSize: 11, color: "#5B6660" },

  forecastCard: { background: "#1E2A26", borderRadius: 10, padding: "14px 16px", marginBottom: 14 },
  forecastHeader: { display: "flex", alignItems: "center", gap: 6, marginBottom: 8 },
  forecastHeaderText: { color: "#EEF0EC", fontSize: 13, fontWeight: 600 },
  forecastRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" },
  forecastValue: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, fontWeight: 600, color: "#EEF0EC" },
  forecastGoalRow: { display: "flex", justifyContent: "space-between", padding: "3px 0" },
  forecastGoalName: { color: "#C9CFC9", fontSize: 12 },
  forecastGoalNote: { color: "#7FB89F", fontSize: 11.5, fontStyle: "italic" },
  forecastHint: { fontSize: 10.5, color: "#7A8580", marginTop: 8, marginBottom: 0 },

  goalCard: { background: "#FFFFFF", border: "1px solid #D7DAD2", borderRadius: 10, padding: "12px 14px" },
  goalProgressBarBg: { height: 8, background: "#EEF0EC", borderRadius: 6, marginTop: 8, overflow: "hidden" },
  goalProgressBarFill: { height: "100%", background: "#24594A", borderRadius: 6, transition: "width 0.2s" },
  goalStatsRow: { display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#5B6660", marginTop: 4, fontFamily: "'IBM Plex Mono', monospace" },

  lockShell: { fontFamily: "'Inter', sans-serif", background: "#1E2A26", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, color: "#EEF0EC" },
  lockTitle: { fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600 },
  lockSubtitle: { fontSize: 12.5, color: "#B9C2BC", marginTop: 4, marginBottom: 20 },
  dotsRow: { display: "flex", gap: 12, marginBottom: 10 },
  dot: { width: 12, height: 12, borderRadius: "50%", border: "1.5px solid #5B6660" },
  dotFilled: { background: "#EEF0EC", border: "1.5px solid #EEF0EC" },
  lockError: { color: "#E39A9A", fontSize: 12, marginBottom: 10 },
  keypad: { display: "grid", gridTemplateColumns: "repeat(3, 64px)", gap: 14, marginTop: 14 },
  key: { width: 64, height: 64, borderRadius: "50%", background: "#2A362F", border: "1px solid #45524C", color: "#EEF0EC", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" },
  skipLink: { marginTop: 20, background: "transparent", border: "none", color: "#7FB89F", fontSize: 12.5, textDecoration: "underline" },
};
