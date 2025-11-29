import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Modal, Portal, Text, Button, Divider, List, Surface } from 'react-native-paper';

interface SelectDialogProps {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  options: {
    label: string;
    value: string | number;
  }[];
  selectedValue?: string | number | null;
  onSelect: (value: string | number) => void;
}

const SelectDialog: React.FC<SelectDialogProps> = ({
  visible,
  onDismiss,
  title,
  options,
  selectedValue,
  onSelect,
}) => {
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
          </View>
          <Divider />
          <ScrollView style={styles.modalBody}>
            {options.map((option) => (
              <List.Item
                key={option.value.toString()}
                title={option.label}
                onPress={() => {
                  onSelect(option.value);
                  onDismiss();
                }}
                left={props =>
                  <List.Icon
                    {...props}
                    icon={option.value === selectedValue ? "check-circle" : "circle-outline"}
                  />
                }
                style={option.value === selectedValue ? styles.selectedItem : undefined}
              />
            ))}
          </ScrollView>
          <Divider />
          <View style={styles.modalFooter}>
            <Button
              mode="text"
              onPress={onDismiss}
            >
              Annulla
            </Button>
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
  selectedItem: {
    backgroundColor: '#e8f5e9',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 8,
  },
});

export default SelectDialog;
