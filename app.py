"""import streamlit as st

st.set_page_config(
    page_title="ATM Predictive Maintenance",
    page_icon="🏦"
)

st.title("🏦 ATM Predictive Maintenance")

st.write(
    "Predict ATM failures before they occur."
)
"""
#Basic demo of the streamlit which includes just a header and some text

import streamlit as st
import joblib
import pandas as pd

from src.ai_explainer import generate_explanation

model = joblib.load(
    "models/atm_failure_model.pkl"
)

st.set_page_config(
    page_title="ATM Predictive Maintenance",
    page_icon="🏦"
)

st.title("🏦 ATM Predictive Maintenance")

temperature = st.number_input(
    "Temperature",
    min_value=0,
    max_value=120,
    value=70
)

network_errors = st.number_input(
    "Network Errors",
    min_value=0,
    value=2
)

dispenser_errors = st.number_input(
    "Dispenser Errors",
    min_value=0,
    value=1
)

cpu_usage = st.number_input(
    "CPU Usage (%)",
    min_value=0,
    max_value=100,
    value=50
)

transaction_failures = st.number_input(
    "Transaction Failures",
    min_value=0,
    value=1
)

if st.button("Predict"):

    sample = pd.DataFrame([
        {
            "temperature": temperature,
            "network_errors": network_errors,
            "dispenser_errors": dispenser_errors,
            "cpu_usage": cpu_usage,
            "transaction_failures": transaction_failures
        }
    ])

    prediction = model.predict(sample)[0]

    result = generate_explanation(
    temperature,
    network_errors,
    dispenser_errors,
    transaction_failures,
    prediction
    )

    if result["risk_level"] == "HIGH RISK":
        st.error("⚠️ High Risk: ATM Failure Likely")
    elif result["risk_level"] == "MEDIUM RISK":
        st.warning("⚠️ Medium Risk: ATM Requires Attention")
    else:
        st.success("✅ ATM Operating Normally")

    st.subheader("Risk Level")
    st.write(result["risk_level"])

    if result["reasons"]:
        st.subheader("Reasons")
        for reason in result["reasons"]:
            st.write(f"• {reason}")
        
    st.subheader("Recommendation")

    st.info(result["recommendation"]
)


