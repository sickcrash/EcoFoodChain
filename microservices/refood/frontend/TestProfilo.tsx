import React, { useState } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { Button, Dialog, Portal, RadioButton, TextInput, Provider as PaperProvider } from 'react-native-paper';

export default function TestProfilo() {
  const [editDialogVisible, setEditDialogVisible] = useState(false);

  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [genere, setGenere] = useState('O');

  return (
    <PaperProvider>
      <ScrollView style={{ flex: 1, padding: 20 }}>
        <Button mode="contained" onPress={() => setEditDialogVisible(true)}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>Modifica Profilo</Text>
        </Button>

        <Portal>
          <Dialog visible={editDialogVisible} onDismiss={() => setEditDialogVisible(false)}>
            <Dialog.Title>Modifica Profilo</Dialog.Title>
            <Dialog.Content>
              <TextInput label="Nome" value={nome} onChangeText={setNome} style={{ marginBottom: 10 }} />
              <TextInput label="Cognome" value={cognome} onChangeText={setCognome} style={{ marginBottom: 10 }} />
              <Text style={{ marginBottom: 5 }}>Genere</Text>
              <RadioButton.Group onValueChange={setGenere} value={genere}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <RadioButton value="M" />
                  <Text>Maschile</Text>
                  <RadioButton value="F" />
                  <Text>Femminile</Text>
                  <RadioButton value="O" />
                  <Text>Altro</Text>
                </View>
              </RadioButton.Group>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setEditDialogVisible(false)}>
                <Text style={{ color: '#6200ee', fontWeight: '600' }}>Annulla</Text>
              </Button>
              <Button onPress={() => {
                // salva dati o chiudi dialog
                setEditDialogVisible(false);
              }}>
                <Text style={{ color: '#6200ee', fontWeight: '600' }}>Salva</Text>
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </ScrollView>
    </PaperProvider>
  );
}


