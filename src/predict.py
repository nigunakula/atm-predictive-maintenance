import joblib
import pandas as pd

from ai_explainer import generate_explanation

from langchain_analyzer import generate_analysis

model = joblib.load(
    "models/atm_failure_model.pkl"
)

temperature = 90
network_errors = 20
dispenser_errors = 10
cpu_usage = 92
transaction_failures = 15

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

analysis = generate_analysis(
    temperature,
    cpu_usage,
    network_errors,
    dispenser_errors,
    transaction_failures,
    result["risk_level"]
)

print("\n=================================")
print("ATM HEALTH REPORT")
print("=================================\n")

print(f"Risk Level: {result['risk_level']}\n")

print("Reasons:")

for reason in result["reasons"]:
    print(f"- {reason}")

print("\nRecommendation:")
print(result["recommendation"])

print("\n=================================")