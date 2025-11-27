import { useState } from 'react';
import jsQR from 'jsqr';

export const useQRScanner = () => {
    const [showCamera, setShowCamera] = useState(false);
    const [showCamera2, setShowCamera2] = useState(false);

    const handleImageUpload = (event, setItemCode, setScan, elementId) => {
        console.log('Starting QR code processing...');
        const file = event.target.files[0];

        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, img.width, img.height);
                    const imageData = ctx.getImageData(0, 0, img.width, img.height);
                    const code = jsQR(imageData.data, img.width, img.height);

                    if (code) {
                        console.log(code.data);
                        const match = code.data.match(/\/scan-product\/([^\/\s]+)/);
                        const id = match ? match[1] : code.data;
                        setItemCode(id);
                        document.getElementById(elementId).value = id;
                        setScan(prev => prev + 1);
                    } else {
                        console.log('No QR code found in uploaded image.');
                    }
                };
            };
            reader.readAsDataURL(file);
            setShowCamera(false);
            document.getElementById('uploader').value = '';
        }
    };

    const handleQrScan = (data, setItemCode, setScan, elementId, setShowCamera) => {
        if (data) {
            console.log(data.text);
            const match = data.text.match(/\/scan-product\/([^\/\s]+)/);
            const id = match ? match[1] : data.text;
            document.getElementById(elementId).value = id;
            setItemCode(id);
            setScan(prev => prev + 1);
            setShowCamera(false);
        }
    };

    const handleError = (err) => {
        console.error('QR code scan error:', err);
    };

    return {
        showCamera,
        setShowCamera,
        showCamera2,
        setShowCamera2,
        handleImageUpload,
        handleQrScan,
        handleError
    };
};
