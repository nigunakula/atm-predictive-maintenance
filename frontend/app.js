/**
 * ATM Predictive Maintenance Dashboard Logic
 * Connects frontend UI to FastAPI backend via asynchronous REST API calls.
 */

document.addEventListener('DOMContentLoaded', () => {
    // API Endpoints
    const API_BASE = '';
    const PREDICT_URL = `${API_BASE}/api/predict`;
    const PRESETS_URL = `${API_BASE}/api/presets`;
    const HEALTH_URL = `${API_BASE}/api/health`;

    // Elements - Controls
    const tempInput = document.getElementById('temperatureInput');
    const tempSlider = document.getElementById('temperatureSlider');
    const cpuInput = document.getElementById('cpuInput');
    const cpuSlider = document.getElementById('cpuSlider');
    const netInput = document.getElementById('networkInput');
    const netSlider = document.getElementById('networkSlider');
    const dispenserInput = document.getElementById('dispenserInput');
    const dispenserSlider = document.getElementById('dispenserSlider');
    const transactionInput = document.getElementById('transactionInput');
    const transactionSlider = document.getElementById('transactionSlider');

    // Action Buttons
    const analyzeBtn = document.getElementById('analyzeBtn');
    const btnSpinner = document.getElementById('btnSpinner');
    const btnText = document.getElementById('btnText');
    const resetBtn = document.getElementById('resetBtn');
    const presetChips = document.querySelectorAll('.chip');

    // Elements - Diagnostic Display
    const riskContainer = document.getElementById('riskContainer');
    const gaugeProgress = document.getElementById('gaugeProgress');
    const failureProbDisplay = document.getElementById('failureProbDisplay');
    const riskBadge = document.getElementById('riskBadge');
    const riskLevelText = document.getElementById('riskLevelText');
    const riskHeadline = document.getElementById('riskHeadline');
    const riskSubtext = document.getElementById('riskSubtext');
    const recommendationText = document.getElementById('recommendationText');
    const reasonsList = document.getElementById('reasonsList');
    const anomalyCountPill = document.getElementById('anomalyCountPill');
    const lastCheckedTime = document.getElementById('lastCheckedTime');
    const systemStatusText = document.getElementById('systemStatusText');
    const systemStatusPill = document.getElementById('systemStatusPill');

    // Mini Stats
    const statTemp = document.getElementById('statTemp');
    const statCpu = document.getElementById('statCpu');
    const statNet = document.getElementById('statNet');
    const statDispenser = document.getElementById('statDispenser');

    // Circumference of radial gauge circle (r = 68 -> 2 * PI * 68 = 427.26)
    const GAUGE_CIRCUMFERENCE = 427.26;

    // Synchronize pair of slider and number box
    function bindSync(slider, input) {
        slider.addEventListener('input', () => {
            input.value = slider.value;
            triggerLiveReadoutUpdate();
        });

        input.addEventListener('input', () => {
            if (input.value !== '') {
                slider.value = input.value;
                triggerLiveReadoutUpdate();
            }
        });
    }

    bindSync(tempSlider, tempInput);
    bindSync(cpuSlider, cpuInput);
    bindSync(netSlider, netInput);
    bindSync(dispenserSlider, dispenserInput);
    bindSync(transactionSlider, transactionInput);

    function triggerLiveReadoutUpdate() {
        statTemp.textContent = `${parseFloat(tempInput.value || 0).toFixed(1)}°C`;
        statCpu.textContent = `${parseInt(cpuInput.value || 0)}%`;
        statNet.textContent = `${parseInt(netInput.value || 0)}/hr`;
        statDispenser.textContent = `${parseInt(dispenserInput.value || 0)}`;
    }

    // Set values into UI controls
    function setFormValues(data) {
        if (data.temperature !== undefined) {
            tempInput.value = data.temperature;
            tempSlider.value = data.temperature;
        }
        if (data.cpu_usage !== undefined) {
            cpuInput.value = data.cpu_usage;
            cpuSlider.value = data.cpu_usage;
        }
        if (data.network_errors !== undefined) {
            netInput.value = data.network_errors;
            netSlider.value = data.network_errors;
        }
        if (data.dispenser_errors !== undefined) {
            dispenserInput.value = data.dispenser_errors;
            dispenserSlider.value = data.dispenser_errors;
        }
        if (data.transaction_failures !== undefined) {
            transactionInput.value = data.transaction_failures;
            transactionSlider.value = data.transaction_failures;
        }
        triggerLiveReadoutUpdate();
    }

    // Check Backend Health
    async function checkBackendHealth() {
        try {
            const res = await fetch(HEALTH_URL);
            if (res.ok) {
                const data = await res.json();
                systemStatusText.textContent = data.model_loaded ? 'Model Engine Ready' : 'Model Offline';
            }
        } catch (err) {
            systemStatusText.textContent = 'Connecting Backend...';
        }
    }

    // Main Function: Send Prediction Request to FastAPI Backend
    async function runPrediction() {
        setLoadingState(true);

        const payload = {
            temperature: parseFloat(tempInput.value),
            network_errors: parseInt(netInput.value),
            dispenser_errors: parseInt(dispenserInput.value),
            cpu_usage: parseFloat(cpuInput.value),
            transaction_failures: parseInt(transactionInput.value)
        };

        try {
            const response = await fetch(PREDICT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Server returned status ${response.status}`);
            }

            const data = await response.json();
            renderDiagnosis(data);
        } catch (error) {
            console.error('Prediction API Error:', error);
            renderErrorState(error.message);
        } finally {
            setLoadingState(false);
        }
    }

    // Update UI with diagnosis results
    function renderDiagnosis(data) {
        const { risk_level, reasons, recommendation, failure_probability } = data;

        // 1. Update Gauge & Percentage
        const prob = Math.min(100, Math.max(0, failure_probability ?? 0));
        failureProbDisplay.textContent = `${Math.round(prob)}%`;

        const offset = GAUGE_CIRCUMFERENCE - (prob / 100) * GAUGE_CIRCUMFERENCE;
        gaugeProgress.style.strokeDashoffset = offset;

        // 2. Risk Level Styling
        riskContainer.classList.remove('risk-low-active', 'risk-med-active', 'risk-high-active');
        riskBadge.classList.remove('risk-low', 'risk-med', 'risk-high');

        if (risk_level === 'HIGH RISK') {
            riskContainer.classList.add('risk-high-active');
            riskBadge.classList.add('risk-high');
            riskLevelText.textContent = 'CRITICAL ALERT: HIGH RISK';
            riskHeadline.textContent = 'Imminent ATM Failure Predicted';
            riskSubtext = 'Immediate intervention required. Mechanical or thermal fault imminent.';
            gaugeProgress.style.stroke = 'var(--risk-high-color)';
        } else if (risk_level === 'MEDIUM RISK') {
            riskContainer.classList.add('risk-med-active');
            riskBadge.classList.add('risk-med');
            riskLevelText.textContent = 'ATTENTION: MEDIUM RISK';
            riskHeadline.textContent = 'Elevated Error Rates Observed';
            riskSubtext = 'Multiple subsystem warning flags. Schedule servicing soon.';
            gaugeProgress.style.stroke = 'var(--risk-med-color)';
        } else {
            riskContainer.classList.add('risk-low-active');
            riskBadge.classList.add('risk-low');
            riskLevelText.textContent = 'NOMINAL: LOW RISK';
            riskHeadline.textContent = 'ATM Operating Within Safe Bounds';
            riskSubtext = 'All telemetry signals indicate normal operating parameters.';
            gaugeProgress.style.stroke = 'var(--risk-low-color)';
        }

        // 3. Recommendation
        recommendationText.textContent = recommendation || 'ATM is operating normally. No immediate action required.';

        // 4. Root Causes Breakdown
        reasonsList.innerHTML = '';
        if (reasons && reasons.length > 0) {
            anomalyCountPill.textContent = `${reasons.length} ${reasons.length === 1 ? 'Anomaly' : 'Anomalies'}`;
            anomalyCountPill.style.color = 'var(--risk-high-color)';

            reasons.forEach(reason => {
                const li = document.createElement('li');
                li.className = 'reason-item';
                li.innerHTML = `<span>⚠️</span> <span>${reason}</span>`;
                reasonsList.appendChild(li);
            });
        } else {
            anomalyCountPill.textContent = '0 Anomalies';
            anomalyCountPill.style.color = 'var(--text-secondary)';

            const emptyLi = document.createElement('li');
            emptyLi.className = 'reason-item empty-state';
            emptyLi.innerHTML = `<span>✅</span> <span>No anomalous threshold breaches detected across telemetry.</span>`;
            reasonsList.appendChild(emptyLi);
        }

        // 5. Update timestamp
        const now = new Date();
        lastCheckedTime.textContent = `Updated at ${now.toLocaleTimeString()}`;
        triggerLiveReadoutUpdate();
    }

    function renderErrorState(message) {
        riskHeadline.textContent = 'Prediction Service Unavailable';
        riskSubtext.textContent = `Could not connect to backend: ${message}`;
        recommendationText.textContent = 'Verify that the FastAPI backend server is running.';
    }

    function setLoadingState(isLoading) {
        if (isLoading) {
            btnSpinner.classList.remove('hidden');
            btnText.textContent = 'Analyzing Telemetry...';
            analyzeBtn.disabled = true;
        } else {
            btnSpinner.classList.add('hidden');
            btnText.textContent = 'Run Predictive Analysis';
            analyzeBtn.disabled = false;
        }
    }

    // Preset Chip Click Handlers
    const PRESETS = {
        normal: { temperature: 68.0, cpu_usage: 32, network_errors: 1, dispenser_errors: 0, transaction_failures: 1 },
        overheating: { temperature: 94.0, cpu_usage: 88, network_errors: 2, dispenser_errors: 1, transaction_failures: 3 },
        dispenser_jam: { temperature: 72.0, cpu_usage: 45, network_errors: 3, dispenser_errors: 12, transaction_failures: 8 },
        network_outage: { temperature: 74.0, cpu_usage: 52, network_errors: 28, dispenser_errors: 2, transaction_failures: 16 },
        critical_failure: { temperature: 96.0, cpu_usage: 95, network_errors: 35, dispenser_errors: 15, transaction_failures: 22 }
    };

    presetChips.forEach(chip => {
        chip.addEventListener('click', () => {
            presetChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');

            const presetKey = chip.dataset.preset;
            if (PRESETS[presetKey]) {
                setFormValues(PRESETS[presetKey]);
                runPrediction();
            }
        });
    });

    // Reset button
    resetBtn.addEventListener('click', () => {
        presetChips.forEach(c => c.classList.remove('active'));
        document.getElementById('presetNormal').classList.add('active');
        setFormValues(PRESETS.normal);
        runPrediction();
    });

    // Analyze button click
    analyzeBtn.addEventListener('click', runPrediction);

    // Initial Launch sequence
    checkBackendHealth();
    triggerLiveReadoutUpdate();
    runPrediction();
});
