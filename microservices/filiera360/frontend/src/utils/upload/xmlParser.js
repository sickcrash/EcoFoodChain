import { normalizeProduct } from './normalize';

export const parseXML = (raw) => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(raw, 'text/xml');
  const items = Array.from(xmlDoc.getElementsByTagName('Product'));

  return items.map((item) => {
    const get = (tag) => item.getElementsByTagName(tag)[0]?.textContent || '';

    let customObj = {};
    const customTags = Array.from(item.getElementsByTagName('CustomObject'));
    customTags.forEach((el, idx) => {
      try {
        Object.assign(customObj, JSON.parse(el.textContent));
      } catch {
        customObj[`custom${idx + 1}`] = el.textContent;
      }
    });

    return normalizeProduct({
      ID: get('ID'),
      Name: get('Name'),
      HarvestDate: get('HarvestDate'),
      ExpiryDate: get('ExpiryDate'),
      Nutritional_information: get('Nutritional_information'),
      CountryOfOrigin: get('CountryOfOrigin'),
      Ingredients: get('Ingredients'),
      Allergens: get('Allergens'),
      PesticideUse: get('PesticideUse'),
      FertilizerUse: get('FertilizerUse'),
      CustomObject: customObj,
    });
  });
};
