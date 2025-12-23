/**
 * EcoShower Frontend Configuration
 * Update these values after deploying the AWS infrastructure
 */

export const config = {
  // API Gateway URL (update after deployment)
  API_URL: import.meta.env.VITE_API_URL || 'https://sk6vjwnic8.execute-api.eu-north-1.amazonaws.com/prod',
  
  // Cognito Configuration (update after deployment)
  COGNITO_USER_POOL_ID: import.meta.env.VITE_COGNITO_USER_POOL_ID || 'eu-north-1_q1X9yXVs5',
  COGNITO_CLIENT_ID: import.meta.env.VITE_COGNITO_CLIENT_ID || '5p4q4tvm8k8q2jr8pr9mmk8un9',
  
  // AWS Region
  AWS_REGION: 'eu-north-1',
  
  // App Settings
  WATER_COST_PER_LITER: 0.008, // ₪ per liter
  DEFAULT_TARGET_TEMP: 38,
  MIN_TEMP: 30,
  MAX_TEMP: 45,
  
  // Refresh intervals (ms)
  TELEMETRY_REFRESH_INTERVAL: 2000,
  DASHBOARD_REFRESH_INTERVAL: 30000,
};

export default config;
