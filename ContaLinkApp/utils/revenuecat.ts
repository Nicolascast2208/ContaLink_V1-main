import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

const API_KEY = 'test_hrnjpWtcViWlcWmuaSobHTEOgLV';

export const configureRevenueCat = () => {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);

    if (Platform.OS === 'ios') {
        Purchases.configure({ apiKey: API_KEY });
    } else if (Platform.OS === 'android') {
        // Si más adelante añades API key de Android, agrégala aquí. Por ahora usamos la misma o puedes omitirla si test_hrnjpWtcViWlcWmuaSobHTEOgLV es para ambas, aunque usualmente son distintas.
        // Usaremos la proporcionada para Android por compatibilidad, pero en PRD asgúrate de usar la llave de Google Play
        Purchases.configure({ apiKey: API_KEY });
    }
};
