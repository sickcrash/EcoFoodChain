#!/bin/bash
# kubectl port-forward svc/filiera-middleware 3000:3000
# chmod +x ./middleware_latency.sh

products=(
'{
    "ID": "PROD-TEST001",
    "Name": "Organic Avocado Premium Lot 1",
    "Manufacturer": "GreenValley Farms Ltd",
    "HarvestDate": "2025-02-03",
    "Ingredients": "Avocado",
    "Allergens": "None",
    "Nutritional_information": "This avocado has about 160 calories, 14.7g fat, 8.5g carbs, 2g protein, rich in vitamins K, E, C, B5, B6, B9 and minerals like potassium and magnesium.",
    "SowingDate": "2024-04-12",
    "PesticideUse": "Ultra-Low",
    "FertilizerUse": "Certified Organic Compost",
    "CountryOfOrigin": "Spain",
    "SensorData": {"temperature": [22.1, 23.4, 24.0, 22.8], "humidity": [58, 60, 62], "soil_moisture": "33%", "sun_exposure_hours": 11.2, "CO2_level": "410ppm"},
    "Certifications": {"organic_eu": true, "fair_trade": true, "non_gmo": true, "iso22000": true},
    "CustomObject": {"AI_Insights": {"PredictedShelfLifeDays": 12, "FreshnessScore": 0.91, "RiskFactors": ["Temperature fluctuations: low", "Humidity spikes: moderate"]}}
}'
'{
    "ID": "PROD-TEST002",
    "Name": "Organic Banana Bunch 3",
    "Manufacturer": "Tropico Farms Inc",
    "HarvestDate": "2025-01-28",
    "Ingredients": "Banana",
    "Allergens": "None",
    "Nutritional_information": "Each banana contains approximately 105 calories, 0.3g fat, 27g carbs, 1.3g protein, high in potassium and vitamin B6.",
    "SowingDate": "2024-03-10",
    "PesticideUse": "Low",
    "FertilizerUse": "Natural Compost",
    "CountryOfOrigin": "Ecuador",
    "SensorData": {"temperature": [26.5, 27.0, 26.8, 27.2], "humidity": [75, 78, 80], "soil_moisture": "45%", "sun_exposure_hours": 12.5, "CO2_level": "415ppm"},
    "Certifications": {"organic_eu": true, "fair_trade": true, "non_gmo": true, "iso22000": false},
    "CustomObject": {"AI_Insights": {"PredictedShelfLifeDays": 7, "FreshnessScore": 0.85, "RiskFactors": ["High humidity: moderate", "Temperature swings: low"]}}
}'
'{
    "ID": "PROD-TEST003",
    "Name": "Red Apple Gala Lot 5",
    "Manufacturer": "Orchard Valley Co.",
    "HarvestDate": "2025-03-02",
    "Ingredients": "Apple",
    "Allergens": "None",
    "Nutritional_information": "One apple has roughly 95 calories, 0.3g fat, 25g carbs, 0.5g protein, rich in vitamin C and dietary fiber.",
    "SowingDate": "2024-04-01",
    "PesticideUse": "Moderate",
    "FertilizerUse": "Organic Fertilizer",
    "CountryOfOrigin": "USA",
    "SensorData": {"temperature": [18.5, 19.2, 20.0, 18.8], "humidity": [60, 63, 65], "soil_moisture": "40%", "sun_exposure_hours": 9.5, "CO2_level": "400ppm"},
    "Certifications": {"organic_eu": false, "fair_trade": false, "non_gmo": true, "iso22000": true},
    "CustomObject": {"AI_Insights": {"PredictedShelfLifeDays": 20, "FreshnessScore": 0.93, "RiskFactors": ["Temperature drops: moderate", "Humidity spikes: low"]}}
}'
'{
    "ID": "PROD-TEST004",
    "Name": "Cherry Tomatoes Pack",
    "Manufacturer": "Sunny Veg Ltd",
    "HarvestDate": "2025-03-05",
    "Ingredients": "Tomato",
    "Allergens": "None",
    "Nutritional_information": "Contains 27 calories per 100g, 0.3g fat, 6g carbs, 1.2g protein, and high in vitamins A, C, and potassium.",
    "SowingDate": "2024-05-01",
    "PesticideUse": "Ultra-Low",
    "FertilizerUse": "Compost Tea",
    "CountryOfOrigin": "Italy",
    "SensorData": {"temperature": [21.0, 22.5, 23.0, 22.0], "humidity": [55, 57, 60], "soil_moisture": "38%", "sun_exposure_hours": 10.0, "CO2_level": "405ppm"},
    "Certifications": {"organic_eu": true, "fair_trade": false, "non_gmo": true, "iso22000": true},
    "CustomObject": {"AI_Insights": {"PredictedShelfLifeDays": 10, "FreshnessScore": 0.88, "RiskFactors": ["Temperature fluctuations: low", "Humidity spikes: moderate"]}}
}'
'{
    "ID": "PROD-TEST005",
    "Name": "Organic Spinach Bag 1kg",
    "Manufacturer": "Green Leaf Organics",
    "HarvestDate": "2025-03-01",
    "Ingredients": "Spinach",
    "Allergens": "None",
    "Nutritional_information": "One serving (100g) has 23 calories, 0.4g fat, 3.6g carbs, 2.9g protein, rich in iron, calcium, vitamins A and C.",
    "SowingDate": "2024-04-10",
    "PesticideUse": "Ultra-Low",
    "FertilizerUse": "Organic Compost",
    "CountryOfOrigin": "Netherlands",
    "SensorData": {"temperature": [16.5, 17.0, 16.8, 17.2], "humidity": [70, 72, 73], "soil_moisture": "42%", "sun_exposure_hours": 8.5, "CO2_level": "398ppm"},
    "Certifications": {"organic_eu": true, "fair_trade": false, "non_gmo": true, "iso22000": true},
    "CustomObject": {"AI_Insights": {"PredictedShelfLifeDays": 5, "FreshnessScore": 0.87, "RiskFactors": ["High humidity: moderate", "Temperature drops: low"]}}
}'
'{
    "ID": "PROD-TEST006",
    "Name": "Fresh Blueberries Pack 250g",
    "Manufacturer": "Berry Farms Ltd",
    "HarvestDate": "2025-02-28",
    "Ingredients": "Blueberries",
    "Allergens": "None",
    "Nutritional_information": "Contains 57 calories per 100g, 0.3g fat, 14g carbs, 0.7g protein, rich in antioxidants, vitamin C and dietary fiber.",
    "SowingDate": "2024-03-20",
    "PesticideUse": "Low",
    "FertilizerUse": "Organic Fertilizer",
    "CountryOfOrigin": "Canada",
    "SensorData": {"temperature": [15.0, 15.5, 16.0, 15.2], "humidity": [65, 67, 68], "soil_moisture": "40%", "sun_exposure_hours": 7.5, "CO2_level": "399ppm"},
    "Certifications": {"organic_eu": true, "fair_trade": true, "non_gmo": true, "iso22000": false},
    "CustomObject": {"AI_Insights": {"PredictedShelfLifeDays": 8, "FreshnessScore": 0.9, "RiskFactors": ["Cold snaps: moderate", "Humidity spikes: low"]}}
}'
'{
    "ID": "PROD-TEST007",
    "Name": "Organic Carrots Bundle 1kg",
    "Manufacturer": "Root Farm Co.",
    "HarvestDate": "2025-03-03",
    "Ingredients": "Carrot",
    "Allergens": "None",
    "Nutritional_information": "One carrot (100g) has 41 calories, 0.2g fat, 10g carbs, 0.9g protein, high in vitamin A and fiber.",
    "SowingDate": "2024-04-05",
    "PesticideUse": "Ultra-Low",
    "FertilizerUse": "Organic Compost",
    "CountryOfOrigin": "France",
    "SensorData": {"temperature": [17.5, 18.0, 18.5, 17.8], "humidity": [60, 62, 63], "soil_moisture": "39%", "sun_exposure_hours": 9.0, "CO2_level": "402ppm"},
    "Certifications": {"organic_eu": true, "fair_trade": false, "non_gmo": true, "iso22000": true},
    "CustomObject": {"AI_Insights": {"PredictedShelfLifeDays": 15, "FreshnessScore": 0.92, "RiskFactors": ["Temperature swings: low", "Humidity fluctuations: low"]}}
}'
'{
    "ID": "PROD-TEST008",
    "Name": "Red Grapes Organic Pack 500g",
    "Manufacturer": "Vineyard Select Ltd",
    "HarvestDate": "2025-02-25",
    "Ingredients": "Grapes",
    "Allergens": "None",
    "Nutritional_information": "100g of grapes has 69 calories, 0.2g fat, 18g carbs, 0.7g protein, high in vitamins C and K.",
    "SowingDate": "2024-03-30",
    "PesticideUse": "Low",
    "FertilizerUse": "Organic Fertilizer",
    "CountryOfOrigin": "Chile",
    "SensorData": {"temperature": [20.0, 20.5, 21.0, 20.2], "humidity": [65, 67, 68], "soil_moisture": "36%", "sun_exposure_hours": 10.5, "CO2_level": "408ppm"},
    "Certifications": {"organic_eu": true, "fair_trade": true, "non_gmo": true, "iso22000": false},
    "CustomObject": {"AI_Insights": {"PredictedShelfLifeDays": 12, "FreshnessScore": 0.9, "RiskFactors": ["Temperature fluctuations: low", "Humidity spikes: moderate"]}}
}'
'{
    "ID": "PROD-TEST009",
    "Name": "Organic Kale Bag 500g",
    "Manufacturer": "Green Leaf Organics",
    "HarvestDate": "2025-03-06",
    "Ingredients": "Kale",
    "Allergens": "None",
    "Nutritional_information": "100g of kale contains 49 calories, 0.9g fat, 8.8g carbs, 4.3g protein, rich in vitamins A, K, C and calcium.",
    "SowingDate": "2024-04-12",
    "PesticideUse": "Ultra-Low",
    "FertilizerUse": "Organic Compost",
    "CountryOfOrigin": "Netherlands",
    "SensorData": {"temperature": [16.5, 17.2, 17.8, 16.9], "humidity": [68, 70, 71], "soil_moisture": "41%", "sun_exposure_hours": 8.8, "CO2_level": "398ppm"},
    "Certifications": {"organic_eu": true, "fair_trade": false, "non_gmo": true, "iso22000": true},
    "CustomObject": {"AI_Insights": {"PredictedShelfLifeDays": 6, "FreshnessScore": 0.88, "RiskFactors": ["Cold snaps: low", "Humidity spikes: moderate"]}}
}'
'{
    "ID": "PROD-TEST010",
    "Name": "Organic Mango Premium Lot 2",
    "Manufacturer": "Tropical Fruits Co.",
    "HarvestDate": "2025-03-01",
    "Ingredients": "Mango",
    "Allergens": "None",
    "Nutritional_information": "One mango contains 200 calories, 0.6g fat, 50g carbs, 2g protein, high in vitamins A, C and dietary fiber.",
    "SowingDate": "2024-03-15",
    "PesticideUse": "Low",
    "FertilizerUse": "Organic Fertilizer",
    "CountryOfOrigin": "Mexico",
    "SensorData": {"temperature": [25.0, 26.0, 26.5, 25.5], "humidity": [70, 72, 73], "soil_moisture": "44%", "sun_exposure_hours": 12.0, "CO2_level": "414ppm"},
    "Certifications": {"organic_eu": true, "fair_trade": true, "non_gmo": true, "iso22000": true},
    "CustomObject": {"AI_Insights": {"PredictedShelfLifeDays": 9, "FreshnessScore": 0.89, "RiskFactors": ["Temperature swings: moderate", "Humidity spikes: low"]}}
}'
)

for product in "${products[@]}"
do
    echo "Uploading product..."
    curl -X POST http://localhost:3000/uploadProduct \
         -H "Content-Type: application/json" \
         -d "$product" \
         -w "\nTotal Time: %{time_total}s\n"
    echo "----------------------------"
done
