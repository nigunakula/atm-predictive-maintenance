from langchain_analyzer import generate_analysis

analysis = generate_analysis(
    temperature=92,
    cpu_usage=92,
    network_errors=18,
    dispenser_errors=10,
    transaction_failures=15,
    risk_level="HIGH RISK"
)

print(analysis)