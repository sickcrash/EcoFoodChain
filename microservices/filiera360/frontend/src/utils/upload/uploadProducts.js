import axios from 'axios';

export const uploadProducts = async (products, onSuccess, onError) => {
  const token = localStorage.getItem('token');

  for (let postData of products) {
    try {
      await axios.post('api/uploadProduct', postData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      onSuccess(postData);
      break;
    } catch (error) {
      onError(postData, error);
      break;
    }
  }
};
