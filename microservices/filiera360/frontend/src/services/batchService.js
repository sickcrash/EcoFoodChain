import axios from 'axios';

export const uploadBatch = async (batchData) => {
  const token = localStorage.getItem('token');
  return axios.post('api/uploadBatch', batchData, {
    headers: { Authorization: `Bearer ${token}` },
  });
};
