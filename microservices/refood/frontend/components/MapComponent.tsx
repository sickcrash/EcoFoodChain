import React from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

interface Centro {
  id: number;
  nome: string;
  indirizzo: string;
  tipologia: string;
  categoria: string;
  lat: number;
  lng: number;
  colore: string;
  has_coordinates: boolean;
}

interface MapComponentProps {
  centri: Centro[];
  selectedCentro?: Centro | null;
  onCentroSelect?: (centro: Centro) => void;
  height?: number;
}

const MapComponent: React.FC<MapComponentProps> = ({
  centri,
  selectedCentro,
  onCentroSelect,
  height = 400
}) => {

  // Filtra centri con coordinate valide
  const validCentri = centri.filter(centro =>
    centro.has_coordinates &&
    centro.lat &&
    centro.lng &&
    centro.lat !== 0 &&
    centro.lng !== 0
  );

  const hasValidCentri = validCentri.length > 0;

  const mapUrl = selectedCentro && selectedCentro.has_coordinates
    ? `https://maps.google.com/maps?q=${selectedCentro.lat},${selectedCentro.lng}&z=15&output=embed`
    : hasValidCentri
      ? `https://maps.google.com/maps?q=${validCentri[0].lat},${validCentri[0].lng}&z=12&output=embed`
      : `https://maps.google.com/maps?q=41.1078556,16.8807137&z=12&output=embed`;

  const showEmptyMessage = !hasValidCentri;

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { height }]}> 
        <iframe
          src={mapUrl}
          width="100%"
          height={height}
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Mappa ReFood"
        />
        {showEmptyMessage && (
          <View style={styles.noDataOverlay}> 
            <Text style={styles.noDataText}>Non ci sono centri con coordinate GPS da mostrare.</Text>
            <Text style={styles.noDataSubText}>Aggiungi le coordinate dall'area amministrativa per completare la mappa.</Text>
          </View>
        )}
      </View>
    );
  }

  const html = `
    <!DOCTYPE html>
    <html lang="it">
      <head>
        <meta name="viewport" content="initial-scale=1, width=device-width" />
        <style>
          html, body { margin: 0; padding: 0; height: 100%; background: #f5f5f5; }
          .map-wrapper { position: relative; width: 100%; height: 100%; }
          iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; }
        </style>
      </head>
      <body>
        <div class="map-wrapper">
          <iframe
            src="${mapUrl}"
            allowfullscreen
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
            title="Mappa Centri"
          ></iframe>
        </div>
      </body>
    </html>
  `;

  return (
    <View style={[styles.container, { height }]}> 
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.map}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        scalesPageToFit
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView error:', nativeEvent);
        }}
      />
      {showEmptyMessage && (
        <View style={styles.noDataOverlay}> 
          <Text style={styles.noDataText}>Non ci sono centri con coordinate GPS da mostrare.</Text>
          <Text style={styles.noDataSubText}>Aggiungi le coordinate dall'area amministrativa per completare la mappa.</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  map: {
    flex: 1,
  },
  noDataOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(18, 18, 18, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noDataText: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 10,
  },
  noDataSubText: {
    fontSize: 14,
    color: '#e0e0e0',
    textAlign: 'center',
  },
});

export default MapComponent;
