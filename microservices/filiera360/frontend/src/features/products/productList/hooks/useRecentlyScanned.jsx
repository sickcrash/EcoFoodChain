import { useState, useEffect } from 'react';
import axios from 'axios';

export const useRecentlyScanned = () => {
    const [recentlyScanned, setRecentlyScanned] = useState([]);

    useEffect(() => {
        fetchRecentlySearched();
    }, []);

    const fetchRecentlySearched = async () => {
        try {
            const userId = localStorage.getItem('email') || 'default';
            const response = await axios.get(`api/getRecentlySearched?userId=${userId}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
            });
            setRecentlyScanned(response.data);
        } catch (error) {
            console.error('Error fetching recently searched products:', error);
        }
    };

    const addToRecentlyScanned = async (productData) => {
        try {
            const scannedProduct = {
                ID: productData.ID,
                Name: productData.Name || 'Batch',
                Manufacturer: productData.Manufacturer,
                CreationDate: productData.CreationDate,
                timestamp: new Date().toISOString(),
            };

            await axios.post(
                'api/addRecentlySearched',
                {
                    blockchainProductId: scannedProduct.ID,
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                    },
                }
            );

            const filteredHistory = recentlyScanned.filter((p) => p.ID !== scannedProduct.ID);
            const updatedHistory = [scannedProduct, ...filteredHistory].slice(0, 5);
            setRecentlyScanned(updatedHistory);
        } catch (error) {
            console.error('Error updating recently searched products:', error);
        }
    };

    return {
        recentlyScanned,
        addToRecentlyScanned
    };
};
