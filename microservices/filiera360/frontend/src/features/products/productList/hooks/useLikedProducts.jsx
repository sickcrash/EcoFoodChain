import { useState, useEffect } from 'react';
import axios from 'axios';

export const useLikedProducts = () => {
    const [likedProducts, setLikedProducts] = useState([]);
    const [liked, setLiked] = useState(false);

    useEffect(() => {
        fetchLikedProducts();
    }, []);

    const fetchLikedProducts = async () => {
        try {
            const userId = localStorage.getItem('email') || 'default';
            const response = await axios.get(`api/getLikedProducts?userId=${userId}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
            });
            setLikedProducts(response.data);
        } catch (error) {
            console.error('Error fetching liked products:', error);
        }
    };

    const handleLikeToggle = async (product) => {
        try {
            const userId = localStorage.getItem('email') || 'default';

            if (liked) {
                const response = await axios.delete(
                    `api/unlikeProduct?productId=${product.ID}&userId=${userId}`,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${localStorage.getItem('token')}`,
                        },
                    }
                );

                console.log(`Product ${product.ID} removed from favorites`, response.data);

                const updatedProducts = likedProducts.filter((p) => p.ID !== product.ID);
                setLikedProducts(updatedProducts);
                setLiked(false);
            } else {
                const productToLike = {
                    ID: product.ID,
                    Name: product.Name,
                    Manufacturer: product.Manufacturer,
                    CreationDate: product.CreationDate,
                    timestamp: new Date().toISOString(),
                };

                await axios.post(
                    'api/likeProduct',
                    {
                        product: productToLike,
                        userId: userId,
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${localStorage.getItem('token')}`,
                            'Content-Type': 'application/json',
                        },
                    }
                );

                console.log(`Product ${product.ID} added to favorites`);

                setLikedProducts([...likedProducts, productToLike]);
                setLiked(true);
            }
        } catch (error) {
            console.error('Error updating liked products:', error);
        }
    };

    const removeLikedProduct = async (productId) => {
        try {
            const userId = localStorage.getItem('email') || 'default';
            await axios.delete(
                `api/unlikeProduct?productId=${productId}&userId=${userId}`,
                {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            const updatedProducts = likedProducts.filter((p) => p.ID !== productId);
            setLikedProducts(updatedProducts);
        } catch (error) {
            console.error('Error removing product from favorites:', error);
        }
    };

    return {
        likedProducts,
        liked,
        setLiked,
        handleLikeToggle,
        removeLikedProduct
    };
};