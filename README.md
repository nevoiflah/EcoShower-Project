# EcoShower - Smart Water Conservation System

EcoShower is a cloud-native IoT solution designed to track, manage, and optimize water usage in smart homes. It integrates hardware sensors (ESP32) with a backend serverless AWS architecture to provide real-time monitoring, remote control, and usage analytics.

---

## Team

- **Nevo Iflah**
- **Liel Yardeni**
- **Adir Ben Dayan**

*Advisor: Dr. Zvi Kuflik | Ruppin Academic Center*

---

## Project Structure

```
EcoShower/
│
├── docs/                          # Submission Documentation
│   ├── User_Manual.md            # End-User Guide (Registration, Usage)
│   ├── Admin_Manual.md           # Administrator Guide (Dashboard, Management)
│   ├── openapi.yaml              # API Reference (Swagger 3.0)
│   ├── architecture.mermaid      # System Diagram Code
│   └── sequence_diagrams.mermaid # Flow Diagrams Code
│
├── src/                          # Source Code
│   ├── frontend/                 # React Web Application (Vite/Tailwind)
│   │   ├── src/pages/            # UI Pages (Devices, Settings, Admin)
│   │   └── src/components/       # UI Components (Control Modal)
│   │
│   └── lambda/                   # Backend Serverless Functions
│       ├── api_handler.py        # REST API Logic (Gateway Integration)
│       └── process_telemetry.py  # IoT Rule Processor (MQTT -> DynamoDB)
│
└── README.md                     # Project Overview
```

---

## Architecture & Technologies

The system is built on **AWS Serverless** architecture for scalability and low maintenance.

| Component | AWS Service | Purpose |
|-----------|-------------|---------|
| **Frontend** | S3 + CloudFront | Hosting the React SPA (Single Page Application) |
| **Auth** | Cognito | User Identity, Authentication, and RBAC (Roles) |
| **API** | API Gateway | REST Endpoint management for Frontend-Backend communication |
| **Compute** | Lambda (Python) | Business logic for API requests and IoT event processing |
| **IoT** | IoT Core | MQTT Broker for real-time device communication |
| **Database** | DynamoDB | NoSQL storage for Users, Devices, and Sessions |
| **Alerts** | SNS | Push notifications (Email) for "Water Ready" alerts |

---

## Key Features

### For Users
*   **Remote Control**: Pre-heat your shower to exact temperature from the app.
*   **Smart Alerts**: Get notified via Email when the water is ready.
*   **Savings Tracking**: View how much water and money you saved per session.
*   **Usage History**: Detailed logs of every shower session.
*   **Custom Settings**: Set water price, temperature units (Celsius/Fahrenheit), and language (EN/HE).

### For Admins
*   **System Dashboard**: View global stats (Active Users, Total Liters Saved).
*   **User Management**: View, delete, or promote users to Admin role.
*   **Analytics**: View daily usage trends across the entire system.

---

## Setup & Installation

### Prerequisites
*   Node.js 18+
*   Python 3.11
*   AWS Account with Admin access

### Running Locally
1.  **Frontend**:
    ```bash
    cd src/frontend
    npm install
    npm run dev
    ```
2.  **Backend**:
    *   Scripts in `src/lambda` are deployed to AWS Lambda.
    *   Use the AWS Console or CLI for updates.

---

## License & Credits

Final Project 2025 - Ruppin Academic Center.
Developed as part of the "Cloud Application Development" course.
