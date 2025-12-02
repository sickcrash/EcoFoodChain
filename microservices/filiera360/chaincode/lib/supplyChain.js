'use strict';
const stringify = require('json-stringify-deterministic');
const sortKeysRecursive = require('sort-keys-recursive');
const { Contract } = require('fabric-contract-api');

class SupplyChainContract extends Contract {
    async initLedger(ctx) {
        console.log('Initializing the ledger with some sample data...');
        const products = [
            {
                "ID": "AGRI_X",
                "Name": "Organic Carrots",
                "Manufacturer": "Green Farm Co.",
                "HarvestDate": "2023-05-01",
                "Ingredients": "",
                "Allergens": "",
                "Nutritional_information": "",
                "SowingDate": "2023-02-25",
                "PesticideUse": "No pesticides used",
                "FertilizerUse": "Organic",
                "CountryOfOrigin": "Canada",
                "SensorData": [],
                "Certifications": [],
                "CustomObject": [
                    {
                        "tipo": "ortaggio",
                        "colore": "verde"
                    }
                ]
            },
            {
                "ID": "FIN_X",
                "Name": "Almond Milk",
                "Manufacturer": "NutraFoods Inc.",
                "HarvestDate": "2023-10-01",
                "Ingredients": "Almonds, Water, Sugar, Salt, Vitamin D",
                "Allergens": "Almonds",
                "Nutritional_information": "Calories: 60 per 240ml, Protein: 1g, Fat: 2.5g",
                "SowingDate": "",
                "PesticideUse": "",
                "FertilizerUse": "",
                "CountryOfOrigin": "",
                "SensorData": [],
                "Certifications": [],
                "CustomObject": [
                    {
                        "tipo": "frutta",
                        "colore": "giallo"
                    }
                ]
            }
        ]
        const batches =[
            {
                "ID" : "L001",
                "Operator":"cuoricini",
                "ProductId":"AGRI_X",
                "ProductionDate": "2023-05-01",
                "Quantity": "6",
                "BatchNumber":"3",
                "State":"Shipped",
                "CustomObject": [
                    {
                        "codiceSpedizione": "1234"
                    }
                ]
            },
            {
                "ID" : "L002",
                "Operator":"cuoricini",
                "ProductId":"FIN_X",
                "ProductionDate": "2025-01-01",
                "Quantity": "16",
                "BatchNumber":"13",
                "State":"Delivered",
                "CustomObject": [
                    {
                        "codiceSpedizione": "4567"
                    }
                ]
            },
        ]

        for (const product of products) {
            product.docType = 'product';
            await ctx.stub.putState(product.ID, Buffer.from(stringify(sortKeysRecursive(product))));
        }
        
        for (const batch of batches) {
            batch.docType = 'batch';
            await ctx.stub.putState(batch.ID, Buffer.from(stringify(sortKeysRecursive(batch))));
        }

    }

    async createProduct(ctx, id, name, manufacturer, harvestDate, ingredients, allergens, nutritionalInformation, sowingDate, pesticideUse, fertilizerUse, countryOfOrigin, sensorData, certifications, customObject) {
       console.log("Sono nella supplychain")
        console.log(`Creating product ${id}`);
        
        const exists = await this.ProductExists(ctx, id);
        if (exists) {
            throw new Error(`The product ${id} already exists`);
        }
    
        const product = {
            ID: id,
            Name: name,
            Manufacturer: manufacturer,
            HarvestDate: harvestDate,
            Ingredients: ingredients,
            Allergens: allergens,
            Nutritional_information: nutritionalInformation,
            SowingDate: sowingDate,
            PesticideUse: pesticideUse,
            FertilizerUse: fertilizerUse,
            CountryOfOrigin: countryOfOrigin,
            SensorData: JSON.parse(sensorData),
            Certifications: JSON.parse(certifications),
            CustomObject: JSON.parse(customObject) // Convertiamo il JSON in oggetto
        };
    
        await ctx.stub.putState(id, Buffer.from(JSON.stringify(product)));
        console.log(`Product ${id} created`);
        return JSON.stringify(product);
    }
    async createBatch(ctx, idBatch, productId, operator, batchNumber, quantity,  productionDate, state, customObject) {
        console.log("Sono nella supplychain")
         console.log(`Creating Batch ${idBatch}`);
         
         const exists = await this.BatchExists(ctx, idBatch);
         if (exists) {
             throw new Error(`The batch ${idBatch} already exists`);
         }
         const existsProduct = await this.ProductExists(ctx, productId);
         if (!existsProduct) {
             throw new Error(`The product ${productId} not exists`);
         }
     
         const batch = {
             ID: idBatch,
             ProductId: productId,
             Operator: operator,
             BatchNumber: batchNumber,
             Quantity: quantity,
             ProductionDate: productionDate,
             State: state,
             CustomObject: JSON.parse(customObject) // Convertiamo il JSON in oggetto
         };
     
         await ctx.stub.putState(idBatch, Buffer.from(JSON.stringify(batch)));
         console.log(`Batch ${idBatch} created`);
         return JSON.stringify(batch);
     }
 
