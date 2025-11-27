import { parseCSV } from './csvParser';
import { parseJSON } from './jsonParser';
import { parseXML } from './xmlParser';
import { uploadProducts } from './uploadProducts';

export const handleMultiFileUpload = (e, { manufacturer, setMessageProduct, setLastAddedProduct, setViewProduct }) => {
  const file = e.target.files[0];
  if (!file) return;

  const ext = file.name.split('.').pop().toLowerCase();
  const reader = new FileReader();

  reader.onload = async (evt) => {
    const raw = evt.target.result;
    let products = [];

    try {
      if (ext === 'csv') {
        products = parseCSV(raw, manufacturer);
      } else if (ext === 'json') {
        products = parseJSON(JSON.parse(raw));
      } else if (ext === 'xml') {
        products = parseXML(raw);
      } else {
        return setMessageProduct('Unsupported file type.');
      }

      await uploadProducts(
        products,
        (postData) => {
          setMessageProduct('Product uploaded successfully!');
          setLastAddedProduct(postData.ID);
          setViewProduct(false);
        },
        (postData, error) => {
          setMessageProduct(error.response?.data?.message || `Failed to upload product ${postData.ID}.`);
          setLastAddedProduct('');
        },
      );
    } catch {
      setMessageProduct(`Invalid ${ext.toUpperCase()} file.`);
    }
  };

  reader.readAsText(file);
};
