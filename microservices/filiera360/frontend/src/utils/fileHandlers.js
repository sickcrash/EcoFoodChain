import axios from 'axios';

export const uploadProductsFromFile = async (file, callbacks) => {
  if (!file) return;

  const ext = file.name.split('.').pop().toLowerCase();
  if (ext !== 'json') {
    throw new Error('Only JSON files are supported for now.');
  }

  try {
    const text = await file.text();
    const products = JSON.parse(text);

    const token = localStorage.getItem('token');

    for (let postData of products) {
      try {
        await axios.post('api/uploadProduct', postData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        callbacks?.onSuccess?.(postData);
        break; // 👉 se vuoi interrompere al primo successo
      } catch (err) {
        callbacks?.onError?.(postData, err);
        break; // 👉 se vuoi interrompere al primo errore
      }
    }
  } catch (err) {
    throw new Error('Failed to parse file: ' + err.message);
  }
};