    async ReadProduct(ctx, id) {
        const productJSON = await ctx.stub.getState(id); // get the product from chaincode state
        if (!productJSON || productJSON.length === 0) {
            throw new Error(`The product ${id} does not exist`);
        }
        return productJSON.toString();
    }

    async ReadBatch(ctx, batchId) {
        const batchJSON = await ctx.stub.getState(batchId);
        if (!batchJSON || batchJSON.length === 0) {
            throw new Error(`The batch ${batchId} does not exist`);
        }
        return batchJSON.toString();
    }

    // DEBUG
    // async GetAllProducts(ctx) {
    //     const iterator = await ctx.stub.getStateByRange('', '');
    //     const allResults = [];
    //
    //     while (true) {
    //         const res = await iterator.next();
    //
    //         if (res.value) {
    //             // Res contiene le informazioni sulla transazione
    //             const strValue = res.value.value.toString('utf8');
    //             let record;
    //             try {
    //                 record = JSON.parse(strValue);
    //             } catch (err) {
    //                 record = strValue;
    //             }
    //             allResults.push({ Key: res.value.key, Record: record });
    //         }
    //
    //         if (res.done) {
    //             await iterator.close();
    //             break;
    //         }
    //     }
    //
    //     return JSON.stringify(allResults);
    // }


    // nuova aggiunta
    async GetProductHistory(ctx, id) {
        const iterator = await ctx.stub.getHistoryForKey(id); // Ottieni la cronologia per l'asset

        const allResults = [];
        while (true) {
            const res = await iterator.next();
            if (res.value) {
                // Res contiene le informazioni sulla transazione
                const tx = res.value;
                const record = {
                    TxId: tx.tx_id,                // ID della transazione
                    Timestamp: tx.timestamp,       // Timestamp della transazione
                    IsDeleted: tx.is_delete,       // Se l'asset è stato eliminato
                    Value: tx.value.toString('utf8') // Stato del prodotto in quella transazione
                };
                allResults.push(record);
            }
            if (res.done) {
                await iterator.close();
                return JSON.stringify(allResults);
            }
        }
    }
      // nuova aggiunta Batch
      async GetBatchHistory(ctx, id) {
        const iterator = await ctx.stub.getHistoryForKey(id); // Ottieni la cronologia per l'asset

        const allResults = [];
        while (true) {
            const res = await iterator.next();
            if (res.value) {
                // Res contiene le informazioni sulla transazione
                const tx = res.value;
                const record = {
                    TxId: tx.tx_id,                // ID della transazione
                    Timestamp: tx.timestamp,       // Timestamp della transazione
                    IsDeleted: tx.is_delete,       // Se l'asset è stato eliminato
                    Value: tx.value.toString('utf8') // Stato del prodotto in quella transazione
                };
                allResults.push(record);
            }
            if (res.done) {
                await iterator.close();
                return JSON.stringify(allResults);
            }
        }
    }

    async UpdateProduct(ctx, id, name, manufacturer, expiryDate, ingredients, allergens, nutritional_information, harvestDate, pesticideUse, fertilizerUse, countryOfOrigin, sensorData, certifications, customObject) {
    
        console.log('Sono su chaincode');
        // Check if the product exists
        const productAsBytes = await ctx.stub.getState(id);
        if (!productAsBytes || productAsBytes.length === 0) {
            console.log('ID non esiste');
            throw new Error(`The product ${id} does not exist`);
        }
    
        // Parse the existing product data
        const existingProduct = JSON.parse(productAsBytes.toString());
    
        // Update fields only if provided
        const updatedProduct = {
            ID: id,
            Name: name || existingProduct.Name,
            Manufacturer: manufacturer || existingProduct.Manufacturer,
            ExpiryDate: expiryDate || existingProduct.ExpiryDate,
            Ingredients: ingredients || existingProduct.Ingredients,
            Allergens: allergens || existingProduct.Allergens,
            Nutritional_information: nutritional_information || existingProduct.Nutritional_information,
            HarvestDate: harvestDate || existingProduct.HarvestDate,
            PesticideUse: pesticideUse || existingProduct.PesticideUse,
            FertilizerUse: fertilizerUse || existingProduct.FertilizerUse,
            CountryOfOrigin: countryOfOrigin || existingProduct.CountryOfOrigin,
            SensorData: sensorData ? JSON.parse(sensorData) : existingProduct.SensorData,
            Certifications: certifications ? JSON.parse(certifications) : existingProduct.Certifications,
            CustomObject: customObject ? JSON.parse(customObject) : existingProduct.CustomObject
        };
    
        await ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(updatedProduct))));
        return JSON.stringify(updatedProduct);
    }

    async UpdateBatch(ctx, batchId, productId, operator, batchNumber, quantity, productionDate, state, customObject) {
        const batchAsBytes = await ctx.stub.getState(batchId);
        if (!batchAsBytes || batchAsBytes.length === 0) {
            throw new Error(`The batch ${batchId} does not exist`);
        }
        const existingBatch = JSON.parse(batchAsBytes.toString());

        console.log('Existing Batch:', existingBatch);
        console.log('Batch ID:', batchId);
        // Update fields only if provided
        const updatedBatch = {
            ID: batchId,
            ProductId: productId || existingBatch.ProductId,
            Operator: operator || existingBatch.Operator,
            BatchNumber: batchNumber || existingBatch.BatchNumber,
            Quantity: quantity || existingBatch.Quantity,
            ProductionDate: productionDate || existingBatch.ProductionDate,
            State: state || existingBatch.state,
            CustomObject: customObject ? JSON.parse(customObject) : existingBatch.CustomObject
        };
        
        await ctx.stub.putState(batchId, Buffer.from(JSON.stringify(updatedBatch)));
        return JSON.stringify(updatedBatch);
    }
    
       
    // DeleteProduct deletes an given product from the world state.
    async DeleteProduct(ctx, id) {
        const exists = await this.ProductExists(ctx, id);
        if (!exists) {
            throw new Error(`The product ${id} does not exist`);
        }
        return ctx.stub.deleteState(id);
    }

    async ProductExists(ctx, id) {
        const productJSON = await ctx.stub.getState(id);
        return productJSON && productJSON.length > 0;
    }



    // DeleteBatch deletes an given Batch from the world state.

    async DeleteBatch(ctx, id) {
        const exists = await this.BatchExists(ctx, id);
        if (!exists) {
            throw new Error(`The batch ${id} does not exist`);
        }
        return ctx.stub.deleteState(id);
    }
    
