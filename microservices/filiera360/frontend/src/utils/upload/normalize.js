export const normalizeProduct = (item, manufacturer = '') => ({
  id: item.ID || item.id || '',
  name: item.Name || item.name || '',
  manufacturer: manufacturer,
  harvestDate: item.HarvestDate || item.harvestDate || '',
  expiryDate: item.ExpiryDate || item.expiryDate || '',
  nutritionalInformation: item.Nutritional_information || item.nutritionalInformation || '',
  countryOfOrigin: item.CountryOfOrigin || item.countryOfOrigin || '',
  ingredients: item.Ingredients || item.ingredients || '',
  allergens: item.Allergens || item.allergens || '',
  pesticideUse: item.PesticideUse || item.pesticideUse || '',
  fertilizerUse: item.FertilizerUse || item.fertilizerUse || '',
  customObject: item.CustomObject || {},
});
