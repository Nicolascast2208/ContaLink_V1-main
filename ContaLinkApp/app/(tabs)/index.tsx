import { useState, useEffect } from 'react';
import { LogBox } from 'react-native';
import { onAuthStateChanged, User } from 'firebase/auth';

// Importamos la configuración y las pantallas
import { auth } from '../../utils/firebaseconfig';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';

// Ignorar advertencias
LogBox.ignoreLogs(['AsyncStorage has been extracted', 'Setting a timer']);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (initializing) setInitializing(false);
    });
    return unsubscribe;
  }, [initializing]);

  if (initializing) return null;

  if (!user) {
    return <LoginScreen />;
  }

  return <HomeScreen user={user} />;
}