def generate_explanation(
    temperature,
    network_errors,
    dispenser_errors,
    transaction_failures,
    prediction
):
    reasons = []

    if temperature > 85:
        reasons.append(
            "ATM temperature is above the safe operating threshold."
        )

    if network_errors > 15:
        reasons.append(
            "Frequent network connectivity issues detected."
        )

    if dispenser_errors > 8:
        reasons.append(
            "Cash dispenser is reporting repeated errors."
        )

    if transaction_failures > 10:
        reasons.append(
            "Transaction failure rate is unusually high."
        )

    # HIGH RISK
    if prediction == 1:

        risk_level = "HIGH RISK"

        recommendation = (
            "Schedule preventive maintenance within 48 hours."
        )

    # MEDIUM RISK
    elif len(reasons) >= 2:

        risk_level = "MEDIUM RISK"

        recommendation = (
            "Multiple warning indicators detected. Monitor closely and schedule maintenance during the next service window."
        )

    # LOW RISK
    else:

        risk_level = "LOW RISK"

        recommendation = (
            "ATM is operating normally. No immediate action required."
        )

    return {
        "risk_level": risk_level,
        "reasons": reasons,
        "recommendation": recommendation
    }