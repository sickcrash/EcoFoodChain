import { View, TextInput } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useState } from 'react';

export default function ModificaProfilo() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');

  const handleSalva = () => {
    console.log('Dati salvati:', nome, email);
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}>Modifica Profilo</Text>

      <TextInput
        placeholder="Nome"
        value={nome}
        onChangeText={setNome}
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          borderRadius: 8,
          padding: 10,
          marginBottom: 12,
        }}
      />

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          borderRadius: 8,
          padding: 10,
          marginBottom: 24,
        }}
      />

      <Button mode="contained" onPress={handleSalva}>
        Salva modifiche
      </Button>
    </View>
  );
}

