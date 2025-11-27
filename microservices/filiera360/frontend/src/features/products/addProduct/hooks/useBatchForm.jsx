import { useState } from 'react';

export const useBatchForm = (operator) => {
  const [idBatch, setIdBatch] = useState('');
  const [productId, setProductId] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [quantity, setQuantity] = useState('');
  const [productionDate, setProductionDate] = useState('');
  const [state, setState] = useState('');
  const [customBatchFields, setCustomBatchFields] = useState([]);

  const resetForm = () => {
    setIdBatch('');
    setProductId('');
    setBatchNumber('');
    setQuantity('');
    setProductionDate('');
    setState('');
    setCustomBatchFields([]);
  };

  const getBatchData = () => {
    const batchIdFormatted = idBatch.startsWith('L') ? idBatch : 'L' + idBatch;

    return {
      ID: batchIdFormatted,
      ProductId: productId,
      Operator: operator,
      BatchNumber: batchNumber,
      Quantity: quantity,
      ProductionDate: productionDate,
      State: state,
      CustomObject: customBatchFields.reduce((obj, field) => {
        if (field.key.trim()) obj[field.key] = field.value;
        return obj;
      }, {}),
    };
  };

  return {
    // State
    idBatch,
    setIdBatch,
    productId,
    setProductId,
    batchNumber,
    setBatchNumber,
    quantity,
    setQuantity,
    productionDate,
    setProductionDate,
    state,
    setState,
    customBatchFields,
    setCustomBatchFields,

    // Methods
    resetForm,
    getBatchData,
  };
};
