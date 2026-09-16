"""
ATM Predictive Maintenance - Server Launcher
Runs FastAPI backend and serves the interactive frontend dashboard.
"""

import sys
import uvicorn

# Reconfigure stdout for utf-8 if supported on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

if __name__ == "__main__":
    print("\n=======================================================")
    print("[*] Starting ATM Predictive Maintenance System...")
    print("[+] Dashboard UI:     http://localhost:8000")
    print("[+] Swagger API Docs: http://localhost:8000/docs")
    print("=======================================================\n")
    uvicorn.run("src.api:app", host="127.0.0.1", port=8000, reload=True)
