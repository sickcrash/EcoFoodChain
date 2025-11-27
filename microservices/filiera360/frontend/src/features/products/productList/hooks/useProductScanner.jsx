import { useState, useEffect } from 'react';
import axios from 'axios';

export const useProductScanner = () => {
    const [itemCode, setItemCode] = useState('');
    const [message, setMessage] = useState('');
    const [product, setProduct] = useState(null);
    const [productHistory, setProductHistory] = useState([]);
    const [scan, setScan] = useState(0);
    const [glbFile, setGlbFile] = useState(null);

    const handleScan = async (e) => {
        e?.preventDefault();

        try {
            console.log('Scanning for Item Code: ' + itemCode);

            // Fetch product details from the server
            const response = await axios.get(`api/getProduct?productId=${itemCode}`);
            const historyResponse = await axios.get(`api/getProductHistory?productId=${itemCode}`);

            if (response.status === 200) {
                const productData = response.data;
                setProduct(productData);
                setMessage(`Product ${itemCode} found!`);
                setProductHistory(historyResponse.data || '');
                // Fetch GLB model
                await fetchGLBModel(itemCode);

                window.scrollTo({ top: 0, behavior: 'smooth' });
                return productData;
            } else {
                setMessage('Product not found.');
                setProduct(null);
                return null;
            }
        } catch (error) {
            setMessage('Failed to fetch product details.');
            setProduct(null);
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
                console.log('GLB model loaded successfully!');
            } else {
                setGlbFile(null);
            }
        } catch (error) {
            console.error('Error fetching model: ', error);
            setGlbFile(null);
        }
    };

    useEffect(() => {
        if (scan > 0) handleScan();
    }, [scan]);

    return {
        itemCode,
        setItemCode,
        message,
        product,
        setProduct,
        productHistory,
        scan,
        setScan,
        glbFile,
        handleScan
    };
};