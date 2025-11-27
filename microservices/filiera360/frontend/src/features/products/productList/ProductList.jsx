import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import UpdateProduct from '../../products/components/update/UpdateProduct';
import UpdateBatch from '../../products/components/update/UpdateBatch';

// Import custom hooks
import { useProductScanner } from './hooks/useProductScanner';
import { useBatchScanner } from './hooks/useBatchScanner';
import { useQRScanner } from './hooks/useQRScanner';
import { useLikedProducts } from './hooks/useLikedProducts';
import { useRecentlyScanned } from './hooks/useRecentlyScanned';

// Import components
import ScannerForm from './components/ScannerForm';
import ProductDetails from './components/ProductDetails';
import BatchDetails from './components/BatchDetails';
import ProductGrid from './components/ProductGrid';

// Import utils
import { handleDownloadHistoryLog, handleDownloadHistoryLogBatch } from '../../../utils/downloadUtils';

const ProductList = ({ onProductSelect, onBatchSelect }) => {
    const isProducer = localStorage.getItem('role') === 'producer';
    const isOperator = localStorage.getItem('role') === 'operator';
    const isUser = localStorage.getItem('role') === 'user';
    const { id } = useParams();

    // Custom hooks
    const productScanner = useProductScanner();
    const batchScanner = useBatchScanner();
    const qrScanner = useQRScanner();
    const likedProducts = useLikedProducts();
    const recentlyScanned = useRecentlyScanned();

    // Handle URL parameter for batch scanning
    useEffect(() => {
        if (id) {
            const batchCode = decodeURIComponent(id);
            console.log('ID Batch estratto da URL:', batchCode);
            batchScanner.setItemCodeBatch(batchCode);
            document.getElementById('itemCodeBatch').value = batchCode;
            batchScanner.setScanBatch((prev) => prev + 1);
        }
    }, []);

    // Update liked status when product changes
    useEffect(() => {
        if (productScanner.product) {
            likedProducts.setLiked(
                likedProducts.likedProducts.some((p) => p.ID === productScanner.itemCode)
            );
        }
    }, [productScanner.product, likedProducts.likedProducts]);

    // Handle product scan with additional logic
    const handleProductScan = async (e) => {
        const result = await productScanner.handleScan(e);
        if (result) {
            onProductSelect(productScanner.itemCode);
            await recentlyScanned.addToRecentlyScanned(result);
            batchScanner.setBatch(null); // Clear batch to avoid conflicts
            batchScanner.setBatchProduct(null);
        }
    };

    // Handle batch scan with additional logic
    const handleBatchScan = async (e) => {
        const result = await batchScanner.handleScanBatch(e);
        if (result) {
            onBatchSelect(batchScanner.itemCodeBatch);
            await recentlyScanned.addToRecentlyScanned(result.batch);
            productScanner.setProduct(); // Clear product to avoid conflicts
            productScanner.setScan(0)

        }
    };

    // Handle QR scanning for products
    const handleProductQrScan = (data) => {
        qrScanner.handleQrScan(
            data,
            productScanner.setItemCode,
            productScanner.setScan,
            'itemCode',
            qrScanner.setShowCamera
        );
    };

    // Handle QR scanning for batches
    const handleBatchQrScan = (data) => {
        qrScanner.handleQrScan(
            data,
            batchScanner.setItemCodeBatch,
            batchScanner.setScanBatch,
            'itemCodeBatch',
            qrScanner.setShowCamera2
        );
    };

    // Handle image upload for products
    const handleProductImageUpload = (event) => {
        qrScanner.handleImageUpload(
            event,
            productScanner.setItemCode,
            productScanner.setScan,
            'itemCode'
        );
    };

    // Handle image upload for batches
    const handleBatchImageUpload = (event) => {
        qrScanner.handleImageUpload(
            event,
            batchScanner.setItemCodeBatch,
            batchScanner.setScanBatch,
            'itemCodeBatch'
        );
    };

    // Handle product selection from grid
    const handleProductFromGrid = (product) => {
        productScanner.setItemCode(product.ID);
        try {
            document.getElementById('itemCode').value = product.ID;
        } catch (e) {
            // Handle case where element doesn't exist
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="container mt-5">
            {/* Product Scanner Form */}
            {(isProducer || isOperator) && (
                <>
                    <ScannerForm
                        title="Scan Product 🔎"
                        subtitle="🔗 Insert the item code manually or either scan/upload a QR code"
                        itemCode={productScanner.itemCode}
                        setItemCode={productScanner.setItemCode}
                        onSubmit={handleProductScan}
                        message={productScanner.message}
                        showCamera={qrScanner.showCamera}
                        setShowCamera={qrScanner.setShowCamera}
                        onImageUpload={handleProductImageUpload}
                        onQrScan={handleProductQrScan}
                        onError={qrScanner.handleError}
                        inputId="itemCode"
                        uploaderId="uploader"
                        submitLabel="Scan Product"
                    />
                    <br />
                </>
            )}

            {/* Batch Scanner Form */}
            <ScannerForm
                title="Scan Batch 🔎"
                subtitle="🔗 Insert the item code manually or either scan/upload a QR code"
                itemCode={batchScanner.itemCodeBatch}
                setItemCode={batchScanner.setItemCodeBatch}
                onSubmit={handleBatchScan}
                message={batchScanner.messageBatch}
                showCamera={qrScanner.showCamera2}
                setShowCamera={qrScanner.setShowCamera2}
                onImageUpload={handleBatchImageUpload}
                onQrScan={handleBatchQrScan}
                onError={qrScanner.handleError}
                inputId="itemCodeBatch"
                uploaderId="uploaderBatch"
                submitLabel="Scan Batch"
            />

            {/* Product Details */}
            {productScanner.product && (
                <>
                    <ProductDetails
                        product={productScanner.product}
                        productHistory={productScanner.productHistory}
                        itemCode={productScanner.itemCode}
                        glbFile={productScanner.glbFile}
                        liked={likedProducts.liked}
                        onLikeToggle={() => likedProducts.handleLikeToggle(productScanner.product)}
                        onDownloadHistory={() => handleDownloadHistoryLog(productScanner.productHistory, productScanner.itemCode)}
                    />

                    {/* Update Product Component */}
                    {isProducer &&
                        productScanner.product.Manufacturer === localStorage.getItem('manufacturer') && (
                            <UpdateProduct
                                productId={productScanner.itemCode}
                                productType={{
                                    Ingredients: productScanner.product.Ingredients,
                                    HarvestDate: productScanner.product.HarvestDate
                                }}
                                onProductUpdate={handleProductScan}
                            />
                        )}
                </>
            )}

            {/* Batch Details */}
            {batchScanner.batch && (
                <>
                    <BatchDetails
                        batch={batchScanner.batch}
                        batchProduct={batchScanner.batchProduct}
                        batchHistory={batchScanner.batchHistory}
                        itemCodeBatch={batchScanner.itemCodeBatch}
                        glbFile={batchScanner.glbFile}
                        onDownloadHistory={() => handleDownloadHistoryLogBatch(batchScanner.batchHistory, batchScanner.itemCodeBatch)}
                    />

                    {/* Update Batch Component */}
                    {batchScanner.batch.Operator === localStorage.getItem('manufacturer') && (
                        <UpdateBatch
                            productId={batchScanner.batch.ProductId}
                            batchId={batchScanner.batch.ID}
                            onBatchUpdate={handleBatchScan}
                        />
                    )}
                </>
            )}

            <br />

            {/* Recently Scanned Products Grid */}
            <ProductGrid
                products={recentlyScanned.recentlyScanned}
                title="Recent uploads/scansdfujkhdfjdjffj 🕒"
                onProductSelect={handleProductFromGrid}
            />

            {/* Liked Products Grid */}
            <ProductGrid
                products={likedProducts.likedProducts}
                title="Your Liked Products ❤️"
                onProductSelect={handleProductFromGrid}
                onRemoveProduct={likedProducts.removeLikedProduct}
                showRemoveButton={true}
            />
        </div>
    );
};

export default ProductList;