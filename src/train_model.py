import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

df = pd.read_csv("data/atm_data.csv")

X = df[
    [
        "temperature",
        "network_errors",
        "dispenser_errors",
        "cpu_usage",
        "transaction_failures"
    ]
]

y = df["failure_status"]

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)

model = RandomForestClassifier(
    n_estimators=100,
    random_state=42
)

model.fit(X_train, y_train)

predictions = model.predict(X_test)

accuracy = accuracy_score(
    y_test,
    predictions
)

print(f"Accuracy: {accuracy:.2f}")

joblib.dump(
    model,
    "models/atm_failure_model.pkl"
)

print("Model saved successfully")
