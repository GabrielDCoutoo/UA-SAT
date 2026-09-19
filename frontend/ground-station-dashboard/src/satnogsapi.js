// frontend/src/services/satnogs.api.js

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const satnogsAPI = {
  // Get station status
  getStatus: async () => {
    const response = await fetch(`${API_BASE}/api/satnogs/status`);
    if (!response.ok) throw new Error('Failed to fetch status');
    return response.json();
  },

  // Get observations
  getObservations: async (limit = 50, status = null) => {
    let url = `${API_BASE}/api/satnogs/observations?limit=${limit}`;
    if (status) url += `&status=${status}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch observations');
    return response.json();
  },

  // Get single observation
  getObservation: async (id) => {
    const response = await fetch(`${API_BASE}/api/satnogs/observations/${id}`);
    if (!response.ok) throw new Error('Failed to fetch observation');
    return response.json();
  },

  // Get scheduled passes
  getPasses: async () => {
    const response = await fetch(`${API_BASE}/api/satnogs/passes`);
    if (!response.ok) throw new Error('Failed to fetch passes');
    return response.json();
  },

  // Get statistics
  getStats: async () => {
    const response = await fetch(`${API_BASE}/api/satnogs/stats`);
    if (!response.ok) throw new Error('Failed to fetch stats');
    return response.json();
  }
};

export default satnogsAPI;