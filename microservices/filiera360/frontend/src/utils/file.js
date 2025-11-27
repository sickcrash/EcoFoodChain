export const convertFileToBase64 = async (fileOrUrl) => {
  try {
    const source = typeof fileOrUrl === 'string' ? await fetch(fileOrUrl).then((res) => res.blob()) : fileOrUrl;

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(source);
    });
  } catch (err) {
    console.error('Error converting to base64:', err);
    throw new Error('Failed to convert file to base64.');
  }
};
