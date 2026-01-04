# EcoShower Admin Guide

## Overview
The **Admin Panel** provides centralized management for the EcoShower system. It allows administrators to view system-wide statistics, manage users, and monitor device activity.

**Prerequisite**: You must be logged in with an account that has the `admin` role.

## Accessing the Panel
1.  Log in to the application.
2.  If you are an admin, a **"Admin Dashboard"** link (Shield icon) will appear in the navigation.
3.  Click it to enter the admin area.

## Dashboard Stats
The top section displays real-time system totals:
*   **Users**: Total registered accounts.
*   **Devices**: Total smart devices registered.
*   **Showers**: Total completed shower sessions across all users.
*   **Liters Used**: Total water consumption tracked by the system.

## Activity Chart
*   **"All Time Activity"**: A line chart showing daily trends.
    *   **Green Line**: Number of Showers.
    *   **Blue Line**: Water Used (Liters).
*   Hover over points to see exact numbers for a specific date.

## User Management
The **Users Table** lists all registered accounts.

### Columns
*   **Name**: User's display name.
*   **Email**: Registered email address.
*   **Role**: `Admin` (Purple) or `User` (Gray).
*   **Devices**: Count of devices owned.
*   **Showers**: Count of sessions completed.
*   **Actions**: Controls for managing the user.

### Actions
1.  **Promote/Demote**:
    *   Click the **Blue Shield** icon to **Promote** a User to Admin.
    *   Click the **Orange Shield** icon to **Demote** an Admin to User.
    *   *Note*: This updates their permissions immediately.
3.  **Filter Stats (Show Data)**:
    *   Click the **"Show Data"** button in any user row.
    *   The Dashboard Stats and Activity Chart will update to show **only** that user's activity.
    *   To clear the filter, click the **"Clear Filter"** button at the top of the page.
4.  **Delete User**:
    *   Click the **Red Trash** icon.
    *   Confirm the dialog ("Are you sure you want to delete...?").
    *   *Warning*: This permanently removes the user, their devices, and history from the database and Cognito.

## Troubleshooting
*   **Data Not Loading?**: Click the **Refresh** icon in the top right corner.
*   **Role Not Updating?**: Ensure the backend Lambda functions (`EcoShower-API`) have the correct IAM permissions for Cognito.
