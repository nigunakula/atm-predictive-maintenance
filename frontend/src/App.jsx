const { useState, useEffect, useMemo, useRef } = React;

// Recharts components from global window
const RechartsObj = window.Recharts || {};
const {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ReferenceLine
} = RechartsObj;

// Backend Risk Factor Definitions (from src/ai_explainer.py & src/generate_data.py)
const BACKEND_FACTORS = [
    { key: "temperature", label: "Temperature", threshold: 85, condition: "temperature > 85", unit: "°C", reason: "ATM temperature is above the safe operating threshold." },
    { key: "network_errors", label: "Network Errors", threshold: 15, condition: "network_errors > 15", unit: "", reason: "Frequent network connectivity issues detected." },
    { key: "dispenser_errors", label: "Dispenser Errors", threshold: 8, condition: "dispenser_errors > 8", unit: "", reason: "Cash dispenser is reporting repeated errors." },
    { key: "transaction_failures", label: "Transaction Failures", threshold: 10, condition: "transaction_failures > 10", unit: "", reason: "Transaction failure rate is unusually high." },
    { key: "cpu_usage", label: "CPU Usage (%)", threshold: 85, condition: "cpu_usage", unit: "%", reason: "ATM CPU utilization" }
];

// Time series simulation for the 5 backend variables.
// This creates a recent trend from the current live reading without artificially
// flattening values below the real thresholds used by the app.
function createTimeSeries(temp, net, disp, cpu, tx) {
    const buildSeries = (current) => {
        const points = [0.2, 0.35, 0.5, 0.7, 0.85, 0.95, 1];
        return points.map((ratio, index) => {
            const value = current * ratio;
            if (index === points.length - 1) return Math.round(current);
            return Math.max(0, Math.round(value));
        });
    };

    const tempSeries = buildSeries(temp);
    const netSeries = buildSeries(net);
    const dispSeries = buildSeries(disp);
    const cpuSeries = buildSeries(cpu);
    const txSeries = buildSeries(tx);

    return [
        { time: "T-6", temperature: tempSeries[0], network_errors: netSeries[0], dispenser_errors: dispSeries[0], cpu_usage: cpuSeries[0], transaction_failures: txSeries[0] },
        { time: "T-5", temperature: tempSeries[1], network_errors: netSeries[1], dispenser_errors: dispSeries[1], cpu_usage: cpuSeries[1], transaction_failures: txSeries[1] },
        { time: "T-4", temperature: tempSeries[2], network_errors: netSeries[2], dispenser_errors: dispSeries[2], cpu_usage: cpuSeries[2], transaction_failures: txSeries[2] },
        { time: "T-3", temperature: tempSeries[3], network_errors: netSeries[3], dispenser_errors: dispSeries[3], cpu_usage: cpuSeries[3], transaction_failures: txSeries[3] },
        { time: "T-2", temperature: tempSeries[4], network_errors: netSeries[4], dispenser_errors: dispSeries[4], cpu_usage: cpuSeries[4], transaction_failures: txSeries[4] },
        { time: "T-1", temperature: tempSeries[5], network_errors: netSeries[5], dispenser_errors: dispSeries[5], cpu_usage: cpuSeries[5], transaction_failures: txSeries[5] },
        { time: "Now", temperature: tempSeries[6], network_errors: netSeries[6], dispenser_errors: dispSeries[6], cpu_usage: cpuSeries[6], transaction_failures: txSeries[6] }
    ];
}

