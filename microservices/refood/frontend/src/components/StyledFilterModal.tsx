import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Modal, Portal, Text, Button, Divider, Surface, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PRIMARY_COLOR, STATUS_COLORS } from '../config/constants';

interface StyledFilterModalProps {
  visible: boolean;
  onDismiss: () => void;
  onApply: () => void;
  onReset: () => void;
  title?: string;
  // Proprietà opzionali per il filtro sullo stato
  selectedStato?: string | null;
  setSelectedStato?: (stato: string | null) => void;
  // Permette di passare contenuto personalizzato
  children?: React.ReactNode;
}

const StyledFilterModal: React.FC<StyledFilterModalProps> = ({
  visible,
  onDismiss,
  onApply,
  onReset,
  title = "Filtri avanzati",
  selectedStato,
  setSelectedStato,
  children
}) => {
  // Verifica se utilizzare l’approccio preesistente o quello basato su children
  const useCustomContent = Boolean(children);
  
  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContainer}
      >
        <Surface style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <MaterialCommunityIcons name="magnify" size={24} color={PRIMARY_COLOR} />
          </View>
          <Divider />
          
          <ScrollView style={styles.modalBody}>
            {useCustomContent ? (
              // Utilizzo il contenuto personalizzato passato come children
              children
            ) : (
              // Utilizzo il comportamento predefinito del componente
              <>
                {setSelectedStato && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Stato del lotto</Text>
                    <Text style={styles.sectionDescription}>
                      Lo stato viene calcolato automaticamente in base alla data di scadenza:
                    </Text>
                    <View style={styles.stateFilters}>
                      <Chip
                        selected={selectedStato === 'Verde'}
                        onPress={() => setSelectedStato(selectedStato === 'Verde' ? null : 'Verde')}
                        style={[
                          styles.stateChip, 
                          {
                            backgroundColor: selectedStato === 'Verde' ? STATUS_COLORS.SUCCESS : STATUS_COLORS.SUCCESS + '20',
                            borderColor: STATUS_COLORS.SUCCESS
                          }
                        ]}
                        selectedColor="#fff"
                        textStyle={{
                          color: selectedStato === 'Verde' ? '#fff' : STATUS_COLORS.SUCCESS, 
                          fontWeight: 'bold',
                          fontSize: 14
                        }}
                        mode="flat"
                        showSelectedCheck
                      >
                        Verde
                      </Chip>
                      <Chip
                        selected={selectedStato === 'Arancione'}
                        onPress={() => setSelectedStato(selectedStato === 'Arancione' ? null : 'Arancione')}
                        style={[
                          styles.stateChip, 
                          {
                            backgroundColor: selectedStato === 'Arancione' ? STATUS_COLORS.WARNING : STATUS_COLORS.WARNING + '20',
                            borderColor: STATUS_COLORS.WARNING
                          }
                        ]}
                        selectedColor="#fff"
                        textStyle={{
                          color: selectedStato === 'Arancione' ? '#fff' : STATUS_COLORS.WARNING, 
                          fontWeight: 'bold',
                          fontSize: 14
                        }}
                        mode="flat"
                        showSelectedCheck
                      >
                        Arancione
                      </Chip>
                      <Chip
                        selected={selectedStato === 'Rosso'}
                        onPress={() => setSelectedStato(selectedStato === 'Rosso' ? null : 'Rosso')}
                        style={[
                          styles.stateChip, 
                          {
                            backgroundColor: selectedStato === 'Rosso' ? STATUS_COLORS.ERROR : STATUS_COLORS.ERROR + '20',
                            borderColor: STATUS_COLORS.ERROR
                          }
                        ]}
                        selectedColor="#fff"
                        textStyle={{
                          color: selectedStato === 'Rosso' ? '#fff' : STATUS_COLORS.ERROR, 
                          fontWeight: 'bold',
                          fontSize: 14
                        }}
                        mode="flat"
                        showSelectedCheck
                      >
                        Rosso
                      </Chip>
                    </View>
                    <View style={styles.stateDescriptions}>
                      <Text style={styles.stateDescription}>
                        <Text style={{fontWeight: 'bold', color: STATUS_COLORS.SUCCESS}}>Verde:</Text> Lontano dalla scadenza
                      </Text>
                      <Text style={styles.stateDescription}>
                        <Text style={{fontWeight: 'bold', color: STATUS_COLORS.WARNING}}>Arancione:</Text> Vicino alla scadenza
                      </Text>
                      <Text style={styles.stateDescription}>
                        <Text style={{fontWeight: 'bold', color: STATUS_COLORS.ERROR}}>Rosso:</Text> Molto vicino/scaduto
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>
          
          <Divider />
          <View style={styles.modalFooter}>
            <Button 
              mode="text" 
              onPress={onReset}
              style={styles.footerButton}
              icon="refresh"
            >
              Azzera
            </Button>
            <View style={styles.footerActions}>
              <Button 
                mode="outlined" 
                onPress={onDismiss}
                style={styles.footerButton}
              >
                Annulla
              </Button>
              <Button 
                mode="contained" 
                onPress={onApply}
                style={[styles.footerButton, styles.applyButton]}
                icon="check"
              >
                Applica
              </Button>
            </View>
          </View>
        </Surface>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: '80%',
  },
  modalHeader: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalBody: {
    maxHeight: 500,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#555',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  stateFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 12,
    justifyContent: 'space-around',
  },
  stateChip: {
    marginHorizontal: 4,
    marginVertical: 6,
    height: 40,
    paddingHorizontal: 8,
    minWidth: 90,
    justifyContent: 'center',
    borderWidth: 1,
  },
  stateDescriptions: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  stateDescription: {
    fontSize: 13,
    marginBottom: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  footerActions: {
    flexDirection: 'row',
  },
  footerButton: {
    marginLeft: 8,
  },
  applyButton: {
    backgroundColor: PRIMARY_COLOR,
  },
});

export default StyledFilterModal; 