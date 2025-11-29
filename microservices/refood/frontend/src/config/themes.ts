// src/config/themes.ts
import {
  MD3LightTheme as DefaultPaperTheme,
  MD3DarkTheme as DarkPaperTheme,
} from 'react-native-paper';
import merge from 'deepmerge';
import { PRIMARY_COLOR } from './constants'; // Assicurati che PRIMARY_COLOR sia definito qui (es. #4CAF50)

export const CombinedDefaultTheme = merge(DefaultPaperTheme, {
  colors: {
    primary: PRIMARY_COLOR, // Il tuo verde scuro (es. #4CAF50)
    onPrimary: '#ffffff', // Testo/icone su primary
    primaryContainer: '#c6e8e0', // Contenitori primari chiari
    onPrimaryContainer: '#00201c',

    secondary: '#6200ee', // Viola scuro
    onSecondary: '#ffffff',
    secondaryContainer: '#eaddff',
    onSecondaryContainer: '#21005d',

    tertiary: '#008855', // Un verde/blu per Centro Sociale
    onTertiary: '#ffffff',
    tertiaryContainer: '#b6f2e2',
    onTertiaryContainer: '#002018',

    error: '#d32f2f', // Rosso per errori
    onError: '#ffffff', // Testo/icone su errore
    errorContainer: '#ffebee', // Sfondo per messaggi di errore (chiaro)
    onErrorContainer: '#d32f2f', // Testo su sfondo errore (scuro)

    background: '#f0f0f0', // Sfondo molto chiaro (quasi bianco)
    onBackground: '#000000', // Testo/icone su sfondo (nero)

    surface: '#ffffff', // Superfici delle Card (bianco)
    onSurface: '#000000', // Testo/icone su superficie (nero)
    surfaceVariant: '#e0e0e0', // Variante della superficie (es. per TextInput o Searchbar background in light mode)
    onSurfaceVariant: '#444444', // Testo/icone su surfaceVariant

    outline: '#cccccc', // Colore per bordi sottili
    outlineVariant: '#bbbbbb', // Colore per elementi meno prominenti, come bordi disabilitati

    inversePrimary: '#82b99a', // Colore inverso o complementare, utile per icone su sfondi primari scuri nel tema chiaro
    inverseSurface: '#303030', // Superficie scura per testo chiaro
    inverseOnSurface: '#ffffff', // Testo chiaro su superficie scura

    backdrop: 'rgba(0, 0, 0, 0.5)', // Sfondo per modali/sheet
    // Queste sono per la compatibilità con vecchie versioni o componenti non MD3
    text: '#000000',
    placeholder: '#888888',
    disabled: '#aaaaaa',
    onDisabled: '#666666',
    onDisabledContainer: '#999999',
  },
});

export const CombinedDarkTheme = merge(DarkPaperTheme, {
  colors: {
    primary: '#66bb6a', // Un verde più chiaro per il tema scuro
    onPrimary: '#000000', // Testo/icone su primary (nero per contrasto su verde chiaro)
    primaryContainer: '#00524a',
    onPrimaryContainer: '#a8dcd4',

    secondary: '#bb86fc', // Viola più chiaro
    onSecondary: '#000000',
    secondaryContainer: '#4a3770',
    onSecondaryContainer: '#eaddff',

    tertiary: '#4dd0e1', // Un azzurro/verde chiaro per Centro Sociale nel tema scuro
    onTertiary: '#000000',
    tertiaryContainer: '#00524a',
    onTertiaryContainer: '#b6f2e2',

    error: '#ef5350', // Rosso per errori
    onError: '#000000', // Testo/icone su errore
    errorContainer: '#6b0000', // Sfondo per messaggi di errore (scuro)
    onErrorContainer: '#ffbaba', // Testo su sfondo errore (chiaro)

    background: '#121212', // Sfondo scuro (quasi nero)
    onBackground: '#ffffff', // Testo/icone su sfondo (bianco)

    surface: '#1e1e1e', // Superfici delle Card (grigio scuro)
    onSurface: '#ffffff', // Testo/icone su superficie (bianco)
    surfaceVariant: '#303030', // Variante della superficie (es. per TextInput o Searchbar background in dark mode)
    onSurfaceVariant: '#bbbbbb', // Testo/icone su surfaceVariant (grigio chiaro)

    outline: '#555555', // Bordi più scuri
    outlineVariant: '#333333', // Elementi meno prominenti, come bordi disabilitati

    inversePrimary: '#4dd0e1', // Un colore complementare chiaro
    inverseSurface: '#e0e0e0', // Superficie chiara per testo scuro
    inverseOnSurface: '#000000', // Testo scuro su superficie chiara

    backdrop: 'rgba(0, 0, 0, 0.75)',
    // Compatibilità
    text: '#ffffff',
    placeholder: '#aaaaaa',
    disabled: '#777777',
    onDisabled: '#cccccc',
    onDisabledContainer: '#666666',
  },
});