function App() {
    // Navigation Page: "dashboard", "predictions", "reports", "settings"
    const [activePage, setActivePage] = useState("dashboard");

    // User-configurable thresholds (editable in Settings tab)
    const DEFAULT_THRESHOLDS = {
        temperature: { value: 85, enabled: true, label: "Temperature", unit: "°C", key: "temperature", description: "Flag ATM when temperature exceeds this value", min: 0, max: 150 },
        network_errors: { value: 15, enabled: true, label: "Network Errors", unit: "", key: "network_errors", description: "Flag ATM when network error count exceeds this value", min: 0, max: 500 },
        dispenser_errors: { value: 8, enabled: true, label: "Dispenser Errors", unit: "", key: "dispenser_errors", description: "Flag ATM when dispenser error count exceeds this value", min: 0, max: 200 },
        transaction_failures: { value: 10, enabled: true, label: "Transaction Failures", unit: "", key: "transaction_failures", description: "Flag ATM when transaction failure count exceeds this value", min: 0, max: 500 },
        cpu_usage: { value: 85, enabled: true, label: "CPU Usage", unit: "%", key: "cpu_usage", description: "Flag ATM when CPU utilization exceeds this value", min: 0, max: 100 }
    };

    const buildRiskProfileFromTelemetry = (input, thresholdMap, prediction = 0) => {
        const reasons = [];
        const checks = [
            { key: "temperature", reason: "ATM temperature is above the safe operating threshold." },
            { key: "network_errors", reason: "Frequent network connectivity issues detected." },
            { key: "dispenser_errors", reason: "Cash dispenser is reporting repeated errors." },
            { key: "transaction_failures", reason: "Transaction failure rate is unusually high." },
            { key: "cpu_usage", reason: "ATM CPU utilization is above the configured threshold." }
        ];

        checks.forEach(({ key, reason }) => {
            const factor = thresholdMap[key];
            if (!factor || !factor.enabled) return;
            if (Number(input[key]) > Number(factor.value)) {
                reasons.push(reason);
            }
        });

        let risk_level = "LOW RISK";
        let recommendation = "ATM is operating normally. No immediate action required.";

        if (prediction === 1 || reasons.length >= 3) {
            risk_level = "HIGH RISK";
            recommendation = "Schedule preventive maintenance within 48 hours.";
        } else if (reasons.length >= 2) {
            risk_level = "MEDIUM RISK";
            recommendation = "Multiple warning indicators detected. Monitor closely and schedule maintenance during the next service window.";
        }

        let status_banner = "✅ ATM Operating Normally";
        if (risk_level === "HIGH RISK") {
            status_banner = "⚠️ High Risk: ATM Failure Likely";
        } else if (risk_level === "MEDIUM RISK") {
            status_banner = "⚠️ Medium Risk: ATM Requires Attention";
        }

        return { risk_level, reasons, recommendation, status_banner };
    };

    const [thresholds, setThresholds] = useState(() => JSON.parse(JSON.stringify(DEFAULT_THRESHOLDS)));
    const [settingsSaved, setSettingsSaved] = useState(false);

    const updateThreshold = (key, val) => {
        const num = parseFloat(val);
        if (isNaN(num)) return;
        setThresholds(prev => ({ ...prev, [key]: { ...prev[key], value: num } }));
        setSettingsSaved(false);
    };

    const toggleFactorEnabled = (key) => {
        setThresholds(prev => ({
            ...prev,
            [key]: { ...prev[key], enabled: !prev[key].enabled }
        }));
        setSettingsSaved(false);
    };

    const saveThresholds = () => {
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 2500);
    };

    const resetThresholds = () => {
        setThresholds(JSON.parse(JSON.stringify(DEFAULT_THRESHOLDS)));
        setSettingsSaved(false);
    };

    // Dataset from data/atm_data.csv
    const [dataset, setDataset] = useState({
        total_atms: 0,
        normal_count: 0,
        failure_count: 0,
        atms: []
    });

    // Operation Mode: "select" (from dataset) or "dry_run" (custom new ATM)
    const [mode, setMode] = useState("select");

    // Current Telemetry Inputs
    const [telemetry, setTelemetry] = useState({
        atm_id: "-",
        temperature: 0,
        network_errors: 0,
        dispenser_errors: 0,
        cpu_usage: 0,
        transaction_failures: 0
    });

    const [isPredicting, setIsPredicting] = useState(false);

    // Whether a prediction has been run (controls right-panel display)
    const [resultReady, setResultReady] = useState(false);

    // Current Prediction Output (only shown after user clicks Predict)
    const [result, setResult] = useState(null);
    const scrollContainerRef = useRef(null);

    // Chart Filter
    const [activeChartMetric, setActiveChartMetric] = useState("all");
    const chartYAxisDomains = {
        all: [0, 150],
        temperature: [0, 150],
        network_errors: [0, 30],
        dispenser_errors: [0, 30],
        cpu_usage: [0, 100],
        transaction_failures: [0, 30]
    };

    // Reports pagination
    const [reportPage, setReportPage] = useState(1);
    const REPORT_PAGE_SIZE = 10;

    // Search and filters for tables
    const [tableSearch, setTableSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");

    // ATM Search state (replaces dropdown for 1000 ATMs)
    const [atmSearchQuery, setAtmSearchQuery] = useState("");
    const [atmSearchSuggestions, setAtmSearchSuggestions] = useState([]);
    const [atmSearchFocused, setAtmSearchFocused] = useState(false);
    const [atmSearchLoading, setAtmSearchLoading] = useState(false);
    const [atmSearchError, setAtmSearchError] = useState("");

    // Load dataset from backend on mount without pre-filling the live prediction form
    useEffect(() => {
        fetch('/api/atms')
            .then(res => res.json())
            .then(data => {
                setDataset(data);
            })
            .catch(err => console.error("Error loading data/atm_data.csv:", err));
    }, []);

    // Select an ATM from the dataset (Mode: select) — only populates form, does NOT run prediction
    const selectAtmFromDataset = (atmRow) => {
        setMode("select");
        setResultReady(false);
        setTelemetry({
            atm_id: atmRow.atm_id,
            temperature: parseFloat(atmRow.temperature),
            network_errors: parseInt(atmRow.network_errors),
            dispenser_errors: parseInt(atmRow.dispenser_errors),
            cpu_usage: parseFloat(atmRow.cpu_usage),
            transaction_failures: parseInt(atmRow.transaction_failures)
        });
    };

    // Switch to Dry Run mode for a new ATM — resets the form to a blank, zeroed state
    const startDryRun = () => {
        setMode("dry_run");
        setResultReady(false);
        setAtmSearchQuery("");
        setAtmSearchSuggestions([]);
        setAtmSearchError("");
        setTelemetry({
            atm_id: "",
            temperature: 0,
            network_errors: 0,
            dispenser_errors: 0,
            cpu_usage: 0,
            transaction_failures: 0
        });
    };

    // ATM Search: filter suggestions from loaded dataset as user types
    const handleAtmSearchInput = (query) => {
        setAtmSearchQuery(query);
        setAtmSearchError("");
        if (query.trim().length === 0) {
            setAtmSearchSuggestions([]);
            return;
        }
        const q = query.trim().toUpperCase();
        const matches = dataset.atms
            .filter(a => a.atm_id.toUpperCase().includes(q))
            .slice(0, 8);
        setAtmSearchSuggestions(matches);
    };

    // ATM Search: load a specific ATM by ID — only populates form values, does NOT run prediction
    const loadAtmById = async (id) => {
        const query = (id || atmSearchQuery).trim();
        if (!query) return;
        setAtmSearchLoading(true);
        setAtmSearchError("");
        setAtmSearchSuggestions([]);
        try {
            // Use the /api/atms endpoint with search to get raw sensor data only
            const res = await fetch(`/api/atms?search=${encodeURIComponent(query)}&limit=1`);
            if (res.ok) {
                const data = await res.json();
                if (data.atms && data.atms.length > 0) {
                    const row = data.atms[0];
                    setAtmSearchQuery(row.atm_id);
                    setAtmSearchFocused(false);
                    setMode("select");
                    setResultReady(false);
                    setTelemetry({
                        atm_id: row.atm_id,
                        temperature: parseFloat(row.temperature),
                        network_errors: parseInt(row.network_errors),
                        dispenser_errors: parseInt(row.dispenser_errors),
                        cpu_usage: parseFloat(row.cpu_usage),
                        transaction_failures: parseInt(row.transaction_failures)
                    });
                } else {
                    setAtmSearchError(`ATM "${query}" not found in dataset.`);
                }
            } else {
                const errData = await res.json().catch(() => ({}));
                setAtmSearchError(errData.detail || `ATM "${query}" not found.`);
            }
        } catch (e) {
            setAtmSearchError("Network error. Ensure the backend is running.");
        } finally {
            setAtmSearchLoading(false);
        }
    };

    // Handle Enter key in ATM search input
    const handleAtmSearchKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            loadAtmById();
        }
        if (e.key === "Escape") {
            setAtmSearchSuggestions([]);
            setAtmSearchFocused(false);
        }
    };


    // Execute prediction on backend
    const runPredict = async (data = telemetry) => {
        setIsPredicting(true);
        try {
            const res = await fetch('/api/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    atm_id: data.atm_id,
                    temperature: parseFloat(data.temperature),
                    network_errors: parseInt(data.network_errors),
                    dispenser_errors: parseInt(data.dispenser_errors),
                    cpu_usage: parseFloat(data.cpu_usage),
                    transaction_failures: parseInt(data.transaction_failures)
                })
            });

            if (res.ok) {
                const json = await res.json();
                const localRisk = buildRiskProfileFromTelemetry(
                    {
                        temperature: Number(data.temperature),
                        network_errors: Number(data.network_errors),
                        dispenser_errors: Number(data.dispenser_errors),
                        cpu_usage: Number(data.cpu_usage),
                        transaction_failures: Number(data.transaction_failures)
                    },
                    thresholds,
                    Number(json.prediction ?? 0)
                );

                setResult({
                    ...json,
                    ...localRisk,
                    status_banner: localRisk.status_banner,
                    failure_status: Number(json.failure_status ?? json.prediction ?? 0)
                });
                setResultReady(true);

                if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }
        } catch (e) {
            console.error("Predict error:", e);
        } finally {
            setTimeout(() => setIsPredicting(false), 200);
        }
    };

    const handleInputChange = (field, value) => {
        const parsed = Number(value);
        setTelemetry(prev => ({ ...prev, [field]: Number.isFinite(parsed) ? parsed : 0 }));
    };

    // Filtered ATMs from dataset for tables
    const filteredAtms = useMemo(() => {
        if (!dataset.atms) return [];
        return dataset.atms.filter(atm => {
            const matchesId = tableSearch === "" || atm.atm_id.toLowerCase().includes(tableSearch.toLowerCase());
            const matchesStatus = statusFilter === "ALL" || 
                (statusFilter === "1" && atm.failure_status === 1) || 
                (statusFilter === "0" && atm.failure_status === 0);
            return matchesId && matchesStatus;
        });
    }, [dataset.atms, tableSearch, statusFilter]);

    const reportItems = useMemo(() => {
        const atms = dataset.atms || [];
        const start = (reportPage - 1) * REPORT_PAGE_SIZE;
        return atms.slice(start, start + REPORT_PAGE_SIZE);
    }, [dataset.atms, reportPage]);

    const reportPageCount = useMemo(() => {
        const total = (dataset.atms || []).length;
        return Math.max(1, Math.ceil(total / REPORT_PAGE_SIZE));
    }, [dataset.atms]);

    // Chart data
    const chartData = useMemo(() => {
        return createTimeSeries(
            telemetry.temperature,
            telemetry.network_errors,
            telemetry.dispenser_errors,
            telemetry.cpu_usage,
            telemetry.transaction_failures
        );
    }, [telemetry]);

    const isHigh = result?.risk_level === "HIGH RISK";
    const isMed = result?.risk_level === "MEDIUM RISK";

    return (
        <div className="flex h-screen bg-[#070d18] text-slate-100 font-sans overflow-hidden">
            {/* ------------------------------------------------------------- */}
            {/* Sidebar Navigation                                            */}
            {/* ------------------------------------------------------------- */}
            <aside className="w-60 bg-[#0a1224] border-r border-slate-800 flex flex-col justify-between flex-shrink-0 select-none">
                <div>
                    {/* Header */}
                    <div className="p-4 border-b border-slate-800 flex items-center space-x-3 bg-[#080e1d]">
                        <span className="text-2xl">🏦</span>
                        <div>
                            <h1 className="font-bold text-sm tracking-tight text-white leading-tight">ATM Predictive Maintenance</h1>
                        </div>
                    </div>

                    {/* Navigation Links */}
                    <nav className="p-3 space-y-1 mt-2">
                        {[
                            { id: "dashboard", label: "Dashboard", icon: "📊" },
                            { id: "predictions", label: "Predictions", icon: "⚡" },
                            { id: "reports", label: "Reports", icon: "📋" },
                            { id: "settings", label: "Settings", icon: "⚙️" }
                        ].map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActivePage(item.id)}
                                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                                    activePage === item.id 
                                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                                }`}
                            >
                                <span className="text-sm">{item.icon}</span>
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </nav>

                    {/* Active ATM Display & Mode Indicator */}
                    <div className="m-3 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1.5">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] uppercase font-bold text-slate-400">Current ATM</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                mode === "dry_run" ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                            }`}>
                                {mode === "dry_run" ? "Dry Run" : "From Dataset"}
                            </span>
                        </div>
                        <p className="font-mono font-bold text-sky-400 text-sm">{telemetry.atm_id || "-"}</p>
                    </div>

                    {/* Dataset Quick Stats in Sidebar */}
                    <div className="mx-3 p-3 rounded-xl bg-[#081022] border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                        <p className="font-semibold text-slate-300 text-xs mb-1">Dataset: data/atm_data.csv</p>
                        <div className="flex justify-between">
                            <span>Total ATMs:</span>
                            <span className="font-mono text-white font-bold">{dataset.total_atms}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Normal (0):</span>
                            <span className="font-mono text-emerald-400 font-bold">{dataset.normal_count}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Failure (1):</span>
                            <span className="font-mono text-rose-400 font-bold">{dataset.failure_count}</span>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-800 bg-[#080e1d] text-[11px] text-slate-500">
                    <p>ATM Predictive Maintenance</p>
                </div>
            </aside>

            {/* ------------------------------------------------------------- */}
            {/* Main Area                                                     */}
            {/* ------------------------------------------------------------- */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-16 border-b border-slate-800 bg-[#0a1224] px-8 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center space-x-3">
                        <span className="text-xl">🏦</span>
                        <div>
                            <h2 className="text-base font-bold tracking-tight text-white">
                                ATM Predictive Maintenance Dashboard
                            </h2>
                            <p className="text-[11px] text-slate-400">
                                Predict ATM failures before they occur.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-3 text-xs">
                        <span className="text-slate-400">ATM:</span>
                        <span className="font-mono font-bold text-sky-400 bg-slate-800 px-2.5 py-1 rounded border border-slate-700">
                            {telemetry.atm_id}
                        </span>
                        <span className="text-slate-500">|</span>
                        <span className="text-slate-400">Mode:</span>
                        <span className="font-semibold text-slate-200">
                            {mode === "dry_run" ? "Dry Run (New ATM)" : "Selected from Dataset"}
                        </span>
                    </div>
                </header>

                <main ref={scrollContainerRef} className="flex-1 overflow-y-auto p-8 space-y-6 bg-[#070d18]">
                    {/* --------------------------------------------------------- */}
                    {/* SCREEN 1: PREDICTIONS                                     */}
                    {/* --------------------------------------------------------- */}
                    {activePage === "predictions" && (
                        <div className="space-y-6">
                            {/* Mode Controls: Search ATM by ID vs Dry Run New ATM */}
                            <div className="p-4 rounded-xl bg-[#0b152b] border border-slate-800 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                                    {/* ATM Search Box */}
                                    <div className="flex-1 space-y-1.5">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                            🔍 Search ATM by ID ({dataset.total_atms} ATMs available)
                                        </span>
                                        <div className="relative">
                                            <div className="flex items-stretch gap-2">
                                                <div className="relative flex-1">
                                                    <input
                                                        type="text"
                                                        value={atmSearchQuery}
                                                        placeholder="Type ATM ID (e.g. ATM567) and press Enter..."
                                                        onChange={(e) => handleAtmSearchInput(e.target.value)}
                                                        onKeyDown={handleAtmSearchKeyDown}
                                                        onFocus={() => setAtmSearchFocused(true)}
                                                        onBlur={() => setTimeout(() => { setAtmSearchFocused(false); setAtmSearchSuggestions([]); }, 180)}
                                                        className="w-full bg-[#081022] border border-slate-600 rounded-lg px-3 py-2 text-xs text-sky-300 font-mono font-bold focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40 placeholder:text-slate-400 transition"
                                                    />
                                                    {/* Autocomplete Suggestions Dropdown */}
                                                    {atmSearchFocused && atmSearchSuggestions.length > 0 && (
                                                        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-[#0d1a35] border border-slate-700 rounded-xl shadow-2xl shadow-black/40 overflow-hidden">
                                                            {atmSearchSuggestions.map(a => (
                                                                <button
                                                                    key={a.atm_id}
                                                                    type="button"
                                                                    onMouseDown={() => {
                                                                        setAtmSearchQuery(a.atm_id);
                                                                        setAtmSearchSuggestions([]);
                                                                        selectAtmFromDataset(a);
                                                                    }}
                                                                    className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-sky-600/20 transition text-left border-b border-slate-800/60 last:border-0"
                                                                >
                                                                    <span className="font-mono font-bold text-sky-400">{a.atm_id}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => loadAtmById()}
                                                    disabled={atmSearchLoading || !atmSearchQuery.trim()}
                                                    className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1.5"
                                                >
                                                    {atmSearchLoading ? (
                                                        <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                                    ) : (
                                                        <span>Load →</span>
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={startDryRun}
                                                    className="px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 whitespace-nowrap bg-purple-950/40 text-purple-300 border border-purple-500/30 hover:bg-purple-900/50"
                                                >
                                                    <span>✨</span>
                                                    <span>Dry Run</span>
                                                </button>
                                            </div>

                                            {/* Error Message */}
                                            {atmSearchError && (
                                                <p className="mt-1.5 text-[11px] text-rose-400 font-medium">
                                                    ⚠️ {atmSearchError}
                                                </p>
                                            )}

                                            {/* Helper hint */}
                                            {!atmSearchError && (
                                                <p className="mt-1 text-[10px] text-slate-600">
                                                    Type an ATM ID and press <kbd className="text-slate-400 bg-slate-800 px-1 rounded">Enter</kbd> or click <strong className="text-slate-500">Load →</strong> to fetch its sensor data
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>


                            {/* Two-Column Grid: ATM Information on Left | Risk & Recommendations on Right */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                {/* Left Column: ATM Information (5 Cols) */}
                                <div className="lg:col-span-5 space-y-6">
                                    <div className="bg-[#0b152b] rounded-2xl border border-slate-800 p-6 shadow-xl space-y-5">
                                        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                                            <h3 className="font-bold text-base text-white">ATM Information</h3>
                                            <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                                                mode === "dry_run" ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" : "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                                            }`}>
                                                {mode === "dry_run" ? "Dry Run Mode" : "Dataset Record"}
                                            </span>
                                        </div>

                                        <form onSubmit={(e) => { e.preventDefault(); runPredict(); }} className="space-y-4">
                                            {/* ATM ID */}
                                            <div>
                                                <label className="text-xs font-semibold text-slate-300 block mb-1">
                                                    ATM ID:
                                                </label>
                                                <input 
                                                    type="text" 
                                                    value={telemetry.atm_id === "-" ? "" : telemetry.atm_id}
                                                    placeholder="Enter new ATM ID and adjust its values below"
                                                    onChange={(e) => {
                                                        setMode("dry_run");
                                                        setTelemetry({ ...telemetry, atm_id: e.target.value });
                                                    }}
                                                    className="w-full bg-[#081022] border border-slate-700 rounded-lg px-3 py-2 text-xs text-sky-400 font-mono font-bold focus:outline-none placeholder:text-slate-400"
                                                />
                                            </div>

                                            {/* Temperature */}
                                            <div className="p-3 rounded-xl bg-[#081022] border border-slate-800">
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className="text-xs font-semibold text-slate-300">
                                                        Temperature:
                                                    </label>
                                                    <div className="flex items-center space-x-1">
                                                        <input 
                                                            type="number"
                                                            value={telemetry.temperature}
                                                            onChange={(e) => {
                                                                setMode("dry_run");
                                                                handleInputChange("temperature", e.target.value);
                                                            }}
                                                            className="w-16 bg-[#0c1833] border border-slate-700 rounded px-2 py-0.5 text-xs text-right font-mono font-bold text-sky-400 focus:outline-none"
                                                        />
                                                        <span className="text-xs text-slate-400">°C</span>
                                                    </div>
                                                </div>
                                                <input 
                                                    type="range" min="0" max="120"
                                                    value={telemetry.temperature}
                                                    onChange={(e) => {
                                                        setMode("dry_run");
                                                        handleInputChange("temperature", e.target.value);
                                                    }}
                                                    className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                                                />
                                                <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                                                    <span>0°C</span>
                                                    <span className={telemetry.temperature > 85 ? "text-rose-400 font-bold" : "text-slate-400"}>
                                                        Threshold: &gt; 85°C
                                                    </span>
                                                    <span>120°C</span>
                                                </div>
                                            </div>

                                            {/* Network Errors */}
                                            <div className="p-3 rounded-xl bg-[#081022] border border-slate-800">
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className="text-xs font-semibold text-slate-300">
                                                        Network Errors:
                                                    </label>
                                                    <input 
                                                        type="number"
                                                        value={telemetry.network_errors}
                                                        onChange={(e) => {
                                                            setMode("dry_run");
                                                            handleInputChange("network_errors", e.target.value);
                                                        }}
                                                        className="w-16 bg-[#0c1833] border border-slate-700 rounded px-2 py-0.5 text-xs text-right font-mono font-bold text-sky-400 focus:outline-none"
                                                    />
                                                </div>
                                                <input 
                                                    type="range" min="0" max="60"
                                                    value={telemetry.network_errors}
                                                    onChange={(e) => {
                                                        setMode("dry_run");
                                                        handleInputChange("network_errors", e.target.value);
                                                    }}
                                                    className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                                                />
                                                <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                                                    <span>0</span>
                                                    <span className={telemetry.network_errors > 15 ? "text-rose-400 font-bold" : "text-slate-400"}>
                                                        Threshold: &gt; 15
                                                    </span>
                                                    <span>60</span>
                                                </div>
                                            </div>

                                            {/* Dispenser Errors */}
                                            <div className="p-3 rounded-xl bg-[#081022] border border-slate-800">
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className="text-xs font-semibold text-slate-300">
                                                        Dispenser Errors:
                                                    </label>
                                                    <input 
                                                        type="number"
                                                        value={telemetry.dispenser_errors}
                                                        onChange={(e) => {
                                                            setMode("dry_run");
                                                            handleInputChange("dispenser_errors", e.target.value);
                                                        }}
                                                        className="w-16 bg-[#0c1833] border border-slate-700 rounded px-2 py-0.5 text-xs text-right font-mono font-bold text-sky-400 focus:outline-none"
                                                    />
                                                </div>
                                                <input 
                                                    type="range" min="0" max="40"
                                                    value={telemetry.dispenser_errors}
                                                    onChange={(e) => {
                                                        setMode("dry_run");
                                                        handleInputChange("dispenser_errors", e.target.value);
                                                    }}
                                                    className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                                                />
                                                <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                                                    <span>0</span>
                                                    <span className={telemetry.dispenser_errors > 8 ? "text-rose-400 font-bold" : "text-slate-400"}>
                                                        Threshold: &gt; 8
                                                    </span>
                                                    <span>40</span>
                                                </div>
                                            </div>

                                            {/* CPU Usage */}
                                            <div className="p-3 rounded-xl bg-[#081022] border border-slate-800">
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className="text-xs font-semibold text-slate-300">
                                                        CPU Usage:
                                                    </label>
                                                    <div className="flex items-center space-x-1">
                                                        <input 
                                                            type="number"
                                                            value={telemetry.cpu_usage}
                                                            onChange={(e) => {
                                                                setMode("dry_run");
                                                                handleInputChange("cpu_usage", e.target.value);
                                                            }}
                                                            className="w-16 bg-[#0c1833] border border-slate-700 rounded px-2 py-0.5 text-xs text-right font-mono font-bold text-sky-400 focus:outline-none"
                                                        />
                                                        <span className="text-xs text-slate-400">%</span>
                                                    </div>
                                                </div>
                                                <input 
                                                    type="range" min="0" max="100"
                                                    value={telemetry.cpu_usage}
                                                    onChange={(e) => {
                                                        setMode("dry_run");
                                                        handleInputChange("cpu_usage", e.target.value);
                                                    }}
                                                    className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                                                />
                                                <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                                                    <span>0%</span>
                                                    <span className={telemetry.cpu_usage > 85 ? "text-rose-400 font-bold" : "text-slate-400"}>
                                                        Threshold: &gt; 85
                                                    </span>
                                                    <span>100%</span>
                                                </div>
                                            </div>

                                            {/* Transaction Failures */}
                                            <div className="p-3 rounded-xl bg-[#081022] border border-slate-800">
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className="text-xs font-semibold text-slate-300">
                                                        Transaction Failures:
                                                    </label>
                                                    <input 
                                                        type="number"
                                                        value={telemetry.transaction_failures}
                                                        onChange={(e) => {
                                                            setMode("dry_run");
                                                            handleInputChange("transaction_failures", e.target.value);
                                                        }}
                                                        className="w-16 bg-[#0c1833] border border-slate-700 rounded px-2 py-0.5 text-xs text-right font-mono font-bold text-sky-400 focus:outline-none"
                                                    />
                                                </div>
                                                <input 
                                                    type="range" min="0" max="50"
                                                    value={telemetry.transaction_failures}
                                                    onChange={(e) => {
                                                        setMode("dry_run");
                                                        handleInputChange("transaction_failures", e.target.value);
                                                    }}
                                                    className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                                                />
                                                <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                                                    <span>0</span>
                                                    <span className={telemetry.transaction_failures > 10 ? "text-rose-400 font-bold" : "text-slate-400"}>
                                                        Threshold: &gt; 10
                                                    </span>
                                                    <span>50</span>
                                                </div>
                                            </div>

                                            {/* Predict / Dry Run Button */}
                                            <button
                                                type="submit"
                                                disabled={isPredicting}
                                                className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition flex items-center justify-center space-x-2"
                                            >
                                                {isPredicting ? (
                                                    <span>Predicting...</span>
                                                ) : (
                                                    <span>{mode === "dry_run" ? "[ Dry Run Values for " + telemetry.atm_id + " ]" : "[ Predict ATM Health ]"}</span>
                                                )}
                                            </button>
                                        </form>
                                    </div>
                                </div>

                                {/* Right Column: Risk Analysis, Recommendation, Health Metrics (7 Cols) */}
                                <div className="lg:col-span-7 space-y-6">

                                    {/* === WAITING STATE: shown until user clicks Predict === */}
                                    {!resultReady && (
                                        <div className="flex flex-col items-center justify-center gap-5 p-10 rounded-2xl bg-[#0b152b] border border-dashed border-slate-700 text-center">
                                            <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-3xl">
                                                🏦
                                            </div>
                                            <div>
                                                <h3 className="text-base font-bold text-slate-300 mb-1">
                                                    {telemetry.atm_id !== "ATM1" && mode === "select"
                                                        ? `${telemetry.atm_id} loaded — ready to predict`
                                                        : "Select an ATM or enter custom values"}
                                                </h3>
                                                <p className="text-xs text-slate-500">
                                                    Click <span className="text-sky-400 font-semibold">Predict ATM Health</span> on the left to run the ML model and see results here.
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/60 border border-slate-700 text-[11px] text-slate-500">
                                                <span>⬅️</span>
                                                <span>Hit the predict button to analyse</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* === RESULT STATE: shown only after prediction runs === */}
                                    {resultReady && result && (
                                        <>
                                            {/* Status Alert Banner */}
                                            <div className={`p-4 rounded-xl font-bold text-sm border ${
                                                isHigh
                                                    ? "bg-rose-500/15 border-rose-500/40 text-rose-400"
                                                    : isMed
                                                    ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                                                    : "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                                            }`}>
                                                {result.status_banner}
                                            </div>

                                            {/* Risk Analysis Section */}
                                            <div className="bg-[#0b152b] rounded-2xl border border-slate-800 p-6 shadow-xl space-y-5">
                                                <div className="flex items-center space-x-3">
                                                    <span className="text-3xl">{isHigh ? "🚨" : isMed ? "⚠️" : "🟢"}</span>
                                                    <div>
                                                        <h3 className={`text-2xl font-black ${
                                                            isHigh ? "text-rose-400" : isMed ? "text-amber-400" : "text-emerald-400"
                                                        }`}>
                                                            {result.risk_level}
                                                        </h3>
                                                        <p className="text-xs text-slate-400 mt-0.5">
                                                            failure_status: {result.failure_status}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Reasons Section — shown FIRST */}
                                            <div className="bg-[#0b152b] rounded-2xl border border-slate-800 p-6 shadow-xl space-y-3">
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                                    Reasons
                                                </h4>
                                                {result.reasons && result.reasons.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {result.reasons.map((reason, idx) => (
                                                            <div key={idx} className="flex items-start space-x-2 text-xs text-slate-300">
                                                                <span className="text-rose-400 mt-0.5">•</span>
                                                                <span>{reason}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-emerald-400">
                                                        • No abnormal threshold breaches.
                                                    </p>
                                                )}
                                            </div>

                                            {/* Recommendation Section — shown AFTER Reasons */}
                                            <div className="bg-[#0b152b] rounded-2xl border border-slate-800 p-6 shadow-xl space-y-3">
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                                    Recommendation
                                                </h4>
                                                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                                                    <p className="text-sm font-semibold text-white">
                                                        {result.recommendation}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* LangChain Analysis Section */}
                                            <div className="bg-[#0b152b] rounded-2xl border border-slate-800 p-6 shadow-xl space-y-3">
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                                    LangChain Analysis
                                                </h4>
                                                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                                                    <pre className="text-xs leading-6 text-slate-200 whitespace-pre-line font-mono">
                                                        {result.langchain_analysis || "No AI analysis generated yet."}
                                                    </pre>
                                                </div>
                                            </div>

                                            {/* System Health Metrics */}
                                            <div className="bg-[#0b152b] rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-800">
                                                    System Health Metrics
                                                </h4>
                                                <div className="space-y-2 text-xs font-mono">
                                                    <div className="flex justify-between py-1.5 px-3 rounded bg-[#081022]">
                                                        <span className="text-slate-400">Temperature</span>
                                                        <span className="text-sky-400 font-bold">{telemetry.temperature}°C</span>
                                                    </div>
                                                    <div className="flex justify-between py-1.5 px-3 rounded bg-[#081022]">
                                                        <span className="text-slate-400">Network Errors</span>
                                                        <span className="text-sky-400 font-bold">{telemetry.network_errors}</span>
                                                    </div>
                                                    <div className="flex justify-between py-1.5 px-3 rounded bg-[#081022]">
                                                        <span className="text-slate-400">Dispenser Errors</span>
                                                        <span className="text-sky-400 font-bold">{telemetry.dispenser_errors}</span>
                                                    </div>
                                                    <div className="flex justify-between py-1.5 px-3 rounded bg-[#081022]">
                                                        <span className="text-slate-400">CPU Usage</span>
                                                        <span className="text-sky-400 font-bold">{telemetry.cpu_usage}%</span>
                                                    </div>
                                                    <div className="flex justify-between py-1.5 px-3 rounded bg-[#081022]">
                                                        <span className="text-slate-400">Transaction Failures</span>
                                                        <span className="text-sky-400 font-bold">{telemetry.transaction_failures}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Interactive Charts (Recharts) */}
                            <div className="bg-[#0b152b] rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                        Interactive Charts (Recharts)
                                    </h4>

                                    <div className="flex flex-wrap gap-1.5 bg-[#081022] p-1 rounded-xl border border-slate-800">
                                        {[
                                            { id: "all", label: "All" },
                                            { id: "temperature", label: "Temperature" },
                                            { id: "network_errors", label: "Network Errors" },
                                            { id: "dispenser_errors", label: "Dispenser Errors" },
                                            { id: "cpu_usage", label: "CPU Usage" },
                                            { id: "transaction_failures", label: "Transaction Failures" }
                                        ].map(tab => (
                                            <button
                                                key={tab.id}
                                                onClick={() => setActiveChartMetric(tab.id)}
                                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                                                    activeChartMetric === tab.id ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                                                }`}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="h-72 w-full pt-4">
                                    {ResponsiveContainer ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
                                                <YAxis stroke="#94a3b8" fontSize={11} domain={chartYAxisDomains[activeChartMetric] || [0, 150]} />
                                                <Tooltip 
                                                    contentStyle={{ backgroundColor: '#0b152b', borderColor: '#334155', borderRadius: '10px', fontSize: '12px' }} 
                                                    itemStyle={{ color: '#f8fafc' }}
                                                />
                                                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

                                                {(activeChartMetric === "all" || activeChartMetric === "temperature") && (
                                                    <ReferenceLine
                                                        y={thresholds.temperature.value}
                                                        stroke="#ef4444"
                                                        strokeDasharray="4 4"
                                                        label={{ value: String(thresholds.temperature.value), fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }}
                                                    />
                                                )}
                                                {(activeChartMetric === "all" || activeChartMetric === "cpu_usage") && (
                                                    <ReferenceLine
                                                        y={thresholds.cpu_usage.value}
                                                        stroke="#38bdf8"
                                                        strokeDasharray="4 4"
                                                        label={{ value: String(thresholds.cpu_usage.value), fill: '#38bdf8', fontSize: 10, position: 'insideTopRight' }}
                                                    />
                                                )}
                                                {(activeChartMetric === "all" || activeChartMetric === "network_errors") && (
                                                    <ReferenceLine
                                                        y={thresholds.network_errors.value}
                                                        stroke="#f59e0b"
                                                        strokeDasharray="4 4"
                                                        label={{ value: String(thresholds.network_errors.value), fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }}
                                                    />
                                                )}
                                                {(activeChartMetric === "all" || activeChartMetric === "dispenser_errors") && (
                                                    <ReferenceLine
                                                        y={thresholds.dispenser_errors.value}
                                                        stroke="#a855f7"
                                                        strokeDasharray="4 4"
                                                        label={{ value: String(thresholds.dispenser_errors.value), fill: '#a855f7', fontSize: 10, position: 'insideTopRight' }}
                                                    />
                                                )}
                                                {(activeChartMetric === "all" || activeChartMetric === "transaction_failures") && (
                                                    <ReferenceLine
                                                        y={thresholds.transaction_failures.value}
                                                        stroke="#ec4899"
                                                        strokeDasharray="4 4"
                                                        label={{ value: String(thresholds.transaction_failures.value), fill: '#ec4899', fontSize: 10, position: 'insideTopRight' }}
                                                    />
                                                )}

                                                {(activeChartMetric === "all" || activeChartMetric === "temperature") && (
                                                    <Line type="monotone" dataKey="temperature" name="Temperature" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4 }} />
                                                )}
                                                {(activeChartMetric === "all" || activeChartMetric === "cpu_usage") && (
                                                    <Line type="monotone" dataKey="cpu_usage" name="CPU Usage (%)" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 4 }} />
                                                )}
                                                {(activeChartMetric === "all" || activeChartMetric === "network_errors") && (
                                                    <Line type="monotone" dataKey="network_errors" name="Network Errors" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                                                )}
                                                {(activeChartMetric === "all" || activeChartMetric === "dispenser_errors") && (
                                                    <Line type="monotone" dataKey="dispenser_errors" name="Dispenser Errors" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
                                                )}
                                                {(activeChartMetric === "all" || activeChartMetric === "transaction_failures") && (
                                                    <Line type="monotone" dataKey="transaction_failures" name="Transaction Failures" stroke="#ec4899" strokeWidth={2} dot={{ r: 3 }} />
                                                )}
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --------------------------------------------------------- */}
                    {/* SCREEN 2: DASHBOARD (Overall ATM Health from Dataset)      */}
                    {/* --------------------------------------------------------- */}
                    {activePage === "dashboard" && (
                        <div className="space-y-6">
                            {/* Summary Cards directly from data/atm_data.csv */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="p-4 rounded-xl bg-[#0b152b] border border-slate-800">
                                    <span className="text-xs text-slate-400 block mb-1">Total ATMs in Dataset</span>
                                    <h3 className="text-2xl font-bold text-white font-mono">{dataset.total_atms}</h3>
                                    <span className="text-[11px] text-slate-500 mt-1 block">Source: data/atm_data.csv</span>
                                </div>
                                <div className="p-4 rounded-xl bg-[#0b152b] border border-slate-800">
                                    <span className="text-xs text-slate-400 block mb-1">Normal (failure_status = 0)</span>
                                    <h3 className="text-2xl font-bold text-emerald-400 font-mono">{dataset.normal_count}</h3>
                                    <span className="text-[11px] text-emerald-500/80 mt-1 block">Operating normally</span>
                                </div>
                                <div className="p-4 rounded-xl bg-[#0b152b] border border-slate-800">
                                    <span className="text-xs text-slate-400 block mb-1">Failure Risk (failure_status = 1)</span>
                                    <h3 className="text-2xl font-bold text-rose-400 font-mono">{dataset.failure_count}</h3>
                                    <span className="text-[11px] text-rose-500/80 mt-1 block">Failure conditions met</span>
                                </div>
                            </div>

                            {/* Dataset Table */}
                            <div className="p-6 rounded-2xl bg-[#0b152b] border border-slate-800 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800">
                                    <div>
                                        <h3 className="text-base font-bold text-white">Overall ATM Health (data/atm_data.csv)</h3>
                                        <p className="text-xs text-slate-400">Click any ATM to select it and view its diagnostic prediction</p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="text"
                                            placeholder="Filter ATM ID..."
                                            value={tableSearch}
                                            onChange={(e) => setTableSearch(e.target.value)}
                                            className="bg-[#081022] border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none"
                                        />
                                        <select
                                            value={statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value)}
                                            className="bg-[#081022] border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none"
                                        >
                                            <option value="ALL">All Statuses</option>
                                            <option value="1">failure_status = 1</option>
                                            <option value="0">failure_status = 0</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                                    <table className="w-full text-left text-xs text-slate-300">
                                        <thead className="bg-[#081022] text-slate-400 text-[10px] uppercase sticky top-0">
                                            <tr>
                                                <th className="p-3">atm_id</th>
                                                <th className="p-3">temperature</th>
                                                <th className="p-3">network_errors</th>
                                                <th className="p-3">dispenser_errors</th>
                                                <th className="p-3">cpu_usage</th>
                                                <th className="p-3">transaction_failures</th>
                                                <th className="p-3">failure_status</th>
                                                <th className="p-3">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/60 font-mono">
                                            {filteredAtms.slice(0, 50).map(atm => (
                                                <tr key={atm.atm_id} className="hover:bg-slate-800/40 transition">
                                                    <td className="p-3 font-bold text-sky-400">{atm.atm_id}</td>
                                                    <td className="p-3">{atm.temperature}°C</td>
                                                    <td className="p-3">{atm.network_errors}</td>
                                                    <td className="p-3">{atm.dispenser_errors}</td>
                                                    <td className="p-3">{atm.cpu_usage}%</td>
                                                    <td className="p-3">{atm.transaction_failures}</td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                            atm.failure_status === 1 ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                                        }`}>
                                                            {atm.failure_status === 1 ? "1 (Failure)" : "0 (Normal)"}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 font-sans">
                                                        <button
                                                            onClick={() => {
                                                                selectAtmFromDataset(atm);
                                                                setActivePage("predictions");
                                                            }}
                                                            className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold transition"
                                                        >
                                                            Select ATM →
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="text-[11px] text-slate-500">
                                    Showing top {Math.min(50, filteredAtms.length)} of {filteredAtms.length} records from data/atm_data.csv.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* --------------------------------------------------------- */}
                    {/* SCREEN 3: REPORTS (Predictions from Dataset)              */}
                    {/* --------------------------------------------------------- */}
                    {activePage === "reports" && (
                        <div className="p-6 rounded-2xl bg-[#0b152b] border border-slate-800 space-y-4">
                            <h3 className="text-base font-bold text-white">Historical Predictions</h3>
                            <p className="text-xs text-slate-400">Dataset records from data/atm_data.csv with corresponding failure status</p>
                            
                            <div className="overflow-x-auto max-h-96 overflow-y-auto">
                                <table className="w-full text-left text-xs text-slate-300">
                                    <thead className="bg-[#081022] text-slate-400 text-[10px] uppercase sticky top-0">
                                        <tr>
                                            <th className="p-3">atm_id</th>
                                            <th className="p-3">temperature</th>
                                            <th className="p-3">network_errors</th>
                                            <th className="p-3">dispenser_errors</th>
                                            <th className="p-3">cpu_usage</th>
                                            <th className="p-3">transaction_failures</th>
                                            <th className="p-3">failure_status</th>
                                            <th className="p-3">Recommendation</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60 font-mono">
                                        {reportItems.map(atm => (
                                            <tr key={atm.atm_id} className="hover:bg-slate-800/40">
                                                <td className="p-3 font-bold text-sky-400">{atm.atm_id}</td>
                                                <td className="p-3">{atm.temperature}°C</td>
                                                <td className="p-3">{atm.network_errors}</td>
                                                <td className="p-3">{atm.dispenser_errors}</td>
                                                <td className="p-3">{atm.cpu_usage}%</td>
                                                <td className="p-3">{atm.transaction_failures}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                        atm.failure_status === 1 ? "text-rose-400" : "text-emerald-400"
                                                    }`}>
                                                        {atm.failure_status}
                                                    </span>
                                                </td>
                                                <td className="p-3 font-sans text-xs text-slate-300">
                                                    {atm.failure_status === 1 
                                                        ? "Schedule preventive maintenance within 48 hours." 
                                                        : "ATM is operating normally. No immediate action required."}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <button
                                    type="button"
                                    onClick={() => setReportPage(p => Math.max(1, p - 1))}
                                    disabled={reportPage === 1}
                                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs text-slate-200 font-semibold transition"
                                >
                                    Previous
                                </button>
                                <span className="text-[11px] text-slate-400">
                                    Page {reportPage} of {reportPageCount}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setReportPage(p => Math.min(reportPageCount, p + 1))}
                                    disabled={reportPage === reportPageCount}
                                    className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-xs text-white font-semibold transition"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}

                    {/* --------------------------------------------------------- */}
                    {/* SCREEN 4: SETTINGS (User-configurable thresholds)          */}
                    {/* --------------------------------------------------------- */}
                    {activePage === "settings" && (
                        <div className="space-y-6 max-w-2xl">
                            {/* Header */}
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-white">Risk Threshold Settings</h3>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Configure the threshold values used to flag ATM health factors. Changes apply to the current session's warning indicators.
                                    </p>
                                </div>
                                <button
                                    onClick={resetThresholds}
                                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 font-semibold transition"
                                >
                                    ↺ Reset Defaults
                                </button>
                            </div>

                            {/* Threshold Cards */}
                            <div className="space-y-4">
                                {Object.values(thresholds).map((factor) => (
                                    <div key={factor.key} className="p-5 rounded-2xl bg-[#0b152b] border border-slate-800 space-y-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <span className="text-sm font-bold text-white">{factor.label}</span>
                                                <p className="text-[11px] text-slate-500 mt-0.5">{factor.description}</p>
                                            </div>
                                            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#081022] px-2.5 py-1.5 text-[10px] text-slate-300">
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(factor.enabled)}
                                                    onChange={() => toggleFactorEnabled(factor.key)}
                                                    className="accent-sky-500"
                                                />
                                                Enabled
                                            </label>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <input
                                                type="range"
                                                min={factor.min}
                                                max={factor.max}
                                                step={1}
                                                value={factor.value}
                                                onChange={(e) => updateThreshold(factor.key, e.target.value)}
                                                className="flex-1 accent-sky-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                                                disabled={!factor.enabled}
                                            />
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    min={factor.min}
                                                    max={factor.max}
                                                    value={factor.value}
                                                    onChange={(e) => updateThreshold(factor.key, e.target.value)}
                                                    className="w-20 bg-[#081022] border border-slate-700 rounded-lg px-2 py-1 text-xs text-right font-mono font-bold text-sky-400 focus:outline-none focus:border-sky-500 disabled:opacity-50"
                                                    disabled={!factor.enabled}
                                                />
                                                {factor.unit && (
                                                    <span className="text-xs text-slate-400 font-mono">{factor.unit}</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex justify-between text-[10px] text-slate-600 font-mono">
                                            <span>Min: {factor.min}{factor.unit}</span>
                                            <span className="text-slate-500">Current threshold: <span className="text-sky-500 font-bold">{factor.value}{factor.unit}</span></span>
                                            <span>Max: {factor.max}{factor.unit}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Save Button */}
                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    onClick={saveThresholds}
                                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition"
                                >
                                    Save Settings
                                </button>
                                {settingsSaved && (
                                    <span className="text-xs text-emerald-400 font-semibold animate-fadeIn">
                                        ✅ Settings saved for this session
                                    </span>
                                )}
                            </div>

                            {/* Info note */}
                            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-400 space-y-1">
                                <p className="font-semibold">ℹ️ Note on threshold changes</p>
                                <p className="text-amber-500/80">These thresholds affect the <strong>UI warning indicators</strong> (red highlights on slider inputs). The ML model prediction is still run by the backend with its trained logic. To change backend thresholds, update <code className="bg-amber-900/30 px-1 rounded">src/ai_explainer.py</code>.</p>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

// Render React App
const rootElement = document.getElementById('root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(<App />);
}
