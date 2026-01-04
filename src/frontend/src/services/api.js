/**
 * EcoShower API Service
 * Matches the snake_case schema used by EcoShower-API Lambda and DynamoDB
 */

import { CognitoUserPool } from 'amazon-cognito-identity-js';
import { config } from '../config';

const API_BASE_URL = config.API_URL;

const poolData = {
  UserPoolId: config.COGNITO_USER_POOL_ID,
  ClientId: config.COGNITO_CLIENT_ID
};

const userPool = new CognitoUserPool(poolData);

/**
 * Get authentication token from Cognito
 */
const getAuthToken = () => {
  return new Promise((resolve, reject) => {
    const cognitoUser = userPool.getCurrentUser();

    if (!cognitoUser) {
      reject(new Error('No authenticated user'));
      return;
    }

    cognitoUser.getSession((err, session) => {
      if (err) {
        reject(err);
        return;
      }

      if (!session || !session.isValid()) {
        reject(new Error('Invalid session'));
        return;
      }

      resolve(session.getIdToken().getJwtToken());
    });
  });
};

/**
 * Make authenticated API request
 */
const apiRequest = async (endpoint, options = {}) => {
  const token = await getAuthToken();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  });

  const data = await response.json();

  // Handle response - could be wrapped in body or direct
  if (typeof data.body === 'string') {
    return JSON.parse(data.body);
  }

  if (!response.ok) {
    throw new Error(data.error || data.message || 'API request failed');
  }

  return data;
};

// ============= DASHBOARD =============

export const getDashboardSummary = async () => {
  const data = await apiRequest('/dashboard/summary');

  // Transform snake_case to camelCase for frontend
  return {
    summary: {
      todayUsage: data.today_usage ?? data.todayUsage ?? 0,
      monthlyUsage: data.monthly_usage ?? data.monthlyUsage ?? data.total_water_saved ?? 0,
      moneySaved: data.money_saved ?? data.moneySaved ?? data.total_money_saved ?? 0,
      totalSessions: data.total_sessions ?? data.totalSessions ?? data.sessions_count ?? 0,
      avgPerSession: data.avg_per_session ?? data.avgPerSession ?? 0
    }
  };
};

export const getDashboardHistory = async (limit = 50) => {
  // Extract limit from object if needed
  const limitValue = typeof limit === 'object' ? (limit.limit || 50) : limit;
  const data = await apiRequest(`/dashboard/history?limit=${limitValue}`);

  // Transform sessions to frontend format
  const sessions = (data.sessions || data.history || []).map(s => ({
    sessionId: s.session_id ?? s.sessionId,
    deviceId: s.device_id ?? s.deviceId,
    deviceName: s.device_name ?? s.deviceName ?? 'Unknown Device',
    startTime: s.start_time ?? s.startTime,
    endTime: s.end_time ?? s.endTime,
    waterSaved: s.water_saved ?? s.waterSaved ?? 0,
    moneySaved: s.money_saved ?? s.moneySaved ?? 0,
    duration: s.duration ?? 0,
    targetTemp: s.target_temp ?? s.targetTemp ?? 38,
    status: s.status ?? 'completed'
  }));

  return { history: sessions };
};

// ============= DEVICES =============

export const getDevices = async () => {
  const data = await apiRequest('/devices');

  // Transform devices to frontend format
  const devices = (data.devices || []).map(d => ({
    deviceId: d.device_id ?? d.deviceId,
    userId: d.user_id ?? d.userId,
    name: d.name ?? 'Unnamed Device',
    deviceCode: d.device_code ?? d.deviceCode,
    status: d.status ?? 'offline',
    currentTemp: d.current_temp ?? d.currentTemp ?? 0,
    targetTemp: d.target_temp ?? d.targetTemp ?? 38,
    totalWaterSaved: d.total_water_saved ?? d.totalWaterSaved ?? 0,
    totalSessions: d.total_sessions ?? d.totalSessions ?? 0,
    createdAt: d.created_at ?? d.createdAt,
    lastSeen: d.last_seen ?? d.lastSeen
  }));

  return { devices };
};

