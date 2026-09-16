from langchain_core.prompts import PromptTemplate

template = """
ATM MAINTENANCE ANALYSIS REPORT

Risk Level: {risk_level}

Risk Summary:
The ATM has been analyzed using operational health metrics and is currently classified as {risk_level}.

Possible Causes:
- Elevated temperature levels may indicate hardware stress.
- Network instability can affect transaction processing.
- Cash dispenser faults may impact cash withdrawal operations.
- Increased transaction failures indicate declining ATM performance.

Business Impact:
Unplanned ATM downtime can affect customer experience, transaction availability, and operational efficiency.

Recommended Actions:
- Inspect ATM hardware components.
- Verify network connectivity.
- Check the cash dispenser mechanism.
- Schedule preventive maintenance if warning signs persist.

Operational Metrics:
Temperature: {temperature}
CPU Usage: {cpu_usage}
Network Errors: {network_errors}
Dispenser Errors: {dispenser_errors}
Transaction Failures: {transaction_failures}
"""

prompt = PromptTemplate(
    input_variables=[
        "temperature",
        "cpu_usage",
        "network_errors",
        "dispenser_errors",
        "transaction_failures",
        "risk_level"
    ],
    template=template
)


def generate_analysis(
    temperature,
    cpu_usage,
    network_errors,
    dispenser_errors,
    transaction_failures,
    risk_level
):
    return prompt.format(
        temperature=temperature,
        cpu_usage=cpu_usage,
        network_errors=network_errors,
        dispenser_errors=dispenser_errors,
        transaction_failures=transaction_failures,
        risk_level=risk_level
    )