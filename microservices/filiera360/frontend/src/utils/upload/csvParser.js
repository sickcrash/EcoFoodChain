import Papa from 'papaparse';

export const parseCSV = (raw, manufacturer) => {
  const products = [];

  Papa.parse(raw, {
    complete: (result) => {
      for (let row of result.data) {
        if (!row[0]) continue;

        const [
          ID,
          Name,
          HarvestDate,
          ExpiryDate,
          Nutritional_information,
          CountryOfOrigin,
          Ingredients,
          Allergens,
          PesticideUse,
          FertilizerUse,
          ...customFieldsArr
        ] = row;

        let customObj = {};
        customFieldsArr.forEach((field, idx) => {
          try {
            Object.assign(customObj, JSON.parse(field));
          } catch {
            if (field && field.trim()) customObj[`custom${idx + 1}`] = field;
          }
        });

        products.push({
          ID,
          Name,
          Manufacturer: manufacturer,
          HarvestDate,
          ExpiryDate,
          Nutritional_information,
          CountryOfOrigin,
          Ingredients,
          Allergens,
          PesticideUse,
          FertilizerUse,
          CustomObject: customObj,
        });
      }
    },
    header: false,
    skipEmptyLines: true,
  });

  return products;
};

// Funzione di utilità per convertire la colonna CSV in oggetto
export const parseCustomObject = (jsonString) => {
  try {
    return JSON.parse(jsonString || '{}');
  } catch {
    return {};
  }
};
