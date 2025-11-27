import { useState, useEffect } from 'react';
import axios from 'axios';

export const useBatchScanner = () => {
    const [itemCodeBatch, setItemCodeBatch] = useState('');
    const [messageBatch, setMessageBatch] = useState('');
    const [batch, setBatch] = useState(null);
    const [batchProduct, setBatchProduct] = useState(null);
    const [batchHistory, setBatchHistory] = useState([]);
    const [scanBatch, setScanBatch] = useState(0);
    const [glbFile, setGlbFile] = useState(null);

    const handleScanBatch = async (e) => {
        e?.preventDefault();

        try {
            console.log('Scanning for Batch Code: ' + itemCodeBatch);

            const responseBatch = await axios.get(`api/getBatch?batchId=${itemCodeBatch}`);
            const historyResponseBatch = await axios.get(`api/getBatchHistory?batchId=${itemCodeBatch}`);

            if (responseBatch.status === 200) {
                const batchData = responseBatch.data;
                const idproduct = batchData.ProductId;

                setBatch(batchData);
                setBatchHistory(historyResponseBatch.data || '');

                // Fetch product details for the batch
                const responseProduct = await axios.get(`api/getProduct?productId=${idproduct}`);

                if (responseProduct.status === 200) {
                    setBatchProduct(responseProduct.data);
                    await fetchGLBModel(idproduct);
                }

                setMessageBatch(`Batch ${itemCodeBatch} found!`);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return { batch: batchData, product: responseProduct.data };
            } else {
                setMessageBatch('Batch not found.');
                setBatch(null);
                return null;
            }
        } catch (error) {
            setMessageBatch('Failed to fetch batch details.');
            setBatch(null);
            return null;
        }
    };

    const fetchGLBModel = async (productId) => {
        try {
            const modelResponse = await axios.get(`api/getModel?productId=${productId}`);
            if (modelResponse.status === 200) {
                const base64Model = modelResponse.data.ModelBase64;
                const byteCharacters = atob(base64Model.split(',')[1]);
                const byteArray = new Uint8Array(byteCharacters.length);

                for (let i = 0; i < byteCharacters.length; i++) {
                    byteArray[i] = byteCharacters.charCodeAt(i);
                }

                const glbBlob = new Blob([byteArray], { type: 'application/octet-stream' });
                setGlbFile(glbBlob);
            }
        } catch (error) {
            console.error('Error fetching model: ', error);
            setGlbFile(null);
        }
    };

    useEffect(() => {
        if (scanBatch > 0) handleScanBatch();
    }, [scanBatch]);

    return {
        itemCodeBatch,
        setItemCodeBatch,
        messageBatch,
        batch,
        setBatch,
        batchProduct,
        batchHistory,
        setBatchProduct,
        scanBatch,
        setScanBatch,
        glbFile,
        handleScanBatch
    };
};