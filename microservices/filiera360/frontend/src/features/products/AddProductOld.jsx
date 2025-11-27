import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Button, Row, Col } from 'react-bootstrap';
import { QRCodeCanvas } from 'qrcode.react';
import Viewer3D from '../products/Viewer3D';
import Papa from 'papaparse'; // Assicurati che sia installato
import AddCertification from '../products/AddCertification';
import AddSensorData from '../products/components/update/AddSensorData';

// Estraggo fuori costanti comuni
const inputWidth = '30%';
const placeholderText = '+ add new';

const AddProductOld = () => {
  let navigate = useNavigate();

  const [manufacturer, setManufacturer] = useState('');

  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [harvestDate, setHarvestDate] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [allergens, setAllergens] = useState('');
  const [nutritionalInformation, setNutritionalInformation] = useState('');
  const [sowingDate, setSowingDate] = useState('');
  const [pesticideUse, setPesticideUse] = useState('');
  const [fertilizerUse, setFertilizerUse] = useState('');
  const [countryOfOrigin, setCountryOfOrigin] = useState('');
  const [message, setMessage] = useState('');
  const [view, setView] = useState('');
  const [lastAdded, setLastAdded] = useState('');
  const [glbFile, setGlbFile] = useState('');
  const [productType, setProductType] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [viewProduct, setViewProduct] = useState(false);
  const [customFields, setCustomFields] = useState([]);
  const [sensorData, setSensorData] = useState([]);
  const [showAddSensor, setShowAddSensor] = useState(false);
  const [showAddCertification, setShowAddCertification] = useState(false);
  // Batch fields
  const [operator, setOperator] = useState('');
  const [idBatch, setIdBatch] = useState('');
  const [productId, setProductId] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [quantity, setQuantity] = useState('');
  const [productionDate, setProductionDate] = useState('');
  const [state, setState] = useState('');
  const [customBatchFields, setCustomBatchFields] = useState([]);
  const [csvBatchFile, setCsvBatchFile] = useState(null);
  const [viewBatch, setViewBatch] = useState(false);

  // UI states
  const [messageProduct, setMessageProduct] = useState('');
  const [messageBatch, setMessageBatch] = useState('');
  const [lastAddedProduct, setLastAddedProduct] = useState('');
  const [lastAddedBatch, setLastAddedBatch] = useState('');
  const [role, setRole] = useState('');
  const [showInfo, setShowInfo] = useState(false);

  // ----------------- LOAD LOCALSTORAGE -----------------
  useEffect(() => {
    setManufacturer(localStorage.getItem('manufacturer') || '');
    const role = localStorage.getItem('role');
    if (role !== 'producer' && role !== 'operator') {
      navigate('/access-denied');
    }
    setRole(role || '');
    setOperator(localStorage.getItem('manufacturer') || ''); // Da sostituire con altro gruppo in futuro
  }, []);

  useEffect(() => {
    setShowAddSensor(false);
  }, [harvestDate, sowingDate]);

  const resetProductForm = () => {
    setId('');
    setName('');
    setHarvestDate('');
    setIngredients('');
    setAllergens('');
    setNutritionalInformation('');
    setSowingDate('');
    setPesticideUse('');
    setFertilizerUse('');
    setCountryOfOrigin('');
    setView('');
    setProductType('');
    setGlbFile('');
    setSensorData([]);
    setCustomFields([]); // Ensure it's an array
  };
  const resetBatchForm = () => {
    setIdBatch('');
    setProductId('');
    setBatchNumber('');
    setQuantity('');
    setProductionDate('');
    setState('');
    setCustomBatchFields([]);
  };
  // ----------------- CUSTOM FIELDS FUNCTIONS -----------------
  // Product

  // Metodo per aggiungere un nuovo campo personalizzato con chiave-valore
  const addCustomField = () => {
    setCustomFields([...customFields, { key: '', value: '' }]);
  };
  // Metodo per aggiornare il nuovo campo personalizzato
  const updateCustomField = (index, key, value) => {
    const newFields = [...customFields];
    newFields[index] = { key, value };
    setCustomFields(newFields);
  };
  const removeCustomField = (index) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };
  // Batch
  const addCustomBatchField = () => setCustomBatchFields([...customBatchFields, { key: '', value: '' }]);
  const updateCustomBatchField = (index, key, value) => {
    const newBatchFields = [...customBatchFields];
    newBatchFields[index] = { key, value };
    setCustomBatchFields(newBatchFields);
  };
  const removeCustomBatchField = (index) => {
    setCustomBatchFields(customBatchFields.filter((_, i) => i !== index));
  };
  // ----------------- FILE CONVERSION FOR 3D MODEL -----------------

  const convertFileToBase64 = async (glbFile) => {
    try {
      const response = await fetch(glbFile);
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting 3D model:', error);
      throw new Error('Failed to convert 3D model.');
    }
  };
  // ----------------- UPLOAD PRODUCT -----------------

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
        },
      );

      // Aggiorna lo stato locale se vuoi mostrare la lista anche qui
      // (opzionale, puoi rimuovere se non serve in AddProductOld)
    } catch (error) {
      console.error('Error updating recently searched products:', error);
    }
  };

  const handleUploadProduct = async (e) => {
    e.preventDefault();

    // Verifica se la data di scadenza è maggiore della data di raccolta
    if (new Date(harvestDate) <= new Date(sowingDate)) {
      alert('Harvest Date must be after Sowing Date');
      return;
    }
    // Crea un oggetto con tutti i dati del prodotto
    const productData = {
      ID: id,
      Name: name,
      Manufacturer: manufacturer,
      SowingDate: sowingDate,
      HarvestDate: harvestDate,
      Nutritional_information: nutritionalInformation,
      CountryOfOrigin: countryOfOrigin,
      Ingredients: ingredients,
      Allergens: allergens,
      PesticideUse: pesticideUse,
      FertilizerUse: fertilizerUse,
      Certifications: [],
      SensorData: sensorData,
      CustomObject: customFields.reduce((obj, field) => {
        if (field.key.trim()) obj[field.key] = field.value;
        return obj;
      }, {}),
    };
    // Funzione per recuperare il Blob da un URL e convertirlo in base64
    const convertFileToBase64 = async (glbFile) => {
      return fetch(glbFile)
        .then((response) => response.blob()) // Recupera il Blob dall'URL
        .then((blob) => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve(reader.result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        })
        .catch((error) => {
          console.error('Error fetching blob:', error);
          throw new Error('Failed to convert blob URL to base64.');
        });
    };
    // Funzione per fare POST del modello 3D
    /* const uploadModel = async () => {
          try {
            const base64File = await convertFileToBase64(glbFile);
            const postData = {
              ID: id,
              ModelBase64: base64File,
            };
            const token = localStorage.getItem("token");
            const response = await axios.post(
              "api/uploadModel",
              postData,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            console.log("Model uploaded successfully!");
            resetForm();
          } catch (error) {
            console.log("Failed to upload model.");
          }
        }; */
    // POST del nuovo prodotto + POST modello 3D
    try {
      const token = localStorage.getItem('token');
      console.log('invio dati al backend', productData);
      await axios.post('api/uploadProduct', productData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      setMessageProduct('Product uploaded successfully!');
    } catch (error) {
      setMessageProduct(error.response?.data?.message || 'Failed to upload product.');
      return; // esci subito se errore
    }

    // Tutto il resto va fuori dal try/catch
    addToRecentlyScanned(productData);
    setLastAddedProduct(productData.ID);
    resetProductForm();
    setViewProduct(false);
    setViewBatch(false);
    setCsvFile(null);
    if (glbFile) {
      try {
        const base64File = await convertFileToBase64(glbFile);
        await axios.post(
          'api/uploadModel',
          {
            ID: id,
            ModelBase64: base64File,
          },
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          },
        );
      } catch (error) {
        console.error('Failed to upload 3D model.');
      }
    }
  };
  // ----------------- UPLOAD BATCH -----------------

  const handleUploadBatch = async (e) => {
    e.preventDefault();

    if (!idBatch.startsWith('L')) {
      alert('L\'ID del Batch deve iniziare con la lettera "L".');
      return; // blocca l'upload
    }
    //Controllo che la quantità non sia nulla o inferiore a zero

    if (isNaN(quantity) || Number(quantity) <= 0) {
      alert('Quantity must be a positive number.');
      return;
    }
    //L'id del batch deve iniziare con la lettera L per legge
    let batchIdFormatted = idBatch.startsWith('L') ? idBatch : 'L' + idBatch;
    const batchData = {
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
    try {
      const token = localStorage.getItem('token');
      console.log(batchData);
      await axios.post('api/uploadBatch', batchData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessageBatch('Batch uploaded successfully!');
      addToRecentlyScanned(batchData);
      //Fai il resei dei dati del Form Batch
      resetBatchForm();

      //Resetta lo stato del file CSV caricato per i Batch, svuotando il campo file.
      setCsvBatchFile(null);

      //Nasconde i form di inserimento manuale che mostri solo quando l'utente clicca su "+ New Product".
      setViewBatch(false);

      //Nasconde i form di inserimento manuale che mostri solo quando l'utente clicca su "+ New Batch".
      setViewProduct(false);
      console.log(batchData.ID);
      setLastAddedBatch(batchData.ID);
    } catch (error) {
      setMessageBatch(error.response?.data?.message || 'Failed to upload batch.');
    }
  };
  // Funzione di normalizzazione per ogni prodotto
  const normalizeProduct = (item) => ({
    ID: item.ID || item.id || '',
    Name: item.Name || item.name || '',
    Manufacturer: manufacturer,
    HarvestDate: item.HarvestDate || item.harvestDate || '',
    ExpiryDate: item.ExpiryDate || item.expiryDate || '',
    Nutritional_information: item.Nutritional_information || item.nutritionalInformation || '',
    CountryOfOrigin: item.CountryOfOrigin || item.countryOfOrigin || '',
    Ingredients: item.Ingredients || item.ingredients || '',
    Allergens: item.Allergens || item.allergens || '',
    PesticideUse: item.PesticideUse || item.pesticideUse || '',
    FertilizerUse: item.FertilizerUse || item.fertilizerUse || '',
    CustomObject: item.CustomObject || {},
  });

  const handleMultiFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();

    const uploadProducts = async (products) => {
      const token = localStorage.getItem('token');
      for (let postData of products) {
        try {
          await axios.post('api/uploadProduct', postData, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          setMessageProduct('Product uploaded successfully!');
          setLastAddedProduct(postData.ID);
          setViewProduct(false);
          break; // Mostra solo il primo QR code, puoi rimuovere se vuoi batch
        } catch (error) {
          setMessageProduct(error.response?.data?.message || `Failed to upload product ${postData.ID}.`);
          setLastAddedProduct(''); // Nascondi QR se errore
          break; // Mostra solo il primo errore
        }
      }
    };

    const reader = new FileReader();
    reader.onload = (evt) => {
      const raw = evt.target.result;
      let products = [];

      if (ext === 'csv') {
        Papa.parse(raw, {
          complete: (result) => {
            for (let row of result.data) {
              if (!row[0]) continue; // skip empty
              // Prendi i primi 10 campi fissi
              const [
                ID,
                Name,
                HarvestDate,
                ExpiryDate,
                Nutritional_information,
                CountryOfOrigin,
                Ingredients,
                Allergens,
                PesticideUse,
                FertilizerUse,
                ...customFieldsArr
              ] = row;

              // Unisci tutti i custom field extra in un oggetto
              let customObj = {};
              customFieldsArr.forEach((field, idx) => {
                try {
                  // Se il campo è un JSON valido, uniscilo
                  const parsed = JSON.parse(field);
                  Object.assign(customObj, parsed);
                } catch {
                  if (field && field.trim()) customObj[`custom${idx + 1}`] = field;
                }
              });

              products.push({
                ID,
                Name,
                Manufacturer: manufacturer,
                HarvestDate,
                ExpiryDate,
                Nutritional_information,
                CountryOfOrigin,
                Ingredients,
                Allergens,
                PesticideUse,
                FertilizerUse,
                CustomObject: customObj,
              });
            }
            uploadProducts(products);
          },
          header: false,
          skipEmptyLines: true,
        });
      } else if (ext === 'json') {
        try {
          const data = JSON.parse(raw);
          const arr = Array.isArray(data) ? data : [data];
          // Merge all CustomObject* fields
          const mergeCustomObjects = (item) => {
            let customObj = {};
            Object.keys(item).forEach((key) => {
              if (key.toLowerCase().startsWith('customobject')) {
                try {
                  Object.assign(customObj, typeof item[key] === 'string' ? JSON.parse(item[key]) : item[key]);
                } catch {
                  customObj[key] = item[key];
                }
              }
            });
            return customObj;
          };
          products = arr.map((item) => ({
            ...normalizeProduct(item),
            CustomObject: mergeCustomObjects(item),
          }));
          uploadProducts(products);
        } catch (err) {
          setMessageProduct('Invalid JSON file.');
        }
      } else if (ext === 'xml') {
        try {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(raw, 'text/xml');
          const items = Array.from(xmlDoc.getElementsByTagName('Product'));
          products = items.map((item) => {
            const get = (tag) => item.getElementsByTagName(tag)[0]?.textContent || '';
            // Merge all <CustomObject> tags
            let customObj = {};
            const customTags = Array.from(item.getElementsByTagName('CustomObject'));
            customTags.forEach((el, idx) => {
              try {
                Object.assign(customObj, JSON.parse(el.textContent));
              } catch {
                customObj[`custom${idx + 1}`] = el.textContent;
              }
            });
            return normalizeProduct({
              ID: get('ID'),
              Name: get('Name'),
              HarvestDate: get('HarvestDate'),
              ExpiryDate: get('ExpiryDate'),
              Nutritional_information: get('Nutritional_information'),
              CountryOfOrigin: get('CountryOfOrigin'),
              Ingredients: get('Ingredients'),
              Allergens: get('Allergens'),
              PesticideUse: get('PesticideUse'),
              FertilizerUse: get('FertilizerUse'),
              CustomObject: customObj,
            });
          });
          uploadProducts(products);
        } catch (err) {
          setMessageProduct('Invalid XML file.');
        }
      } else {
        setMessageProduct('Unsupported file type.');
      }
    };
    reader.readAsText(file);
  };
  // ----------------- CSV Product -----------------
  /*const handleCsvChange = (e) => {
      setCsvFile(e.target.files[0]);
    };

    const handleCsvUpload = async () => {
      if (!csvFile) {
        setMessageProduct("Please upload a CSV file first.");
        return;
      }

      Papa.parse(csvFile, {
        complete: async (result) => {
          for (let row of result.data) {
            // Costruisci l'oggetto Product per ogni riga
            const postData = {
              ID: row[0],
              Name: row[1],
              Manufacturer: manufacturer,
              SowingDate: row[2],
              HarvestDate: row[3],
              Nutritional_information: row[4],
              CountryOfOrigin: row[5],
              Ingredients: row[6],
              Allergens: row[7],
              PesticideUse: row[8],
              FertilizerUse: row[9],
              Certifications: [],
              SensorData: [],
              CustomObject: JSON.parse(row[10] || "{}"), // Assicurati che sia JSON valido
            };

            try {
              const token = localStorage.getItem("token");
              await axios.post("api/uploadProduct", postData, {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });
              console.log(`Product ${postData.ID} uploaded successfully!`);
            } catch (error) {
              console.error(`Error uploading product ${postData.ID}`, error);
              setMessageProduct(`Error uploading product ${postData.ID}`);
            }
          }
          setMessageProduct("CSV Product upload completed successfully!");
          setCsvFile(null);
          setViewProduct(false);
        },
        header: false, // Il CSV non contiene intestazioni
      });
    };*/

  // ----------------- CSV Batch -----------------
  const handleCsvBatchChange = (e) => {
    setCsvBatchFile(e.target.files[0]);
  };

  const handleCsvUploadBatch = async () => {
    if (!csvBatchFile) {
      setMessageBatch('Please upload a CSV file first.');
      return;
    }

    Papa.parse(csvBatchFile, {
      complete: async (result) => {
        for (let row of result.data) {
          // Formatta ID batch con la lettera L
          let batchIdFormatted = row[0].startsWith('L') ? row[0] : 'L' + row[0];

          // Costruisci l'oggetto Batch per ogni riga
          const postBatchData = {
            ID: batchIdFormatted,
            ProductId: row[1],
            Operator: operator,
            BatchNumber: row[2],
            Quantity: row[3],
            ProductionDate: row[4],
            State: row[5],
            CustomObject: JSON.parse(row[6] || '{}'), // Assicurati che sia JSON valido
          };

          try {
            const token = localStorage.getItem('token');
            await axios.post('api/uploadBatch', postBatchData, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            console.log(`Batch ${postBatchData.ID} uploaded successfully!`);
          } catch (error) {
            console.error(`Error uploading batch ${postBatchData.ID}`, error);
            setMessageBatch(`Error uploading batch ${postBatchData.ID}`);
          }
        }
        setMessageBatch('CSV Batch upload completed successfully!');
        setCsvBatchFile(null);
        setViewBatch(false);
      },
      header: false, // Il CSV non contiene intestazioni
    });
  };

  // Nuovo stato per la cronologia dei prodotti scansionati
  const [recentlyScanned, setRecentlyScanned] = useState(() => {
    // Load recently scanned products from localStorage
    const savedScanned = localStorage.getItem('recentlyScannedProducts');
    return savedScanned ? JSON.parse(savedScanned) : [];
  });

  // Funzione per aggiungere un prodotto alla cronologia dei prodotti scansionati
  /* const addToRecentlyScanned = async (productData) => {
       try {
         // Get user ID from localStorage (set during login)
         const userId = localStorage.getItem('email') || 'default';

         // Crea un oggetto con solo le informazioni essenziali
         const scannedProduct = {
           ID: productData.ID,
           Name: productData.Name || "Batch",
           Manufacturer: productData.Manufacturer,
           CreationDate: productData.CreationDate,
           timestamp: new Date().toISOString() // Aggiungi timestamp per ordinare per data di scansione
         };

         // Send to backend
         await axios.post('api/addRecentlySearched', {
           product: scannedProduct,
           userId: userId
         }, {
           headers: {
             "Content-Type": "application/json",
             "Authorization": `Bearer ${localStorage.getItem('token')}`
           }
         });

         // Update local state
         // Rimuovi il prodotto se già presente nella lista
         const filteredHistory = recentlyScanned.filter(p => p.ID !== scannedProduct.ID);
         // Aggiungi il prodotto all'inizio della lista
         const updatedHistory = [scannedProduct, ...filteredHistory].slice(0, 5); // Mantieni solo gli ultimi 5 prodotti
         setRecentlyScanned(updatedHistory);
       } catch (error) {
         console.error("Error updating recently searched products:", error);
       }
     };*/

  // Add useEffect to fetch recently searched products
  useEffect(() => {
    const fetchRecentlySearched = async () => {
      try {
        // Get user ID from localStorage (set during login)
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

    fetchRecentlySearched();
  }, []);

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          {role === 'producer' && (
            <div className="card shadow">
              <div className="card-body">
                <Card.Header>
                  <h4>Upload Product 🌱</h4>
                  <p style={{ color: 'grey' }}>
                    ℹ️ Add your product and complete its details to enhance traceability and transparency
                    <br />
                    🖼️ Insert and visualize your product with a 3D model
                  </p>
                </Card.Header>
                <br />
                {messageProduct && !viewProduct && (
                  <div>
                    {lastAddedProduct && (
                      <div>
                        <QRCodeCanvas
                          value={`${window.location.origin}/scan-product/${lastAddedProduct}`}
                          style={{ marginBottom: '2vw' }}
                        />
                        <p>
                          Product ID: <b>{lastAddedProduct}</b>
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {!viewProduct && (
                  <button
                    style={{ backgroundColor: '#1e90ff', border: '1px solid #1e90ff' }}
                    className="btn btn-primary mt-3 w-100"
                    onClick={() => {
                      setViewProduct(true);
                      setViewBatch(false);
                      setMessageProduct('');
                    }}
                  >
                    + New Product
                  </button>
                )}
                {!viewProduct && (
                  <>
                    {messageProduct && <p style={{ color: 'red', marginTop: '1vw' }}>{messageProduct}</p>}
                    <button
                      style={{
                        backgroundColor: '#6c757d',
                        border: '1px solid #6c757d',
                        color: 'white',
                        marginTop: '10px',
                        width: '100%',
                      }}
                      className="btn mt-2"
                      onClick={() => document.getElementById('multiFileInput').click()}
                    >
                      📁 or upload CSV/JSON/XML
                    </button>
                    <input
                      id="multiFileInput"
                      type="file"
                      accept=".csv,.json,.xml"
                      style={{ display: 'none' }}
                      onChange={handleMultiFileUpload}
                    />
                  </>
                )}
                {viewProduct && (
                  <Card.Body>
                    {/* CSV File Upload */}
                    {/*
                    <Form.Group
                      className="d-flex align-items-center mb-3"
                      style={{ marginTop: "1vw" }}
                    >
                      <Form.Label
                        style={{ width: inputWidth }}
                        className="me-3"
                      >
                        Upload CSV
                      </Form.Label>
                      <Form
                        style={{
                          display: "flex",
                          width: "100%",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "2vw",
                          border: "1px dashed silver",
                          borderRadius: "1vw",
                          padding: "1vw",
                        }}
                      >
                        {csvFile ? (
                          <ion-icon
                            name="trash-outline"
                            style={{ cursor: "pointer", color: "grey" }}
                            onClick={() => {
                              document.getElementById("csvFile").value = "";
                              setCsvFile("");
                            }}
                          />
                        ) : (
                          <ion-icon
                            name="folder-outline"
                            style={{ color: "grey" }}
                          ></ion-icon>
                        )}
                        <label
                          htmlFor="csvFile"
                          style={{
                            color: "grey",
                            textDecoration: "underline",
                            cursor: "pointer",
                          }}
                        >
                          {csvFile
                            ? JSON.stringify(csvFile.name)
                            : "upload data Batch from CSV file"}
                        </label>
                        <input
                          style={{ display: "none" }}
                          id="csvFile"
                          type="file"
                          accept=".csv"
                          onChange={handleCsvChange}
                        />
                        {csvFile && (
                          <Button
                            variant="primary"
                            style={{ borderRadius: "2vw", paddingBlock: "0" }}
                            onClick={handleCsvUpload}
                            disabled={!csvFile}
                          >
                            Submit
                          </Button>
                        )}
                      </Form>
                    </Form.Group>
                    {csvFile && <p>{messageProduct}</p>}

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        margin: "20px 0",
                      }}
                    >
                      <hr
                        style={{
                          flex: 1,
                          border: "none",
                          borderTop: "1px solid #666",
                        }}
                      />
                      <span
                        style={{
                          margin: "0 10px",
                          color: "#666",
                          fontWeight: "bold",
                        }}
                      >
                        or
                      </span>
                      <hr
                        style={{
                          flex: 1,
                          border: "none",
                          borderTop: "1px solid #666",
                        }}
                      />
                    </div>
                    */}
                    <Form onSubmit={handleUploadProduct}>
                      {/* Display basic fields */}
                      <Form.Group
                        controlId="id"
                        className="d-flex align-items-center mb-3"
                      >
                        <Form.Label
                          style={{ width: inputWidth }}
                          className="me-3"
                        >
                          ID
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={id}
                          onChange={(e) => setId(e.target.value)}
                          placeholder={placeholderText}
                          required
                        />
                      </Form.Group>
                      {/* Name Field */}
                      <Form.Group
                        controlId="name"
                        className="d-flex align-items-center mb-3"
                      >
                        <Form.Label
                          style={{ width: inputWidth }}
                          className="me-3"
                        >
                          Name
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder={placeholderText}
                          required
                        />
                      </Form.Group>
                      {/*Sowing Date Field*/}
                      <Form.Group
                        controlId="sowingDate"
                        className="d-flex align-items-center mb-3"
                      >
                        <Form.Label
                          style={{ width: inputWidth }}
                          className="me-3"
                        >
                          <span
                            title="Production Start Date refers to the sowing date or, more generally, the date when the production for that year’s product begins"
                            style={{ marginLeft: '6px', cursor: 'help' }}
                            onClick={() => setShowInfo((prev) => !prev)}
                          >
                            ℹ️
                          </span>
                          Production Start Date
                          {showInfo && (
                            <div style={{ marginLeft: '10px', fontSize: '0.9em', color: 'grey' }}>
                              Production Start Date refers to the sowing date or, more generally, the date when the
                              production for that year’s product begins
                            </div>
                          )}
                        </Form.Label>
                        <Form.Control
                          type="date"
                          value={sowingDate}
                          onChange={(e) => setSowingDate(e.target.value)}
                        />
                      </Form.Group>
                      {/* Harvest Date Field*/}
                      <Form.Group
                        controlId="harvestDate"
                        className="d-flex align-items-center mb-3"
                      >
                        <Form.Label
                          style={{ width: inputWidth }}
                          className="me-3"
                        >
                          Harvest Date
                        </Form.Label>
                        <Form.Control
                          type="date"
                          value={harvestDate}
                          onChange={(e) => setHarvestDate(e.target.value)}
                          required
                        />
                      </Form.Group>

                      <Form.Group
                        controlId="nutritionalInformation"
                        className="d-flex align-items-center mb-3"
                      >
                        <Form.Label
                          style={{ width: inputWidth }}
                          className="me-3"
                        >
                          Nutritional Information
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={nutritionalInformation}
                          onChange={(e) => setNutritionalInformation(e.target.value)}
                          placeholder={placeholderText}
                        />
                      </Form.Group>

                      <Form.Group
                        controlId="countryOfOrigin"
                        className="d-flex align-items-center mb-3"
                      >
                        <Form.Label
                          style={{ width: inputWidth }}
                          className="me-3"
                        >
                          Country of Origin
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={countryOfOrigin}
                          onChange={(e) => setCountryOfOrigin(e.target.value)}
                          placeholder={placeholderText}
                        />
                      </Form.Group>
                      <Form.Group
                        controlId="pesticideUse"
                        className="d-flex align-items-center mb-3"
                      >
                        <Form.Label
                          style={{ width: inputWidth }}
                          className="me-3"
                        >
                          Pesticide Use
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={pesticideUse}
                          onChange={(e) => setPesticideUse(e.target.value)}
                          placeholder={placeholderText}
                        />
                      </Form.Group>
                      <Form.Group
                        controlId="fertilizerUse"
                        className="d-flex align-items-center mb-3"
                      >
                        <Form.Label
                          style={{ width: inputWidth }}
                          className="me-3"
                        >
                          Fertilizer Use
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={fertilizerUse}
                          onChange={(e) => setFertilizerUse(e.target.value)}
                          placeholder={placeholderText}
                        />
                      </Form.Group>
                      <Form.Group
                        controlId="ingredients"
                        className="d-flex align-items-center mb-3"
                      >
                        <Form.Label
                          style={{ width: inputWidth }}
                          className="me-3"
                        >
                          Ingredients
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={ingredients}
                          onChange={(e) => setIngredients(e.target.value)}
                          placeholder={placeholderText}
                        />
                      </Form.Group>
                      <Form.Group
                        controlId="allergens"
                        className="d-flex align-items-center mb-3"
                      >
                        <Form.Label
                          style={{ width: inputWidth }}
                          className="me-3"
                        >
                          Allergens
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={allergens}
                          onChange={(e) => setAllergens(e.target.value)}
                          placeholder={placeholderText}
                        />
                      </Form.Group>
                      {/* Upload 3D Model */}
                      <div className="mb-3">
                        <Viewer3D onGlbUpload={setGlbFile} />
                      </div>
                      {/* Separator */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          margin: '20px 0',
                        }}
                      >
                        <hr
                          style={{
                            flex: 1,
                            border: 'none',
                            borderTop: '1px solid #666',
                          }}
                        />
                        <span
                          style={{
                            margin: '0 10px',
                            color: '#666',
                            fontWeight: 'bold',
                          }}
                        ></span>
                        <hr
                          style={{
                            flex: 1,
                            border: 'none',
                            borderTop: '1px solid #666',
                          }}
                        />
                      </div>
                      <h5>Custom Fields</h5>
                      {customFields.map((field, index) => (
                        <div
                          key={index}
                          className="d-flex mb-2 align-items-center"
                        >
                          <Form.Control
                            type="text"
                            placeholder="Field Name"
                            value={field.key}
                            onChange={(e) => updateCustomField(index, e.target.value, field.value)}
                            className="me-2"
                          />
                          <Form.Control
                            type="text"
                            placeholder="Value"
                            value={field.value}
                            onChange={(e) => updateCustomField(index, field.key, e.target.value)}
                          />
                          {/* Pulsante di rimozione con icona*/}
                          <button
                            type="button"
                            className="btn btn-light btn-sm ms-2 p-1"
                            onClick={() => removeCustomField(index)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              fontSize: '18px',
                              cursor: 'pointer',
                              color: '#ff4d4d',
                            }}
                          >
                            ✖️
                          </button>
                        </div>
                      ))}

                      <Button
                        variant="primary"
                        onClick={addCustomField}
                        className="my-3 d-block mx-auto"
                      >
                        + Add Field
                      </Button>
                      {/* Separator */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          margin: '20px 0',
                        }}
                      >
                        <hr
                          style={{
                            flex: 1,
                            border: 'none',
                            borderTop: '1px solid #666',
                          }}
                        />
                        <span
                          style={{
                            margin: '0 10px',
                            color: '#666',
                            fontWeight: 'bold',
                          }}
                        ></span>
                        <hr
                          style={{
                            flex: 1,
                            border: 'none',
                            borderTop: '1px solid #666',
                          }}
                        />
                      </div>
                      {/* ----------------------------- SENSOR DATA ----------------------------- */}
                      <div className="text-center mt-4">
                        <h5>Sensors 🌡️</h5>
                        <p style={{ color: 'grey' }}>
                          ℹ️ Sensor data are processed and extracted from the Databoom server. To retrieve it, you need
                          to enter the sowing date and harvest date
                          <br />
                        </p>
                        <Button
                          variant="outline-success"
                          onClick={() => setShowAddSensor(!showAddSensor)}
                          className="mb-3"
                          disabled={!harvestDate || !sowingDate}
                        >
                          {showAddSensor ? 'Cancel' : '+ Add Sensor Data'}
                        </Button>
                        {showAddSensor && (
                          <AddSensorData
                            productId={id}
                            sowingDate={sowingDate}
                            harvestDate={harvestDate}
                            onAddSensorData={(data) => setSensorData(data)}
                          />
                        )}
                      </div>

                      {/* --------------------------- CERTIFICATIONS --------------------------- */}
                      <div className="text-center mt-4">
                        <h5>Certifications ✅</h5>
                        <p style={{ color: 'grey' }}>
                          ℹ️ In order to insert certifications, the product must already have been uploaded
                          <br />
                        </p>
                        <Button
                          variant="outline-primary"
                          onClick={() => setShowAddCertification(!showAddCertification)}
                          className="mb-3"
                        >
                          {showAddCertification ? 'Cancel' : '+ Add Certification'}
                        </Button>
                        {showAddCertification && (
                          <AddCertification
                            productId={id}
                            onAddCertification={(data) => console.log('Certification added:', data)}
                          />
                        )}
                      </div>
                      {/* Separator */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          margin: '20px 0',
                        }}
                      >
                        <hr
                          style={{
                            flex: 1,
                            border: 'none',
                            borderTop: '1px solid #666',
                          }}
                        />
                        <span
                          style={{
                            margin: '0 10px',
                            color: '#666',
                            fontWeight: 'bold',
                          }}
                        ></span>
                        <hr
                          style={{
                            flex: 1,
                            border: 'none',
                            borderTop: '1px solid #666',
                          }}
                        />
                      </div>
                      <Button
                        variant="primary"
                        type="submit"
                        disabled={
                          !id ||
                          !name ||
                          !harvestDate ||
                          !sowingDate ||
                          !ingredients ||
                          !nutritionalInformation ||
                          !allergens ||
                          !pesticideUse ||
                          !countryOfOrigin ||
                          !fertilizerUse
                        }
                      >
                        Upload Product
                      </Button>
                      {messageProduct && <p style={{ marginTop: '1vw', color: 'red' }}>{messageProduct}</p>}
                    </Form>
                  </Card.Body>
                )}
              </div>
            </div>
          )}
          <br />
          {(role === 'producer' || role === 'operator') && (
            <div className="card shadow">
              <div className="card-body">
                <Card.Header>
                  <h4>Upload Batch 📦</h4>
                  <p style={{ color: 'grey' }}>
                    ℹ️ Add your batch and complete its details to enhance traceability and transparency
                    <br />
                  </p>
                </Card.Header>
                <br />
                {messageBatch && !viewBatch && (
                  <div>
                    {lastAddedBatch && (
                      <div>
                        <QRCodeCanvas
                          value={`${window.location.origin}/scan-product/${lastAddedBatch}`}
                          style={{ marginBottom: '2vw' }}
                        />
                        <p>
                          Batch ID: <b>{lastAddedBatch}</b>
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {!viewBatch && (
                  <button
                    className="btn btn-primary mt-3 w-100"
                    onClick={() => {
                      setViewBatch(true);
                      setViewProduct(false);
                      setMessageBatch('');
                    }}
                  >
                    + New Batch
                  </button>
                )}
                {viewBatch && (
                  <Card.Body>
                    {/* CSV File Upload */}
                    <Form.Group
                      className="d-flex align-items-center mb-3"
                      style={{ marginTop: '1vw' }}
                    >
                      <Form.Label
                        style={{ width: inputWidth }}
                        className="me-3"
                      >
                        Upload CSV Batch
                      </Form.Label>
                      <Form
                        style={{
                          display: 'flex',
                          width: '100%',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '2vw',
                          border: '1px dashed silver',
                          borderRadius: '1vw',
                          padding: '1vw',
                        }}
                      >
                        {csvBatchFile ? (
                          <ion-icon
                            name="trash-outline"
                            style={{ cursor: 'pointer', color: 'grey' }}
                            onClick={() => {
                              document.getElementById('csvBatchFile').value = '';
                              setCsvBatchFile('');
                            }}
                          />
                        ) : (
                          <ion-icon
                            name="folder-outline"
                            style={{ color: 'grey' }}
                          ></ion-icon>
                        )}
                        <label
                          htmlFor="csvBatchFile"
                          style={{
                            color: 'grey',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                          }}
                        >
                          {csvBatchFile ? JSON.stringify(csvBatchFile.name) : 'upload data Batch from CSV file'}
                        </label>
                        <input
                          style={{ display: 'none' }}
                          id="csvBatchFile"
                          type="file"
                          accept=".csv"
                          onChange={handleCsvBatchChange}
                        />
                        {csvBatchFile && (
                          <Button
                            variant="primary"
                            style={{ borderRadius: '2vw', paddingBlock: '0' }}
                            onClick={handleCsvUploadBatch}
                            disabled={!csvBatchFile}
                          >
                            Submit
                          </Button>
                        )}
                      </Form>
                    </Form.Group>
                    {csvBatchFile && <p>{messageBatch}</p>}
                    {/* Separator */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        margin: '20px 0',
                      }}
                    >
                      <hr
                        style={{
                          flex: 1,
                          border: 'none',
                          borderTop: '1px solid #666',
                        }}
                      />
                      <span
                        style={{
                          margin: '0 10px',
                          color: '#666',
                          fontWeight: 'bold',
                        }}
                      >
                        or
                      </span>
                      <hr
                        style={{
                          flex: 1,
                          border: 'none',
                          borderTop: '1px solid #666',
                        }}
                      />
                    </div>

                    <Form onSubmit={handleUploadBatch}>
                      {/* Display basic fields */}
                      <Form.Group
                        controlId="id"
                        className="d-flex align-items-center mb-3"
                      >
                        <Form.Label
                          style={{ width: inputWidth }}
                          className="me-3"
                        >
                          ID
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={idBatch}
                          onChange={(e) => setIdBatch(e.target.value)}
                          placeholder={'LXXX'}
                          required
                        />
                      </Form.Group>
                      {/* Product Id */}
                      <Form.Group
                        controlId="productId"
                        className="d-flex align-items-center mb-3"
                      >
                        <Form.Label
                          style={{ width: inputWidth }}
                          className="me-3"
                        >
                          Product Id
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={productId}
                          onChange={(e) => setProductId(e.target.value)}
                          placeholder={placeholderText}
                          required
                        />
                      </Form.Group>
                      {/*Batch Number*/}
                      <Form.Group
                        controlId="batchNumber"
                        className="d-flex align-items-center mb-3"
                      >
                        <Form.Label
                          style={{ width: inputWidth }}
                          className="me-3"
                        >
                          Batch Number
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={batchNumber}
                          onChange={(e) => setBatchNumber(e.target.value)}
                        />
                      </Form.Group>
                      {/* Quantity*/}
                      <Form.Group
                        controlId="quantity"
                        className="d-flex align-items-center mb-3"
                      >
                        <Form.Label
                          style={{ width: inputWidth }}
                          className="me-3"
                        >
                          Quantity
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          required
                        />
                      </Form.Group>

                      <Form.Group
                        controlId="productionDate"
                        className="d-flex align-items-center mb-3"
                      >
                        <Form.Label
                          style={{ width: inputWidth }}
                          className="me-3"
                        >
                          Production Date
                        </Form.Label>
                        <Form.Control
                          type="date"
                          value={productionDate}
                          onChange={(e) => setProductionDate(e.target.value)}
                          placeholder={placeholderText}
                        />
                      </Form.Group>
                      <Form.Group
                        controlId="state"
                        className="d-flex align-items-center mb-3"
                      >
                        <Form.Label
                          style={{ width: inputWidth }}
                          className="me-3"
                        >
                          Status
                        </Form.Label>
                        <Form.Select
                          value={state}
                          onChange={(e) => setState(e.target.value)}
                          required
                        >
                          <option
                            value=""
                            disabled
                          >
                            -- Select Status --
                          </option>
                          <option value="Shipped">Shipped</option>
                          <option value="Delivered">Delivered</option>
                          <option value="Retired">Retired</option>
                          <option value="Reported">Reported</option>
                        </Form.Select>
                      </Form.Group>
                      {/* Separator */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          margin: '20px 0',
                        }}
                      >
                        <hr
                          style={{
                            flex: 1,
                            border: 'none',
                            borderTop: '1px solid #666',
                          }}
                        />
                        <span
                          style={{
                            margin: '0 10px',
                            color: '#666',
                            fontWeight: 'bold',
                          }}
                        ></span>
                        <hr
                          style={{
                            flex: 1,
                            border: 'none',
                            borderTop: '1px solid #666',
                          }}
                        />
                      </div>
                      <h5>Custom Batch Fields</h5>
                      <p style={{ color: 'gray' }}>edit existing custom fields or add new ones</p>
                      {customBatchFields.map((field, index) => (
                        <div
                          key={index}
                          className="d-flex mb-2 align-items-center"
                        >
                          <Form.Control
                            type="text"
                            placeholder="Batch Field Name"
                            value={field.key}
                            onChange={(e) => updateCustomBatchField(index, e.target.value, field.value)}
                            className="me-2"
                          />
                          <Form.Control
                            type="text"
                            placeholder="Value"
                            value={field.value}
                            onChange={(e) => updateCustomBatchField(index, field.key, e.target.value)}
                          />
                          {/* Pulsante di rimozione con icona*/}
                          <button
                            type="button"
                            className="btn btn-light btn-sm ms-2 p-1"
                            onClick={() => removeCustomBatchField(index)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              fontSize: '18px',
                              cursor: 'pointer',
                              color: '#ff4d4d',
                            }}
                          >
                            ✖️
                          </button>
                        </div>
                      ))}

                      <Button
                        variant="primary"
                        onClick={addCustomBatchField}
                        className="my-3 d-block mx-auto"
                      >
                        + Add Batch Field
                      </Button>

                      {/* Separator */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          margin: '20px 0',
                        }}
                      >
                        <hr
                          style={{
                            flex: 1,
                            border: 'none',
                            borderTop: '1px solid #666',
                          }}
                        />
                        <span
                          style={{
                            margin: '0 10px',
                            color: '#666',
                            fontWeight: 'bold',
                          }}
                        ></span>
                        <hr
                          style={{
                            flex: 1,
                            border: 'none',
                            borderTop: '1px solid #666',
                          }}
                        />
                      </div>
                      <Button
                        variant="primary"
                        type="submit"
                        disabled={!idBatch || !productId || !batchNumber || !quantity || !productionDate}
                      >
                        Upload Batch
                      </Button>
                      {messageBatch && <p style={{ marginTop: '1vw', color: 'red' }}>{messageBatch}</p>}
                    </Form>
                  </Card.Body>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <br />
      {/* Recently Scanned Products Section */}
      {recentlyScanned.length > 0 && (
        <div className="row mt-4 mb-4">
          <div className="col-12">
            <p style={{ fontWeight: 'bold' }}>Recent uploads/scans 🕒</p>
            <Row
              xs={1}
              md={2}
              lg={3}
              className="g-4"
            >
              {recentlyScanned.map((scannedProduct) => (
                <Col key={scannedProduct.ID}>
                  <Card className="h-100 shadow-sm">
                    <Card.Body>
                      <Card.Title>{scannedProduct.Name}</Card.Title>
                      <Card.Text>
                        <small className="text-muted">ID: {scannedProduct.ID}</small>
                        <br />
                        <small className="text-muted">Manufacturer: {scannedProduct.Manufacturer}</small>
                        <br />
                        <small className="text-muted">Created: {scannedProduct.CreationDate}</small>
                      </Card.Text>
                      <div className="d-flex justify-content-between align-items-center">
                        <small className="text-muted">{new Date(scannedProduct.timestamp).toLocaleDateString()}</small>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        </div>
      )}

      <br />
      <br />
    </div>
  );
};

export default AddProductOld;
