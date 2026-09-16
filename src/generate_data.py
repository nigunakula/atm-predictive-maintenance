import pandas as pd
import numpy as np

np.random.seed(42)

records = []

for i in range(1000):

    temperature = np.random.randint(50, 100)
    network_errors = np.random.randint(0, 30)
    dispenser_errors = np.random.randint(0, 15)
    cpu_usage = np.random.randint(30, 100)
    transaction_failures = np.random.randint(0, 25)

    failure_status = 0

    if (
        temperature > 85 and
        network_errors > 15
    ):
        failure_status = 1

    if (
        dispenser_errors > 8 and
        transaction_failures > 10
    ):
        failure_status = 1

    records.append([
        f"ATM{i+1}",
        temperature,
        network_errors,
        dispenser_errors,
        cpu_usage,
        transaction_failures,
        failure_status
    ])

df = pd.DataFrame(
    records,
    columns=[
        "atm_id",
        "temperature",
        "network_errors",
        "dispenser_errors",
        "cpu_usage",
        "transaction_failures",
        "failure_status"
    ]
)

df.to_csv("data/atm_data.csv", index=False)

print(df.head())
print("Dataset generated successfully")
