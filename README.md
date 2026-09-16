# 🏦 ATM Predictive Maintenance

A machine learning solution for predicting ATM failures before they happen using operational telemetry such as temperature, network errors, dispenser errors, CPU usage, and transaction failures.

This project combines a predictive model, an explanation engine, a FastAPI backend, and a lightweight frontend/dashboard to help monitor ATM health and recommend preventive maintenance.

## ✨ Features

- Predict ATM failure risk using a trained Random Forest model
- Classify ATM status as Low, Medium, or High risk
- Explain the reasons behind a prediction
- Provide maintenance recommendations for high-risk scenarios
- Serve the dashboard through a FastAPI backend
- Offer a clean Streamlit interface for quick testing and visualization
- Use real ATM telemetry data for model training and analysis

## 🧠 Project Overview

ATM downtime can lead to customer dissatisfaction, financial disruption, and increased service costs. This repository demonstrates how operational data can be used to predict failures and trigger preventive maintenance before the ATM becomes unavailable.

The system uses:

- Python for data processing and model logic
- scikit-learn for machine learning
- Streamlit for an interactive prediction UI
- FastAPI for API-based service integration
- LangChain prompt templates for operational analysis summaries
- Joblib for model persistence

## 🏗️ Architecture

- `app.py` — Streamlit app for interactive ATM risk prediction
- `run_server.py` — launches the FastAPI backend server
- `src/api.py` — REST API for prediction and ATM data retrieval
- `src/train_model.py` — trains the Random Forest model
- `src/predict.py` — sample prediction workflow
- `src/ai_explainer.py` — explanation and risk logic
- `src/langchain_analyzer.py` — formatted operational analysis text
- `data/atm_data.csv` — ATM telemetry dataset
- `models/atm_failure_model.pkl` — trained model artifact
- `frontend/` — static frontend assets served by the backend

## 📁 Project Structure

```text
atm-predictive-maintenance/
├── app.py
├── run_server.py
├── requirements.txt
├── pyrightconfig.json
├── README.md
├── data/
│   └── atm_data.csv
├── frontend/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── models/
│   └── atm_failure_model.pkl
├── src/
│   ├── ai_explainer.py
│   ├── api.py
│   ├── generate_data.py
│   ├── langchain_analyzer.py
│   ├── predict.py
│   ├── test_langchain.py
│   └── train_model.py
└── .venv/
```

## 🚀 Getting Started

### 1) Clone the repository

```bash
git clone https://github.com/your-username/atm-predictive-maintenance.git
cd atm-predictive-maintenance
```

### 2) Create a virtual environment

#### Windows

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

#### macOS / Linux

```bash
python -m venv .venv
source .venv/bin/activate
```

### 3) Install dependencies

```bash
pip install -r requirements.txt
```

### 4) Train the model

```bash
python src/train_model.py
```

This step creates the trained model file in the `models/` directory.

## ▶️ Run the Application

### Streamlit app

```bash
streamlit run app.py
```

Then open the local URL shown in the terminal, typically:

```text
http://localhost:8501
```

### FastAPI backend + frontend

```bash
python run_server.py
```

Then visit:

- Dashboard: http://localhost:8000
- API docs: http://localhost:8000/docs

## 🧪 Model Inputs

The model uses the following operational metrics:

- Temperature
- Network Errors
- Dispenser Errors
- CPU Usage
- Transaction Failures

## 📊 Example Prediction Flow

A sample ATM reading can produce:

- `Risk Level`: HIGH RISK / MEDIUM RISK / LOW RISK
- `Reasons`: specific operational problems detected
- `Recommendation`: preventive action to take

## 🔌 API Endpoints

The backend exposes these endpoints:

- `GET /api/health` — checks API and model status
- `GET /api/atms` — returns ATM dataset summaries
- `GET /api/atms/{atm_id}` — fetches a specific ATM and predicts its health
- `POST /api/predict` — sends telemetry to the model and returns a prediction result

## 🛠️ Tech Stack

- Python 3
- Streamlit
- FastAPI
- scikit-learn
- pandas
- joblib
- LangChain Core
- JavaScript + HTML/CSS frontend

## 📌 Notes

- If the model file is missing, run `python src/train_model.py` before launching prediction features.
- The project is meant as a practical demo and can be extended with real-time monitoring, alert notifications, and cloud deployment.

## 📧 License

This project is intended for educational and demonstration purposes.

## 🙌 Contributing

Contributions, bug reports, and feature ideas are welcome. Feel free to open an issue or submit a pull request.
