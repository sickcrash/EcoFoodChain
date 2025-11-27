import { useState } from 'react';

export const useProductForm = (manufacturer) => {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [harvestDate, setHarvestDate] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [allergens, setAllergens] = useState('');
  const [nutritionalInformation, setNutritionalInformation] = useState('');
  const [sowingDate, setSowingDate] = useState('');
  const [pesticideUse, setPesticideUse] = useState('');
  const [fertilizerUse, setFertilizerUse] = useState('');
  const [countryOfOrigin, setCountryOfOrigin] = useState('');
  const [glbFile, setGlbFile] = useState('');
  const [productType, setProductType] = useState('');
  const [sensorData, setSensorData] = useState([]);
  const [customFields, setCustomFields] = useState([]);

  const resetForm = () => {
    setId('');
    setName('');
    setHarvestDate('');
    setIngredients('');
    setAllergens('');
    setNutritionalInformation('');
    setSowingDate('');
    setPesticideUse('');
    setFertilizerUse('');
    setCountryOfOrigin('');
    setGlbFile('');
    setProductType('');
    setSensorData([]);
    setCustomFields([]);
  };

  const getProductData = () => ({
    ID: id,
    Name: name,
    Manufacturer: manufacturer,
    SowingDate: sowingDate,
    HarvestDate: harvestDate,
    Nutritional_information: nutritionalInformation,
    CountryOfOrigin: countryOfOrigin,
    Ingredients: ingredients,
    Allergens: allergens,
    PesticideUse: pesticideUse,
    FertilizerUse: fertilizerUse,
    Certifications: [],
    SensorData: sensorData,
    CustomObject: customFields.reduce((obj, field) => {
      if (field.key.trim()) obj[field.key] = field.value;
      return obj;
    }, {}),
  });

  return {
    // State
    id,
    setId,
    name,
    setName,
    harvestDate,
    setHarvestDate,
    ingredients,
    setIngredients,
    allergens,
    setAllergens,
    nutritionalInformation,
    setNutritionalInformation,
    sowingDate,
    setSowingDate,
    pesticideUse,
    setPesticideUse,
    fertilizerUse,
    setFertilizerUse,
    countryOfOrigin,
    setCountryOfOrigin,
    glbFile,
    setGlbFile,
    productType,
    setProductType,
    sensorData,
    setSensorData,
    customFields,
    setCustomFields,

    // Methods
    resetForm,
    getProductData,
  };
};
