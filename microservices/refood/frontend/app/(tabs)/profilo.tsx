import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import {
  Button,
  Card,
  Avatar,
  List,
  Divider,
  Switch,
  TextInput,
  Dialog,
  Portal,
  Paragraph,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { RUOLI, PRIMARY_COLOR, STORAGE_KEYS, API_URL } from '../../src/config/constants';
import { router, type Href } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeContext } from '../../src/context/ThemeContext';

export default function ProfiloScreen() {
  const { user, logout, forceAuthUpdate } = useAuth();
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const { width } = useWindowDimensions();
  const isCompactProfile = width < 430;
  const avatarSize = isCompactProfile ? 64 : 80;

  const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);
  const [modificaProfiloVisibile, setModificaProfiloVisibile] = useState(false);
  const [cambiaPasswordVisibile, setCambiaPasswordVisibile] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [nome, setNome] = useState(user?.nome || '');
  const [cognome, setCognome] = useState(user?.cognome || '');
  const [email, setEmail] = useState(user?.email || '');
  const [passwordAttuale, setPasswordAttuale] = useState('');
  const [nuovaPassword, setNuovaPassword] = useState('');
  const [confermaPassword, setConfermaPassword] = useState('');

  // Usa l'API_URL centralizzato (EXPO_PUBLIC_API_URL fallback localhost:3000)

  const forceLogout = async () => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.USER_TOKEN,
        STORAGE_KEYS.USER_DATA,
        STORAGE_KEYS.REFRESH_TOKEN,
      ]);
      if (logout) await logout();
      if (forceAuthUpdate) forceAuthUpdate();
    } catch (error) {
      console.error('forceLogout error', error);
    }
  };

  const handleLogout = () => setLogoutDialogVisible(true);

  // Elimina account (soft-delete)
  const eliminaAccount = async () => {
    try {
      if (deleteConfirmText.trim().toUpperCase() !== 'ELIMINA') {
        alert("Digita 'ELIMINA' per confermare");
        return;
      }
      const res = await fetch(`${API_URL}/attori/me`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({ confirm: true, motivo: 'Richiesta utente da app' }),
      });
      let data: any = null;
      try { data = await res.json(); } catch (parseError) {
        console.warn('Impossibile leggere la risposta JSON durante l\'eliminazione account:', parseError);
      }
      if (!res.ok) {
        alert((data && data.message) || 'Impossibile eliminare l\'account');
        return;
      }
      setDeleteDialogVisible(false);
      setDeleteConfirmText('');
      alert('Account eliminato. Verrai disconnesso.');
      await forceLogout();
    } catch (error) {
      console.error('Errore di rete durante l\'eliminazione account:', error);
      alert('Errore di rete durante l\'eliminazione');
    }
  };

  // Salva modifiche profilo
  const salvaProfilo = async () => {
    try {
      const body: any = { nome, cognome, email };
      console.log('DEBUG salvaProfilo: invio PUT', `${API_URL}/attori/profile`, body);
      console.log('DEBUG salvaProfilo: token usato', user?.token);
      const res = await fetch(`${API_URL}/attori/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify(body),
      });
      let data = null;
      try {
        data = await res.json();
      } catch (parseError) {
        console.log('DEBUG salvaProfilo: errore parsing json', parseError);
      }
      console.log('DEBUG salvaProfilo: response', res.status, data);
      if (res.ok) {
        alert('Profilo aggiornato');
        if (forceAuthUpdate) forceAuthUpdate();
        setModificaProfiloVisibile(false);
      } else {
        alert((data && data.message) || 'Errore durante l\'aggiornamento');
      }
    } catch (error) {
      console.log('DEBUG salvaProfilo: errore di rete', error);
      alert('Errore di rete');
    }
  };

  // Cambia password
  const cambiaPassword = async () => {
    if (nuovaPassword !== confermaPassword) {
      alert('Le password non coincidono');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/attori/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({ password: nuovaPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('Password aggiornata');
        setCambiaPasswordVisibile(false);
        setPasswordAttuale('');
        setNuovaPassword('');
        setConfermaPassword('');
      } else {
        alert(data.message || 'Errore durante il cambio password');
      }
    } catch (error) {
      console.error('Errore di rete durante il cambio password:', error);
      alert('Errore di rete');
    }
  };
  const isAdmin = user?.ruolo === RUOLI.AMMINISTRATORE;

  const backgroundColor = isDarkMode ? '#121212' : '#f5f5f5';
  const textColor = isDarkMode ? '#fff' : '#000';

  return (
    <ScrollView style={[styles.container, { backgroundColor }]}>
      <Card style={styles.profileCard}>
        <Card.Content style={styles.profileContent}>
          <View style={[styles.profileHeader, isCompactProfile && styles.profileHeaderCompact]}>
            <Avatar.Icon
              size={avatarSize}
              icon="account"
              style={[styles.profileAvatar, { backgroundColor: PRIMARY_COLOR }, isCompactProfile && styles.profileAvatarCompact]}
              color="#fff"
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
            <View style={[styles.profileInfo, isCompactProfile && styles.profileInfoCompact]}>
              <Text style={[styles.name, { color: textColor, fontSize: isCompactProfile ? 20 : 24 }]}>
                {user?.nome} {user?.cognome}
              </Text>
              <Text style={[styles.email, { color: isDarkMode ? '#ccc' : '#444', fontSize: isCompactProfile ? 14 : 16 }]}>
                {user?.email}
              </Text>
              <View style={[styles.roleContainer, isCompactProfile && styles.roleContainerCompact]}>
              {isAdmin ? (
                <View style={styles.userTypeContainer}>
                  <Text style={[styles.role, { color: PRIMARY_COLOR }]}>Amministratore</Text>
                  <View style={[styles.userTypeBadge, styles.badgeAmministratore]} />
                </View>
              ) : user?.ruolo === RUOLI.OPERATORE ? (
                <View style={styles.userTypeContainer}>
                  <Text style={[styles.role, { color: PRIMARY_COLOR }]}>Operatore</Text>
                  <View style={[styles.userTypeBadge, styles.badgeOperatore]} />
                </View>
              ) : user?.ruolo === 'OperatoreCentro' ? (
                <View style={styles.userTypeContainer}>
                  <Text style={[styles.role, { color: PRIMARY_COLOR }]}>
                    Centro associato
                  </Text>
                  <View style={[styles.userTypeBadge, styles.badgeOperatoreCentro]} />
                </View>
              ) : (
                <View style={styles.userTypeContainer}>
                  <Text style={[styles.role, { color: PRIMARY_COLOR }]}>
                    {user?.tipo_utente?.toUpperCase() === 'PRIVATO'
                      ? 'Utente privato'
                      : user?.tipo_utente?.toUpperCase() === 'CANALE SOCIALE'
                        ? 'Canale Sociale'
                        : user?.tipo_utente?.toUpperCase() === 'CENTRO RICICLO'
                          ? 'Centro riciclo'
                          : 'Utente'}
                  </Text>
                  <View
                    style={[
                      styles.userTypeBadge,
                      user?.tipo_utente?.toUpperCase() === 'PRIVATO'
                        ? styles.badgePrivato
                        : user?.tipo_utente?.toUpperCase() === 'CANALE SOCIALE'
                          ? styles.badgeSociale
                          : user?.tipo_utente?.toUpperCase() === 'CENTRO RICICLO'
                            ? styles.badgeRiciclo
                            : {},
                    ]}
                  />
                </View>
              )}
              </View>
            </View>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.sectionCard}>
        <Card.Title
          title="Impostazioni Account"
          titleStyle={{ color: textColor }}
          left={(props) => <MaterialCommunityIcons name="account-cog" size={24} color={PRIMARY_COLOR} />}
        />
        <Card.Content>
          <List.Item
            title="Notifiche"
            titleStyle={{ color: textColor }}
            left={(props) => (
              <List.Icon {...props} icon="bell" color={isDarkMode ? '#fff' : props.color} />
            )}
            onPress={() => router.push('/(tabs)/notifiche' as Href)}
          />
          <Divider style={{ marginVertical: 10 }} />
          <List.Item
            title="Modifica Profilo"
            titleStyle={{ color: textColor }}
            left={(props) => (
              <List.Icon {...props} icon="account-edit" color={isDarkMode ? '#fff' : props.color} />
            )}
            right={(props) => (
              <List.Icon
                {...props}
                icon={modificaProfiloVisibile ? 'chevron-up' : 'chevron-down'}
                color={isDarkMode ? '#fff' : props.color}
              />
            )}
            onPress={() => setModificaProfiloVisibile(!modificaProfiloVisibile)}
          />
          {modificaProfiloVisibile && (
            <View style={{ paddingLeft: 20, paddingVertical: 10 }}>
              <TextInput
                label="Nome"
                value={nome}
                onChangeText={setNome}
                style={[styles.textInput, { backgroundColor: isDarkMode ? '#181A20' : '#fff' }]}
                mode="outlined"
                underlineColor={PRIMARY_COLOR}
                selectionColor={PRIMARY_COLOR}
                theme={{
                  colors: {
                    text: isDarkMode ? '#fff' : '#000',
                    placeholder: isDarkMode ? '#b0b0b0' : undefined,
                    onSurfaceVariant: isDarkMode ? '#b0b0b0' : undefined,
                    primary: PRIMARY_COLOR,
                    background: isDarkMode ? '#181A20' : '#fff',
                    onSurface: isDarkMode ? '#fff' : '#000',
                  },
                }}
                placeholderTextColor={isDarkMode ? '#b0b0b0' : undefined}
                inputMode="text"
                autoCapitalize="sentences"
                placeholder="Nome"
              />
              <TextInput
                label="Cognome"
                value={cognome}
                onChangeText={setCognome}
                style={[styles.textInput, { backgroundColor: isDarkMode ? '#181A20' : '#fff' }]}
                mode="outlined"
                underlineColor={PRIMARY_COLOR}
                selectionColor={PRIMARY_COLOR}
                theme={{
                  colors: {
                    text: isDarkMode ? '#fff' : '#000',
                    placeholder: isDarkMode ? '#b0b0b0' : undefined,
                    onSurfaceVariant: isDarkMode ? '#b0b0b0' : undefined,
                    primary: PRIMARY_COLOR,
                    background: isDarkMode ? '#181A20' : '#fff',
                    onSurface: isDarkMode ? '#fff' : '#000',
                  },
                }}
                placeholderTextColor={isDarkMode ? '#b0b0b0' : undefined}
                inputMode="text"
                autoCapitalize="sentences"
                placeholder="Cognome"
              />
              <TextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                style={[styles.textInput, { backgroundColor: isDarkMode ? '#181A20' : '#fff' }]}
                mode="outlined"
                underlineColor={PRIMARY_COLOR}
                selectionColor={PRIMARY_COLOR}
                keyboardType="email-address"
                autoCapitalize="none"
                theme={{
                  colors: {
                    text: isDarkMode ? '#fff' : '#000',
                    placeholder: isDarkMode ? '#b0b0b0' : undefined,
                    onSurfaceVariant: isDarkMode ? '#b0b0b0' : undefined,
                    primary: PRIMARY_COLOR,
                    background: isDarkMode ? '#181A20' : '#fff',
                    onSurface: isDarkMode ? '#fff' : '#000',
                  },
                }}
                placeholderTextColor={isDarkMode ? '#b0b0b0' : undefined}
                inputMode="email"
                placeholder="Email"
              />
              <Button mode="contained" onPress={salvaProfilo} style={{ marginTop: 10 }}>
                Salva modifiche
              </Button>
            </View>
          )}

          <Divider style={{ marginVertical: 10 }} />

          <List.Item
            title="Cambia Password"
            titleStyle={{ color: textColor }}
            left={(props) => (
              <List.Icon {...props} icon="lock-reset" color={isDarkMode ? '#fff' : props.color} />
            )}
            right={(props) => (
              <List.Icon
                {...props}
                icon={cambiaPasswordVisibile ? 'chevron-up' : 'chevron-down'}
                color={isDarkMode ? '#fff' : props.color}
              />
            )}
            onPress={() => setCambiaPasswordVisibile(!cambiaPasswordVisibile)}
          />

          {cambiaPasswordVisibile && (
            <View style={{ paddingLeft: 20, paddingVertical: 10 }}>
              <TextInput
                label="Password attuale"
                secureTextEntry
                value={passwordAttuale}
                onChangeText={setPasswordAttuale}
                style={[styles.textInput, { backgroundColor: isDarkMode ? '#181A20' : '#fff' }]}
                mode="outlined"
                underlineColor={PRIMARY_COLOR}
                selectionColor={PRIMARY_COLOR}
                theme={{
                  colors: {
                    text: isDarkMode ? '#fff' : '#000',
                    placeholder: isDarkMode ? '#b0b0b0' : undefined,
                    onSurfaceVariant: isDarkMode ? '#b0b0b0' : undefined,
                    primary: PRIMARY_COLOR,
                    background: isDarkMode ? '#181A20' : '#fff',
                    onSurface: isDarkMode ? '#fff' : '#000',
                  },
                }}
                placeholderTextColor={isDarkMode ? '#b0b0b0' : undefined}
                inputMode="text"
                placeholder="Password attuale"
              />
              <TextInput
                label="Nuova password"
                secureTextEntry
                value={nuovaPassword}
                onChangeText={setNuovaPassword}
                style={[styles.textInput, { backgroundColor: isDarkMode ? '#181A20' : '#fff' }]}
                mode="outlined"
                underlineColor={PRIMARY_COLOR}
                selectionColor={PRIMARY_COLOR}
                theme={{
                  colors: {
                    text: isDarkMode ? '#fff' : '#000',
                    placeholder: isDarkMode ? '#b0b0b0' : undefined,
                    onSurfaceVariant: isDarkMode ? '#b0b0b0' : undefined,
                    primary: PRIMARY_COLOR,
                    background: isDarkMode ? '#181A20' : '#fff',
                    onSurface: isDarkMode ? '#fff' : '#000',
                  },
                }}
                placeholderTextColor={isDarkMode ? '#b0b0b0' : undefined}
                inputMode="text"
                placeholder="Nuova password"
              />
              <TextInput
                label="Conferma nuova password"
                secureTextEntry
                value={confermaPassword}
                onChangeText={setConfermaPassword}
                style={[styles.textInput, { backgroundColor: isDarkMode ? '#181A20' : '#fff' }]}
                mode="outlined"
                underlineColor={PRIMARY_COLOR}
                selectionColor={PRIMARY_COLOR}
                theme={{
                  colors: {
                    text: isDarkMode ? '#fff' : '#000',
                    placeholder: isDarkMode ? '#b0b0b0' : undefined,
                    onSurfaceVariant: isDarkMode ? '#b0b0b0' : undefined,
                    primary: PRIMARY_COLOR,
                    background: isDarkMode ? '#181A20' : '#fff',
                    onSurface: isDarkMode ? '#fff' : '#000',
                  },
                }}
                placeholderTextColor={isDarkMode ? '#b0b0b0' : undefined}
                inputMode="text"
                placeholder="Conferma nuova password"
              />
              <Button mode="contained" onPress={cambiaPassword} style={{ marginTop: 10 }}>
                Cambia password
              </Button>
            </View>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.sectionCard}>
        <Card.Title
          title="Altro"
          titleStyle={{ color: textColor }}
          left={(props) => <MaterialCommunityIcons name="dots-horizontal" size={24} color={PRIMARY_COLOR} />}
        />
        <Card.Content>
          <List.Item
            title="Tema scuro"
            titleStyle={{ color: textColor }}
            left={(props) => (
              <List.Icon
                {...props}
                icon={isDarkMode ? 'weather-night' : 'white-balance-sunny'}
                color={isDarkMode ? '#fff' : props.color}
              />
            )}
            right={() => (
              <Switch
                value={isDarkMode}
                onValueChange={toggleTheme}
                color={PRIMARY_COLOR}
              />
            )}
          />
          <List.Item
            title="Logout"
            titleStyle={{ color: '#f44336', fontWeight: 'bold' }} // testo rosso e in grassetto
            left={(props) => (
              <List.Icon {...props} icon="logout" color="#f44336" /> // icona rossa
            )}
            onPress={handleLogout}
          />
          <Divider style={{ marginVertical: 10 }} />
          <List.Item
            title="Elimina account"
            description="Questa azione non è reversibile"
            titleStyle={{ color: '#d32f2f', fontWeight: 'bold' }}
            descriptionStyle={{ color: isDarkMode ? '#ccc' : '#666' }}
            left={(props) => (
              <List.Icon {...props} icon="account-remove" color="#d32f2f" />
            )}
            onPress={() => setDeleteDialogVisible(true)}
          />
        </Card.Content>

      </Card>

      <Portal>
        <Dialog
          visible={logoutDialogVisible}
          onDismiss={() => setLogoutDialogVisible(false)}
          style={{ backgroundColor: isDarkMode ? '#121212' : '#fff' }}
        >
          <Dialog.Title style={{ color: isDarkMode ? '#fff' : '#000' }}>
            Conferma logout
          </Dialog.Title>
          <Dialog.Content>
            <Paragraph style={{ color: isDarkMode ? '#ccc' : '#333' }}>
              Sei sicuro di voler effettuare il logout?
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setLogoutDialogVisible(false)}
              textColor={PRIMARY_COLOR}  // verde primario
            >
              Annulla
            </Button>
            <Button
              onPress={forceLogout}
              textColor="#f44336" // rosso vivo
            > Logout
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={deleteDialogVisible}
          onDismiss={() => setDeleteDialogVisible(false)}
          style={{ backgroundColor: isDarkMode ? '#121212' : '#fff' }}
        >
          <Dialog.Title style={{ color: isDarkMode ? '#fff' : '#000' }}>
            Conferma eliminazione account
          </Dialog.Title>
          <Dialog.Content>
            <Paragraph style={{ color: isDarkMode ? '#ccc' : '#333', marginBottom: 8 }}>
              L'account verrà  disabilitato e i dati principali anonimizzati.
            </Paragraph>
            <Paragraph style={{ color: isDarkMode ? '#ccc' : '#333', marginBottom: 12 }}>
              Digita "ELIMINA" per confermare:
            </Paragraph>
            <TextInput
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              mode="outlined"
              placeholder="ELIMINA"
              style={{ backgroundColor: isDarkMode ? '#181A20' : '#fff' }}
              theme={{
                colors: {
                  text: isDarkMode ? '#fff' : '#000',
                  primary: PRIMARY_COLOR,
                  background: isDarkMode ? '#181A20' : '#fff',
                  onSurface: isDarkMode ? '#fff' : '#000',
                },
              }}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)} textColor={PRIMARY_COLOR}>
              <Text style={{ color: PRIMARY_COLOR, fontWeight: "600" }}>Annulla</Text>
            </Button>
            <Button onPress={eliminaAccount} textColor="#d32f2f">
              <Text style={{ color: "#d32f2f", fontWeight: "600" }}>Elimina</Text>
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileCard: {
    margin: 10,
  },
  profileContent: {
    paddingVertical: 4,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 16,
  },
  profileHeaderCompact: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    columnGap: 12,
    rowGap: 8,
    width: '100%',
  },
  profileAvatar: {
    elevation: 0,
    marginRight: 16,
  },
  profileAvatarCompact: {
    marginBottom: 0,
  },
  profileInfo: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  profileInfoCompact: {
    marginTop: 4,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  email: {
    fontSize: 16,
  },
  roleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 12,
    rowGap: 6,
    marginTop: 8,
  },
  roleContainerCompact: {
    marginTop: 10,
    width: '100%',
  },
  role: {
    fontWeight: 'bold',
    marginRight: 5,
  },
  userTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userTypeBadge: {
    width: 15,
    height: 15,
    borderRadius: 7,
    marginLeft: 5,
  },
  badgeAmministratore: {
    backgroundColor: '#BB86FC',
  },
  badgeOperatore: {
    backgroundColor: '#03DAC5',
  },
  badgeOperatoreCentro: {
    backgroundColor: '#e7dc12ff',
  },
  badgePrivato: {
    backgroundColor: '#4CAF50',
  },
  badgeSociale: {
    backgroundColor: '#2196F3',
  },
  badgeRiciclo: {
    backgroundColor: '#FF9800',
  },
  sectionCard: {
    marginHorizontal: 10,
    marginVertical: 5,
  },
  textInput: {
    marginBottom: 10,
  },
});


