import axios from 'axios';
import { convertFileToBase64 } from '../utils/file';

export const uploadProduct = async (productData) => {
  const token = localStorage.getItem('token');

  return axios.post('api/uploadProduct', productData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
};

export const uploadModel = async (id, glbFile) => {
  try {
    const base64File = await convertFileToBase64(glbFile);
    const token = localStorage.getItem('token');

    return axios.post(
      'api/uploadModel',
      { ID: id, ModelBase64: base64File },
      { headers: { Authorization: `Bearer ${token}` } },
    );
  } catch (err) {
    console.error('Failed to upload 3D model.', err);
    throw err;
  }
};

export const addToRecentlyScanned = async (productData) => {
  try {
    const scannedProduct = {
      ID: productData.ID,
      Name: productData.Name || 'Batch',
      Manufacturer: productData.Manufacturer,
      CreationDate: productData.CreationDate,
      timestamp: new Date().toISOString(),
    };

    await axios.post(
      'api/addRecentlySearched',
      { blockchainProductId: scannedProduct.ID },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      },
    );
  } catch (error) {
    console.error('Error updating recently searched products:', error);
    throw error;
  }
};

export const fetchRecentlySearched = async (userId) => {
  try {
    const response = await axios.get(`api/getRecentlySearched?userId=${userId}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching recently searched products:', error);
    throw error;
  }
};
