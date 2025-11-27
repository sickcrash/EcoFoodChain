// Contiene solo validazioni
export const validateDates = (sowingDate, harvestDate) => {
  if (new Date(harvestDate) <= new Date(sowingDate)) {
    throw new Error('Harvest Date must be after Sowing Date');
  }
};

export const validateBatchId = (id) => {
  if (!id.startsWith('L')) {
    alert('L\'ID del Batch deve iniziare con la lettera "L".');
    return false;
  }
  return true;
};

//Controllo che la quantità non sia nulla o inferiore a zero
export const validateQuantity = (qty) => {
  if (isNaN(qty) || Number(qty) <= 0) {
    alert('Quantity must be a positive number.');
    return false;
  }
  return true;
};

export const buildBatchData = (fields) => ({
  ID: fields.idBatch.startsWith('L') ? fields.idBatch : 'L' + fields.idBatch,
  ProductId: fields.productId,
  Operator: fields.operator,
  BatchNumber: fields.batchNumber,
  Quantity: fields.quantity,
  ProductionDate: fields.productionDate,
  State: fields.state,
  CustomObject: fields.customBatchFields.reduce((obj, field) => {
    if (field.key.trim()) obj[field.key] = field.value;
    return obj;
  }, {}),
});

export const buildProductData = ({
  id,
  name,
  manufacturer,
  sowingDate,
  harvestDate,
  nutritionalInformation,
  countryOfOrigin,
  ingredients,
  allergens,
  pesticideUse,
  fertilizerUse,
  sensorData,
  customFields,
}) => ({
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
