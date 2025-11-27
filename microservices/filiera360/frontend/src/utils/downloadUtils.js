export const handleDownloadHistoryLog = (productHistory, itemCode) => {
    const history = productHistory;
    let logContent = `Product History for ID: ${itemCode}\n\n`;

    history.forEach((item, index) => {
        const date = new Date(item.Timestamp.seconds * 1000).toLocaleString();
        const valueData = JSON.parse(item.Value);

        logContent += `Transaction ${index + 1}\n`;
        logContent += `Date and Time: ${date}\n`;
        logContent += `ID: ${valueData.ID}\n`;
        logContent += `Name: ${valueData.Name}\n`;
        logContent += `Manufacturer: ${valueData.Manufacturer}\n`;
        logContent += `Expiry Date: ${valueData.ExpiryDate}\n`;
        logContent += `Ingredients: ${valueData.Ingredients}\n`;
        logContent += `Nutritional Information: ${valueData.Nutritional_information || 'N/A'}\n`;
        logContent += `Allergens: ${valueData.Allergens || 'N/A'}\n`;
        logContent += `Harvest Date: ${valueData.HarvestDate}\n`;
        logContent += `Pesticide Use: ${valueData.PesticideUse || 'N/A'}\n`;
        logContent += `Fertilizer Use: ${valueData.FertilizerUse || 'N/A'}\n`;
        logContent += `Country Of Origin: ${valueData.CountryOfOrigin || 'N/A'}\n`;

        // Add sensor data, certifications, and custom fields logic...
        logContent += '\n---\n\n';
    });

    const blob = new Blob([logContent], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${itemCode}_product_history.txt`;
    link.click();
};

export const handleDownloadHistoryLogBatch = (batchHistory, itemCodeBatch) => {
    const history = batchHistory;
    let logContent = `Batch History for ID: ${itemCodeBatch}\n\n`;

    history.forEach((item, index) => {
        const date = new Date(item.Timestamp.seconds * 1000).toLocaleString();
        const valueData = JSON.parse(item.Value);

        logContent += `Transaction ${index + 1}\n`;
        logContent += `Date and Time: ${date}\n`;
        logContent += `ID: ${valueData.ID}\n`;
        logContent += `Product ID: ${valueData.ProductId}\n`;
        logContent += `Operator: ${valueData.Operator}\n`;
        logContent += `Batch number: ${valueData.BatchNumber}\n`;
        logContent += `Quantity: ${valueData.Quantity}\n`;
        logContent += `Production date: ${valueData.Production_date || 'N/A'}\n`;
        logContent += `State: ${valueData.State || 'N/A'}\n`;

        // Add custom fields logic...
        logContent += '\n---\n\n';
    });

    const blob = new Blob([logContent], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${itemCodeBatch}_batch_history.txt`;
    link.click();
};