export const getDevice = async (deviceId) => {
  const data = await apiRequest(`/devices/${deviceId}`);
  const d = data.device || data;

  return {
    device: {
      deviceId: d.device_id ?? d.deviceId,
      userId: d.user_id ?? d.userId,
      name: d.name ?? 'Unnamed Device',
      deviceCode: d.device_code ?? d.deviceCode,
      status: d.status ?? 'offline',
      currentTemp: d.current_temp ?? d.currentTemp ?? 0,
      targetTemp: d.target_temp ?? d.targetTemp ?? 38,
      totalWaterSaved: d.total_water_saved ?? d.totalWaterSaved ?? 0,
      totalSessions: d.total_sessions ?? d.totalSessions ?? 0,
      createdAt: d.created_at ?? d.createdAt,
      lastSeen: d.last_seen ?? d.lastSeen
    }
  };
};

export const addDevice = async (name, deviceCode) => {
  // EcoShower-API expects snake_case
  const data = await apiRequest('/devices', {
    method: 'POST',
    body: JSON.stringify({
      name,
      device_code: deviceCode  // Must be 12 characters
    })
  });

  const d = data.device || data;
  return {
    device: {
      deviceId: d.device_id ?? d.deviceId,
      name: d.name,
      status: d.status ?? 'offline'
    }
  };
};

export const updateDevice = async (deviceId, updates) => {
  // Convert to snake_case for API
  const body = {};
  if (updates.name) body.name = updates.name;
  if (updates.targetTemp) body.target_temp = updates.targetTemp;
  if (updates.status) body.status = updates.status;

  return await apiRequest(`/devices/${deviceId}`, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
};

export const deleteDevice = async (deviceId) => {
  return await apiRequest(`/devices/${deviceId}`, {
    method: 'DELETE'
  });
};

// ============= SESSIONS =============

export const startShowerSession = async (deviceId, targetTemp = 38, duration = 10) => {
  const data = await apiRequest(`/devices/${deviceId}/start`, {
    method: 'POST',
    body: JSON.stringify({
      target_temp: targetTemp,
      duration: duration
    })
  });

  const s = data.session || data;
  return {
    session: {
      sessionId: s.session_id ?? s.sessionId,
      deviceId: s.device_id ?? s.deviceId,
      targetTemp: s.target_temp ?? s.targetTemp ?? targetTemp,
      status: s.status ?? 'active',
      startTime: s.start_time ?? s.startTime
    }
  };
};

export const sendDeviceCommand = async (deviceId, command) => {
  return apiRequest(`/devices/${deviceId}/command`, {
    method: 'POST',
    body: JSON.stringify({ command })
  });
};

export const updateDeviceStatus = async (deviceId, status, targetTemp) => {
  const body = { status };
  if (targetTemp) body.target_temp = targetTemp;

  // We reuse updateDevice endpoint but focused on status
  // Note: Backend might not expose status update directly via update_device, 
  // but let's check. If not, we rely on the command side effect.
  // Actually, backend 'update_device' allows target_temp but maybe not status directly?
  // Use generic updateDevice
  return updateDevice(deviceId, body);
};

export const openValve = async (deviceId) => {
  return await apiRequest(`/devices/${deviceId}/command`, {
    method: 'POST',
    body: JSON.stringify({
      command: 'OPEN_VALVE'
    })
  });
};

export const endShowerSession = async (deviceId, sessionId, duration) => {
  return apiRequest(`/devices/${deviceId}/stop`, {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      duration: duration // Send the visual timer duration
    })
  });
};

export const markWaterReady = async (deviceId) => {
  return await apiRequest(`/devices/${deviceId}/ready`, { method: 'POST' });
};

// ============= SETTINGS =============

export const getSettings = async () => {
  const data = await apiRequest('/users/me');
  const s = data.user || data;

  // Transform to frontend format (camelCase)
  return {
    settings: {
      userId: s.user_id ?? s.userId,
      email: s.email ?? '',
      name: s.name ?? '',
      role: s.role ?? 'user',
      showerProfiles: s.shower_profiles ?? s.showerProfiles ?? [],
      notifications: {
        pushEnabled: s.notifications?.push_enabled ?? s.notifications?.pushEnabled ?? true,
        emailEnabled: s.notifications?.email_enabled ?? s.notifications?.emailEnabled ?? false,
        deviceOfflineAlert: s.notifications?.device_offline_alert ?? s.notifications?.deviceOfflineAlert ?? true,
        dailySummary: s.notifications?.daily_summary ?? s.notifications?.dailySummary ?? false,
        waterGoalAlert: s.notifications?.water_goal_alert ?? s.notifications?.waterGoalAlert ?? true,
        weeklySummary: s.notifications?.weekly_summary ?? s.notifications?.weeklySummary ?? false,
        waterReadyAlert: s.notifications?.water_ready_alert ?? s.notifications?.waterReadyAlert ?? true
      },
      system: {
        temperatureUnit: s.system?.temperature_unit ?? s.system?.temperatureUnit ?? 'celsius',
        waterPricePerLiter: s.system?.water_price_per_liter ?? s.system?.waterPricePerLiter ?? 0.008,
        language: s.system?.language ?? 'he',
        dailyWaterGoal: s.system?.daily_water_goal ?? s.system?.dailyWaterGoal ?? 50,
        monthlyBudget: s.system?.monthly_budget ?? s.system?.monthlyBudget ?? 100
      }
    }
  };
};