// BatchExists verifies the existence of a given Batch.

    async BatchExists(ctx, idBatch) {
        const batchJSON = await ctx.stub.getState(idBatch);
        return batchJSON && batchJSON.length > 0;
    }

    async AddSensorData(ctx, id, sensor_id, signals) {
        const productAsBytes = await ctx.stub.getState(id);
        if (!productAsBytes || productAsBytes.length === 0) {
            throw new Error(`Il prodotto ${id} non esiste.`);
        }
        const product = JSON.parse(productAsBytes.toString());

        // Aggiungi i dati del sensore alla cronologia del prodotto
        product.SensorData.push({
            SensorId: sensor_id,
            Signals: JSON.parse(signals)
        });

        await ctx.stub.putState(id, Buffer.from(JSON.stringify(product)));
        console.info(`Dati del sensore aggiunti per il prodotto ${id}.`);
    }

    async AddCertification(ctx, id, certificationType, certifyingBody, issueDate) {
         // Retrieve the product data from the state
         const productAsBytes = await ctx.stub.getState(id);
         if (!productAsBytes || productAsBytes.length === 0) {
             throw new Error(`Product ${id} does not exist.`);
         }

         const product = JSON.parse(productAsBytes.toString());

         product.Certifications.push({
             CertificationType: certificationType,
             CertifyingBody: certifyingBody,
             IssueDate: issueDate
         });

         await ctx.stub.putState(id, Buffer.from(JSON.stringify(product)));
         console.info(`Certification added to product ${id}.`);
    }

    async VerifyCertification(ctx, id, requiredCertificationType) {
        const productAsBytes = await ctx.stub.getState(id);
        if (!productAsBytes || productAsBytes.length === 0) {
            throw new Error(`Product ${id} does not exist.`);
        }
        const product = JSON.parse(productAsBytes.toString());

        // Check if the product has certifications
        if (!product.Certifications || product.Certifications.length === 0) {
            const res = JSON.stringify({ compliant: false, message: `Product ${id} has no certifications.` });
            return ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(res))));
        }

        // Verify the product certification
        for (const certification of product.Certifications) {
            if (certification.CertificationType === requiredCertificationType) {
                const res = JSON.stringify({ compliant: true, message: `Product ${id} is compliant with certification: ${requiredCertificationType}.` });
                return ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(res))));
            }
        }

        const res = JSON.stringify({ compliant: false, message: `Product ${id} is not compliant with the required certification: ${requiredCertificationType}.` });
        return ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(res))));
    }

    async GetAllSensorData(ctx, id) {
        const productAsBytes = await ctx.stub.getState(id);
        if (!productAsBytes || productAsBytes.length === 0) {
            throw new Error(`Product ${id} does not exist.`);
        }
        const product = JSON.parse(productAsBytes.toString());
        return JSON.stringify(product.SensorData);
    }

    async GetAllCertifications(ctx, id) {
         const productAsBytes = await ctx.stub.getState(id);
         if (!productAsBytes || productAsBytes.length === 0) {
             throw new Error(`Product ${id} does not exist.`);
         }
         const product = JSON.parse(productAsBytes.toString());
         return JSON.stringify(product.Certifications);
     }
}

module.exports = SupplyChainContract;
