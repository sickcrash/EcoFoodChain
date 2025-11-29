import { StyleSheet } from 'react-native';

/**
 * Shared button layout for call-to-actions placed inside cards.
 * Mantiene proporzioni coerenti tra schermate diverse.
 */
const cardActionStyles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    width: '100%',
    marginHorizontal: -4,
  },
  button: {
    flexGrow: 1,
    flexShrink: 1,
    borderRadius: 14,
    marginHorizontal: 4,
    marginVertical: 4,
  },
  buttonFullWidth: {
    flexBasis: '100%',
  },
  content: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default cardActionStyles;