export const updateSettings = async (settings) => {
  // Convert to snake_case for API
  const body = {
    name: settings.name,
    notifications: {
      push_enabled: settings.notifications?.pushEnabled,
      email_enabled: settings.notifications?.emailEnabled,
      device_offline_alert: settings.notifications?.deviceOfflineAlert,
      daily_summary: settings.notifications?.dailySummary,
      water_goal_alert: settings.notifications?.waterGoalAlert,
      weekly_summary: settings.notifications?.weeklySummary,
      water_ready_alert: settings.notifications?.waterReadyAlert
    },
    system: {
      temperature_unit: settings.system?.temperatureUnit,
      water_price_per_liter: settings.system?.waterPricePerLiter,
      language: settings.system?.language,
      daily_water_goal: settings.system?.dailyWaterGoal,
      monthly_budget: settings.system?.monthlyBudget
    }
  };

  return await apiRequest('/users/me', {
    method: 'PUT',
    body: JSON.stringify(body)
  });
};

// ============= ADMIN =============

export const getAdminStats = async (userId = null) => {
  const url = userId ? `/admin/stats?userId=${userId}` : '/admin/stats';
  const data = await apiRequest(url);

  // Backend returns: total_users, total_devices, total_sessions, total_water_saved
  return {
    stats: {
      totalUsers: data.total_users ?? data.users_count ?? 0,
      totalDevices: data.total_devices ?? data.devices_count ?? 0,
      totalSessions: data.total_sessions ?? data.sessions_count ?? 0,
      devicesOnline: data.devices_online ?? 0,
      totalWaterSaved: data.total_water_saved ?? data.total_water_saved_month ?? 0
    },
    activityData: data.activity_data ?? []
  };
};

export const getAdminUsers = async () => {
  const data = await apiRequest('/admin/users');

  const users = (data.users || []).map(u => ({
    userId: u.user_id ?? u.userId,
    email: u.email ?? '',
    name: u.name ?? '',
    role: u.role ?? 'user',
    createdAt: u.created_at ?? u.createdAt,
    devicesCount: u.devices_count ?? u.devicesCount ?? 0,
    sessionsCount: u.sessions_count ?? u.sessionsCount ?? 0
  }));

  return { users };
};

export const deleteUser = async (userId) => {
  return await apiRequest(`/admin/users/${userId}`, {
    method: 'DELETE'
  });
};

export const updateUserRole = async (userId, role) => {
  return await apiRequest(`/admin/users/${userId}/role`, {
    method: 'POST',
    body: JSON.stringify({ role })
  });
};

export const deleteSession = async (sessionId) => {
  return await apiRequest(`/sessions/${sessionId}`, {
    method: 'DELETE'
  });
};

// ============= USER PROFILE =============

export const getUserProfile = async () => {
  const data = await apiRequest('/users/me');
  const u = data.user || data;

  return {
    user: {
      userId: u.user_id ?? u.userId,
      email: u.email ?? '',
      name: u.name ?? '',
      role: u.role ?? 'user'
    }
  };
};

export const updateUserProfile = async (updates) => {
  return await apiRequest('/users/me', {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
};

export default {
  getDashboardSummary,
  getDashboardHistory,
  getDevices,
  getDevice,
  addDevice,
  updateDevice,
  deleteDevice,
  startShowerSession,
  endShowerSession,
  getSettings,
  updateSettings,
  getAdminStats,
  getAdminUsers,
  deleteUser,
  updateUserRole,
  deleteSession,
  getUserProfile,
  updateUserProfile
};
